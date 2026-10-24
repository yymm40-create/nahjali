// Seedance video generation through BytePlus ModelArk (create a task, then poll it). Server only: the key
// never reaches the browser. API: POST/GET {base}/contents/generations/tasks (docs.byteplus.com, ModelArk
// "Create / Retrieve a video generation task", checked 2026-10).

import { randomUUID } from "crypto";
import { VIDEO_MODELS, type VideoModel, type VideoResolution } from "@config/film";
import { realFaceSubmit, realFaceTask } from "@/lib/jawad/server/providers/realface";
import { falSubmit, falTask } from "@/lib/jawad/server/providers/fal";

export const ARK_BASE_URL = (process.env.ARK_BASE_URL || "https://ark.ap-southeast.bytepluses.com/api/v3").replace(/\/+$/, "");

export function arkHeaders() {
  // ARK_API_KEY is the documented name; the owner's Vercel project stores it as seedance_api
  const key = process.env.ARK_API_KEY || process.env.seedance_api || process.env.SEEDANCE_API;
  if (!key) throw new Error("مفتاح BytePlus (ARK_API_KEY) مو موجود في إعدادات Vercel لهذا المشروع، أو انضاف بعد آخر نشر. أضفه لبيئة Production وانشر من جديد.");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

/** The model ID can be overridden per environment when BytePlus rolls out a newer dated ID. */
const modelId = (m: VideoModel) =>
  (m === "seedance-2.5" ? process.env.ARK_MODEL_SEEDANCE_25 : m === "seedance-2.0" ? process.env.ARK_MODEL_SEEDANCE_20 : undefined) || VIDEO_MODELS[m].modelId;

/** One ModelArk request (also used by JAWAD AI's video studio, src/lib/jawad/server/providers/modelark.ts). */
export async function arkCall(path: string, init?: RequestInit) {
  const res = await fetch(`${ARK_BASE_URL}${path}`, { ...init, headers: arkHeaders(), cache: "no-store" });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = body?.error;
    throw new Error(`Seedance ${res.status}: ${e?.message ?? e?.code ?? body?.message ?? "request failed"}`);
  }
  return body as Record<string, unknown>;
}

export interface VideoRequest {
  model: VideoModel;
  prompt: string;
  /** Short-lived URLs of the reference images, in <<<image_n>>> order. */
  imageUrls: string[];
  /** Short-lived URLs of reference audio (the shot's spoken dialogue): the model lip-syncs to it and keeps it. */
  audioUrls?: string[];
  durationSec: number;
  ratio: string;
  generateAudio: boolean;
  resolution: VideoResolution;
}

/** A task of «Seedance وجه واقعي» carries this prefix, so it is followed at its own provider. */
const REAL_FACE = "rf:";

/** A task of Wan 3.0 carries this prefix (followed on fal's queue). */
const WAN = "wan:";
const WAN_APP = "alibaba/wan-3.0";

/** Wan 3.0's request for a film shot: references (pictures and the shot's voice) when there are any, else from the text. */
export function wanFilmRequest(r: VideoRequest): { model: string; input: Record<string, unknown> } {
  // the references are named «Image 1», «Audio 1» … at Wan (the director writes <<<image_n>>>)
  const prompt = r.prompt.replace(/<<<\s*(image|audio|video)_(\d+)\s*>>>/gi, (_m, kind: string, n: string) => `${kind[0].toUpperCase()}${kind.slice(1).toLowerCase()} ${n}`);
  const images = r.imageUrls.slice(0, VIDEO_MODELS["wan-3.0"].maxImages);
  const audios = r.audioUrls ?? [];
  const common = { prompt, duration: Math.max(2, Math.min(30, Math.round(r.durationSec))), resolution: r.resolution, aspect_ratio: r.ratio || "16:9", audio: r.generateAudio };
  if (!images.length && !audios.length) return { model: `${WAN_APP}/text-to-video`, input: common };
  return { model: `${WAN_APP}/reference-to-video`, input: { ...common, ...(images.length ? { reference_image_urls: images } : {}), ...(audios.length ? { reference_audio_urls: audios } : {}) } };
}

