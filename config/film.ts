// Film branch settings. Edit freely.
// Spending caps (USD) are edited from /admin/film and stored in the database (film_settings).

/** The film branch's stages, in order. */
export const FILM_STAGES = [
  { key: "screenwriter", label: "السيناريست", icon: "✍️" },
  { key: "sheets", label: "صانع الشيت", icon: "🎨" },
  { key: "director", label: "المخرج", icon: "🎥" },
  { key: "voices", label: "الأصوات", icon: "🎙️" },
  { key: "done", label: "التنزيل", icon: "📦" },
] as const;

export type FilmStage = (typeof FILM_STAGES)[number]["key"];

/** Video models (both through BytePlus ModelArk). 2.5 is the default per the course's «المخرج الخارق» appendix B. */
export const VIDEO_MODELS = {
  "seedance-2.5": { label: "Seedance 2.5", maxSeconds: 30, maxImages: 30, modelId: "dreamina-seedance-2-5-260628" },
  "seedance-2.0": { label: "Seedance 2.0", maxSeconds: 15, maxImages: 9, modelId: "dreamina-seedance-2-0-260128" },
} as const;
export type VideoModel = keyof typeof VIDEO_MODELS;

/** Output qualities the client chooses from on the generation page (cost grows with the picture size). */
export const VIDEO_RESOLUTIONS = {
  "480p": { label: "480p", hint: "للتجربة والمسودات", width: 854, height: 480 },
  "720p": { label: "720p (HD)", hint: "متوازن للجوال", width: 1280, height: 720 },
  "1080p": { label: "1080p (Full HD)", hint: "أعلى جودة", width: 1920, height: 1080 },
} as const;
export type VideoResolution = keyof typeof VIDEO_RESOLUTIONS;
export const DEFAULT_VIDEO_RESOLUTION: VideoResolution = "720p";

/**
 * Video cost. BytePlus bills Seedance by output tokens ≈ width × height × 24 fps × seconds ÷ 1024, at a price
 * per 1M tokens that depends on the model and the quality (owner's ModelArk console, "without video input").
 * Seedance 2.5 prices are not confirmed yet: 2.0's are used until they are.
 */
export const VIDEO_PRICE_PER_MILLION_TOKENS: Record<VideoModel, Record<VideoResolution, number>> = {
  "seedance-2.0": { "480p": 7, "720p": 7, "1080p": 7.7 },
  "seedance-2.5": { "480p": 7, "720p": 7, "1080p": 7.7 },
};

/** Approximate tokens of one video (the provider reports the real count once it is done). */
export const videoTokens = (resolution: VideoResolution, seconds: number) =>
  (VIDEO_RESOLUTIONS[resolution].width * VIDEO_RESOLUTIONS[resolution].height * 24 * seconds) / 1024;

/** USD for a token count. */
export const videoUsd = (model: VideoModel, resolution: VideoResolution, tokens: number) =>
  (tokens * VIDEO_PRICE_PER_MILLION_TOKENS[model][resolution]) / 1_000_000;

/** Estimated USD for one video (used for the reservation and shown before generating). */
export const videoEstimateUsd = (model: VideoModel, resolution: VideoResolution, seconds: number) =>
  videoUsd(model, resolution, videoTokens(resolution, seconds));

/** Generated videos are kept on the site this many days; the client is asked to download them. */
export const VIDEO_KEEP_DAYS = 7;

/** Labels for every status a deliverable or file can have. */
export const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  awaiting_approval: "بانتظار الاعتماد",
  approved: "معتمد",
  superseded: "نسخة قديمة",
  uploaded: "مرفوع",
  queued: "بالانتظار",
  generating: "قيد التوليد",
  generated: "تم التوليد",
  rejected: "مرفوض",
  failed: "فشل",
};

export const FILM_LIMITS = {
  titleMax: 80,
  storyMax: 20000,
  factsMax: 5000,
  maxUploadBytes: 20 * 1024 * 1024,
  uploadMimes: ["image/png", "image/jpeg", "image/webp"],
  maxUploadsPerProject: 20,
  maxProjectsPerUser: 20,
};
