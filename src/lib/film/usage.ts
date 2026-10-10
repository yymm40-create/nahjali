import { createAdminClient } from "@/lib/supabase/admin";
import { refundCoins, reserveCoins, reserveTeamCoins, settleCoins } from "@/lib/coins";
import { giveAttempt, teamPayment, teamSeriesOf } from "./team";

/** What a coin movement says in the user's history. */
const COIN_LABELS: Record<string, string> = {
  screenwriter: "رد السيناريست",
  sheets: "رد صانع الشيت",
  sheet_image: "صورة شيت",
  director: "رد المخرج",
  director_video: "فيديو",
  voice_line: "صوت جملة (ElevenLabs)",
  sajjad: "سؤال لسجاد",
};
import type { FilmJob, FilmService } from "./types";

const RIYADH_MS = 3 * 3600_000;

/** Midnight today in Riyadh (UTC+3), as a UTC date. */
export function riyadhDayStart(now = new Date()) {
  const r = new Date(now.getTime() + RIYADH_MS);
  return new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth(), r.getUTCDate()) - RIYADH_MS);
}

/** First day of this month in Riyadh, as a UTC date. */
export function riyadhMonthStart(now = new Date()) {
  const r = new Date(now.getTime() + RIYADH_MS);
  return new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth(), 1) - RIYADH_MS);
}

interface UsageRow {
  state: "reserved" | "settled" | "released";
  estimated_cost_usd: number | string;
  actual_cost_usd: number | string | null;
}

/** What a ledger row counts for: real cost once settled, the estimate while reserved, nothing once released. */
export const rowCost = (r: UsageRow) =>
  r.state === "released" ? 0 : r.state === "settled" ? Number(r.actual_cost_usd ?? r.estimated_cost_usd) : Number(r.estimated_cost_usd);

export interface StartJobInput {
  projectId: string;
  user: { id: string; email?: string | null };
  service: FilmService;
  operation: string;
  /** Same key = same request: a repeat (double click, retry after a crash) never creates a second job or charge. */
  idempotencyKey: string;
  estimateUsd: number;
  units: number;
  unit: string;
  assetId?: string | null;
}

/** Who pays for a project's operations: its owner (a team member working on the owner's scene uses the owner's coins). */
export async function payerOf(projectId: string, actor: { id: string; email?: string | null }): Promise<{ id: string; email?: string | null }> {
  const db = createAdminClient();
  const { data } = await db.from("film_projects").select("user_id").eq("id", projectId).maybeSingle();
  const owner = data?.user_id as string | undefined;
  if (!owner || owner === actor.id) return actor;
  const { data: u } = await db.auth.admin.getUserById(owner);
  return { id: owner, email: u.user?.email ?? null };
}

/**
 * Creates a job and reserves its estimated cost. If a job with this key already exists it is returned
 * as is (created: false) and nothing new is reserved.
 */
