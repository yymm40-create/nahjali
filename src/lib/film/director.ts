import { after } from "next/server";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson, claudeCost, totalTokens } from "./anthropic";
import { addMessage, buildTurns } from "./conversation";
import { createVideoTask, getVideoTask, type VideoTask } from "./seedance";
import { approvedImages, latestJob, sheetAssets } from "./sheets";
import { failJob, startJob, succeedJob } from "./usage";
import { FILM_BUCKET, projectDir, type FilmAsset, type FilmJob, type FilmProject } from "./types";
import { DEFAULT_VIDEO_RESOLUTION, VIDEO_KEEP_DAYS, VIDEO_MODELS, VIDEO_PRICING, VIDEO_RESOLUTIONS, videoEstimateUsd, type VideoModel, type VideoResolution } from "@config/film";
import {
  DIRECTOR_APP_INTEGRATION,
  DIRECTOR_PROMPT,
  DIRECTOR_SCHEMA,
  SUPER_DIRECTOR,
  SUPER_DIRECTOR_MESSAGE,
  VIDEO_GENERATOR_FACTS,
} from "@config/film-prompts/director";

const STAGE = "director";
const VIDEO_OP = "director_video";
const ESTIMATE_USD = 1;
const MAX_TOKENS = 32000;
/** A video still "running" after this long is given up on (and its reservation released). */
const VIDEO_STALE_MS = 45 * 60_000;
/** How long the request that started a video keeps watching it; the page's polling finishes the rest. */
const WATCH_MS = 240_000;

type User = { id: string; email?: string | null };

// Prefixed so version numbers never collide with the other stages' deliverables of the same name
export type DirectorKind = "dir_setup" | "dir_understanding" | "dir_questions" | "dir_map" | "dir_generation" | "dir_note";

interface Reply {
  stage: number;
  content: string;
  suggestion: string;
  notes: string;
  questions: { question: string; options: string[] }[];
  generation_map: { id: string; name: string; duration_sec: number }[];
  gen_id: string;
  prompt: string;
  references: { name: string; role: string }[];
  dialogue_ar: { speaker: string; line: string }[];
  video_model: "" | VideoModel;
  duration_sec: number;
  ratio: string;
  generate_audio: boolean;
}

export interface DirectorVersion {
  id: string;
  kind: DirectorKind;
  ref_key: string;
  version: number;
  body: string;
  data: {
    superDirector?: boolean;
    notes?: string;
    suggestion?: string;
    questions?: Reply["questions"];
    answers?: string[];
    generation_map?: Reply["generation_map"];
    prompt?: string;
    references?: Reply["references"];
    dialogue_ar?: Reply["dialogue_ar"];
    video_model?: VideoModel;
    duration_sec?: number;
    ratio?: string;
    generate_audio?: boolean;
  };
  status: "draft" | "awaiting_approval" | "approved" | "superseded";
  stale: boolean;
  created_at: string;
}

const db = () => createAdminClient();
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

export async function directorVersions(projectId: string) {
  const { data } = await db()
    .from("film_versions")
    .select("id,kind,ref_key,version,body,data,status,stale,created_at")
    .eq("project_id", projectId)
    .eq("stage", STAGE)
    .order("created_at", { ascending: true });
  return (data ?? []) as DirectorVersion[];
}

export async function directorVideos(projectId: string) {
  const { data } = await db().from("film_assets").select("*").eq("project_id", projectId).eq("kind", "video").order("created_at", { ascending: true });
  return (data ?? []) as FilmAsset[];
}

/** The approved references from the sheet maker, by their @name. */
export async function referenceLibrary(projectId: string) {
  const out: Record<string, FilmAsset> = {};
  for (const a of Object.values(approvedImages(await sheetAssets(projectId)))) {
    if (typeof a.meta?.at_name === "string") out[a.meta.at_name] = a;
  }
  return out;
}

