// fal.ai — models run on fal's queue (submit, then poll until done). Used by «حيدرة كت» for separating music and
// sound effects (Meta's SAM-Audio). Server only; needs FAL_KEY.

import { FAL_IMAGE_SIZES } from "@config/jawad/generators";
import { ProviderError, rejectedMessage } from "./common";

const QUEUE = "https://queue.fal.run";

export const falReady = () => !!process.env.FAL_KEY;

const headers = () => ({ Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" });

/** Runs a model and waits for its output (at most `waitMs`). */
export async function falRun<T>(model: string, input: Record<string, unknown>, waitMs = 240_000): Promise<T> {
  if (!falReady()) throw new ProviderError("rejected", "خدمة الفصل غير مفعّلة على الخادم.", "FAL_KEY missing");
  const sub = await fetch(`${QUEUE}/${model}`, { method: "POST", headers: headers(), body: JSON.stringify(input) });
  if (!sub.ok) throw new ProviderError("rejected", rejectedMessage(sub.status, await sub.text()), `fal ${model} submit ${sub.status}`);
  const { status_url, response_url } = (await sub.json()) as { request_id: string; status_url: string; response_url: string };
  const until = Date.now() + waitMs;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 2500));
    const st = await fetch(status_url, { headers: headers() });
    if (!st.ok) continue;
    const s = (await st.json()) as { status: string };
    if (s.status === "COMPLETED") {
      const out = await fetch(response_url, { headers: headers() });
      if (!out.ok) throw new ProviderError("rejected", rejectedMessage(out.status, await out.text()), `fal ${model} result ${out.status}`);
      return (await out.json()) as T;
    }
    if (s.status === "FAILED" || s.status === "ERROR") throw new ProviderError("rejected", "تعذّر الفصل عند المزوّد؛ جرّب مرة ثانية.", `fal ${model} ${s.status}`);
  }
  throw new ProviderError("unknown", "الفصل أخذ وقت أطول من المتوقع؛ جرّب على جزء أقصر.", `fal ${model} timeout`);
}

/** The first file URL under `key` of a fal output ({url} or [{url}] or a plain string). */
export function falUrl(out: Record<string, unknown>, key: string): string | null {
  const v = out[key] as unknown;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return falUrl({ x: v[0] }, "x");
  if (v && typeof v === "object" && typeof (v as { url?: unknown }).url === "string") return (v as { url: string }).url;
  return null;
}

/**
 * SAM-Audio: the sound described by `prompt` taken out of a recording (`target`), and everything else (`residual`).
 * Both as downloaded files.
 */
export async function samSeparate(audioUrl: string, prompt: string, waitMs?: number) {
  // («balanced»: a song of a few minutes is done well within the request's time; long sound goes in 60 s chunks)
  const out = await falRun<Record<string, unknown>>("fal-ai/sam-audio/separate", { audio_url: audioUrl, prompt, acceleration: "balanced" }, waitMs);
  const target = falUrl(out, "target") ?? falUrl(out, "target_audio") ?? falUrl(out, "audio");
  const residual = falUrl(out, "residual") ?? falUrl(out, "residual_audio");
  if (!target || !residual) throw new ProviderError("rejected", "ما رجع الفصل بنتيجة كاملة؛ جرّب مرة ثانية.", `sam-audio output keys: ${Object.keys(out).join(",")}`);
  const get = async (u: string) => {
    const r = await fetch(u);
    if (!r.ok) throw new ProviderError("rejected", "تعذّر تنزيل نتيجة الفصل.", `download ${r.status}`);
    return { bytes: Buffer.from(await r.arrayBuffer()), mime: r.headers.get("content-type") ?? "audio/wav" };
  };
  return { target: await get(target), residual: await get(residual), residualUrl: residual };
}

/**
 * Demucs: a song or a recording split into its singing/talking (`vocals`) and its music (drums, bass and the rest),
 * as WAV links. Together the four play the recording back, so nothing is heard twice.
 */
export async function demucsSplit(audioUrl: string, quality: "normal" | "high" = "normal", waitMs = 150_000) {
  // «جودة عالية»: the fine-tuned model, run twice over shifted copies and averaged, with wider overlap: cleaner edges
  // between voice and music (and slower: a few minutes for a song)
  const tune = quality === "high" ? { model: "htdemucs_ft", shifts: 2, overlap: 0.5 } : { model: "htdemucs", shifts: 1, overlap: 0.25 };
  const out = await falRun<Record<string, unknown>>("fal-ai/demucs", { audio_url: audioUrl, ...tune, stems: ["vocals", "drums", "bass", "other"], output_format: "wav" }, waitMs);
  const urls = { vocals: falUrl(out, "vocals"), drums: falUrl(out, "drums"), bass: falUrl(out, "bass"), other: falUrl(out, "other") };
  if (!urls.vocals || !urls.drums || !urls.bass || !urls.other) throw new ProviderError("rejected", "ما رجع الفصل بنتيجة كاملة؛ جرّب مرة ثانية.", `demucs output keys: ${Object.keys(out).join(",")}`);
  return urls as Record<keyof typeof urls, string>;
}

