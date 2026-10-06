// «التعديل الذكي» of a JAWAD AI video (or a film video sent there) opens in «الممنتج الذكي»: a new edit with the
// video on the main track, an empty red track for the pieces to fix and a green one for what is made. Server only.

import type { User } from "@supabase/supabase-js";
import { UserError } from "@/lib/api";
import { getOwnedProject } from "@/lib/film/access";
import { directorAction } from "@/lib/film/director";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/jawad/server/uploads";
import { assetViews, createEditorProject, importAssets, requireEditorProject, runCommands, stillOpen, type EditorProject } from "./server";
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

/**
 * A film video in an edit (the film maker's «المونتاج» step) has no JAWAD AI job yet: it gets one (the same as the
 * film's «التعديل الذكي» button makes), so its red pieces can be made again. Returns the asset as the page sees it.
 */
export async function linkForFix(p: EditorProject, user: User, b: { assetId?: unknown }) {
  stillOpen(p);
  if (!isUuid(b.assetId)) throw new UserError("طلب غير صحيح.", 400);
  const { data: row } = await db().from("editor_assets").select("id,origin,meta").eq("id", b.assetId).eq("project_id", p.id).maybeSingle();
  if (!row) throw new UserError("ما لقينا الملف.", 404);
  const meta = (row.meta ?? {}) as Record<string, unknown>;
  if (typeof meta.jobId === "string") return (await assetViews(p.id)).find((a) => a.id === row.id)!;
  if (row.origin !== "film" || typeof meta.sourceId !== "string") throw new UserError("هذا المقطع مو من فيديو صنعته في «الجواد الذكي!» أو صانع الفيلم؛ ما يقدر يتعاد.", 400);
  const { data: fa } = await db().from("film_assets").select("project_id").eq("id", meta.sourceId).maybeSingle();
  if (!fa) throw new UserError("فيديو الفيلم ما عاد موجود.", 404);
  const film = await getOwnedProject(fa.project_id, user.id);
  const { studioJobId } = await directorAction(film, user, { action: "send_to_studio", assetId: meta.sourceId });
  if (!studioJobId) throw new UserError("تعذّر تجهيز الفيديو للتعديل.", 500);
  const { data: out } = await db().from("jawad_outputs").select("id").eq("job_id", studioJobId).eq("kind", "video").order("idx", { ascending: true }).limit(1).maybeSingle();
  if (!out) throw new UserError("تعذّر تجهيز الفيديو للتعديل.", 500);
  await db().from("editor_assets").update({ meta: { ...meta, jobId: studioJobId, outputId: out.id } }).eq("id", row.id);
  return (await assetViews(p.id)).find((a) => a.id === row.id)!;
}