const latest = (vs: DirectorVersion[], kind: DirectorKind, ref = "") => vs.filter((v) => v.kind === kind && v.ref_key === ref).at(-1);
export const superDirectorOn = (vs: DirectorVersion[]) => latest(vs, "dir_setup")?.data.superDirector === true;
const addUserMessage = (projectId: string, content: string) => addMessage(projectId, STAGE, content);

/** The prompt sent to Seedance: the English one of the Super Director's EN/ZH array, or the plain prompt. */
export function videoPrompt(raw: string) {
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      const en = arr.find((x) => x?.lang === "en")?.prompt;
      if (typeof en === "string" && en.trim()) return en.trim();
    }
  } catch {
    // not JSON: a plain prompt
  }
  return raw.trim();
}

async function queueReply(project: FilmProject, user: User, messageId: string) {
  const { count } = await db().from("film_jobs").select("id", { count: "exact", head: true }).like("idempotency_key", `${messageId}%`);
  const { job, created } = await startJob({
    projectId: project.id,
    user,
    service: "anthropic",
    operation: STAGE,
    idempotencyKey: count ? `${messageId}:retry${count}` : messageId,
    estimateUsd: ESTIMATE_USD,
    units: 0,
    unit: "tokens",
  });
  if (created) after(() => runDirectorReply(project.id, job.id));
  return job.id;
}

async function setApproved(v: DirectorVersion, versions: DirectorVersion[]) {
  const older = versions.filter((x) => x.kind === v.kind && x.ref_key === v.ref_key && x.id !== v.id && x.status === "approved").map((x) => x.id);
  if (older.length) await db().from("film_versions").update({ status: "superseded" }).in("id", older);
  const { data, error } = await db()
    .from("film_versions")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", v.id)
    .eq("status", "awaiting_approval")
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new UserError("ما انعتمد (تغيّرت حالته). حدّث الصفحة وجرّب.", 409);
}

export type DirectorAction =
  | { action: "start"; superDirector: boolean }
  | { action: "set_super"; superDirector: boolean }
  | { action: "approve"; versionId: string }
  | { action: "answers"; versionId: string; answers: string[] }
  | { action: "revise"; text: string; versionId?: string; mode?: "edit" | "direct" }
  | { action: "retry" }
  | { action: "generate_video"; genId: string; resolution: VideoResolution }
  | { action: "approve_video"; assetId: string }
  | { action: "unapprove_video"; assetId: string }
  | { action: "reject_video"; assetId: string };

