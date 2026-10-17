// «👄 طابق الشفايف على الصوت» — the fallback when Seedance garbles the Arabic dialogue of a take even with the voices
// as reference audio: the SAME take is sent with the shot's dialogue audio to a lip-sync model (Sync Lipsync 2 on
// fal.ai), which redraws only the mouth to match the audio exactly — face, body, camera, light and the voice itself
// stay as they are — and the result comes back as a new take of the same shot, cut to the audio's length (no stretch,
// so nothing drifts in the montage). Paid by the second of video like any film operation. Server only.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { falReady, falSubmit, falTask } from "@/lib/jawad/server/providers/fal";
import { storage } from "@/lib/storage";
import { FILM_BUCKET, projectDir, type FilmAsset, type FilmJob, type FilmProject } from "./types";
import { failJob, startJob, succeedJob } from "./usage";
import { buildVoiceTrack } from "./voice-track";

const db = () => createAdminClient();

export const LIPSYNC_OP = "lipsync";
export const LIPSYNC_ENDPOINT = "fal-ai/sync-lipsync/v2";
/** fal's published price: $3 a minute for lipsync-2; the pro model about 1.67× ($5 a minute). */
export const LIPSYNC_USD_PER_MIN = { std: 3, pro: 5 } as const;
/** A lip-sync job given up when nothing came back in this long. */
const STALE_MS = 30 * 60_000;

export const lipsyncUsd = (seconds: number, pro: boolean) => (Math.max(1, seconds) / 60) * LIPSYNC_USD_PER_MIN[pro ? "pro" : "std"];

/** The dialogue audio of a take: the one it was made with, else the person's own recording, else the voices made here. */
async function dialogueOf(project: FilmProject, take: FilmAsset): Promise<{ path: string; seconds: number }> {
  const used = typeof take.meta?.voiceTrack === "string" ? take.meta.voiceTrack : null;
  if (used) return { path: used, seconds: Number(take.meta?.durationSec) || 10 };
  const { data } = await db().from("film_assets").select("storage_path,meta").eq("project_id", project.id).eq("kind", "audio").eq("ref_key", `track:${take.ref_key}`).eq("status", "approved").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (data?.storage_path) return { path: data.storage_path as string, seconds: Number((data.meta as { seconds?: number } | null)?.seconds) || 10 };
  const t = await buildVoiceTrack(project, take.ref_key, "seedance-2.5");
  return { path: t.path, seconds: t.seconds };
}

/** Starts the lip-sync of one take; the new take appears as «generating» and is finished by checkLipsyncs. */
export async function startLipsync(project: FilmProject, user: { id: string; email?: string | null }, assetId: string, pro: boolean) {
  if (!falReady()) throw new UserError("مطابقة الشفايف غير مفعّلة على الخادم (مفتاح fal).", 503);
  const { data } = await db().from("film_assets").select("*").eq("id", assetId).eq("project_id", project.id).eq("kind", "video").maybeSingle();
  const take = data as FilmAsset | null;
  if (!take?.storage_path || !["generated", "approved"].includes(take.status)) throw new UserError("اختر لقطة جاهزة (انولّدت وموجودة).", 409);
  if (take.meta?.lipsync) throw new UserError("هذي اللقطة مطابقة أصلًا؛ طابق اللقطة الأصلية لو تبي تعيد.", 409);
  const audio = await dialogueOf(project, take);
  const seconds = Math.min(Number(take.meta?.durationSec) || audio.seconds, Math.max(2, Math.ceil(audio.seconds)));
  const meta = { ...(take.meta ?? {}), lipsync: { from: take.id, model: pro ? "lipsync-2-pro" : "lipsync-2" }, voiceTrack: audio.path, durationSec: seconds, montage_note: undefined };
  const { data: asset, error } = await db().from("film_assets").insert({ project_id: project.id, kind: "video", ref_key: take.ref_key, version_id: take.version_id, status: "generating", meta }).select().single();
  if (error) throw error;
  let job: FilmJob;
  try {
    ({ job } = await startJob({ projectId: project.id, user, service: "lipsync", operation: LIPSYNC_OP, idempotencyKey: `lipsync:${asset.id}`, estimateUsd: lipsyncUsd(seconds, pro), units: seconds, unit: "seconds", assetId: asset.id }));
  } catch (e) {
    await db().from("film_assets").delete().eq("id", asset.id);
    if (/film_jobs_service_check/.test(String((e as { message?: string })?.message ?? e))) throw new UserError("مطابقة الشفايف تحتاج ملف قاعدة البيانات 0075 في Supabase (SQL Editor ← Run).", 503);
    throw e;
  }
  try {
    const signed = (await storage.from(FILM_BUCKET).createSignedUrls([take.storage_path, audio.path], 7200)).data ?? [];
    const [videoUrl, audioUrl] = signed.map((s) => s.signedUrl);
    if (!videoUrl || !audioUrl) throw new Error("no signed url for the take or its audio");
    // cut_off: the result ends with the audio (the take is longer by design), so it is never stretched
    const id = await falSubmit(LIPSYNC_ENDPOINT, { video_url: videoUrl, audio_url: audioUrl, model: pro ? "lipsync-2-pro" : "lipsync-2", sync_mode: "cut_off" });
    await db().from("film_jobs").update({ provider_task_id: id }).eq("id", job.id);
  } catch (e) {
    await db().from("film_assets").update({ status: "failed", error: String(e instanceof Error ? e.message : e).slice(0, 300) }).eq("id", asset.id);
    await failJob(job.id, e);
    throw new UserError("ما قدرنا نرسل اللقطة لمطابقة الشفايف الحين. ما انخصم منك شي.", 502);
  }
  return { assetId: asset.id as string };
}

