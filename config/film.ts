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

/**
 * Video cost. BytePlus bills Seedance by tokens; the real price per 1M tokens (from the ModelArk pricing page
 * of the owner's account) goes in `usdPerMillionTokens`. Until it is filled in, the per-second estimate is
 * used for both the reservation and the recorded cost.
 */
export const VIDEO_PRICING: Record<VideoModel, { usdPerSecondEstimate: number; usdPerMillionTokens: number | null }> = {
  "seedance-2.5": { usdPerSecondEstimate: 0.15, usdPerMillionTokens: null },
  "seedance-2.0": { usdPerSecondEstimate: 0.1, usdPerMillionTokens: null },
};

/** Output resolution for every video generation (cost grows with it). */
export const VIDEO_RESOLUTION = "720p";

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
