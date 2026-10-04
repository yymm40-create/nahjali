// «لأجل المهدي» settings. Edit freely.
// Content the admin will manage later (shrines, motivational phrases, verified religious texts) lives in the database.

/** Where the branch lives on the site. */
export const MAHDI_BASE = "/mahdi";

/** Sign-in providers. Apple needs a paid Apple Developer account ($99/year) and a secret renewed every 6 months. */
export const MAHDI_AUTH = {
  google: true,
  email: true,
  apple: false,
};

export type MahdiTheme = "cinematic" | "minimal" | "night";

/** The three looks. The shrine is chosen separately. */
export const MAHDI_THEMES: { key: MahdiTheme; label: string; description: string; themeColor: string }[] = [
  { key: "cinematic", label: "الحرم السينمائي", description: "صورة الحرم حاضرة بقوة، إضاءة ذهبية وزجاج خفيف.", themeColor: "#0d0c0b" },
  { key: "minimal", label: "السكينة", description: "فاتح وهادئ: عاجي وذهبي خفيف ومساحات مريحة.", themeColor: "#faf6ee" },
  { key: "night", label: "زيارة الليل", description: "داكن فاخر بإضاءة الحرم الذهبية، كزيارة ليلية هادئة.", themeColor: "#0b0c0e" },
];
export const DEFAULT_THEME: MahdiTheme = "cinematic";
export const DEFAULT_SHRINE = "imam-ali";

/** Project accent colours (keys stored in the database). */
export const PROJECT_COLORS = ["gold", "emerald", "lapis", "turquoise", "garnet", "amber", "olive", "stone"] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];

/** Suggested names in onboarding and in "new project" (the user can type any name). */
export const PROJECT_SUGGESTIONS = [
  { name: "العبادة", icon: "📿" },
  { name: "الدراسة", icon: "📚" },
  { name: "الصحة", icon: "🌿" },
  { name: "الرياضة", icon: "🏃" },
  { name: "الأسرة", icon: "🏡" },
  { name: "بناء النفس", icon: "🌱" },
];

/** Icons offered for projects and habits (any single emoji can also be typed). */
export const ICON_CHOICES = [
  "📿", "🤲", "📖", "🕌", "🌙", "☀️", "⭐", "🕯️", "💧", "🌿", "🌱", "🍎", "🥗", "💤", "🏃", "🚶", "💪", "🧘",
  "📚", "✍️", "🧠", "🎯", "⏰", "🧹", "🏡", "👨‍👩‍👧", "🤝", "💛", "🗣️", "💰", "🖊️", "🎧", "📵", "🧴",
];

/** Common units for amount habits; a custom unit can be typed. */
export const UNIT_CHOICES = ["صفحة", "دقيقة", "ساعة", "خطوة", "لتر", "كوب", "كم", "ركعة", "آية", "جزء"];

/** A day (or week) is "consistent" when at least this share of its goals is reached. */
export const CONSISTENCY_THRESHOLD = 0.8;

/** How much history the app loads into the browser (days). Older data is fetched when a report needs it. */
export const HISTORY_DAYS = 400;

/** "Undo" stays available this long after a tap (ms). */
export const UNDO_MS = 6000;

export const MAHDI_LIMITS = {
  nameMax: 30,
  projectNameMax: 40,
  habitNameMax: 60,
  categoryMax: 30,
  notesMax: 500,
  unitMax: 20,
  maxProjects: 30,
  maxHabits: 200,
  maxValue: 1_000_000,
  maxCountTarget: 1000,
  maxLogOps: 100,
  avatarMaxBytes: 5 * 1024 * 1024,
};

/**
 * «حسّن الغلاف»: GPT Image 2 cleans a photo of a book cover (one 1024×1536 image at medium quality). Its cost by
 * OpenAI's official formula: 1,372 output tokens × $30/M + the photo at the 7,100-token cap × $8/M + up to 2,000
 * prompt tokens × $5/M ≈ $0.108 → 4 coins (see config/coins.ts). Free for the owner and while coins are off.
 */
export const COVER_ENHANCE = { model: "gpt-image-2-2026-04-21", size: "1024x1536", quality: "medium", costUsd: 0.108, coins: 4, perDay: 10 } as const;

/** A book's PDF for download: one file per book, uploaded straight to storage (never through the website). */
export const BOOK_PDF = { maxBytes: 50 * 1024 * 1024, perDay: 10 } as const;
