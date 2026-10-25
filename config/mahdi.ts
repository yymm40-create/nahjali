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

export type MahdiTheme =
  | "rings" | "bars" | "liquid" | "buttons" | "heatmap" | "bento" | "pop" | "garden" | "path" | "flame"
  | "gauge" | "swipe" | "timeline" | "cells" | "rpg" | "aurora" | "neon" | "journal" | "zakhrafa" | "mono"
  | "cinematic" | "minimal" | "night";

/** How a design draws the day's two goals (habits, reading) at the top of the home. */
export type GoalsStyle = "ring" | "rings3" | "bar" | "liquid" | "heatmap" | "bento" | "segments" | "garden" | "path" | "flame" | "gauge" | "rpg" | "stickers" | "star" | "number" | "chip";
/** How a design lays out the habits to tap. */
export type QuickStyle = "tiles" | "list" | "circles" | "cells" | "swipe" | "timeline" | "xp";

export interface MahdiDesign {
  key: MahdiTheme;
  /** its number in the gallery the owner chose from (1–20; 0 = «الحرم», the shrine look) */
  n: number;
  label: string;
  description: string;
  /** the app or school it learns from (researched: components/mahdi/HomeBoard) */
  from: string;
  themeColor: string;
  light: boolean;
  goals: GoalsStyle;
  quick: QuickStyle;
  /** how the design draws the holy shrine (lib/mahdi/shrine-art.ts), and where it shows it unless the person chooses */
  art: "gold" | "flat" | "outline" | "silhouette" | "line" | "glow" | "gradient" | "dots" | "sketch";
  place: "backdrop" | "banner" | "horizon" | "photo";
  legacy?: true;
}

/**
 * The designs the person chooses between: twenty different apps in style, letters, colours, corners — and in how the
 * day is drawn (rings, a filling bar, a glass that fills, a heatmap, a plant that grows, a path, a gauge, one card to
 * swipe, a timeline…). Built from research on the trackers that won (Streaks and (Not Boring) Habits: Apple Design
 * Awards; Duolingo's streak; Finch; Habitica; Apple's activity rings; GitHub's heatmap) and on the psychology of
 * progress (goal gradient, endowed progress, Fogg's celebration, self-determination theory, Lally's 66 days).
 * «الحرم» keeps the shrine; «السكينة» and «زيارة الليل» are older looks kept for whoever chose them.
 */