export async function directorAction(project: FilmProject, user: User, input: DirectorAction): Promise<{ jobId: string | null }> {
  if (project.stage === "screenwriter" || project.stage === "sheets") throw new UserError("اعتمد كل صور الشيتات أول.", 409);
  const versions = await directorVersions(project.id);
  const convo = await latestJob(project.id, STAGE);
  const busy = () => {
    if (convo?.status === "running") throw new UserError("المخرج يكتب ردّه الحين، انتظر شوي.", 409);
  };

  switch (input.action) {
    case "start": {
      busy();
      const { count } = await db().from("film_messages").select("id", { count: "exact", head: true }).eq("project_id", project.id).eq("stage", STAGE);
      if (count) throw new UserError("المخرج بدأ من قبل.", 409);
      const handoff = async (stage: string, kind: string) => {
        const { data } = await db()
          .from("film_versions")
          .select("body")
          .eq("project_id", project.id)
          .eq("stage", stage)
          .eq("kind", kind)
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return data?.body as string | undefined;
      };
      const script = await handoff("screenwriter", "handoff");
      const sheets = await handoff("sheets", "sheet_handoff");
      if (!script || !sheets) throw new UserError("ما لقينا رسالتَي التسليم المعتمدتين من السيناريست وصانع الشيت.", 409);
      await insertSetup(project.id, versions, input.superDirector);
      const lib = await referenceLibrary(project.id);
      const refs = Object.entries(lib).map(([name, a]) => `- ${name} (${a.ref_key}): [[image:${a.id}]]`);
      const text = [
        "رسالة التسليم المعتمدة من السيناريست الذكي:",
        script,
        "---",
        "رسالة التسليم المعتمدة من صانع الشيت الذكي:",
        sheets,
        "---",
        "الصور المرجعية المعتمدة (مرفقة هنا، كل وحدة باسمها):",
        ...refs,
        "---",
        VIDEO_GENERATOR_FACTS,
      ].join("\n\n");
      const id = await addUserMessage(project.id, text);
      return { jobId: await queueReply(project, user, id) };
    }

    case "set_super": {
      busy();
      const on = Boolean(input.superDirector);
      if (superDirectorOn(versions) === on) return { jobId: null };
      await insertSetup(project.id, versions, on);
      const { count } = await db().from("film_messages").select("id", { count: "exact", head: true }).eq("project_id", project.id).eq("stage", STAGE);
      if (!count) return { jobId: null };
      // Told to the director with the next message; the understanding's approval carries the skill if it comes later
      const understood = versions.some((v) => v.kind === "dir_understanding" && v.status === "approved");
      await addUserMessage(
        project.id,
        on
          ? understood
            ? `فعّلت «المخرج الخارق» من الحين. هذي المهارة:\n\n${SUPER_DIRECTOR}`
            : "فعّلت «المخرج الخارق». بيوصلك مع اعتماد الفهم."
          : "ألغيت «المخرج الخارق» من الحين: تخطَّه، واكتب البرومبتات القادمة كبرومبت إنجليزي واحد كامل.",
      );
      return { jobId: null };
    }

    case "approve": {
      busy();
      const v = versions.find((x) => x.id === input.versionId);
      if (!v || v.status !== "awaiting_approval" || latest(versions, v.kind, v.ref_key)?.id !== v.id) {
        throw new UserError("«اعتمد» يعتمد آخر نسخة معروضة بس. حدّث الصفحة وجرّب.", 409);
      }
      if (v.kind === "dir_understanding") {
        await setApproved(v, versions);
        // With the Super Director on, the website sends the skill on the client's behalf
        const sent = await superAlreadySent(project.id);
        const id = await addUserMessage(project.id, superDirectorOn(versions) && !sent ? SUPER_DIRECTOR_MESSAGE(SUPER_DIRECTOR) : "اعتمد");
        return { jobId: await queueReply(project, user, id) };
      }
      if (v.kind === "dir_map") {
        await setApproved(v, versions);
        const id = await addUserMessage(project.id, "اعتمد");
        return { jobId: await queueReply(project, user, id) };
      }
      if (v.kind !== "dir_generation") throw new UserError("هذا العنصر ما يحتاج اعتماد.", 409);
      // Checked before approving, so an approved generation can always be sent from the generation page
      readyForVideo(v, await referenceLibrary(project.id));
      await setApproved(v, versions);
      const id = await addUserMessage(project.id, "اعتمد");
      return { jobId: await queueReply(project, user, id) };
    }

    case "answers": {
      busy();
      const v = versions.find((x) => x.id === input.versionId);
      if (!v || v.kind !== "dir_questions" || v.status !== "awaiting_approval") throw new UserError("هذي الأسئلة مو آخر نسخة.", 409);
      const qs = v.data.questions ?? [];
      const answers = input.answers.map((a) => String(a ?? "").trim().slice(0, 1500));
      if (answers.length !== qs.length || answers.some((a) => !a)) throw new UserError("جاوب على كل الأسئلة.", 400);
      await db().from("film_versions").update({ status: "approved", data: { ...v.data, answers } }).eq("id", v.id);
      const id = await addUserMessage(project.id, ["إجاباتي:", ...answers.map((a, i) => `${i + 1}. ${a}`)].join("\n"));
      return { jobId: await queueReply(project, user, id) };
    }

    case "revise": {
      busy();
      const text = String(input.text ?? "").trim();
      if (!text || text.length > 4000) throw new UserError("اكتب التعديل (٤٠٠٠ حرف كحد أقصى).", 400);
      const target = input.versionId ? versions.find((x) => x.id === input.versionId) : undefined;
      const prefix =
        input.mode === "direct" ? "توجيه / أمر جديد:\n" : target?.kind === "dir_generation" ? `تعديل على ${target.ref_key}:\n` : "";
      const id = await addUserMessage(project.id, prefix + text);
      return { jobId: await queueReply(project, user, id) };
    }

    case "retry": {
      if (convo?.status !== "failed") throw new UserError("ما فيه شي يحتاج إعادة.", 409);
      const { data: last } = await db()
        .from("film_messages")
        .select("id,role")
        .eq("project_id", project.id)
        .eq("stage", STAGE)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!last || last.role !== "user") throw new UserError("ما فيه شي يحتاج إعادة.", 409);
      return { jobId: await queueReply(project, user, last.id) };
    }

    case "generate_video": {
      const v = versions.filter((x) => x.kind === "dir_generation" && x.ref_key === input.genId && x.status === "approved").at(-1);
      if (!v) throw new UserError("اعتمد هذا التوليد أول.", 409);
      const resolution = input.resolution in VIDEO_RESOLUTIONS ? input.resolution : DEFAULT_VIDEO_RESOLUTION;
      await startVideo(project, user, v, await referenceLibrary(project.id), resolution);
      return { jobId: null };
    }

    case "approve_video": {
      const videos = await directorVideos(project.id);
      const a = videos.find((x) => x.id === input.assetId);
      if (!a || a.status !== "generated") throw new UserError("هذا الفيديو ما ينعتمد.", 409);
      const older = videos.filter((x) => x.ref_key === a.ref_key && x.id !== a.id && x.status === "approved").map((x) => x.id);
      if (older.length) await db().from("film_assets").update({ status: "rejected" }).in("id", older);
      const { error } = await db().from("film_assets").update({ status: "approved" }).eq("id", a.id);
      if (error) throw error;
      await maybeFinish(project, versions, [...videos.filter((x) => x.id !== a.id), { ...a, status: "approved" }]);
      return { jobId: null };
    }

    case "unapprove_video": {
      // The client can always take an approval back, then generate another video or send another edit
      const a = (await directorVideos(project.id)).find((x) => x.id === input.assetId);
      if (!a || a.status !== "approved") throw new UserError("هذا الفيديو مو معتمد.", 409);
      const { error } = await db().from("film_assets").update({ status: "generated" }).eq("id", a.id);
      if (error) throw error;
      if (project.stage !== "director") await db().from("film_projects").update({ stage: "director" }).eq("id", project.id);
      return { jobId: null };
    }

    case "reject_video": {
      const a = (await directorVideos(project.id)).find((x) => x.id === input.assetId);
      if (!a) throw new UserError("ما لقينا الفيديو.", 404);
      await db().from("film_assets").update({ status: "rejected" }).eq("id", a.id);
      return { jobId: null };
    }
  }
}

