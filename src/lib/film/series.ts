// «المسلسل الذكي»: a series → episodes → scenes. Each scene is a film project that goes through the same steps
// (screenwriter → sheets → director → videos → montage → «المشهد الناجح»); an episode is assembled in «حيدرة كت» from
// its scenes' saved montages, in order. Team mode: the owner adds people by @username, they work on the series' scenes
// and every paid step is charged to the owner (usage.ts → payerOf). Individual mode: only the owner. Server only.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanUsername } from "@/lib/username-rules";
import { FILM_LIMITS } from "@config/film";
import { projectFields } from "./validate";
import { isSeriesTeamMember } from "./access";
import type { FilmProject } from "./types";

const db = () => createAdminClient();

export const SERIES_LIMITS = { seriesPerUser: 20, episodes: 100, scenesPerEpisode: 60, members: 20, aboutMax: 4000 } as const;
const NOT_READY = "«المسلسل الذكي» يحتاج تجهيز قاعدة البيانات أول (ملف 0032).";

export type SeriesMode = "solo" | "team";

export interface FilmSeries {
  id: string;
  user_id: string;
  title: string;
  about: string;
  mode: SeriesMode;
  created_at: string;
  updated_at: string;
}

export interface FilmEpisode {
  id: string;
  series_id: string;
  number: number;
  title: string;
  created_at: string;
}

export interface SceneSummary {
  id: string;
  title: string;
  number: number;
  stage: FilmProject["stage"];
  /** its montage is saved as «المشهد الناجح» (it goes into the episode) */
  saved: boolean;
  updatedAt: string;
}

/** The series this person may open: their own, and those they were added to (team mode only). */
export async function listSeries(userId: string): Promise<{ series: FilmSeries; owner: boolean }[]> {
  const own = await db().from("film_series").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
  if (own.error) return [];
  const { data: m } = await db().from("film_series_members").select("series_id").eq("user_id", userId);
  const ids = (m ?? []).map((r) => r.series_id as string);
  const team = ids.length ? ((await db().from("film_series").select("*").in("id", ids).eq("mode", "team")).data ?? []) : [];
  return [...((own.data ?? []) as FilmSeries[]).map((series) => ({ series, owner: true })), ...(team as FilmSeries[]).map((series) => ({ series, owner: false }))];
}

/** The series, when this person may open it (its owner, or a member in team mode), else null. */
export async function openSeries(id: unknown, userId: string): Promise<{ series: FilmSeries; owner: boolean } | null> {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from("film_series").select("*").eq("id", id).maybeSingle();
  const series = data as FilmSeries | null;
  if (!series) return null;
  if (series.user_id === userId) return { series, owner: true };
  return (await isSeriesTeamMember(series.id, userId)) ? { series, owner: false } : null;
}

/** API: the series or 404; `ownerOnly` for what only its owner decides (mode, team, name). */
export async function requireSeries(id: unknown, userId: string, ownerOnly = false) {
  const s = await openSeries(id, userId);
  if (!s) throw new UserError("ما لقينا هذا المسلسل.", 404);
  if (ownerOnly && !s.owner) throw new UserError("هذا يقرره صاحب المسلسل.", 403);
  return s;
}

const cleanText = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === "\n" ? c : " ")).trim().slice(0, max) : "");

export async function createSeries(userId: string, b: { title?: unknown; about?: unknown; mode?: unknown }) {
  const title = cleanText(b.title, 200).replace(/\s+/g, " ");
  if (!title) throw new UserError("اكتب اسم المسلسل.", 400);
  if (title.length > FILM_LIMITS.titleMax) throw new UserError(`الاسم طويل (${FILM_LIMITS.titleMax} حرف كحد أقصى).`, 400);
  const { count, error: e } = await db().from("film_series").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (e) throw new UserError(NOT_READY, 503);
  if ((count ?? 0) >= SERIES_LIMITS.seriesPerUser) throw new UserError(`وصلت للحد الأقصى للمسلسلات (${SERIES_LIMITS.seriesPerUser}).`, 403);
  const { data, error } = await db()
    .from("film_series")
    .insert({ user_id: userId, title, about: cleanText(b.about, SERIES_LIMITS.aboutMax), mode: b.mode === "team" ? "team" : "solo" })
    .select("*")
    .single();
  if (error) throw new UserError(NOT_READY, 503);
  const series = data as FilmSeries;
  await addEpisode(series, "");
  return series;
}

