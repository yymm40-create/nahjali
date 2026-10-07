// «حيدرة كت» as the film maker's step after «الأصوات»: one edit per film project, with the film's approved
// videos in the director's order. Server only.

import type { User } from "@supabase/supabase-js";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { directorVersions, directorVideos } from "@/lib/film/director";
import { FILM_BUCKET, projectDir, type FilmProject } from "@/lib/film/types";
import { storage } from "@/lib/storage";
import { createEditorProject, importAssets, requireEditorProject, runCommands, assetInfo, assetViews, EDITOR_BUCKET } from "./server";
import { firstCut } from "./first-cut";
import { duration, readTimeline } from "./model";

const db = () => createAdminClient();

/** The film's approved generations, in the director's map order, each with its chosen video (if it is still kept). */
export async function filmCut(projectId: string) {
  const [versions, videos] = await Promise.all([directorVersions(projectId), directorVideos(projectId)]);
  const map = versions.filter((v) => v.kind === "dir_map" && v.status === "approved").at(-1)?.data.generation_map ?? [];
  const approved = versions.filter((v) => v.kind === "dir_generation" && v.status === "approved");
  const planOf = (g: string) => approved.filter((v) => v.ref_key === g).at(-1)?.data;
  const ids = [...new Set([...map.map((g) => g.id), ...approved.map((v) => v.ref_key)])].filter((g) => approved.some((v) => v.ref_key === g));
  return ids.map((g) => {
    const chosen = videos.filter((x) => x.ref_key === g && x.status === "approved").at(-1) ?? videos.filter((x) => x.ref_key === g && x.status === "generated").at(-1);
    return {
      genId: g,
      name: map.find((m) => m.id === g)?.name ?? g,
      plannedSec: Number(planOf(g)?.duration_sec ?? map.find((m) => m.id === g)?.duration_sec ?? 0) || null,
      ratio: planOf(g)?.ratio ?? null,
      video: chosen?.storage_path ? { id: chosen.id, durationSec: Number(chosen.meta?.durationSec ?? 0) || null, approved: chosen.status === "approved", note: typeof chosen.meta?.montage_note === "string" ? (chosen.meta.montage_note as string) : "" } : null,
      removed: !!chosen && !chosen.storage_path,
    };
  });
}

export async function editorForFilm(filmProjectId: string) {
  const { data } = await db().from("editor_projects").select("id").eq("film_project_id", filmProjectId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * Opens the film's edit, bringing any newly chosen videos into its library. The first time it also makes «النسخة
 * الأولى» (see first-cut.ts): the chosen videos in the director's order, cut to plan, with dissolves and the title.
 */
export async function openFilmEdit(film: FilmProject, user: User) {
  let id = await editorForFilm(film.id);
  const fresh = !id;
  // made in the film owner's name (a team member's scene stays the series owner's, like its files)
  if (!id) id = await createEditorProject(film.user_id, { title: film.title, kind: "horizontal" }, film.id);
  let p = await requireEditorProject(id, user.id);
  const cut = (await filmCut(film.id)).filter((c) => c.video);
  if (!cut.length) throw new UserError("ما فيه فيديوهات محفوظة لهذا الفيلم بعد. ولّدها من صفحة «التوليد».", 409);

  const have = await assetViews(p.id);
  const missing = cut.filter((c) => !have.some((a) => a.sourceId === c.video!.id));
  if (missing.length) {
    await importAssets(p, { items: missing.map((c) => ({ source: "film", id: c.video!.id, durationMs: (c.video!.durationSec ?? 10) * 1000, name: `${film.title} · ${c.genId}` })) });
  }
  const timeline = readTimeline(p.timeline);
  const main = timeline.tracks.find((t) => t.kind === "video");
  // only the first time: afterwards the person's own edit is never rearranged (new videos wait in the library)
  if (fresh && main && !main.clips.length) {
    const assets = await assetViews(p.id);
    const shots = cut.flatMap((c) => {
      const a = assets.find((x) => x.sourceId === c.video!.id);
      return a ? [{ assetId: a.id, plannedMs: c.plannedSec ? c.plannedSec * 1000 : null }] : [];
    });
    // the film's shape: the ratio most of its scenes were made in
    const ratios = cut.map((c) => c.ratio).filter((r): r is string => !!r);
    const ratio = ratios.sort((x, y) => ratios.filter((r) => r === y).length - ratios.filter((r) => r === x).length)[0] ?? null;
    const cmds = firstCut(timeline, shots, new Map(assets.map((a) => [a.id, assetInfo(a)])), { title: film.title, ratio });
    if (cmds.length) {
      await runCommands(p, cmds, "film");
      p = await requireEditorProject(id, user.id);
    }
  }
  return p.id;
}

/**
 * «المشهد الناجح»: the film's exported montage kept by the film itself (the editor's own export is removed after three
 * days): copied into the film's files as its approved scene. Returns how many scenes the film now keeps.
 */
export async function saveSuccessfulScene(film: FilmProject) {
  const id = await editorForFilm(film.id);
  if (!id) throw new UserError("ما فيه مونتاج لهذا الفيلم بعد.", 409);
  const { data: ed } = await db().from("editor_projects").select("export_path,purged_at,title,timeline").eq("id", id).single();
  if (!ed?.export_path || ed.purged_at) throw new UserError("صدّر المونتاج أول من «صدّر» داخل حيدرة كت، وبعدها احفظه هنا.", 409);
  const path = `${projectDir(film)}/scene/scene-${Date.now()}.mp4`;
  const copied = await storage.from(EDITOR_BUCKET).copyTo(FILM_BUCKET, ed.export_path, path);
  if (copied.error) throw new UserError("ما قدرنا ننسخ المونتاج؛ جرّب مرة ثانية.", 502);
  const info = await storage.from(FILM_BUCKET).info(path).catch(() => null);
  await db().from("film_assets").update({ status: "rejected" }).eq("project_id", film.id).eq("kind", "video").eq("ref_key", SCENE_KEY).eq("status", "approved");
  const { error } = await db().from("film_assets").insert({
    project_id: film.id, kind: "video", ref_key: SCENE_KEY, storage_path: path, file_name: `${film.title}.mp4`, mime: "video/mp4",
    bytes: Number((info as { size?: number } | null)?.size ?? 0) || null, status: "approved", meta: { scene: true, from_edit: id, durationSec: Math.round(duration(readTimeline(ed.timeline)) / 100) / 10 || null },
  });
  if (error) throw error;
}

/** The film's saved successful scene (signed link), if any. */
export async function successfulScene(filmId: string) {
  const { data } = await db().from("film_assets").select("id,storage_path,created_at").eq("project_id", filmId).eq("kind", "video").eq("ref_key", SCENE_KEY).eq("status", "approved").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data?.storage_path) return null;
  const url = (await storage.from(FILM_BUCKET).createSignedUrl(data.storage_path, 3600)).data?.signedUrl ?? null;
  return url ? { id: data.id as string, url, savedAt: data.created_at as string } : null;
}

/** «المشهد الناجح» is kept as the film's video with this key. */
export const SCENE_KEY = "SCENE";