export const MAHDI_THEMES: MahdiDesign[] = [
  { key: "rings", n: 1, label: "حلقات النشاط", from: "Apple Fitness", description: "داكن بثلاث حلقات متداخلة: العادات والقراءة والأسبوع، تقفلها كل يوم.", themeColor: "#000000", light: false, goals: "rings3", quick: "list", art: "glow", place: "backdrop" },
  { key: "bars", n: 2, label: "الشريط اللي يتعبّى", from: "Things · Todoist", description: "فاتح ونظيف، أشرطة عريضة تتعبّى وتقارن أهدافك بنظرة.", themeColor: "#fbfbfd", light: true, goals: "bar", quick: "list", art: "line", place: "horizon" },
  { key: "liquid", n: 3, label: "الكوب اللي يمتلي", from: "Plant Nanny · WaterMinder", description: "مائي، أهدافك كؤوس يرتفع فيها الماء مع إنجازك.", themeColor: "#eaf5ff", light: true, goals: "liquid", quick: "tiles", art: "gradient", place: "banner" },
  { key: "buttons", n: 4, label: "الأزرار الكبيرة", from: "Streaks", description: "كل عادة زر دائري ضخم بحلقة حوله: ضغطة وتكمل.", themeColor: "#ff6b4a", light: false, goals: "chip", quick: "circles", art: "silhouette", place: "banner" },
  { key: "heatmap", n: 5, label: "خريطة الحرارة", from: "GitHub · Loop", description: "داكن، مربعات أيامك من أسابيع تبيّن ثباتك.", themeColor: "#0d1117", light: false, goals: "heatmap", quick: "cells", art: "dots", place: "backdrop" },
  { key: "bento", n: 6, label: "بنتو ملوّن", from: "اتجاه ٢٠٢٥–٢٠٢٦", description: "بطاقات ملوّنة بأحجام مختلفة، كل معلومة بحجم أهميتها.", themeColor: "#f4f1ea", light: true, goals: "bento", quick: "tiles", art: "flat", place: "banner" },
  { key: "pop", n: 7, label: "نيو بروتال", from: "ستايل Gen Z", description: "جريء: حدود سوداء عريضة، ظلال صلبة، وألوان فاقعة.", themeColor: "#fff4dc", light: true, goals: "segments", quick: "tiles", art: "outline", place: "banner" },
  { key: "garden", n: 8, label: "النبتة تكبر", from: "Finch · Forest", description: "إنجازك يكبّر نبتتك مرحلة بعد مرحلة.", themeColor: "#e3f6e0", light: true, goals: "garden", quick: "tiles", art: "flat", place: "horizon" },
  { key: "path", n: 9, label: "طريق المراحل", from: "Duolingo", description: "أيامك عُقد على طريق، تشوف وين وصلت ووين باقي.", themeColor: "#ffffff", light: true, goals: "path", quick: "list", art: "flat", place: "horizon" },
  { key: "flame", n: 10, label: "الشعلة الكبيرة", from: "Duolingo · Snapchat", description: "رقم سلسلتك بطل الشاشة، وأيام أسبوعك تحته.", themeColor: "#b8174f", light: false, goals: "flame", quick: "list", art: "silhouette", place: "banner" },
  { key: "gauge", n: 11, label: "العدّاد", from: "Oura · لوحة السيارة", description: "داكن، يومك درجة على عدّاد نصف دائري.", themeColor: "#0f1220", light: false, goals: "gauge", quick: "list", art: "glow", place: "backdrop" },
  { key: "swipe", n: 12, label: "البطاقة اللي تسحبها", from: "Headspace", description: "عادة وحدة قدامك: سويتها أو بعدين، بدون تشتيت.", themeColor: "#f6f2ff", light: true, goals: "bar", quick: "swipe", art: "gradient", place: "banner" },
  { key: "timeline", n: 13, label: "الخط الزمني لليوم", from: "Structured · Tiimo", description: "يومك مرتب بالأوقات من الفجر لليل.", themeColor: "#fffaf5", light: true, goals: "bar", quick: "timeline", art: "line", place: "horizon" },
  { key: "cells", n: 14, label: "خلايا البطارية", from: "Habitify · Productive", description: "كل عادة شريط خلايا لأيام أسبوعها.", themeColor: "#f7f8fa", light: true, goals: "chip", quick: "cells", art: "silhouette", place: "horizon" },
  { key: "rpg", n: 15, label: "شخصية تلعب", from: "Habitica", description: "كل عادة نقاط خبرة ترفع مستوى شخصيتك.", themeColor: "#2b1d4e", light: false, goals: "rpg", quick: "xp", art: "dots", place: "banner" },
  { key: "aurora", n: 16, label: "شفق زجاجي", from: "iOS · Arc", description: "فاتح ومبهج: تدرّج بنفسجي وردي برتقالي على زجاج.", themeColor: "#f6f0ff", light: true, goals: "ring", quick: "tiles", art: "gradient", place: "backdrop" },
  { key: "neon", n: 17, label: "نيون", from: "ألعاب · Cyberpunk", description: "داكن بإضاءات نيون تلمع، وعناوين عريضة كالملصق.", themeColor: "#07070d", light: false, goals: "ring", quick: "list", art: "glow", place: "backdrop" },
  { key: "journal", n: 18, label: "الدفتر", from: "Bullet Journal · Daylio", description: "ورق مسطّر وخط يد وستيكرات.", themeColor: "#fdf8ee", light: true, goals: "stickers", quick: "list", art: "sketch", place: "banner" },
  { key: "zakhrafa", n: 19, label: "الزخرفة الإسلامية", from: "العمارة الإسلامية", description: "ذهبي وفيروزي، نجمة ثمانية تمتلي مع إنجازك.", themeColor: "#0b1f1c", light: false, goals: "star", quick: "tiles", art: "gold", place: "banner" },
  { key: "mono", n: 20, label: "الأرقام الكبيرة", from: "(Not Boring) Habits · Things", description: "هادئ جدًا: رقم كبير وقائمة نظيفة، بلا زحمة.", themeColor: "#ffffff", light: true, goals: "number", quick: "list", art: "line", place: "horizon" },
  { key: "cinematic", n: 0, label: "الحرم", from: "لأجل المهدي", description: "صورة الحرم حاضرة، إضاءة ذهبية وخط عربي كلاسيكي.", themeColor: "#0d0c0b", light: false, goals: "ring", quick: "tiles", art: "gold", place: "photo" },
  { key: "minimal", n: 0, label: "السكينة", from: "لأجل المهدي", description: "فاتح وهادئ: عاجي وذهبي خفيف ومساحات مريحة.", themeColor: "#faf6ee", light: true, goals: "ring", quick: "tiles", art: "gold", place: "photo", legacy: true },
  { key: "night", n: 0, label: "زيارة الليل", from: "لأجل المهدي", description: "داكن فاخر بإضاءة الحرم الذهبية.", themeColor: "#0b0c0e", light: false, goals: "ring", quick: "tiles", art: "gold", place: "photo", legacy: true },
];
/** The designs offered in the picker (the twenty and «الحرم»). */
export const PICKED_THEMES = MAHDI_THEMES.filter((x) => !x.legacy);
/** Light looks (the browser chrome, the status bar). */
export const LIGHT_THEMES: MahdiTheme[] = MAHDI_THEMES.filter((x) => x.light).map((x) => x.key);
export const designOf = (k: string | null | undefined) => MAHDI_THEMES.find((x) => x.key === k) ?? MAHDI_THEMES.find((x) => x.key === "aurora")!;
export const DEFAULT_THEME: MahdiTheme = "aurora";
export const DEFAULT_SHRINE = "imam-ali";