export async function startJob(input: StartJobInput): Promise<{ job: FilmJob; created: boolean }> {
  const db = createAdminClient();
  const existing = await db.from("film_jobs").select("*").eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (existing.data) return { job: existing.data as FilmJob, created: false };

  // «المسلسل الذكي» in team mode: the member must have this step and an attempt left; the team's wallet pays
  const team = await teamPayment(input.projectId, input.user.id, input.operation);
  const { data, error } = await db
    .from("film_jobs")
    .insert({
      project_id: input.projectId,
      user_id: input.user.id,
      asset_id: input.assetId ?? null,
      service: input.service,
      operation: input.operation,
      idempotency_key: input.idempotencyKey,
      status: "running",
      attempts: 1,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) {
    // Another request inserted the same key a moment ago
    if (team?.took) await giveAttempt(team.id, input.user.id);
    if (error.code === "23505") {
      const again = await db.from("film_jobs").select("*").eq("idempotency_key", input.idempotencyKey).single();
      return { job: again.data as FilmJob, created: false };
    }
    throw error;
  }

  const job = data as FilmJob;
  // a scene's usage counts for its owner (the series' owner), whoever presses
  const payer = await payerOf(input.projectId, input.user);
  const { error: e2 } = await db.from("film_usage").insert({
    user_id: payer.id,
    project_id: input.projectId,
    job_id: job.id,
    service: input.service,
    operation: input.operation,
    units: input.units,
    unit: input.unit,
    estimated_cost_usd: input.estimateUsd,
    state: "reserved",
  });
  if (e2) {
    await db.from("film_jobs").update({ status: "failed", error: "usage reservation failed", finished_at: new Date().toISOString() }).eq("id", job.id);
    if (team?.took) await giveAttempt(team.id, input.user.id);
    throw e2;
  }
  // «النقود الذكية»: hold the operation's coins (when coins are required); a short balance cancels the job
  try {
    const label = COIN_LABELS[input.operation] ?? input.operation;
    // Claude's own work (the screenwriter, the sheets maker, the director's replies, سجاد) costs its real usage + 10%
    const claude = input.service === "anthropic";
    if (team) await reserveTeamCoins(team.id, input.user, job.id, input.estimateUsd, label, claude);
    else await reserveCoins(payer, job.id, input.estimateUsd, label, claude);
  } catch (e) {
    await failJob(job.id, e);
    throw e;
  }
  return { job, created: true };
}

/** Success: the job is done and its real cost replaces the estimate. */
export async function succeedJob(jobId: string, actual: { costUsd: number; units?: number; providerTaskId?: string | null }) {
  const db = createAdminClient();
  const { data: kind } = await db.from("film_jobs").select("service").eq("id", jobId).maybeSingle();
  await settleCoins(jobId, actual.costUsd, kind?.service === "anthropic").catch((e) => console.error("coin settle failed", e));
  const now = new Date().toISOString();
  await db
    .from("film_jobs")
    .update({ status: "succeeded", finished_at: now, error: null, ...(actual.providerTaskId ? { provider_task_id: actual.providerTaskId } : {}) })
    .eq("id", jobId);
  await db
    .from("film_usage")
    .update({ state: "settled", actual_cost_usd: actual.costUsd, settled_at: now, ...(actual.units != null ? { units: actual.units } : {}) })
    .eq("job_id", jobId)
    .eq("state", "reserved");
}

/**
 * Failure: nothing is charged against any cap. If the provider still billed something (e.g. a reply
 * cut off half-way), that real amount is kept in actual_cost_usd for the owner's records only.
 */
export async function failJob(jobId: string, error: unknown, providerCostUsd?: number) {
  await refundCoins(jobId).catch((e) => console.error("coin refund failed", e));
  const db = createAdminClient();
  // a team member's failed attempt is given back
  const { data: j } = await db.from("film_jobs").select("project_id,user_id,status").eq("id", jobId).maybeSingle();
  if (j && j.status !== "failed") {
    const { data: fp } = await db.from("film_projects").select("user_id,series_id").eq("id", j.project_id).maybeSingle();
    const series = fp ? await teamSeriesOf(fp).catch(() => null) : null;
    if (series && j.user_id !== series.ownerId) await giveAttempt(series.id, j.user_id as string).catch(() => {});
  }
  const now = new Date().toISOString();
  const message = String(
    error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? (error as { message: unknown }).message : error,
  ).slice(0, 1000);
  await db.from("film_jobs").update({ status: "failed", finished_at: now, error: message }).eq("id", jobId);
  await db
    .from("film_usage")
    .update({ state: "released", settled_at: now, ...(providerCostUsd ? { actual_cost_usd: providerCostUsd } : {}) })
    .eq("job_id", jobId)
    .eq("state", "reserved");
}

/** A job still "running" after this long died with its server request (the routes live up to 800 s); it is failed and released. */
export const JOB_STALE_MS = 15 * 60_000;

/** Total real + reserved cost of one project (shown on the project page). */
export async function projectCost(projectId: string) {
  const { data } = await createAdminClient()
    .from("film_usage")
    .select("state,estimated_cost_usd,actual_cost_usd,service")
    .eq("project_id", projectId);
  const rows = (data ?? []) as (UsageRow & { service: string })[];
  const byService: Record<string, number> = {};
  for (const r of rows) byService[r.service] = (byService[r.service] ?? 0) + rowCost(r);
  return { total: rows.reduce((s, r) => s + rowCost(r), 0), byService };
}