export async function episodesOf(seriesId: string) {
  const { data } = await db().from("film_episodes").select("*").eq("series_id", seriesId).order("number", { ascending: true });
  return (data ?? []) as FilmEpisode[];
}

/** Each episode's scenes in order, with their step and whether their montage is saved. */
export async function scenesOf(seriesId: string): Promise<Map<string, SceneSummary[]>> {
  const { data } = await db().from("film_projects").select("id,title,stage,scene_number,episode_id,updated_at").eq("series_id", seriesId).order("scene_number", { ascending: true });
  const rows = (data ?? []) as { id: string; title: string; stage: FilmProject["stage"]; scene_number: number | null; episode_id: string | null; updated_at: string }[];
  const saved = new Set<string>();
  if (rows.length) {
    const { data: sc } = await db().from("film_assets").select("project_id").in("project_id", rows.map((r) => r.id)).eq("kind", "video").eq("ref_key", "SCENE").eq("status", "approved");
    for (const r of sc ?? []) saved.add(r.project_id as string);
  }
  const out = new Map<string, SceneSummary[]>();
  for (const r of rows) {
    if (!r.episode_id) continue;
    const list = out.get(r.episode_id) ?? [];
    list.push({ id: r.id, title: r.title, number: r.scene_number ?? list.length + 1, stage: r.stage, saved: saved.has(r.id), updatedAt: r.updated_at });
    out.set(r.episode_id, list);
  }
  return out;
}

export async function membersOf(seriesId: string): Promise<{ userId: string; username: string | null }[]> {
  const { data } = await db().from("film_series_members").select("user_id,added_at").eq("series_id", seriesId).order("added_at", { ascending: true });
  const ids = (data ?? []).map((r) => r.user_id as string);
  if (!ids.length) return [];
  const { data: names } = await db().from("site_usernames").select("user_id,username").in("user_id", ids);
  return ids.map((userId) => ({ userId, username: (names ?? []).find((n) => n.user_id === userId)?.username ?? null }));
}

export async function addEpisode(series: FilmSeries, title: unknown) {
  const eps = await episodesOf(series.id);
  if (eps.length >= SERIES_LIMITS.episodes) throw new UserError(`وصلت للحد الأقصى للحلقات (${SERIES_LIMITS.episodes}).`, 403);
  const number = (eps.at(-1)?.number ?? 0) + 1;
  const { data, error } = await db().from("film_episodes").insert({ series_id: series.id, number, title: cleanText(title, 80) }).select("*").single();
  if (error) throw new UserError("ما قدرنا نضيف الحلقة؛ جرّب مرة ثانية.", 409);
  await touch(series.id);
  return data as FilmEpisode;
}

async function episodeOf(series: FilmSeries, episodeId: unknown) {
  if (typeof episodeId !== "string") throw new UserError("اختر الحلقة.", 400);
  const { data } = await db().from("film_episodes").select("*").eq("id", episodeId).eq("series_id", series.id).maybeSingle();
  if (!data) throw new UserError("ما لقينا هذي الحلقة.", 404);
  return data as FilmEpisode;
}

export async function nextSceneNumber(episodeId: string) {
  const { data } = await db().from("film_projects").select("scene_number").eq("episode_id", episodeId).order("scene_number", { ascending: false }).limit(1).maybeSingle();
  return Math.min(500, ((data?.scene_number as number | null) ?? 0) + 1);
}

/** A new scene: a film project in the series owner's name (its files and costs are the owner's), at the episode's end. */
export async function addScene(series: FilmSeries, b: { episodeId?: unknown; title?: unknown; story?: unknown; targetDurationSec?: unknown }) {
  const ep = await episodeOf(series, b.episodeId);
  const { count } = await db().from("film_projects").select("id", { count: "exact", head: true }).eq("episode_id", ep.id);
  if ((count ?? 0) >= SERIES_LIMITS.scenesPerEpisode) throw new UserError(`وصلت للحد الأقصى لمشاهد الحلقة (${SERIES_LIMITS.scenesPerEpisode}).`, 403);
  const number = await nextSceneNumber(ep.id);
  const fields = projectFields({ title: cleanText(b.title, 200) || `مشهد ${number}`, story: b.story ?? "", ...(b.targetDurationSec != null ? { targetDurationSec: b.targetDurationSec } : {}) }, { requireTitle: true });
  // what the series is about goes with every scene, so the screenwriter keeps the same world and characters
  const facts = series.about ? `هذا المشهد ${number} من الحلقة ${ep.number} في مسلسل «${series.title}». عن المسلسل:\n${series.about}`.slice(0, FILM_LIMITS.factsMax) : "";
  const { data, error } = await db()
    .from("film_projects")
    .insert({ user_id: series.user_id, ...fields, fixed_facts: facts, series_id: series.id, episode_id: ep.id, scene_number: number })
    .select("id")
    .single();
  if (error) throw error;
  await touch(series.id);
  return data.id as string;
}