async function insertSetup(projectId: string, versions: DirectorVersion[], superDirector: boolean) {
  const prev = latest(versions, "dir_setup");
  const { error } = await db().from("film_versions").insert({
    project_id: projectId, stage: STAGE, kind: "dir_setup", ref_key: "", version: (prev?.version ?? 0) + 1, body: "",
    data: { superDirector }, status: "approved", approved_at: new Date().toISOString(), created_by: "user",
  });
  if (error) throw error;
  if (prev) await db().from("film_versions").update({ status: "superseded" }).eq("id", prev.id);
}

async function superAlreadySent(projectId: string) {
  const { count } = await db()
    .from("film_messages")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("stage", STAGE)
    .eq("role", "user")
    .like("content", "%# Seedance 2.0 — Universal Director%");
  return Boolean(count);
}

/** When every generation of the approved map has an approved video, the project moves on to the voices. */
async function maybeFinish(project: FilmProject, versions: DirectorVersion[], videos: FilmAsset[]) {
  const map = versions.filter((v) => v.kind === "dir_map" && v.status === "approved").at(-1)?.data.generation_map ?? [];
  if (!map.length || !map.every((g) => videos.some((a) => a.ref_key === g.id && a.status === "approved"))) return;
  if (project.stage === "director") await db().from("film_projects").update({ stage: "voices" }).eq("id", project.id);
}

