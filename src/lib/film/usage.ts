import { createAdminClient } from "@/lib/supabase/admin";
import { UserError } from "@/lib/api";
import { isAdmin } from "@config/site";
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

export interface FilmCaps {
  daily_site_cap_usd: number;
  monthly_user_cap_usd: number;
}

export async function getCaps(): Promise<FilmCaps> {
  const { data } = await createAdminClient().from("film_settings").select("*").eq("id", true).maybeSingle();
  return {
    daily_site_cap_usd: Number(data?.daily_site_cap_usd ?? 30),
    monthly_user_cap_usd: Number(data?.monthly_user_cap_usd ?? 10),
  };
}

interface UsageRow {
  state: "reserved" | "settled" | "released";
  estimated_cost_usd: number | string;
  actual_cost_usd: number | string | null;
}

/** What a ledger row counts for: real cost once settled, the estimate while reserved, nothing once released. */
export const rowCost = (r: UsageRow) =>
  r.state === "released" ? 0 : r.state === "settled" ? Number(r.actual_cost_usd ?? r.estimated_cost_usd) : Number(r.estimated_cost_usd);

async function spentSince(since: Date, userId?: string) {
  let q = createAdminClient()
    .from("film_usage")
    .select("state,estimated_cost_usd,actual_cost_usd")
    .gte("created_at", since.toISOString())
    .neq("state", "released");
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q;
  return ((data ?? []) as UsageRow[]).reduce((s, r) => s + rowCost(r), 0);
}

/** Throws a clear Arabic message if this operation would pass the site's daily cap or the user's monthly cap. */
export async function assertWithinCaps(user: { id: string; email?: string | null }, estimateUsd: number) {
  const caps = await getCaps();
  const today = await spentSince(riyadhDayStart());
  if (today + estimateUsd > caps.daily_site_cap_usd) {
    throw new UserError(`وصلنا للحد اليومي للموقع ($${caps.daily_site_cap_usd}). جرّب بكرة إن شاء الله، أو ارفع الحد من لوحة التحكم.`, 429);
  }
  // The owner has no personal monthly cap; the daily site cap still protects the budget
  if (!isAdmin(user.email)) {
    const month = await spentSince(riyadhMonthStart(), user.id);
    if (month + estimateUsd > caps.monthly_user_cap_usd) {
      throw new UserError(`وصلت للحد الشهري لحسابك ($${caps.monthly_user_cap_usd}).`, 429);
    }
  }
}

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

/**
 * Creates a job and reserves its estimated cost. If a job with this key already exists it is returned
 * as is (created: false) and nothing new is reserved.
 */
export async function startJob(input: StartJobInput): Promise<{ job: FilmJob; created: boolean }> {
  const db = createAdminClient();
  const existing = await db.from("film_jobs").select("*").eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (existing.data) return { job: existing.data as FilmJob, created: false };

  await assertWithinCaps(input.user, input.estimateUsd);

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
    if (error.code === "23505") {
      const again = await db.from("film_jobs").select("*").eq("idempotency_key", input.idempotencyKey).single();
      return { job: again.data as FilmJob, created: false };
    }
    throw error;
  }

  const job = data as FilmJob;
  const { error: e2 } = await db.from("film_usage").insert({
    user_id: input.user.id,
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
    throw e2;
  }
  return { job, created: true };
}

/** Success: the job is done and its real cost replaces the estimate. */
export async function succeedJob(jobId: string, actual: { costUsd: number; units?: number; providerTaskId?: string | null }) {
  const db = createAdminClient();
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

/** Failure: nothing is charged against any cap. */
export async function failJob(jobId: string, error: unknown) {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const message = String(error instanceof Error ? error.message : error).slice(0, 1000);
  await db.from("film_jobs").update({ status: "failed", finished_at: now, error: message }).eq("id", jobId);
  await db.from("film_usage").update({ state: "released", settled_at: now }).eq("job_id", jobId).eq("state", "reserved");
}

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