/** Running lip-syncs: finished ones saved as the shot's new take, stale ones given up. Returns how many still run. */
export async function checkLipsyncs(project: FilmProject): Promise<number> {
  const { data } = await db().from("film_jobs").select("*").eq("project_id", project.id).eq("operation", LIPSYNC_OP).eq("status", "running");
  let running = 0;
  for (const j of (data ?? []) as FilmJob[]) {
    if (!j.asset_id) continue;
    if (Date.now() - new Date(j.started_at ?? j.created_at).getTime() > STALE_MS) {
      await failJob(j.id, "انتهى وقت مطابقة الشفايف قبل ما تكمل");
      await db().from("film_assets").update({ status: "failed", error: "انتهى وقت مطابقة الشفايف" }).eq("id", j.asset_id);
      continue;
    }
    if (!j.provider_task_id) {
      running++;
      continue;
    }
    const t = await falTask(LIPSYNC_ENDPOINT, j.provider_task_id).catch(() => null);
    if (!t || t.status === "queued" || t.status === "running") {
      running++;
      continue;
    }
    // only one request saves it: the first to mark the job
    const { data: claimed } = await db().from("film_jobs").update({ error: "saving" }).eq("id", j.id).eq("status", "running").is("error", null).select("id");
    if (!claimed?.length) continue;
    try {
      if (t.status !== "succeeded" || !t.videoUrl) throw new Error(t.error ?? "lip-sync failed");
      const res = await fetch(t.videoUrl);
      if (!res.ok) throw new Error(`lip-sync download ${res.status}`);
      const file = Buffer.from(await res.arrayBuffer());
      const path = `${projectDir(project)}/director/${j.asset_id}-lipsync.mp4`;
      const up = await storage.from(FILM_BUCKET).upload(path, file, { contentType: "video/mp4", upsert: true });
      if (up.error) throw up.error;
      await db().from("film_assets").update({ status: "generated", storage_path: path, mime: "video/mp4", bytes: file.length, error: null }).eq("id", j.asset_id);
      const { data: a } = await db().from("film_assets").select("meta").eq("id", j.asset_id).single();
      const m = (a?.meta ?? {}) as { durationSec?: number; lipsync?: { model?: string } };
      await succeedJob(j.id, { costUsd: lipsyncUsd(m.durationSec ?? 10, m.lipsync?.model === "lipsync-2-pro"), units: m.durationSec ?? 10 });
    } catch (e) {
      await db().from("film_assets").update({ status: "failed", error: String(e instanceof Error ? e.message : e).slice(0, 300) }).eq("id", j.asset_id);
      await failJob(j.id, e);
    }
  }
  return running;
}
