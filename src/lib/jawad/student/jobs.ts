// «الطالب الذكي» — long, paid steps as resumable jobs. Server only.
//
// • The same idempotency key is the same job: a repeated click (or a retry after a lost connection) never runs or
//   charges twice.
// • Coins: the ceiling is held when the job is created (or it is refused clearly), the real cost is settled when it
//   succeeds, and everything is given back when it fails (lib/coins: reserve → settle → refund; the owner and the
//   free-trial switch are honoured there).
// • Work is cut into steps (a few PDF pages, one part of a book…). A run does steps until its time is nearly up and
//   leaves the job queued; the next poll (or the daily cron) continues it from the saved progress.

import { after } from "next/server";
import { UserError } from "@/lib/api";
import { coinsRequired, refundCoins, releaseCoins, reserveCoins, settleCoins } from "@/lib/coins";
import { coinsFor } from "@config/coins";
import { unlimitedFor } from "@/lib/access";
import { STUDENT } from "@config/jawad/student";
import { sdb } from "./db";
import { HANDLERS } from "./handlers";

export interface Job {
  id: string;
  user_id: string;
  project_id: string;
  output_id: string | null;
  kind: string;
  status: "queued" | "running" | "succeeded" | "failed";
  stage: string;
  progress: Record<string, unknown>;
  input: Record<string, unknown>;
  result: unknown;
  error: string | null;
  estimate_usd: number;
  cost_usd: number;
  lease_until: string | null;
  attempts: number;
  created_at: string;
}

export interface StepResult {
  done: boolean;
  usd?: number;
  stage?: string;
  progress?: Record<string, unknown>;
  result?: unknown;
}

export interface Handler {
  label: string;
  step: (job: Job) => Promise<StepResult>;
  /** After the last step succeeded (the job's cost is settled first). */
  onSuccess?: (job: Job) => Promise<void>;
  /** After a failure (coins already refunded): leave the project/output in a state the student can retry from. */
  onFail?: (job: Job, message: string) => Promise<void>;
}

const KEY = /^[A-Za-z0-9_-]{8,80}$/;
const RUN_BUDGET_MS = 150_000;
const LEASE_MS = 330_000;
// Runs (not steps): a long job (a big PDF, a long book) takes many steps but only a few runs of 150 s each
const MAX_RUNS = 60;

export function checkKey(key: unknown): string {
  const k = String(key ?? "");
  if (!KEY.test(k)) throw new UserError("طلب غير صالح، حدّث الصفحة وجرّب مرة ثانية.", 400);
  return k;
}

/** Creates (or returns the existing) job, holds its coins, and starts it after the response. */
export async function createJob(
  user: { id: string; email?: string | null },
  o: { projectId: string; outputId?: string | null; kind: string; key: string; input?: Record<string, unknown>; estimateUsd: number; stage?: string },
): Promise<{ job: Job; created: boolean }> {
  const handler = HANDLERS[o.kind];
  if (!handler) throw new Error(`unknown student job ${o.kind}`);
  const db = sdb();
  const { data: existing } = await db.from("student_jobs").select("*").eq("user_id", user.id).eq("idempotency_key", o.key).maybeSingle();
  if (existing) return { job: existing as Job, created: false };

  // One open job per project at a time: outputs are made one after the other, in the student's order
  const { data: busy } = await db.from("student_jobs").select("id").eq("project_id", o.projectId).in("status", ["queued", "running"]).limit(1);
  if (busy?.length) throw new UserError("فيه عملية شغالة على هذه المادة، انتظر تخلص ثم كمّل.", 409);

  // Free trial (no coins taken): a daily ceiling per person, so nobody can repeat paid steps without end
  if (o.estimateUsd > 0 && !(await unlimitedFor(user.email)) && !(await coinsRequired())) {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: today } = await db.from("student_jobs").select("estimate_usd,cost_usd,status").eq("user_id", user.id).gte("created_at", since);
    const used = ((today ?? []) as { estimate_usd: number; cost_usd: number; status: string }[]).reduce(
      (s, j) => s + (j.status === "succeeded" ? Number(j.cost_usd) : j.status === "failed" ? 0 : Number(j.estimate_usd)),
      0,
    );
    if (used + o.estimateUsd > STUDENT.freeDailyUsd) throw new UserError("وصلت حد التجربة المجانية لليوم. كمّل بكرة إن شاء الله 🌙", 429);
  }

  const { data, error } = await db
    .from("student_jobs")
    .insert({
      user_id: user.id,
      project_id: o.projectId,
      output_id: o.outputId ?? null,
      kind: o.kind,
      idempotency_key: o.key,
      input: o.input ?? {},
      estimate_usd: o.estimateUsd,
      stage: o.stage ?? "في الطابور",
    })
    .select("*")
    .single();
  if (error) {
    // The same key sent twice at once: the other request created it
    const { data: again } = await db.from("student_jobs").select("*").eq("user_id", user.id).eq("idempotency_key", o.key).maybeSingle();
    if (again) return { job: again as Job, created: false };
    throw error;
  }
  const job = data as Job;
  try {
    if (o.estimateUsd > 0) await reserveCoins(user, job.id, o.estimateUsd, `الطالب الذكي · ${handler.label}`);
  } catch (e) {
    await db.from("student_jobs").delete().eq("id", job.id);
    throw e;
  }
  after(() => runJob(job.id));
  return { job, created: true };
}

