// «رجّع مبلغ كلود» (the owner, 13 November 2026: «إذا كلاود كتب البرومبت وصار مشكلة في المولد إن مبلغ الأداة خلص من جهتنا،
// يسترجع لهم رصيد كلود اللي انسحب»): when a generation fails because of the PLATFORM's own account at the provider (its
// balance, billing or key — lib/platform-fault), the Claude reply that wrote that generation's prompt is given back too,
// not only the generation itself (finishJob / failJob already give that back).
//   • a robot's turn (robotTurn, claudeCharged) collects the studio jobs it creates; once its charge is settled each job
//     gets a «claude_prompt» event with the turn's ledger ref (an event, not the job's inputs: the job's runner rewrites
//     those), and a job that fails through our account gives the whole turn back;
//   • the film maker: the director's and the sheet maker's replies write their job id into the version they deliver, and
//     a video or picture made from that version that fails through our account gives that reply back.
// A reply whose result already came out (any of its generations succeeded) is kept: it did its work. Server only.

import { AsyncLocalStorage } from "node:async_hooks";
import { createAdminClient } from "@/lib/supabase/admin";
import { refundCharge } from "@/lib/coins";
import { isPlatformFault } from "@/lib/platform-fault";

const db = () => createAdminClient();
const made = new AsyncLocalStorage<string[]>();

/** Runs a Claude turn while collecting the studio jobs it creates (their ids land in `into`). */
export const collectJobs = <T>(into: string[], run: () => Promise<T>): Promise<T> => made.run(into, run);

/** A studio job was created: the Claude turn around it (if any) will link itself to it. */
export function noteJob(jobId: string) {
  made.getStore()?.push(jobId);
}

/** The text of a failure, whatever shape it came in (an Error, a provider's error with its detail, a string). */
export function failureText(err: unknown): string {
  if (err == null) return "";
  if (typeof err === "string") return err;
  const o = err as { message?: unknown; detail?: unknown; userMessage?: unknown; code?: unknown };
  return [o.message, o.userMessage, o.detail, o.code].filter((x) => typeof x === "string" && x).join(" ") || String(err);
}

const LINK = "claude_prompt";

/** A studio job's status and failure, or null. */
async function studioJob(id: string) {
  const { data } = await db().from("jawad_jobs").select("status,error_message,error_detail").eq("id", id).maybeSingle();
  return data as { status: string; error_message: string | null; error_detail: string | null } | null;
}

/**
 * After a PAID turn was settled: each job it created is linked to its ref. A job that already failed through our account
 * (it may have, while the turn was still talking) gives the turn back now.
 */
export async function linkTurnJobs(ref: string, jobIds: string[]) {
  const ids = [...new Set(jobIds)];
  if (!ids.length) return;
  const { error } = await db().from("jawad_job_events").insert(ids.map((id) => ({ job_id: id, type: LINK, detail: { ref } })));
  if (error) throw error;
  // read after the link is written: a job that ended before it is caught here, one that ends after it by finishJob
  for (const id of ids) {
    const j = await studioJob(id);
    if (j?.status === "failed" && isPlatformFault(`${j.error_detail ?? ""} ${j.error_message ?? ""}`)) {
      await giveTurnBack(ref);
      return;
    }
  }
}

/** A turn's ref is given back unless one of its jobs succeeded (then the prompt did its work). */
async function giveTurnBack(ref: string) {
  const { data } = await db().from("jawad_job_events").select("job_id").eq("type", LINK).eq("detail->>ref", ref);
  const ids = [...new Set((data ?? []).map((e) => e.job_id as string))];
  if (ids.length) {
    const { count } = await db().from("jawad_jobs").select("id", { count: "exact", head: true }).in("id", ids).eq("status", "succeeded");
    if ((count ?? 0) > 0) return;
  }
  const back = await refundCharge(ref, "رجع مبلغ كلود: التوليد فشل من جهة المنصة");
  if (back > 0) console.warn("prompt refunded (platform account)", ref, back);
}

/** A studio job failed: when it was our account, the Claude turn that wrote its prompt is given back. */
export async function refundPromptOfStudioJob(jobId: string, why: string) {
  if (!isPlatformFault(why)) return;
  const { data } = await db().from("jawad_job_events").select("detail").eq("job_id", jobId).eq("type", LINK).limit(1).maybeSingle();
  const ref = (data?.detail as { ref?: unknown } | null)?.ref;
  if (typeof ref === "string" && ref) await giveTurnBack(ref);
}

/**
 * A film generation (a video, a sheet picture) failed: when it was our account, the reply that wrote its version's prompt
 * (its film job, in the version's `data.job_id`) is given back — unless something from that reply already came out.
 */
export async function refundPromptOfFilmJob(jobId: string, why: string) {
  if (!isPlatformFault(why)) return;
  const { data: job } = await db().from("film_jobs").select("asset_id,service").eq("id", jobId).maybeSingle();
  if (!job?.asset_id || job.service === "anthropic") return;
  const { data: asset } = await db().from("film_assets").select("version_id,project_id").eq("id", job.asset_id).maybeSingle();
  if (!asset?.version_id) return;
  const { data: v } = await db().from("film_versions").select("data").eq("id", asset.version_id).maybeSingle();
  const reply = (v?.data as { job_id?: unknown } | null)?.job_id;
  if (typeof reply !== "string" || !reply) return;
  // every version that reply wrote (a batch writes several), and whether anything made from them came out
  const { data: vs } = await db().from("film_versions").select("id").eq("project_id", asset.project_id).eq("data->>job_id", reply);
  const ids = (vs ?? []).map((x) => x.id as string);
  if (ids.length) {
    const { count } = await db().from("film_assets").select("id", { count: "exact", head: true }).in("version_id", ids).not("storage_path", "is", null);
    if ((count ?? 0) > 0) return;
  }
  const back = await refundCharge(reply, "رجع مبلغ كلود: التوليد فشل من جهة المنصة");
  if (back > 0) console.warn("film prompt refunded (platform account)", reply, back);
}
