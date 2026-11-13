// Gemini Omni Flash 1.1 and 1.2 on fal: what is sent for each mode (text, first frame (and last), references). Pure: the
// job engine (jobs.ts) signs the links and sends the request. Schemas checked 2026-10-25 (fal.ai/models/google/
// gemini-omni-flash/v1.1/*) and 2026-11-06 (v1.2/*: 3–15 s, at most 10 with an end image). Its sound is always on
// (native, synchronized): the model has no switch for it.

import { ProviderError } from "./providers/common";

export interface OmniRef {
  kind: string;
  role: string;
}

export const OMNI_DURATION = { min: 3, max: 10, default: 8 } as const;
/** Omni 1.2: up to 15 s, but at most 10 between a first and a last frame. */
export const OMNI12_DURATION = { min: 3, max: 15, maxWithEnd: 10, default: 8 } as const;

type OmniInput = { modelId: string; settings: Record<string, unknown>; prompt: string; refs: OmniRef[]; urls: string[] };

export function omniRequest(o: OmniInput, limits: { min: number; max: number; maxWithEnd?: number; default: number } = OMNI_DURATION): { model: string; input: Record<string, unknown> } {
  const s = o.settings;
  const prompt = o.prompt.trim();
  const at = (role: string) => o.refs.findIndex((r) => r.role === role);
  const max = at("last_frame") >= 0 ? Math.min(limits.max, limits.maxWithEnd ?? limits.max) : limits.max;
  const duration = Math.max(limits.min, Math.min(max, Math.round(Number(s.duration) || limits.default)));
  const common = { ...(prompt ? { prompt } : {}), resolution: String(s.resolution), duration };
  const of = (kind: string) => o.refs.flatMap((r, i) => (r.kind === kind ? [o.urls[i]] : []));
  if (at("first_frame") >= 0 || at("last_frame") >= 0) {
    const first = o.urls[at("first_frame")] ?? o.urls[0];
    const last = at("last_frame") >= 0 ? o.urls[at("last_frame")] : null;
    return { model: o.modelId.replace(/text-to-video$/, "image-to-video"), input: { ...common, aspect_ratio: String(s.ratio), image_url: first, ...(last ? { end_image_url: last } : {}) } };
  }
  if (o.refs.length) {
    const [images, videos] = [of("image"), of("video")];
    return {
      model: o.modelId.replace(/text-to-video$/, "reference-to-video"),
      input: { ...common, aspect_ratio: String(s.ratio), ...(images.length ? { image_urls: images } : {}), ...(videos.length ? { reference_video_urls: videos } : {}) },
    };
  }
  return { model: o.modelId, input: { ...common, aspect_ratio: String(s.ratio) } };
}

/** Omni 1.2 (google/gemini-omni-flash/v1.2/*): the same request, with its own length limits. */
export const omni12Request = (o: OmniInput) => omniRequest(o, OMNI12_DURATION);

/** Omni 1.2 «تعديل فيديو» (google/gemini-omni-flash/v1.2/edit): the one video and the instruction, at the chosen resolution. */
export function omni12EditRequest(o: OmniInput): { model: string; input: Record<string, unknown> } {
  const video = o.urls[o.refs.findIndex((r) => r.kind === "video")];
  if (!video) throw new ProviderError("rejected", "أضف الفيديو اللي تبي تعدّله.", "omni 1.2 edit: no video reference");
  return { model: o.modelId, input: { prompt: o.prompt.trim(), video_url: video, resolution: String(o.settings.resolution || "720p") } };
}
