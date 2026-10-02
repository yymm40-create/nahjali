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
  "seedance-2.5": { label: "Seedance 2.5", maxSeconds: 30 },
  "seedance-2.0": { label: "Seedance 2.0", maxSeconds: 15 },
} as const;

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