/** A finished file of a model's output. */
export async function falFile(u: string) {
  const r = await fetch(u);
  if (!r.ok) throw new ProviderError("rejected", "تعذّر تنزيل نتيجة الفصل.", `download ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

/** A picture model of fal (Google's Nano Banana family): its images, downloaded. `refs` → its edit endpoint. */
export async function falImages(o: { model: string; editModel?: string; prompt: string; aspect: string; resolution?: string; count: number; refs: string[] }) {
  const edit = o.refs.length > 0 && o.editModel;
  // each family names its inputs its own way: Nano Banana (aspect_ratio, resolution), FLUX 2 (image_size, one picture),
  // Ideogram 3 (image_size, rendering_speed, image_urls as style references)
  const size = FAL_IMAGE_SIZES[o.aspect] ?? "square_hd";
  const input: Record<string, unknown> = o.model.startsWith("fal-ai/flux-2")
    ? { prompt: o.prompt, image_size: edit ? "auto" : size, output_format: "png", ...(edit ? { image_urls: o.refs } : {}) }
    : o.model.startsWith("fal-ai/ideogram")
      ? { prompt: o.prompt, image_size: size, num_images: o.count, ...(o.resolution ? { rendering_speed: o.resolution } : {}), ...(o.refs.length ? { image_urls: o.refs } : {}) }
      : {
          prompt: o.prompt,
          num_images: o.count,
          aspect_ratio: o.aspect,
          output_format: "png",
          ...(o.resolution ? { resolution: o.resolution } : {}),
          ...(edit ? { image_urls: o.refs } : {}),
        };
  const out = await falRun<{ images?: { url: string; content_type?: string; width?: number; height?: number }[] }>(edit ? o.editModel! : o.model, input, 270_000).catch((e) => {
    if (e instanceof ProviderError && /الفصل/.test(e.userMessage)) throw new ProviderError(e.outcome, e.outcome === "unknown" ? "التوليد أخذ وقت أطول من المتوقع؛ جرّب مرة ثانية." : "تعذّر التوليد عند المزوّد؛ جرّب مرة ثانية.", e.detail);
    throw e;
  });
  const list = out.images ?? [];
  if (!list.length) throw new ProviderError("rejected", "ما رجع المزوّد بصورة؛ جرّب وصف ثاني.", `fal ${o.model}: no images`);
  return Promise.all(
    list.map(async (im) => ({ bytes: await falFile(im.url), mime: im.content_type ?? "image/png", width: im.width ?? null, height: im.height ?? null })),
  );
}

// ───────────────────────────── videos on fal's queue (Kling) ─────────────────────────────

/** The app a model belongs to ("fal-ai/kling-video/v3/pro/text-to-video" → "fal-ai/kling-video"): its queue's requests live there. */
const appOf = (model: string) => model.split("/").slice(0, 2).join("/");

/** Sends a video to fal's queue; returns the request's id (what is followed later). */
export async function falSubmit(model: string, input: Record<string, unknown>): Promise<string> {
  if (!falReady()) throw new ProviderError("rejected", "مفتاح fal.ai غير موجود على الخادم.", "FAL_KEY missing");
  let res: Response;
  try {
    res = await fetch(`${QUEUE}/${model}`, { method: "POST", headers: headers(), body: JSON.stringify(input), signal: AbortSignal.timeout(60_000) });
  } catch (e) {
    // sent but no answer: it may be queued (never sent twice)
    throw new ProviderError("unknown", "ما تأكدنا من وصول الطلب للمزوّد.", `fal ${model} submit: ${e instanceof Error ? e.message : e}`);
  }
  if (!res.ok) throw new ProviderError("rejected", rejectedMessage(res.status, await res.text()), `fal ${model} submit ${res.status}`);
  const id = ((await res.json()) as { request_id?: string }).request_id;
  if (!id) throw new ProviderError("unknown", "ما رجع المزوّد برقم للطلب.", `fal ${model}: no request_id`);
  return id;
}

export interface FalTask {
  status: "queued" | "running" | "succeeded" | "failed";
  videoUrl: string | null;
  error: string | null;
}

/** Where a request on fal's queue stands; a finished one carries its video's link. */
export async function falTask(model: string, id: string): Promise<FalTask> {
  const base = `${QUEUE}/${appOf(model)}/requests/${encodeURIComponent(id)}`;
  const st = await fetch(`${base}/status`, { headers: headers(), signal: AbortSignal.timeout(30_000) });
  if (!st.ok) throw new Error(`fal status ${st.status}: ${(await st.text()).slice(0, 300)}`);
  const s = (await st.json()) as { status?: string; error?: string };
  if (s.status === "IN_QUEUE") return { status: "queued", videoUrl: null, error: null };
  if (s.status === "IN_PROGRESS") return { status: "running", videoUrl: null, error: null };
  if (s.status !== "COMPLETED") return { status: "failed", videoUrl: null, error: s.error ?? String(s.status) };
  // completed: the result holds the video, or the reason it failed
  const out = await fetch(base, { headers: headers(), signal: AbortSignal.timeout(30_000) });
  const body = (await out.json().catch(() => ({}))) as Record<string, unknown>;
  if (!out.ok) return { status: "failed", videoUrl: null, error: JSON.stringify(body.detail ?? body).slice(0, 500) };
  const url = falUrl(body, "video");
  return url ? { status: "succeeded", videoUrl: url, error: null } : { status: "failed", videoUrl: null, error: `no video in ${Object.keys(body).join(",")}` };
}