/** Project accent colours (keys stored in the database). */
export const PROJECT_COLORS = ["gold", "emerald", "lapis", "turquoise", "garnet", "amber", "olive", "stone"] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];

/**
 * Habit colours: the person picks one per habit and it shows on the habit's tick, bar and dot (keys stored in the
 * database; null = the project's colour). Mid tones, so each one reads on light and dark designs.
 */
export const HABIT_COLORS = [
  { key: "ruby", name: "ياقوتي", hex: "#e5484d" },
  { key: "rose", name: "وردي", hex: "#e93d82" },
  { key: "pink", name: "زهري", hex: "#d6409f" },
  { key: "plum", name: "برقوقي", hex: "#ab4aba" },
  { key: "purple", name: "بنفسجي", hex: "#8e4ec6" },
  { key: "violet", name: "أرجواني", hex: "#6e56cf" },
  { key: "indigo", name: "نيلي", hex: "#3e63dd" },
  { key: "blue", name: "أزرق", hex: "#0b84f3" },
  { key: "sky", name: "سماوي", hex: "#29a9e0" },
  { key: "cyan", name: "فيروزي", hex: "#00a2c7" },
  { key: "teal", name: "أخضر مزرق", hex: "#12a594" },
  { key: "jade", name: "يشمي", hex: "#29a383" },
  { key: "green", name: "أخضر", hex: "#30a46c" },
  { key: "grass", name: "عشبي", hex: "#46a758" },
  { key: "lime", name: "ليموني", hex: "#8db32a" },
  { key: "olive", name: "زيتوني", hex: "#8a8f3c" },
  { key: "yellow", name: "أصفر", hex: "#e2b203" },
  { key: "amber", name: "كهرماني", hex: "#f5a524" },
  { key: "orange", name: "برتقالي", hex: "#f76b15" },
  { key: "coral", name: "مرجاني", hex: "#e54d2e" },
  { key: "brown", name: "بني", hex: "#a07553" },
  { key: "bronze", name: "برونزي", hex: "#a18072" },
  { key: "gold", name: "ذهبي", hex: "#c9a227" },
  { key: "slate", name: "رصاصي", hex: "#6b7a90" },
  { key: "crimson", name: "قرمزي", hex: "#b5303f" },
  { key: "peach", name: "خوخي", hex: "#f08a65" },
  { key: "ocean", name: "محيطي", hex: "#1c6ea4" },
  { key: "lavender", name: "خزامي", hex: "#9a8cd8" },
  { key: "sage", name: "مريمي", hex: "#7a9a7e" },
  { key: "sand", name: "رملي", hex: "#c8b08a" },
] as const;
export type HabitColor = (typeof HABIT_COLORS)[number]["key"];
export const habitColorHex = (key: string | null | undefined) => HABIT_COLORS.find((c) => c.key === key)?.hex ?? null;

/** A milestone («هدف مرحلي») is measured over one of these periods, again and again. */
export const MILESTONE_PERIODS = ["week", "2weeks", "month", "2months"] as const;
export type MilestonePeriod = (typeof MILESTONE_PERIODS)[number];

/** Strategic goals: research says few at once (OKR/Hoshin: 3–5; we advise 3) and a handful of milestones each. */
export const GOAL_LIMITS = {
  advisedGoals: 3,
  statementMax: 300,
  whyMax: 400,
  visionMax: 400,
  obstacleMax: 200,
  maxObstacles: 12,
  milestoneTitleMax: 80,
  planMax: 200,
  maxMilestones: 12,
};

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

/** Videos in posts and stories: off for now (the owner's choice). Photos and quotes stay; old videos still play. */
export const SOCIAL_VIDEO = false;
