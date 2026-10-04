// JAWAD AI — BytePlus ModelArk (Seedance 2.x) adapter: create a task, read it, list recent tasks, cancel a queued one.
// Server only. Docs: docs.byteplus.com/en/docs/ModelArk/1520757 (create), 1521309 (retrieve), 1521675 (list), 1521720 (cancel).
import { ARK_BASE_URL, arkHeaders } from "@/lib/film/seedance";
import { ProviderError, rejectedMessage } from "./common";

async function ark(path: string, init: RequestInit & { timeoutMs?: number } = {}) {
  let res: Response;
  try {
    res = await fetch(`${ARK_BASE_URL}${path}`, { ...init, headers: arkHeaders(), cache: "no-store", signal: AbortSignal.timeout(init.timeoutMs ?? 30_000) });
  } catch (e) {
    // No answer: the provider may or may not have the request
    throw new ProviderError("unknown", "انقطع الاتصال بالمزوّد.", String(e instanceof Error ? e.message : e));
  }
  const text = await res.text();
  let body: Record<string, unknown> | null = null;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = (body?.error ?? {}) as { code?: string; message?: string };
    throw new ProviderError("rejected", rejectedMessage(res.status, `${err.code ?? ""} ${err.message ?? text}`), `ModelArk ${res.status} ${err.code ?? ""} ${err.message ?? text}`.slice(0, 900));
  }
  return body ?? {};
}

export interface ArkContent {
  type: "text" | "image_url" | "video_url" | "audio_url";
  text?: string;
  image_url?: { url: string };
  video_url?: { url: string };
  audio_url?: { url: string };
  role?: "first_frame" | "last_frame" | "reference_image" | "reference_video" | "reference_audio";
}

export interface ArkCreate {
  model: string;
  content: ArkContent[];
  ratio: string;
  resolution: string;
  duration: number;
  generate_audio: boolean;
  callback_url?: string;
  safety_identifier: string;
}

/** Starts a task. Unknown outcome (no answer) is reported as such, never retried here. */
export async function arkCreateTask(b: ArkCreate): Promise<string> {
  const body = await ark("/contents/generations/tasks", {
    method: "POST",
    // A task that cannot start within 2 hours expires (and is never billed): our jobs never wait longer
    body: JSON.stringify({ ...b, watermark: false, execution_expires_after: 7200 }),
    timeoutMs: 45_000,
  });
  if (typeof body.id !== "string" || !body.id) throw new ProviderError("unknown", "لم يرجع المزوّد رقم المهمة.", JSON.stringify(body).slice(0, 500));
  return body.id;
}

export interface ArkTask {
  id: string;
  model: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "expired" | "unknown";
  videoUrl: string | null;
  error: string | null;
  tokens: number | null;
  createdAt: number | null;
  safetyIdentifier: string | null;
  duration: number | null;
  ratio: string | null;
  resolution: string | null;
}

function readTask(t: Record<string, unknown>): ArkTask {
  const s = String(t.status ?? "").toLowerCase();
  const status = (["queued", "running", "succeeded", "failed", "cancelled", "expired"].includes(s) ? s : s === "canceled" ? "cancelled" : "unknown") as ArkTask["status"];
  const content = (t.content ?? {}) as Record<string, unknown>;
  const err = (t.error ?? null) as Record<string, unknown> | null;
  const usage = (t.usage ?? {}) as Record<string, unknown>;
  const tokens = Number(usage.completion_tokens ?? usage.total_tokens ?? NaN);
  return {
    id: String(t.id ?? ""),
    model: String(t.model ?? ""),
    status,
    videoUrl: typeof content.video_url === "string" ? content.video_url : null,
    error: err ? `${err.code ?? ""} ${err.message ?? ""}`.trim() : null,
    tokens: Number.isFinite(tokens) ? tokens : null,
    createdAt: Number.isFinite(Number(t.created_at)) ? Number(t.created_at) : null,
    safetyIdentifier: typeof t.safety_identifier === "string" ? t.safety_identifier : null,
    duration: Number.isFinite(Number(t.duration)) ? Number(t.duration) : null,
    ratio: typeof t.ratio === "string" ? t.ratio : null,
    resolution: typeof t.resolution === "string" ? t.resolution : null,
  };
}

export async function arkGetTask(id: string) {
  return readTask(await ark(`/contents/generations/tasks/${encodeURIComponent(id)}`));
}

/** Recent tasks of a model (the last 7 days, newest first), to find a task whose creation answer was lost. */
export async function arkListTasks(model: string, pageSize = 50) {
  const body = await ark(`/contents/generations/tasks?page_num=1&page_size=${pageSize}&filter.model=${encodeURIComponent(model)}`);
  return ((body.items ?? []) as Record<string, unknown>[]).map(readTask);
}

/** Cancels a task still in the queue (ModelArk cannot cancel a running task). */
export async function arkCancelTask(id: string) {
  await ark(`/contents/generations/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
}