/** The reference images of a generation, in <<<image_n>>> order. Throws if one is not in the library. */
function videoRefs(v: DirectorVersion, lib: Record<string, FilmAsset>) {
  const names = (v.data.references ?? []).map((r) => (r.name.startsWith("@") ? r.name : `@${r.name}`).trim());
  const missing = names.filter((n) => !lib[n]);
  if (missing.length) throw new UserError(`مراجع غير موجودة في المكتبة: ${missing.join("، ")}. اطلب من المخرج يصححها.`, 409);
  const model = v.data.video_model ?? "seedance-2.5";
  return names.slice(0, VIDEO_MODELS[model].maxImages).map((n) => lib[n]);
}

/** The prompt and references a generation sends to Seedance; throws a clear message if it cannot be sent. */
function readyForVideo(v: DirectorVersion, lib: Record<string, FilmAsset>) {
  const prompt = videoPrompt(v.data.prompt ?? "");
  if (!prompt) throw new UserError("برومبت هذا التوليد فاضي.", 409);
  if (ARABIC.test(prompt)) throw new UserError("البرومبت فيه حروف عربية؛ اطلب من المخرج يكتب الحوار بحروف لاتينية.", 409);
  return { prompt, refs: videoRefs(v, lib) };
}

/** Creates the video asset + paid job, and sends the generation to Seedance in the background. */
async function startVideo(project: FilmProject, user: User, v: DirectorVersion, lib: Record<string, FilmAsset>, resolution: VideoResolution) {
  const { prompt, refs } = readyForVideo(v, lib);
  const model: VideoModel = v.data.video_model || project.video_model || "seedance-2.5";
  const durationSec = Math.min(Math.max(Math.round(v.data.duration_sec || 10), 4), VIDEO_MODELS[model].maxSeconds);
  const { count } = await db().from("film_jobs").select("id", { count: "exact", head: true }).eq("project_id", project.id).eq("operation", VIDEO_OP).eq("status", "running");
  if ((count ?? 0) >= 3) throw new UserError("فيه فيديوهات تتولد الحين، انتظرها تخلص.", 409);

  const meta = { model, durationSec, resolution, ratio: v.data.ratio || "16:9", generateAudio: v.data.generate_audio ?? true };
  const { data: asset, error } = await db()
    .from("film_assets")
    .insert({ project_id: project.id, kind: "video", ref_key: v.ref_key, version_id: v.id, status: "generating", meta })
    .select()
    .single();
  if (error) throw error;
  const { job } = await startJob({
    projectId: project.id,
    user,
    service: "seedance",
    operation: VIDEO_OP,
    idempotencyKey: `video:${asset.id}`,
    estimateUsd: videoEstimateUsd(model, resolution, durationSec),
    units: durationSec,
    unit: "seconds",
    assetId: asset.id,
  }).catch(async (e) => {
    await db().from("film_assets").delete().eq("id", asset.id);
    throw e;
  });
  after(() => submitVideo(project, job.id, asset.id, { prompt, refs, ...meta }));
}

async function submitVideo(
  project: FilmProject,
  jobId: string,
  assetId: string,
  o: { prompt: string; refs: FilmAsset[]; model: VideoModel; durationSec: number; resolution: VideoResolution; ratio: string; generateAudio: boolean },
) {
  const client = db();
  try {
    const paths = o.refs.map((r) => r.storage_path!).filter(Boolean);
    const signed = paths.length ? (await client.storage.from(FILM_BUCKET).createSignedUrls(paths, 7200)).data ?? [] : [];
    const imageUrls = signed.map((s) => s.signedUrl).filter(Boolean) as string[];
    const taskId = await createVideoTask({ model: o.model, prompt: o.prompt, imageUrls, durationSec: o.durationSec, resolution: o.resolution, ratio: o.ratio, generateAudio: o.generateAudio });
    await client.from("film_jobs").update({ provider_task_id: taskId }).eq("id", jobId);
    // Keep watching for a while; the page's polling (checkVideos) finishes the rest
    const until = Date.now() + WATCH_MS;
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, 10_000));
      const task = await getVideoTask(taskId);
      if (["succeeded", "failed", "cancelled", "expired"].includes(task.status)) {
        await finishVideo(project, jobId, assetId, o, task);
        return;
      }
    }
  } catch (err) {
    console.error("film video failed", err);
    await client.from("film_assets").update({ status: "failed", error: String(err instanceof Error ? err.message : err).slice(0, 300) }).eq("id", assetId);
    await failJob(jobId, err);
  }
}

