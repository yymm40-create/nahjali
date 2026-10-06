// «التعديل الذكي» of a JAWAD AI video (or a film video sent there) opens in «الممنتج الذكي»: a new edit with the
// video on the main track, an empty red track for the pieces to fix and a green one for what is made. Server only.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/jawad/server/uploads";
import { createEditorProject, importAssets, requireEditorProject, runCommands } from "./server";
import { RATIOS, type Ratio } from "./model";

const db = () => createAdminClient();

/** The project shape closest to the video's own. */
export function nearestRatio(w: number | null, h: number | null): Ratio {
  if (!w || !h) return "16:9";
  const want = Math.log(w / h);
  return (Object.keys(RATIOS) as Ratio[]).sort((a, b) => Math.abs(Math.log(RATIOS[a].width / RATIOS[a].height) - want) - Math.abs(Math.log(RATIOS[b].width / RATIOS[b].height) - want))[0];
}

export async function openSmartEdit(user: { id: string }, b: { jobId?: unknown; outputId?: unknown }) {
  if (!isUuid(b.jobId)) throw new UserError("طلب غير صحيح.", 400);
  const { data: job } = await db().from("jawad_jobs").select("id,user_id,status,output_kind,prompt,inputs").eq("id", b.jobId).eq("user_id", user.id).maybeSingle();
  if (!job || job.status !== "succeeded" || job.output_kind !== "video") throw new UserError("ما لقينا هذا الفيديو.", 404);
  let q = db().from("jawad_outputs").select("id,kind,width,height,duration_ms").eq("job_id", job.id).eq("user_id", user.id).eq("kind", "video");
  if (isUuid(b.outputId)) q = q.eq("id", b.outputId);
  const { data: outs } = await q.order("created_at", { ascending: true }).limit(1);
  const out = outs?.[0];
  if (!out) throw new UserError("ما لقينا هذا الفيديو.", 404);

  const ratio = nearestRatio(out.width, out.height);
  const words = String(job.prompt ?? "").replace(/\s+/g, " ").trim().slice(0, 50);
  const id = await createEditorProject(user.id, { title: `التعديل الذكي${words ? ` · ${words}` : ""}`, kind: ratio === "9:16" ? "reel" : "horizontal" });
  const p = await requireEditorProject(id, user.id);
  const durationMs = Number(out.duration_ms) || Number((job.inputs as { settings?: { duration?: unknown } })?.settings?.duration ?? 0) * 1000 || 10_000;
  const [asset] = await importAssets(p, { items: [{ source: "jawad", id: out.id, durationMs, width: out.width, height: out.height, name: "الفيديو الأصلي" }] });
  await runCommands(
    p,
    [
      { type: "set_ratio", ratio },
      { type: "set_magnetic", on: false },
      { type: "add_clip", assetId: asset.id },
      { type: "add_track", kind: "video", role: "fix" },
      { type: "add_track", kind: "video", role: "fixed" },
    ],
    "smart_edit",
  );
  return id;
}
