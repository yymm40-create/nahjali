// Kling 4.0 and Kling 4.0 Flash on fal: what is sent for each mode (text, first frame (and last, 4.0 only), references,
// and the «تعديل فيديو» cards). Pure: the job engine (jobs.ts) signs the links and sends the request. Schemas checked
// 2026-11-07 (fal.ai/models/kling/v4/* and kling/v4/flash/*): 4.0 is 3–30 s at 720p or 1080p, Flash 3–20 s at 720p only;
// 16:9 · 9:16 · 1:1 · 21:9; the frames set the shape themselves; references are named @Image1…, @Video1… in the prompt.

import { ProviderError } from "./providers/common";

export interface Kling4Ref {
  kind: string;
  role: string;
}

type Kling4Input = { modelId: string; settings: Record<string, unknown>; prompt: string; refs: Kling4Ref[]; urls: string[] };

const isFlash = (modelId: string) => modelId.startsWith("kling/v4/flash/");
const resolution = (modelId: string, s: Record<string, unknown>) => (isFlash(modelId) ? "720p" : s.resolution === "720p" ? "720p" : "1080p");
const seconds = (modelId: string, s: Record<string, unknown>) => Math.max(3, Math.min(isFlash(modelId) ? 20 : 30, Math.round(Number(s.duration) || 5)));
const base = (modelId: string) => modelId.replace(/\/text-to-video$/, "");

export function kling4Request(o: Kling4Input): { model: string; input: Record<string, unknown> } {
  const s = o.settings;
  const prompt = o.prompt.trim();
  const common = { ...(prompt ? { prompt } : {}), duration: seconds(o.modelId, s), resolution: resolution(o.modelId, s) };
  const of = (kind: string) => o.refs.flatMap((r, i) => (r.kind === kind ? [o.urls[i]] : []));
  const at = (role: string) => o.refs.findIndex((r) => r.role === role);
  if (at("first_frame") >= 0) {
    const last = !isFlash(o.modelId) && at("last_frame") >= 0 ? o.urls[at("last_frame")] : null;
    return { model: `${base(o.modelId)}/image-to-video`, input: { ...common, start_image_url: o.urls[at("first_frame")], ...(last ? { end_image_url: last } : {}) } };
  }
  if (o.refs.length) {
    const [images, videos] = [of("image"), of("video")];
    return {
      model: `${base(o.modelId)}/reference-to-video`,
      input: { ...common, aspect_ratio: String(s.ratio || "16:9"), ...(images.length ? { image_urls: images } : {}), ...(videos.length ? { video_urls: videos } : {}) },
    };
  }
  if (!prompt) throw new ProviderError("rejected", "اكتب وصف الفيديو.", "kling 4: no prompt");
  return { model: o.modelId, input: { ...common, aspect_ratio: String(s.ratio || "16:9") } };
}

/** «تعديل فيديو» (kling/v4/video-to-video/edit · kling/v4/flash/video-to-video): the video (@Video1), the instruction, any pictures (@Image1…). */
export function kling4EditRequest(o: Kling4Input): { model: string; input: Record<string, unknown> } {
  const at = o.refs.findIndex((r) => r.kind === "video");
  if (at < 0) throw new ProviderError("rejected", "أضف الفيديو اللي تبي تعدّله.", "kling 4 edit: no video reference");
  const images = o.refs.flatMap((r, i) => (r.kind === "image" ? [o.urls[i]] : []));
  return { model: o.modelId, input: { prompt: o.prompt.trim(), video_url: o.urls[at], resolution: resolution(o.modelId, o.settings), ...(images.length ? { image_urls: images } : {}) } };
}

/** The names the Flash change shipped with (PR 628). */
export const kling4FlashRequest = kling4Request;
export const kling4FlashEditRequest = kling4EditRequest;
