// Gemini Omni Flash 1.1 on fal: what is sent for each mode (text, first frame (and last), references). Pure: the job
// engine (jobs.ts) signs the links and sends the request. Schemas checked 2026-10-25 (fal.ai/models/google/
// gemini-omni-flash/v1.1/*). Its sound is always on (native, synchronized): the model has no switch for it.

export interface OmniRef {
  kind: string;
  role: string;
}

export const OMNI_DURATION = { min: 3, max: 10, default: 8 } as const;

export function omniRequest(o: { modelId: string; settings: Record<string, unknown>; prompt: string; refs: OmniRef[]; urls: string[] }): { model: string; input: Record<string, unknown> } {
  const s = o.settings;
  const prompt = o.prompt.trim();
  const duration = Math.max(OMNI_DURATION.min, Math.min(OMNI_DURATION.max, Math.round(Number(s.duration) || OMNI_DURATION.default)));
  const common = { ...(prompt ? { prompt } : {}), resolution: String(s.resolution), duration };
  const at = (role: string) => o.refs.findIndex((r) => r.role === role);
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
