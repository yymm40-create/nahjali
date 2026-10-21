// JAWAD AI — «Seedance وجه واقعي»: Seedance 2.5 through the partner that accepts a person's own face (Higgsfield's
// API). Server only. The partner's name is never shown to users or written in a message to them.
// Docs: docs.higgsfield.ai/docs/models/seedance-2-5/reference-to-video · /docs/concepts/requests (statuses, cancel).
import { ProviderError, rejectedMessage } from "./common";

const BASE = "https://api.higgsfield.ai";
/** The owner's Vercel name for the key; `KEY_ID:KEY_SECRET` (or the one combined key the console gives). */
export const REALFACE_KEYS = ["HIGGSFIELD_API", "higgsfieldapi", "HIGGSFIELDAPI", "higgsfield_api", "HIGGSFIELD_API_KEY", "HF_KEY", "HF_CREDENTIALS"];
const key = () => REALFACE_KEYS.map((k) => process.env[k]?.trim()).find(Boolean) ?? "";
export const realFaceReady = () => Boolean(key());

const headers = () => ({ Authorization: `Key ${key()}`, "Content-Type": "application/json", Accept: "application/json" });

/** Sends one request (`endpoint` like «bytedance/seedance-2.5/image-to-video»); the same idempotency key never runs twice. */
export async function realFaceSubmit(endpoint: string, input: Record<string, unknown>, idempotencyKey: string): Promise<string> {
  if (!realFaceReady()) throw new ProviderError("rejected", "مفتاح «Seedance وجه واقعي» غير موجود على الخادم.", "HIGGSFIELD_API missing");
  let res: Response;
  try {
    res = await fetch(`${BASE}/${endpoint}`, {
      method: "POST",
      headers: { ...headers(), "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    // sent but no answer: it may be queued (never sent twice)
    throw new ProviderError("unknown", "ما تأكدنا من وصول الطلب للمزوّد.", `realface ${endpoint} submit: ${e instanceof Error ? e.message : e}`);
  }
  const text = await res.text();
  if (!res.ok) throw new ProviderError("rejected", rejectedMessage(res.status, text), `realface ${endpoint} ${res.status} ${text}`.slice(0, 900));
  let body: { request_id?: string } = {};
  try {
    body = JSON.parse(text);
  } catch {}
  if (!body.request_id) throw new ProviderError("unknown", "ما رجع المزوّد برقم للطلب.", `realface ${endpoint}: ${text.slice(0, 300)}`);
  return body.request_id;
}

export interface RealFaceTask {
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  videoUrl: string | null;
  error: string | null;
  /** refused by the partner's moderation (input or output) */
  moderated: boolean;
}

/** Where a request stands; a completed one carries its video's link (kept at least 7 days). */
export async function realFaceTask(id: string): Promise<RealFaceTask> {
  const res = await fetch(`${BASE}/requests/${encodeURIComponent(id)}/status`, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`realface status ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const b = (await res.json()) as { status?: string; video?: { url?: string }; error?: unknown };
  const s = String(b.status ?? "").toLowerCase();
  const error = b.error ? (typeof b.error === "string" ? b.error : JSON.stringify(b.error)).slice(0, 500) : null;
  if (s === "queued") return { status: "queued", videoUrl: null, error: null, moderated: false };
  if (s === "in_progress") return { status: "running", videoUrl: null, error: null, moderated: false };
  if (s === "canceled" || s === "cancelled") return { status: "cancelled", videoUrl: null, error: null, moderated: false };
  if (s === "nsfw") return { status: "failed", videoUrl: null, error: error ?? "nsfw", moderated: true };
  if (s === "completed") {
    const url = b.video?.url ?? null;
    return url ? { status: "succeeded", videoUrl: url, error: null, moderated: false } : { status: "failed", videoUrl: null, error: "completed without video", moderated: false };
  }
  return { status: "failed", videoUrl: null, error: error ?? (s || "failed"), moderated: false };
}

/** Cancels a request still waiting in the queue (false once it has started). */
export async function realFaceCancel(id: string): Promise<boolean> {
  const res = await fetch(`${BASE}/requests/${encodeURIComponent(id)}/cancel`, { method: "POST", headers: headers(), cache: "no-store", signal: AbortSignal.timeout(30_000) });
  return res.status === 202 || res.ok;
}