/** Moves a scene one place earlier or later within its episode. */
export async function moveScene(series: FilmSeries, sceneId: unknown, by: unknown) {
  const { data } = await db().from("film_projects").select("id,episode_id,scene_number").eq("id", String(sceneId)).eq("series_id", series.id).maybeSingle();
  if (!data?.episode_id) throw new UserError("ما لقينا المشهد.", 404);
  const dir = by === -1 ? -1 : 1;
  const { data: list } = await db().from("film_projects").select("id,scene_number").eq("episode_id", data.episode_id).order("scene_number", { ascending: true });
  const rows = (list ?? []) as { id: string; scene_number: number }[];
  const i = rows.findIndex((r) => r.id === data.id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  // renumber the whole episode 1..n with the two swapped (numbers stay unique and in order)
  [rows[i], rows[j]] = [rows[j], rows[i]];
  for (const [k, r] of rows.entries()) if (r.scene_number !== k + 1) await db().from("film_projects").update({ scene_number: k + 1 }).eq("id", r.id);
}

export async function setMode(series: FilmSeries, mode: unknown) {
  await db().from("film_series").update({ mode: mode === "team" ? "team" : "solo" }).eq("id", series.id);
}

export async function renameSeries(series: FilmSeries, b: { title?: unknown; about?: unknown }) {
  const patch: Record<string, string> = {};
  if (b.title !== undefined) {
    const t = cleanText(b.title, 200).replace(/\s+/g, " ");
    if (!t || t.length > FILM_LIMITS.titleMax) throw new UserError("اكتب اسمًا مناسبًا للمسلسل.", 400);
    patch.title = t;
  }
  if (b.about !== undefined) patch.about = cleanText(b.about, SERIES_LIMITS.aboutMax);
  if (Object.keys(patch).length) await db().from("film_series").update(patch).eq("id", series.id);
}

/** The owner adds a person to the team by their @username. */
export async function addMember(series: FilmSeries, username: unknown) {
  const name = cleanUsername(String(username ?? "").replace(/^@/, ""));
  if (!name) throw new UserError("اكتب اسم المستخدم.", 400);
  const { data: u } = await db().from("site_usernames").select("user_id,username").eq("username", name).maybeSingle();
  if (!u) throw new UserError(`ما لقينا أحد باسم المستخدم @${name}.`, 404);
  if (u.user_id === series.user_id) throw new UserError("هذا أنت، صاحب المسلسل.", 400);
  const members = await membersOf(series.id);
  if (members.some((m) => m.userId === u.user_id)) return { username: u.username as string };
  if (members.length >= SERIES_LIMITS.members) throw new UserError(`وصلت للحد الأقصى لأعضاء الفريق (${SERIES_LIMITS.members}).`, 403);
  const { error } = await db().from("film_series_members").insert({ series_id: series.id, user_id: u.user_id });
  if (error) throw new UserError("ما قدرنا نضيفه؛ جرّب مرة ثانية.", 409);
  return { username: u.username as string };
}

export async function removeMember(series: FilmSeries, userId: unknown) {
  await db().from("film_series_members").delete().eq("series_id", series.id).eq("user_id", String(userId));
}

/** A member leaves a team they were added to. */
export async function leaveSeries(series: FilmSeries, userId: string) {
  await db().from("film_series_members").delete().eq("series_id", series.id).eq("user_id", userId);
}

export async function requireEpisode(series: FilmSeries, episodeId: unknown) {
  return episodeOf(series, episodeId);
}

async function touch(seriesId: string) {
  await db().from("film_series").update({ updated_at: new Date().toISOString() }).eq("id", seriesId);
}
