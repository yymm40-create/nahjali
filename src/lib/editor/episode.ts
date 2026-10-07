// «المسلسل الذكي»: an episode assembled in «حيدرة كت» from its scenes' «المشهد الناجح» (each scene's saved montage), in
// the scenes' order, then the sound effects and music are added there. One edit per episode, in the series owner's
// name (like its scenes); the team's members open it too. Server only.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FilmEpisode, FilmSeries } from "@/lib/film/series";
import { assetInfo, assetViews, createEditorProject, importAssets, requireEditorProject, runCommands } from "./server";
import { firstCut } from "./first-cut";
import { readTimeline } from "./model";
import { SCENE_KEY } from "./film";

const db = () => createAdminClient();

/** The episode's scenes in order, each with its saved montage (if it has one). */
export async function episodeScenes(episodeId: string) {
  const { data } = await db().from("film_projects").select("id,title,scene_number").eq("episode_id", episodeId).order("scene_number", { ascending: true });
  const scenes = (data ?? []) as { id: string; title: string; scene_number: number }[];
  if (!scenes.length) return [];
  const { data: vids } = await db()
    .from("film_assets")
    .select("id,project_id,meta,created_at")
    .in("project_id", scenes.map((s) => s.id))
    .eq("kind", "video")
    .eq("ref_key", SCENE_KEY)
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  return scenes.map((s) => {
    const v = (vids ?? []).find((x) => x.project_id === s.id);
    return { id: s.id, title: s.title, number: s.scene_number, videoId: (v?.id as string | undefined) ?? null, durationSec: Number((v?.meta as Record<string, unknown> | undefined)?.durationSec ?? 0) || null };
  });
}

/**
 * Opens (or makes) the episode's edit: brings in every scene's newest saved montage; the first time (or while the
 * main track is still empty) lays them out in order with soft dissolves and the episode's name over the opening.
 * Returns the edit's id and the scenes still without a saved montage.
 */
export async function assembleEpisode(series: FilmSeries, ep: FilmEpisode, userId: string) {
  const scenes = await episodeScenes(ep.id);
  const ready = scenes.filter((s) => s.videoId);
  if (!ready.length) throw new UserError("ما فيه ولا مشهد محفوظ في هذي الحلقة بعد. احفظ مونتاج كل مشهد في «🏆 المشهد الناجح» أول.", 409);

  const title = `${series.title} · الحلقة ${ep.number}${ep.title ? ` · ${ep.title}` : ""}`.slice(0, 120);
  const { data: had } = await db().from("editor_projects").select("id").eq("episode_id", ep.id).maybeSingle();
  const id = (had?.id as string | undefined) ?? (await createEditorProject(series.user_id, { title, kind: "horizontal" }, null, ep.id));
  let p = await requireEditorProject(id, userId);

  const have = await assetViews(p.id);
  const missing = ready.filter((s) => !have.some((a) => a.sourceId === s.videoId));
  if (missing.length) await importAssets(p, { items: missing.map((s) => ({ source: "film", id: s.videoId!, durationMs: (s.durationSec ?? 30) * 1000, name: `المشهد ${s.number} · ${s.title}` })) });

  const timeline = readTimeline(p.timeline);
  const main = timeline.tracks.find((t) => t.kind === "video");
  if (main && !main.clips.length) {
    const assets = await assetViews(p.id);
    const shots = ready.flatMap((s) => {
      // the scene's newest saved montage
      const a = assets.filter((x) => x.sourceId === s.videoId).at(-1);
      return a ? [{ assetId: a.id, plannedMs: null }] : [];
    });
    const cmds = firstCut(timeline, shots, new Map(assets.map((a) => [a.id, assetInfo(a)])), { title });
    if (cmds.length) {
      await runCommands(p, cmds, "film");
      p = await requireEditorProject(id, userId);
    }
  }
  return { id: p.id, waiting: scenes.filter((s) => !s.videoId).map((s) => ({ number: s.number, title: s.title })) };
}
