// Wan 3.0 on fal: what is sent for each mode (text, first frame, first and last, references). Pure: the job engine
// (jobs.ts) signs the links and sends the request. Schemas checked 2026-10-23 (fal.ai/models/alibaba/wan-3.0/*/api).

export interface WanRef {
  kind: string;
  role: string;
}

export function wanRequest(o: { modelId: string; settings: Record<string, unknown>; prompt: string; refs: WanRef[]; urls: string[] }): { model: string; input: Record<string, unknown> } {
  const s = o.settings;
  const prompt = o.prompt.trim();
  const common = {
    ...(prompt ? { prompt } : {}),
    resolution: String(s.resolution),
    duration: Math.max(2, Math.min(30, Math.round(Number(s.duration) || 5))),
    audio: s.audio !== false,
  };
  const at = (role: string) => o.refs.findIndex((r) => r.role === role);
  const of = (kind: string) => o.refs.flatMap((r, i) => (r.kind === kind ? [o.urls[i]] : []));
  if (at("first_frame") >= 0 || at("last_frame") >= 0) {
    const first = o.urls[at("first_frame")] ?? o.urls[0];
    const last = at("last_frame") >= 0 ? o.urls[at("last_frame")] : null;
    return { model: o.modelId.replace(/text-to-video$/, "image-to-video"), input: { ...common, start_image_url: first, ...(last ? { end_image_url: last } : {}) } };
  }
  if (o.refs.length) {
    const [images, videos, audios] = [of("image"), of("video"), of("audio")];
    return {
      model: o.modelId.replace(/text-to-video$/, "reference-to-video"),
      input: {
        ...common,
        aspect_ratio: String(s.ratio),
        ...(images.length ? { reference_image_urls: images } : {}),
        ...(videos.length ? { reference_video_urls: videos } : {}),
        ...(audios.length ? { reference_audio_urls: audios } : {}),
      },
    };
  }
  return { model: o.modelId, input: { ...common, aspect_ratio: String(s.ratio) } };
}
