import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { advanceJob, hookTokenValid, loadJob } from "@/lib/jawad/server/jobs";
import { arkGetTask } from "@/lib/jawad/server/providers/modelark";
import { providerUserId } from "@/lib/jawad/server/providers/common";
import { isUuid } from "@/lib/jawad/server/uploads";

export const maxDuration = 300;

/**
 * JAWAD AI · BytePlus ModelArk's callback (callback_url): POSTed on every status change of a video task, and retried
 * for success/failure. The body is never trusted: it only tells us to look. We read the task from ModelArk ourselves
 * and move the job forward; duplicates and late deliveries change nothing (every step happens once).
 */
export async function POST(req: Request) {
  const p = new URL(req.url).searchParams;
  const jobId = p.get("job") ?? "";
  if (!isUuid(jobId) || !hookTokenValid(jobId, p.get("t") ?? "")) return NextResponse.json({ ok: false }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { id?: unknown };
  const job = await loadJob(jobId);
  if (!job) return NextResponse.json({ ok: true });
  const db = createAdminClient();
  await db.from("jawad_job_events").insert({ job_id: job.id, type: "callback", detail: { task: String(body.id ?? "").slice(0, 80) } });

  try {
    // Our creation answer was lost but the provider called back: link the task after checking it is really ours
    if (!job.provider_task_id && job.submit_state === "unknown" && typeof body.id === "string") {
      const t = await arkGetTask(body.id);
      if (t.safetyIdentifier === providerUserId(job.user_id) && t.model === job.model_id) {
        await db.from("jawad_jobs").update({ provider_task_id: t.id, submit_state: "accepted", status: "running", provider_status: t.status }).eq("id", job.id).is("provider_task_id", null);
      }
    }
    const fresh = await loadJob(job.id);
    if (fresh && (!fresh.provider_task_id || fresh.provider_task_id === body.id || typeof body.id !== "string")) await advanceJob(fresh, { force: true });
  } catch (e) {
    console.error("jawad callback failed", jobId, e);
  }
  // Always acknowledge quickly: the job's state does not depend on this delivery
  return NextResponse.json({ ok: true });
}
