// «ارجع بمشروعك لنقطة»: after the video is made (or any later stage), the person can go back to the screenwriter, the
// sheets or the director to change something, without losing work:
//   fork  — a NEW project with everything up to and including that stage (the original stays untouched);
//   reset — the SAME project goes back to that stage; the texts after it are deleted, but its pictures, videos and
//          voices are kept in «المكتبة» (archived under their old names, never shown as the new work's).
// Server only. Nothing here is charged: copying and archiving call no paid service.

import { randomUUID } from "node:crypto";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { FILM_LIMITS, FILM_STAGES, type FilmStage } from "@config/film";
import { FILM_BUCKET, projectDir, type FilmAsset, type FilmProject } from "./types";
import { nextSceneNumber } from "./series";

import { storage } from "@/lib/storage";
const db = () => createAdminClient();

export const REWIND_POINTS = ["screenwriter", "sheets", "director"] as const;
export type RewindPoint = (typeof REWIND_POINTS)[number];
const rank = (s: string) => FILM_STAGES.findIndex((x) => x.key === s);

/** What exists after each point (for the confirmation text and to show only the points that have something after them). */
export async function rewindSummary(project: FilmProject) {
  const [{ data: assets }, { data: versions }] = await Promise.all([
    db().from("film_assets").select("kind,ref_key,status").eq("project_id", project.id),
    db().from("film_versions").select("stage").eq("project_id", project.id),
  ]);
  const A = (assets ?? []) as Pick<FilmAsset, "kind" | "ref_key" | "status">[];
  const V = (versions ?? []) as { stage: string }[];
  const videos = A.filter((a) => a.kind === "video" && a.status !== "failed").length;
  const voices = A.filter((a) => a.kind === "audio").length;
  const pictures = A.filter((a) => (a.kind === "image" || a.kind === "upload") && a.ref_key !== "").length;
  const sheets = V.some((v) => v.stage === "sheets");
  const director = V.some((v) => v.stage === "director");
  return {
    videos,
    voices,
    pictures,
    points: {
      screenwriter: sheets || director || videos > 0 || rank(project.stage) > rank("screenwriter"),
      sheets: director || videos > 0 || voices > 0 || rank(project.stage) > rank("sheets"),
      director: videos > 0 || voices > 0 || rank(project.stage) > rank("director"),
    } as Record<RewindPoint, boolean>,
  };
}

const LATER_STAGES: Record<RewindPoint, string[]> = {
  screenwriter: ["sheets", "director"],
  sheets: ["director"],
  director: [],
};

/** Assets that belong AFTER a point. */
const afterPoint = (a: Pick<FilmAsset, "kind" | "ref_key">, to: RewindPoint) => {
  const sheetAsset = (a.kind === "image" || a.kind === "upload") && a.ref_key !== "";
  if (to === "screenwriter") return sheetAsset || a.kind === "video" || a.kind === "audio";
  if (to === "sheets") return a.kind === "video" || a.kind === "audio";
  return a.kind === "video" || a.kind === "audio"; // the director's prompts stay; the videos and voices made from them go
};

async function assertIdle(projectId: string) {
  const { count } = await db().from("film_jobs").select("id", { count: "exact", head: true }).eq("project_id", projectId).in("status", ["queued", "running"]);
  if (count) throw new UserError("فيه عملية شغالة الحين (رد أو صورة أو فيديو). انتظرها تخلص ثم جرّب.", 409);
}

function check(to: unknown): RewindPoint {
  if (!(REWIND_POINTS as readonly string[]).includes(String(to))) throw new UserError("اختر النقطة اللي تبي ترجع لها.", 400);
  return to as RewindPoint;
}

/** The project goes back to `to`; what comes after it is deleted (with its files). */
export async function resetProject(project: FilmProject, toRaw: unknown) {
  const to = check(toRaw);
  await assertIdle(project.id);
  const later = LATER_STAGES[to];
  const { data } = await db().from("film_assets").select("*").eq("project_id", project.id);
  const doomed = ((data ?? []) as FilmAsset[]).filter((a) => afterPoint(a, to) && !a.ref_key.startsWith("archive:"));
  const paths = new Set<string>();
  // the joined dialogue tracks sent to the video model are not assets: they live in the voices folder
  {
    const { data: files } = await storage.from(FILM_BUCKET).list(`${projectDir(project)}/voices`, { limit: 1000 });
    for (const f of files ?? []) if (f.name.startsWith("track-")) paths.add(`${projectDir(project)}/voices/${f.name}`);
  }
  // kept for «المكتبة»: out of the way of the new work (an archived ref_key matches no sheet or shot), files untouched
  const at = new Date().toISOString();
  for (const a of doomed) {
    const { error } = await db().from("film_assets").update({ status: a.storage_path ? "rejected" : "failed", ref_key: `archive:${a.ref_key}`, meta: { ...(a.meta ?? {}), archived_at: at, archived_from: a.ref_key } }).eq("id", a.id);
    if (error) throw error;
  }
  if (later.length) {
    await db().from("film_versions").delete().eq("project_id", project.id).in("stage", later);
    await db().from("film_messages").delete().eq("project_id", project.id).in("stage", later);
  }
  await db().from("film_voice_cast").delete().eq("project_id", project.id);
  const list = [...paths];
  for (let i = 0; i < list.length; i += 100) await storage.from(FILM_BUCKET).remove(list.slice(i, i + 100)).catch((e) => console.error("rewind: file cleanup", e));
  const { error } = await db().from("film_projects").update({ stage: to as FilmStage }).eq("id", project.id);
  if (error) throw error;
  return { id: project.id };
}