/** Copies a finished video to our storage at once (the provider's link lasts 24 hours) and settles its cost. */
async function finishVideo(
  project: FilmProject,
  jobId: string,
  assetId: string,
  { model, durationSec, resolution }: { model: VideoModel; durationSec: number; resolution: VideoResolution },
  task: VideoTask,
) {
  const client = db();
  // Only one request finishes a job: the first one to mark it
  const { data: claimed } = await client.from("film_jobs").update({ error: "saving" }).eq("id", jobId).eq("status", "running").is("error", null).select("id");
  if (!claimed?.length) return;
  try {
    if (task.status !== "succeeded" || !task.videoUrl) throw new Error(task.error ?? `Seedance: ${task.status}`);
    const res = await fetch(task.videoUrl);
    if (!res.ok) throw new Error(`video download ${res.status}`);
    const file = Buffer.from(await res.arrayBuffer());
    const path = `${projectDir(project)}/director/${assetId}.mp4`;
    const up = await client.storage.from(FILM_BUCKET).upload(path, file, { contentType: "video/mp4", upsert: true });
    if (up.error) throw up.error;
    await client.from("film_assets").update({ status: "generated", storage_path: path, mime: "video/mp4", bytes: file.length, error: null }).eq("id", assetId);
    const perM = VIDEO_PRICING[model].usdPerMillionTokens;
    const cost = perM && task.tokens ? (task.tokens * perM) / 1_000_000 : videoEstimateUsd(model, resolution, durationSec);
    await succeedJob(jobId, { costUsd: cost, units: task.tokens ?? durationSec });
  } catch (err) {
    console.error("film video finish failed", err);
    await client.from("film_assets").update({ status: "failed", error: String(err instanceof Error ? err.message : err).slice(0, 300) }).eq("id", assetId);
    await failJob(jobId, err);
  }
}

/**
 * Generated videos are kept VIDEO_KEEP_DAYS days (free storage is small); older files are removed and the
 * client is told so. The record stays, so the page can say which videos were removed.
 */
export async function purgeOldVideos(project: FilmProject) {
  const cutoff = new Date(Date.now() - VIDEO_KEEP_DAYS * 86_400_000).toISOString();
  const { data } = await db()
    .from("film_assets")
    .select("id,storage_path,meta")
    .eq("project_id", project.id)
    .eq("kind", "video")
    .not("storage_path", "is", null)
    .lt("created_at", cutoff);
  const old = (data ?? []) as Pick<FilmAsset, "id" | "storage_path" | "meta">[];
  if (!old.length) return;
  const { error } = await db().storage.from(FILM_BUCKET).remove(old.map((a) => a.storage_path!));
  if (error) return console.error("video purge failed", error);
  for (const a of old) {
    await db().from("film_assets").update({ storage_path: null, meta: { ...a.meta, removed_at: new Date().toISOString() } }).eq("id", a.id);
  }
}

