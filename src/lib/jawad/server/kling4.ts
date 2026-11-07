// Kling 4.0 Flash on fal: what is sent for each mode (text, first frame, references, and the «تعديل فيديو» card). Pure:
// the job engine (jobs.ts) signs the links and sends the request. Schemas checked 2026-11-07
// (fal.ai/models/kling/v4/flash/{text-to-video,image-to-video,reference-to-video,video-to-video}/api): 3–20 s, 720p only,
// 16:9 · 9:16 · 1:1 · 21:9; the first frame sets the shape itself; references are named @Image1…, @Video1… in the prompt.

import { ProviderError } from "./providers/common";

export interface Kling4Ref {
  kind: string;
  role: string;
}

type Kling4Input = { modelId: string; settings: Record<string, unknown>; prompt: string; refs: Kling4Ref[]; urls: string[] };

export const KLING4_FLASH_DURATION = { min: 3, max: 20, default: 5 } as const;
const seconds = (s: Record<string, unknown>) => Math.max(KLING4_FLASH_DURATION.min, Math.min(KLING4_FLASH_DURATION.max, Math.round(Number(s.duration) || KLING4_FLASH_DURATION.default)));
const base = (modelId: string) => modelId.replace(/\/text-to-video$/, "");

export function kling4FlashRequest(o: Kling4Input): { model: string; input: Record<string, unknown> } {
  const s = o.settings;
  const prompt = o.prompt.trim();
  const common = { ...(prompt ? { prompt } : {}), duration: seconds(s), resolution: "720p" };
  const of = (kind: string) => o.refs.flatMap((r, i) => (r.kind === kind ? [o.urls[i]] : []));
  const first = o.refs.findIndex((r) => r.role === "first_frame");
  if (first >= 0) return { model: `${base(o.modelId)}/image-to-video`, input: { ...common, start_image_url: o.urls[first] } };
  if (o.refs.length) {
    const [images, videos] = [of("image"), of("video")];
    return {
      model: `${base(o.modelId)}/reference-to-video`,
      input: { ...common, aspect_ratio: String(s.ratio || "16:9"), ...(images.length ? { image_urls: images } : {}), ...(videos.length ? { video_urls: videos } : {}) },
    };
  }
  if (!prompt) throw new ProviderError("rejected", "اكتب وصف الفيديو.", "kling 4 flash: no prompt");
  return { model: o.modelId, input: { ...common, aspect_ratio: String(s.ratio || "16:9") } };
}

/** «Kling 4.0 Flash · تعديل فيديو» (kling/v4/flash/video-to-video): the video (@Video1), the instruction, and any pictures (@Image1…). */
export function kling4FlashEditRequest(o: Kling4Input): { model: string; input: Record<string, unknown> } {
  const at = o.refs.findIndex((r) => r.kind === "video");
  if (at < 0) throw new ProviderError("rejected", "أضف الفيديو اللي تبي تعدّله.", "kling 4 flash edit: no video reference");
  const images = o.refs.flatMap((r, i) => (r.kind === "image" ? [o.urls[i]] : []));
  return { model: o.modelId, input: { prompt: o.prompt.trim(), video_url: o.urls[at], resolution: "720p", ...(images.length ? { image_urls: images } : {}) } };
}