/** Claims a job that is queued, or running with an expired lease (its worker stopped), and runs steps. */
export async function runJob(id: string) {
  const db = sdb();
  const now = new Date();
  const { data } = await db
    .from("student_jobs")
    .update({ status: "running", lease_until: new Date(now.getTime() + LEASE_MS).toISOString(), updated_at: now.toISOString() })
    .eq("id", id)
    .or(`status.eq.queued,and(status.eq.running,lease_until.lt.${now.toISOString()})`)
    .select("*")
    .maybeSingle();
  if (!data) return;
  let job = data as Job;
  const handler = HANDLERS[job.kind];
  const started = Date.now();
  try {
    if (job.attempts >= MAX_RUNS) throw new Error("too many runs");
    job = { ...job, attempts: job.attempts + 1 };
    await db.from("student_jobs").update({ attempts: job.attempts }).eq("id", id);
    for (;;) {
      const r = await handler.step(job);
      const patch = {
        cost_usd: Number(job.cost_usd) + (r.usd ?? 0),
        stage: r.stage ?? job.stage,
        progress: r.progress ?? job.progress,
        updated_at: new Date().toISOString(),
        ...(r.result !== undefined ? { result: r.result } : {}),
      };
      job = { ...job, ...patch };
      if (r.done) {
        await db.from("student_jobs").update({ ...patch, status: "succeeded", finished_at: new Date().toISOString(), lease_until: null }).eq("id", id);
        await settleCoins(job.id, Number(job.cost_usd));
        await creditTrial(job);
        await handler.onSuccess?.(job);
        return;
      }
      if (Date.now() - started > RUN_BUDGET_MS) {
        // Out of time for this run: queued again, continued by the next poll from the saved progress
        await db.from("student_jobs").update({ ...patch, status: "queued", lease_until: null }).eq("id", id);
        return;
      }
      await db.from("student_jobs").update(patch).eq("id", id);
    }
  } catch (e) {
    const message = e instanceof UserError ? e.message : "تعذّر إكمال هذه الخطوة. ما انخصم منك شيء، وتقدر تعيد المحاولة.";
    console.error("student job failed", job.kind, job.id, e);
    await db.from("student_jobs").update({ status: "failed", error: message, finished_at: new Date().toISOString(), lease_until: null }).eq("id", id);
    await refundCoins(job.id);
    await handler.onFail?.(job, message);
  }
}

/** Coins actually taken for a job (0 for the owner or while coins are not required). */
async function chargedCoins(jobId: string) {
  const { data } = await sdb().from("smart_coin_ledger").select("delta").eq("ref", jobId);
  return -((data ?? []) as { delta: number }[]).reduce((s, r) => s + r.delta, 0);
}

/**
 * A finished trial is taken off the final version's price (the owner's choice), once. The final already skips what
 * the trial made (its chapter / slides are kept, see outputs.ts), so that part is never charged twice; the refund
 * below is only for a final that had to make everything again (e.g. the design changed after the trial).
 */
async function creditTrial(job: Job) {
  if (job.kind === "trial" && job.output_id) {
    await sdb().from("student_outputs").update({ trial_coins: await chargedCoins(job.id) }).eq("id", job.output_id);
    return;
  }
  if (job.kind !== "final" || !job.output_id) return;
  if (job.input?.reusedTrial) {
    await sdb().from("student_outputs").update({ trial_coins: 0 }).eq("id", job.output_id);
    return;
  }
  const { data } = await sdb().from("student_outputs").select("trial_coins").eq("id", job.output_id).maybeSingle();
  const trial = (data?.trial_coins as number) ?? 0;
  if (trial <= 0) return;
  const paid = await chargedCoins(job.id);
  const credit = Math.min(trial, paid);
  await sdb().from("student_outputs").update({ trial_coins: 0 }).eq("id", job.output_id);
  if (credit > 0) await releaseCoins(job.user_id, credit, job.id, "الطالب الذكي · خصم النسخة التجريبية من السعر النهائي");
}

/** Moves the open jobs of a project (or all, from the cron) forward. Safe to call often: each claim is atomic. */
export async function advanceJobs(filter: { projectId?: string; userId?: string }, limit = 10) {
  let q = sdb().from("student_jobs").select("id,status,lease_until,updated_at").in("status", ["queued", "running"]);
  if (filter.projectId) q = q.eq("project_id", filter.projectId);
  if (filter.userId) q = q.eq("user_id", filter.userId);
  const { data } = await q.order("updated_at").limit(limit);
  const now = Date.now();
  for (const j of (data ?? []) as { id: string; status: string; lease_until: string | null; updated_at: string }[]) {
    const free = j.status === "queued" ? now - new Date(j.updated_at).getTime() > 3000 : !j.lease_until || new Date(j.lease_until).getTime() < now;
    if (free) after(() => runJob(j.id));
  }
}

export interface JobView {
  id: string;
  kind: string;
  outputId: string | null;
  status: Job["status"];
  stage: string;
  progress: Record<string, unknown>;
  error: string | null;
  coins: number;
}
export const jobView = (j: Job): JobView => ({
  id: j.id,
  kind: j.kind,
  outputId: j.output_id,
  status: j.status,
  stage: j.stage,
  progress: j.progress,
  error: j.error,
  coins: coinsFor(Number(j.estimate_usd) || 0),
});

export async function projectJobs(projectId: string, limit = 30): Promise<Job[]> {
  const { data } = await sdb().from("student_jobs").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as Job[];
}