/** A new project with everything up to and including `to`; the original is left as it is. */
export async function forkProject(project: FilmProject, toRaw: unknown) {
  const to = check(toRaw);
  await assertIdle(project.id);
  const { count } = await db().from("film_projects").select("id", { count: "exact", head: true }).eq("user_id", project.user_id);
  if ((count ?? 0) >= FILM_LIMITS.maxProjectsPerUser) throw new UserError(`وصلت للحد الأقصى للمشاريع (${FILM_LIMITS.maxProjectsPerUser}). احذف مشروعًا أو اختر «عدّل على هذا المشروع».`, 403);
  const later = LATER_STAGES[to];

  const [{ data: msgs }, { data: vers }, { data: assets }] = await Promise.all([
    db().from("film_messages").select("*").eq("project_id", project.id).order("created_at", { ascending: true }),
    db().from("film_versions").select("*").eq("project_id", project.id).order("created_at", { ascending: true }),
    db().from("film_assets").select("*").eq("project_id", project.id).order("created_at", { ascending: true }),
  ]);
  const keptAssets = ((assets ?? []) as FilmAsset[]).filter((a) => !afterPoint(a, to) && a.status !== "generating");
  const idMap = new Map<string, string>();
  for (const a of keptAssets) idMap.set(a.id, randomUUID());
  const verMap = new Map<string, string>();
  const keptVers = ((vers ?? []) as Record<string, unknown>[]).filter((v) => !later.includes(String(v.stage)));
  for (const v of keptVers) verMap.set(String(v.id), randomUUID());
  // ids written inside texts and structured data (the pictures attached to the conversation) follow the copies
  const remap = (s: string) => {
    let out = s;
    for (const [from, to2] of idMap) out = out.split(from).join(to2);
    return out;
  };

  const title = `${project.title.replace(/ \(من هنا \d+\)$/, "")} (من هنا ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })})`.slice(0, 80);
  // a scene of a series stays in its episode, as the episode's next scene
  const scene = project.episode_id
    ? { series_id: project.series_id, episode_id: project.episode_id, scene_number: await nextSceneNumber(project.episode_id) }
    : {};
  const { data: created, error } = await db()
    .from("film_projects")
    .insert({ user_id: project.user_id, title, story: project.story, fixed_facts: project.fixed_facts, target_duration_sec: project.target_duration_sec, stage: to, video_model: project.video_model, ...scene })
    .select("*")
    .single();
  if (error) throw error;
  const copy = created as FilmProject;
  let copiedPaths: string[] = [];
  try {
    // files first (a failed copy leaves nothing half-made behind)
    const fromDir = projectDir(project);
    const toDir = projectDir(copy);
    const rows = [];
    copiedPaths = [];
    for (const a of keptAssets) {
      let path = a.storage_path;
      if (path && path.startsWith(`${fromDir}/`)) {
        const next = `${toDir}/${path.slice(fromDir.length + 1)}`;
        const { error: e } = await storage.from(FILM_BUCKET).copy(path, next);
        if (e) throw new Error(`copy ${path}: ${e.message}`);
        path = next;
        copiedPaths.push(next);
      }
      rows.push({ ...a, id: idMap.get(a.id), project_id: copy.id, storage_path: path, version_id: a.version_id ? (verMap.get(a.version_id) ?? null) : null, meta: JSON.parse(remap(JSON.stringify(a.meta ?? {}))) });
    }
    if (keptVers.length) {
      const { error: e } = await db().from("film_versions").insert(
        keptVers.map((v) => ({ ...v, id: verMap.get(String(v.id)), project_id: copy.id, body: remap(String(v.body ?? "")), data: JSON.parse(remap(JSON.stringify(v.data ?? {}))) })),
      );
      if (e) throw e;
    }
    if (rows.length) {
      const { error: e } = await db().from("film_assets").insert(rows);
      if (e) throw e;
    }
    const keptMsgs = ((msgs ?? []) as Record<string, unknown>[]).filter((m) => !later.includes(String(m.stage)));
    if (keptMsgs.length) {
      const { error: e } = await db().from("film_messages").insert(keptMsgs.map((m) => ({ ...m, id: randomUUID(), project_id: copy.id, content: remap(String(m.content ?? "")) })));
      if (e) throw e;
    }
  } catch (e) {
    // undo: the new project goes away with its rows and files
    await db().from("film_projects").delete().eq("id", copy.id);
    if (copiedPaths.length) await storage.from(FILM_BUCKET).remove(copiedPaths).catch(() => null);
    console.error("film fork failed", e);
    throw new UserError("تعذّر فتح المشروع الجديد، وما تغيّر شي في مشروعك. جرّب مرة ثانية.", 502);
  }
  return { id: copy.id };
}