/** Starts a generation and returns the provider's task ID. */
export async function createVideoTask(r: VideoRequest): Promise<string> {
  if (r.model === "wan-3.0") {
    const { model, input } = wanFilmRequest(r);
    return WAN + (await falSubmit(model, input));
  }
  if (r.model === "seedance-real-face") {
    // the references are named @image1, @audio1 … at this provider (the director writes <<<image_n>>>)
    const prompt = r.prompt.replace(/<<<\s*(image|audio|video)_(\d+)\s*>>>/gi, (_m, kind: string, n: string) => `@${kind.toLowerCase()}${n}`);
    const id = await realFaceSubmit("bytedance/seedance-2.5/reference-to-video", {
      prompt,
      duration: Math.max(4, Math.min(30, Math.round(r.durationSec))),
      resolution: r.resolution,
      aspect_ratio: r.ratio || "16:9",
      generate_audio: r.generateAudio,
      ...(r.imageUrls.length ? { image_urls: r.imageUrls } : {}),
      ...(r.audioUrls?.length ? { audio_urls: r.audioUrls } : {}),
    }, randomUUID());
    return REAL_FACE + id;
  }
  const content: Record<string, unknown>[] = [{ type: "text", text: r.prompt }];
  for (const url of r.imageUrls) content.push({ type: "image_url", image_url: { url }, role: "reference_image" });
  for (const url of r.audioUrls ?? []) content.push({ type: "audio_url", audio_url: { url }, role: "reference_audio" });
  const body = await arkCall("/contents/generations/tasks", {
    method: "POST",
    body: JSON.stringify({
      model: modelId(r.model),
      content,
      duration: r.durationSec,
      ratio: r.ratio || "16:9",
      resolution: r.resolution,
      generate_audio: r.generateAudio,
      watermark: false,
    }),
  });
  if (typeof body.id !== "string" || !body.id) throw new Error("Seedance: no task id in the reply");
  return body.id;
}

export interface VideoTask {
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "expired" | "unknown";
  /** Valid for 24 hours only: the file must be copied to our storage right away. */
  videoUrl: string | null;
  error: string | null;
  tokens: number | null;
}

export async function getVideoTask(taskId: string): Promise<VideoTask> {
  if (taskId.startsWith(WAN)) {
    const t = await falTask(WAN_APP, taskId.slice(WAN.length));
    return { status: t.status, videoUrl: t.videoUrl, error: t.error, tokens: null };
  }
  if (taskId.startsWith(REAL_FACE)) {
    const t = await realFaceTask(taskId.slice(REAL_FACE.length));
    return { status: t.status, videoUrl: t.videoUrl, error: t.moderated ? "رفض الفحص هذا الفيديو (وجه أو محتوى غير مسموح)." : t.error, tokens: null };
  }
  const body = await arkCall(`/contents/generations/tasks/${encodeURIComponent(taskId)}`);
  const s = String(body.status ?? "").toLowerCase();
  const status = (["queued", "running", "succeeded", "failed", "cancelled", "expired"].includes(s) ? s : s === "canceled" ? "cancelled" : "unknown") as VideoTask["status"];
  const content = (body.content ?? {}) as Record<string, unknown>;
  const err = (body.error ?? null) as Record<string, unknown> | null;
  const usage = (body.usage ?? {}) as Record<string, unknown>;
  const tokens = Number(usage.completion_tokens ?? usage.total_tokens ?? NaN);
  return {
    status,
    videoUrl: typeof content.video_url === "string" ? content.video_url : null,
    error: err ? String(err.message ?? err.code ?? "failed") : null,
    tokens: Number.isFinite(tokens) ? tokens : null,
  };
}