/** Running videos: finished ones are saved, stale ones given up. Called by the page and its polling. */
export async function checkVideos(project: FilmProject) {
  const { data } = await db().from("film_jobs").select("*").eq("project_id", project.id).eq("operation", VIDEO_OP).eq("status", "running");
  const jobs = (data ?? []) as FilmJob[];
  let running = 0;
  for (const j of jobs) {
    if (Date.now() - new Date(j.started_at ?? j.created_at).getTime() > VIDEO_STALE_MS) {
      await failJob(j.id, "انتهى وقت التوليد قبل ما يكمل");
      if (j.asset_id) await db().from("film_assets").update({ status: "failed", error: "انتهى وقت التوليد" }).eq("id", j.asset_id);
      continue;
    }
    if (j.provider_task_id && j.asset_id && !j.error) {
      const task = await getVideoTask(j.provider_task_id).catch(() => null);
      if (task && ["succeeded", "failed", "cancelled", "expired"].includes(task.status)) {
        const { data: a } = await db().from("film_assets").select("meta").eq("id", j.asset_id).single();
        const meta = (a?.meta ?? {}) as { model?: VideoModel; durationSec?: number; resolution?: VideoResolution };
        await finishVideo(project, j.id, j.asset_id, { model: meta.model ?? "seedance-2.5", durationSec: meta.durationSec ?? 10, resolution: meta.resolution ?? DEFAULT_VIDEO_RESOLUTION }, task);
        continue;
      }
    }
    running++;
  }
  return running;
}

const KIND_FOR = (r: Reply): DirectorKind => {
  if (r.stage === 2) return "dir_understanding";
  if (r.questions?.length) return "dir_questions";
  if (r.stage === 6 && r.generation_map?.length) return "dir_map";
  if (r.gen_id && r.prompt) return "dir_generation";
  return "dir_note";
};

export async function runDirectorReply(projectId: string, jobId: string) {
  try {
    const versions = await directorVersions(projectId);
    const turns = await buildTurns(projectId, STAGE);
    if (turns.at(-1)?.role !== "user") throw new Error("nothing to answer");
    const system = `${DIRECTOR_PROMPT}\n\n${DIRECTOR_APP_INTEGRATION(superDirectorOn(versions))}`;
    const result = await callClaudeJson<Reply>({ system, turns, schema: DIRECTOR_SCHEMA, maxTokens: MAX_TOKENS });
    const r = result.data;
    const kind = KIND_FOR(r);
    const ref = kind === "dir_generation" ? r.gen_id.trim() : "";

    const client = db();
    const same = versions.filter((v) => v.kind === kind && v.ref_key === ref);
    const old = same.filter((v) => v.status === "awaiting_approval" || v.status === "draft").map((v) => v.id);
    if (old.length) await client.from("film_versions").update({ status: "superseded" }).in("id", old);
    const isGen = kind === "dir_generation";
    const { error } = await client.from("film_versions").insert({
      project_id: projectId,
      stage: STAGE,
      kind,
      ref_key: ref,
      version: (same.at(-1)?.version ?? 0) + 1,
      body: r.content,
      data: {
        notes: r.notes,
        suggestion: r.suggestion?.trim() || undefined,
        questions: kind === "dir_questions" ? r.questions : undefined,
        generation_map: kind === "dir_map" ? r.generation_map : undefined,
        prompt: isGen ? r.prompt : undefined,
        references: isGen ? r.references : undefined,
        dialogue_ar: isGen && r.dialogue_ar?.length ? r.dialogue_ar : undefined,
        video_model: isGen ? r.video_model || "seedance-2.5" : undefined,
        duration_sec: isGen ? r.duration_sec : undefined,
        ratio: isGen ? r.ratio || "16:9" : undefined,
        generate_audio: isGen ? r.generate_audio : undefined,
      },
      // A note (e.g. "the generation set is complete") needs no approval
      status: kind === "dir_note" ? "approved" : "awaiting_approval",
      approved_at: kind === "dir_note" ? new Date().toISOString() : null,
      created_by: "assistant",
    });
    if (error) throw error;
    // The reply joins the conversation only once its deliverable is stored, so a failure stays retryable
    await client.from("film_messages").insert({ project_id: projectId, stage: STAGE, role: "assistant", content: result.raw });
    await succeedJob(jobId, { costUsd: claudeCost(result.usage), units: totalTokens(result.usage) });
  } catch (err) {
    console.error("director reply failed", err);
    await failJob(jobId, err);
  }
}
