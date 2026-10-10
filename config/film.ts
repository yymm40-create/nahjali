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
/** Qualities users can pick right now, for both Seedance models (owner: 480p only until he says otherwise). */
export const VIDEO_OPEN_RESOLUTIONS: readonly VideoResolution[] = ["480p"];
export const DEFAULT_VIDEO_RESOLUTION: VideoResolution = "480p";

/**
 * Video cost. BytePlus bills Seedance by output tokens ≈ width × height × 24 fps × seconds ÷ 1024, at a price
 * per 1M tokens that depends on the model and the quality (owner's ModelArk console, "without video input").
 */
export const VIDEO_PRICE_PER_MILLION_TOKENS: Record<VideoModel, Record<VideoResolution, number>> = {
  "seedance-2.0": { "480p": 7, "720p": 7, "1080p": 7.7 },
  "seedance-2.5": { "480p": 10.7, "720p": 10.7, "1080p": 11.7 },
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

/**
 * Public trial: while `open`, the first `users` people (the owner excluded) to start a film project can use
 * the film maker for free, from the story to their first video; once that video is made their trial is over.
 * When all places are taken the film maker is closed to everyone but the owner. `open: false` goes back to
 * the invite list.
 */
// `since`: only projects started from this moment count (UTC), so older test projects take no place
// The number of users and each user's free videos are set from /admin/limits (src/lib/film/limits.ts)
export const FILM_PUBLIC_TRIAL = { open: true, since: "2026-10-03T13:38:00Z" } as const;

/** Video length the client can choose on the generation page (seconds). */
// The longest is Seedance 2.5's 30 s; each model's own cap (VIDEO_MODELS[m].maxSeconds) applies on top
export const VIDEO_DURATION = { min: 4, max: 30 } as const;
export const clampVideoSeconds = (sec: number, model?: VideoModel) =>
  Math.min(Math.max(Math.round(sec || 10), VIDEO_DURATION.min), model ? VIDEO_MODELS[model].maxSeconds : VIDEO_DURATION.max);

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

/**
 * WHAT IS BEING MADE. The maker used to know one shape only — a single scene — so a person who wanted a whole film
 * got a scene, and a person who wanted one shot got a film's brief. The three shapes are now named at the start:
 * a SHORT SCENE that stands on its own, a CINEMATIC FILM (several scenes with a beginning, a turn and an end — and
 * every scene inside it is still made with the same tools), or a WHOLE SERIES, which has its own place («المسلسل
 * الذكي») with episodes and a cast that stays the same.
 */
export const FILM_KINDS = [
  {
    id: "scene",
    ar: "مشهد قصير",
    icon: "🎬",
    hint: "لقطة أو مشهد واحد يقف بنفسه (ريل، إعلان قصير، لحظة واحدة)",
    /** what the screenwriter is told to write */
    brief: "هذا مشهد قصير يقف بنفسه: مكان واحد ولحظة واحدة وهدف واحد. لا تكتب فصولًا ولا خطًا دراميًا طويلًا، ولا تفتح أحداثًا تحتاج مشاهد أخرى — المشهد يبدأ وينتهي هنا.",
    seconds: [8, 60] as [number, number],
  },
  {
    id: "film",
    ar: "فيلم سينمائي",
    icon: "🎥",
    hint: "عمل كامل من عدّة مشاهد: بداية وتحوّل ونهاية، وكل مشهد يُصنع بنفس الأدوات",
    brief: "هذا فيلم سينمائي كامل: اكتبه كعمل له بداية تُعرّف وتحوّل يقلب الحال ونهاية تُقنع، مقسّمًا إلى مشاهد مرقّمة، كل مشهد بمكانه ووقته وهدفه الدرامي وكيف يسلّم للذي بعده، مع خط الشخصية الرئيسية من أول مشهد لآخره. وضّح أي مشهد هو الذروة.",
    seconds: [60, 900] as [number, number],
  },
  {
    id: "series",
    ar: "مسلسل كامل",
    icon: "📺",
    hint: "حلقات بشخصيات ثابتة — يفتح «المسلسل الذكي» بحلقاته وفريق التمثيل",
    brief: "",
    seconds: [0, 0] as [number, number],
  },
] as const;
export type FilmKind = (typeof FILM_KINDS)[number]["id"];
export const filmKind = (v: unknown) => FILM_KINDS.find((k) => k.id === v) ?? null;
/** The shape a project is made in (a scene when nothing was chosen, which is how every old project was made). */
export const readFilmKind = (v: unknown): Exclude<FilmKind, "series"> => (v === "film" ? "film" : "scene");

export const FILM_LIMITS = {
  titleMax: 80,
  storyMax: 20000,
  factsMax: 5000,
  maxUploadBytes: 20 * 1024 * 1024,
  uploadMimes: ["image/png", "image/jpeg", "image/webp"],
  maxUploadsPerProject: 20,
  maxProjectsPerUser: 20,
};
