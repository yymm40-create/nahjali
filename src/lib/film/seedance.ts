// Seedance video generation through BytePlus ModelArk (create a task, then poll it). Server only: the key
// never reaches the browser. API: POST/GET {base}/contents/generations/tasks (docs.byteplus.com, ModelArk
// "Create / Retrieve a video generation task", checked 2026-10).

import { VIDEO_MODELS, type VideoModel, type VideoResolution } from "@config/film";

const BASE_URL = (process.env.ARK_BASE_URL || "https://ark.ap-southeast.bytepluses.com/api/v3").replace(/\/+$/, "");

function headers() {
  // ARK_API_KEY is the documented name; the owner's Vercel project stores it as seedance_api
  const key = process.env.ARK_API_KEY || process.env.seedance_api || process.env.SEEDANCE_API;
  if (!key) throw new Error("مفتاح BytePlus (ARK_API_KEY) مو موجود في إعدادات Vercel لهذا المشروع، أو انضاف بعد آخر نشر. أضفه لبيئة Production وانشر من جديد.");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

/** The model ID can be overridden per environment when BytePlus rolls out a newer dated ID. */
const modelId = (m: VideoModel) =>
  (m === "seedance-2.5" ? process.env.ARK_MODEL_SEEDANCE_25 : process.env.ARK_MODEL_SEEDANCE_20) || VIDEO_MODELS[m].modelId;

async function call(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers: headers(), cache: "no-store" });
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
  durationSec: number;
  ratio: string;
  generateAudio: boolean;
  resolution: VideoResolution;
}

/** Starts a generation and returns the provider's task ID. */
export async function createVideoTask(r: VideoRequest): Promise<string> {
  const content: Record<string, unknown>[] = [{ type: "text", text: r.prompt }];
  for (const url of r.imageUrls) content.push({ type: "image_url", image_url: { url }, role: "reference_image" });
  const body = await call("/contents/generations/tasks", {
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
  const body = await call(`/contents/generations/tasks/${encodeURIComponent(taskId)}`);
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
