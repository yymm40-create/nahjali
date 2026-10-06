// «الممنتج الذكي» as the film maker's step after «الأصوات»: one edit per film project, with the film's approved
// videos in the director's order. Server only.

import type { User } from "@supabase/supabase-js";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { directorVersions, directorVideos } from "@/lib/film/director";
import type { FilmProject } from "@/lib/film/types";
import { createEditorProject, importAssets, requireEditorProject, runCommands, assetViews } from "./server";
import { readTimeline } from "./model";

const db = () => createAdminClient();

/** The film's approved generations, in the director's map order, each with its chosen video (if it is still kept). */
export async function filmCut(projectId: string) {
  const [versions, videos] = await Promise.all([directorVersions(projectId), directorVideos(projectId)]);
  const map = versions.filter((v) => v.kind === "dir_map" && v.status === "approved").at(-1)?.data.generation_map ?? [];
  const approved = versions.filter((v) => v.kind === "dir_generation" && v.status === "approved");
  const ids = [...new Set([...map.map((g) => g.id), ...approved.map((v) => v.ref_key)])].filter((g) => approved.some((v) => v.ref_key === g));
  return ids.map((g) => {
    const chosen = videos.filter((x) => x.ref_key === g && x.status === "approved").at(-1) ?? videos.filter((x) => x.ref_key === g && x.status === "generated").at(-1);
    return {
      genId: g,
      name: map.find((m) => m.id === g)?.name ?? g,
      video: chosen?.storage_path ? { id: chosen.id, durationSec: Number(chosen.meta?.durationSec ?? 0) || null, approved: chosen.status === "approved" } : null,
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
 * الأولى»: the chosen videos one after another in the director's order.
 */
export async function openFilmEdit(film: FilmProject, user: User) {
  let id = await editorForFilm(film.id);
  const fresh = !id;
  if (!id) id = await createEditorProject(user.id, { title: film.title, kind: "horizontal" }, film.id);
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
    const ordered = cut.map((c) => assets.find((a) => a.sourceId === c.video!.id)).filter((a) => !!a);
    if (ordered.length) {
      await runCommands(p, ordered.map((a) => ({ type: "add_clip" as const, assetId: a.id, trackId: main.id })), "film");
      p = await requireEditorProject(id, user.id);
    }
  }
  return p.id;
}
