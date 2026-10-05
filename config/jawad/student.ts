// «الجواد الذكي!» | JAWAD AI · «الطالب الذكي» — the branch's fixed choices: outputs, levels, design styles, fonts.
// Prices are not set here: every paid step is priced from its real cost on the site's coin (config/coins.ts).

export const STUDENT = {
  base: "/jawad-ai/student",
  bucket: "student",
  /** A project is deleted this many days after its last activity (the owner's choice). */
  keepDays: 30,
  /** No product limit on size, pages or pictures (the owner's choice); these are only how work is cut into steps. */
  pdfPagesPerCall: 4,
  understandingChunkChars: 40_000,
  /** ElevenLabs Eleven v4 takes up to 10,000 characters a request; we cut well below it, at sentence ends. */
  audioPartChars: 2500,
  /** Web searches Claude may run for one research request ($10 per 1,000 searches, Anthropic's price). */
  maxSearches: 8,
  webSearchUsd: 10 / 1000,
} as const;

export const LEVELS = ["ابتدائي", "متوسط", "ثانوي", "جامعي", "دراسات عليا"] as const;

export type OutputKind = "summary" | "explain" | "transcript" | "book" | "slides" | "audio" | "quiz";

export const OUTPUT_KINDS: { kind: OutputKind; name: string; blurb: string }[] = [
  { kind: "summary", name: "ملخص", blurb: "الأفكار الجوهرية بالمستوى والتفصيل الذي تختاره." },
  { kind: "explain", name: "شرح جديد", blurb: "شرح المادة بطريقة أسهل أو أنسب لجمهورك." },
  { kind: "transcript", name: "تفريغ نصي كامل", blurb: "النص الذي راجعته كما هو، كاملًا، للنسخ والتنزيل." },
  { kind: "book", name: "كتاب أو ملزمة PDF", blurb: "ملف قراءة مصمم بخط عربي واضح وأسلوب تختاره." },
  { kind: "slides", name: "عرض تقديمي PPTX", blurb: "شرائح قابلة للتعديل، مع نسخة PDF مطابقة." },
  { kind: "audio", name: "تسجيل صوتي", blurb: "قراءة صوتية بـ ElevenLabs، ملف واحد أو عدة ملفات." },
  { kind: "quiz", name: "اختبار", blurb: "أسئلة من المادة بصعوبة وعدد وأنواع تحددها." },
];
export const outputName = (k: string) => OUTPUT_KINDS.find((o) => o.kind === k)?.name ?? k;

export const OUTPUT_STATUS: Record<string, string> = {
  settings: "ينتظر الإعدادات",
  waiting: "ينتظر ناتجًا قبله",
  planning: "جارٍ إعداد الخطة",
  plan_review: "ينتظر اعتماد الخطة",
  ready: "الخطة معتمدة — جاهز للتصنيع",
  trial_offer: "ينتظر قرار النسخة التجريبية",
  trial_running: "جارٍ إنشاء النسخة التجريبية",
  trial_review: "ينتظر مراجعة النسخة التجريبية",
  running: "جارٍ",
  review: "ينتظر اعتمادًا",
  done: "مكتمل",
  failed: "فشل",
};

export const DENSITIES = [
  { id: "high", label: "مفصل جدًا" },
  { id: "medium", label: "متوسط" },
  { id: "low", label: "قليل الكلام" },
] as const;

export const QUESTION_TYPES = [
  { id: "mcq", label: "اختيار متعدد" },
  { id: "tf", label: "صح وخطأ" },
  { id: "short", label: "أسئلة قصيرة" },
  { id: "essay", label: "مقالية" },
  { id: "long", label: "طويلة" },
] as const;

// ───────────────────────────── fonts ─────────────────────────────
// Researched on 2026-10-05 (web search): the Arabic families most recommended in 2026 sources for reading, UI and
// display, all under the SIL Open Font License 1.1 (commercial use, embedding in PDF/PPTX, server hosting).
// Excluded: Thmanyah (licence unclear in published copies), Lamar (commercial). Files + OFL texts: assets/fonts/student.
// Sources: ehabfayez.com/en/blog/best-free-arabic-fonts-2026 · chobixo.com/2026/05/best-arabic-fonts-for-designers-2026.html
// · arabic-calligraphy-generator.com/guides/best-arabic-fonts-2025 · software.sil.org/scheherazade (4.500, 2026-04-15).
export const FONTS_CHECKED = "2026-10-05";

export interface FontDef {
  id: string;
  family: string;
  label: string;
  role: string;
  files: { file: string; weight: string }[];
  url: string;
}

export const FONTS: FontDef[] = [
  { id: "readex", family: "Readex Pro", label: "Readex Pro", role: "عناوين حديثة وقراءة على الشاشة", files: [{ file: "student/ReadexPro.ttf", weight: "160 700" }], url: "https://fonts.google.com/specimen/Readex+Pro" },
  { id: "plex", family: "IBM Plex Sans Arabic", label: "IBM Plex Sans Arabic", role: "متن واضح للقراءة الطويلة والأرقام", files: [{ file: "student/IBMPlexSansArabic-Regular.ttf", weight: "400" }, { file: "student/IBMPlexSansArabic-Bold.ttf", weight: "700" }], url: "https://fonts.google.com/specimen/IBM+Plex+Sans+Arabic" },
  { id: "amiri", family: "Amiri", label: "Amiri (نسخ)", role: "التفريغ الحرفي والاقتباس والنص المشكول", files: [{ file: "student/Amiri-Regular.ttf", weight: "400" }, { file: "student/Amiri-Bold.ttf", weight: "700" }], url: "https://fonts.google.com/specimen/Amiri" },
  { id: "scheherazade", family: "Scheherazade New", label: "Scheherazade New", role: "التشكيل الكثيف", files: [{ file: "student/ScheherazadeNew-Regular.ttf", weight: "400" }], url: "https://software.sil.org/scheherazade/" },
  { id: "markazi", family: "Markazi Text", label: "Markazi Text", role: "متن تحريري (مجلة)", files: [{ file: "student/MarkaziText.ttf", weight: "400 700" }], url: "https://fonts.google.com/specimen/Markazi+Text" },
  { id: "messiri", family: "El Messiri", label: "El Messiri", role: "عناوين تحريرية", files: [{ file: "student/ElMessiri.ttf", weight: "400 700" }], url: "https://fonts.google.com/specimen/El+Messiri" },
  { id: "reemkufi", family: "Reem Kufi", label: "Reem Kufi", role: "عناوين كوفية حديثة", files: [{ file: "student/ReemKufi.ttf", weight: "400 700" }], url: "https://fonts.google.com/specimen/Reem+Kufi" },
  { id: "tajawal", family: "Tajawal", label: "Tajawal", role: "متن شبابي مدور", files: [{ file: "student/Tajawal-Regular.ttf", weight: "400" }, { file: "student/Tajawal-Bold.ttf", weight: "700" }], url: "https://fonts.google.com/specimen/Tajawal" },
  { id: "playpen", family: "Playpen Sans Arabic", label: "Playpen Sans Arabic (يدوي)", role: "ملاحظات الهامش بخط يدوي", files: [{ file: "PlaypenSansArabic.ttf", weight: "100 800" }], url: "https://fonts.google.com/specimen/Playpen+Sans+Arabic" },
  { id: "lalezar", family: "Lalezar", label: "Lalezar", role: "عناوين عريضة للملصقات", files: [{ file: "Lalezar-Regular.ttf", weight: "400" }], url: "https://fonts.google.com/specimen/Lalezar" },
  { id: "baloo", family: "Baloo Bhaijaan 2", label: "Baloo Bhaijaan 2", role: "عناوين مرحة", files: [{ file: "BalooBhaijaan2.ttf", weight: "400 800" }], url: "https://fonts.google.com/specimen/Baloo+Bhaijaan+2" },
];
export const fontById = (id: string) => FONTS.find((f) => f.id === id) ?? FONTS[1];

export interface FontPair {
  heading: string;
  body: string;
  /** margin notes, quotes or the verbatim text */
  accent: string;
}
export const DEFAULT_PAIR: FontPair = { heading: "readex", body: "plex", accent: "amiri" };

// ───────────────────────────── design styles ─────────────────────────────
export type StyleId = "notebook" | "editorial" | "bento" | "cinematic" | "collage";

export interface StyleDef {
  id: StyleId;
  letter: string;
  name: string;
  en: string;
  idea: string;
  inPdf: string;
  inSlides: string;
  suits: string;
  pair: FontPair;
  colors: { bg: string; paper: string; ink: string; muted: string; accent: string; accent2: string; line: string };
}

export const STYLES: StyleDef[] = [
  {
    id: "notebook",
    letter: "A",
    name: "الدفتر والملاحظات المشروحة",
    en: "Notebook & Annotated Notes",
    idea: "صفحات كدفتر دراسة مرتب: ورق فاتح بسطور خفيفة، هوامش لملاحظة أو تعريف أو سؤال مراجعة، تظليل للكلمات المهمة فقط، وأسهم تربط فكرتين فعلًا.",
    inPdf: "للفصول والملخصات والكتب المشروحة: ملاحظة في الهامش، تفسير مصطلح، والمتن كامل ومقروء.",
    inSlides: "الشريحة صفحة ملاحظات مركزة: فكرة رئيسية وعنصر مشروح وتظليل محدد؛ التفصيل العالي يتوزع على شرائح أكثر بدل تصغير الحروف.",
    suits: "التعليم، التلخيص، المواد الطبية والتقنية، الدورات.",
    pair: { heading: "readex", body: "plex", accent: "playpen" },
    colors: { bg: "#fbf8f1", paper: "#fffdf7", ink: "#1f2430", muted: "#5d6473", accent: "#2b6cb0", accent2: "#f6d860", line: "#d9e3f0" },
  },
  {
    id: "editorial",
    letter: "B",
    name: "المجلة التحريرية الحديثة",
    en: "Modern Editorial Magazine",
    idea: "ملف تحريري واثق: عناوين لها شخصية، فروق واضحة بين العنوان والعنوان الفرعي والمتن، شبكة ثابتة، اقتباسات بارزة من النص نفسه، ولوحة ألوان محدودة.",
    inPdf: "افتتاحيات فصول، صفحات نصية مريحة، وصفحات اقتباس أو حالة؛ العناوين لا تأخذ مساحة الشرح.",
    inSlides: "شريحة افتتاحية قوية ثم شرائح بأعمدة وهوامش تحريرية وشريحة اقتباس أو نتيجة.",
    suits: "الموضوعات العميقة، الدراسات، السرد الثقافي والتعليمي.",
    pair: { heading: "messiri", body: "markazi", accent: "amiri" },
    colors: { bg: "#f6f3ee", paper: "#ffffff", ink: "#16161a", muted: "#5b5b66", accent: "#b3261e", accent2: "#16161a", line: "#e3ddd3" },
  },
  {
    id: "bento",
    letter: "C",
    name: "الشبكة والبطاقات المنظمة",
    en: "Bento Grid & Modular Cards",
    idea: "المحتوى وحدات يسهل مسحها: لكل بطاقة وظيفة (مفهوم، رقم، مثال، خطوة، مقارنة، نتيجة)، وأحجام تحددها أهمية المعلومة، وتتبع من اليمين لليسار.",
    inPdf: "للمقارنات والخطوات والقوائم والتصنيفات، مع شرح نصي كافٍ بعد البطاقات.",
    inSlides: "أجزاء الفكرة الواحدة على بطاقات في شريحة متماسكة؛ إذا كثرت الوحدات تُستخدم شرائح أكثر.",
    suits: "الأدوات، الخطوات، البرامج التدريبية، المقارنات.",
    pair: { heading: "readex", body: "plex", accent: "amiri" },
    colors: { bg: "#eef1f6", paper: "#ffffff", ink: "#111827", muted: "#4b5563", accent: "#4f46e5", accent2: "#14b8a6", line: "#dde3ee" },
  },
  {
    id: "cinematic",
    letter: "D",
    name: "الفيلم والقصص البصرية",
    en: "Cinematic Storyboard",
    idea: "تسلسل مشاهد له بداية وتطور ونتيجة، بهوية لونية ثابتة، ونص واضح بجانب العنصر البصري، وترقيم مشهد أو فصل عندما يخدم القراءة.",
    inPdf: "لافتتاحيات الفصول والأحداث المتتابعة ودراسات الحالة؛ صفحات المتن الطويل تبقى صفحات قراءة مريحة.",
    inSlides: "خريطة الشرائح تُظهر تسلسل القصة كاملًا أولًا؛ المحاضرة المفصلة تتوزع على شرائح أو ملاحظات.",
    suits: "القصص، التجارب، قبل وبعد، الموضوعات التاريخية ودراسات الحالة.",
    pair: { heading: "reemkufi", body: "readex", accent: "amiri" },
    colors: { bg: "#0f1218", paper: "#161b24", ink: "#eef1f6", muted: "#a9b2c2", accent: "#f2a33a", accent2: "#5aa9e6", line: "#2a3242" },
  },
  {
    id: "collage",
    letter: "E",
    name: "الكولاج الملموس متعدد الخامات",
    en: "Tactile Mixed-Media Collage",
    idea: "عناصر تبدو مادية ومصنوعة يدويًا: ورق ممزق، شريط لاصق، إطارات بولارويد، خطوط يدوية وظلال طبيعية — لكل خامة وظيفة وضمن ترتيب واضح.",
    inPdf: "للأغلفة والافتتاحيات والقصص؛ الصفحة الكثيفة تخفف الخامات حول المتن.",
    inSlides: "شرائح ذات شخصية بصرية؛ لا شريط ولا صورة يغطي الكلمات.",
    suits: "المحتوى الشبابي والإبداعي والسرد.",
    pair: { heading: "lalezar", body: "tajawal", accent: "playpen" },
    colors: { bg: "#efe6d8", paper: "#fbf6ec", ink: "#2a2420", muted: "#6b5f55", accent: "#d9534f", accent2: "#3c8d7f", line: "#d8c9b3" },
  },
];
export const styleById = (id: string) => STYLES.find((s) => s.id === id) ?? STYLES[0];

/** What each extra style can be given when styles are mixed. */
export const STYLE_ROLES = [
  { id: "body", label: "متن الشرح والهوامش" },
  { id: "structure", label: "الهيكل العام والعناوين" },
  { id: "compare", label: "صفحات المقارنات والخطوات" },
  { id: "story", label: "الأقسام القصصية والافتتاحيات" },
  { id: "cover", label: "الغلاف" },
] as const;
export type StyleRole = (typeof STYLE_ROLES)[number]["id"];

/** A design: one style, a mix (a main style and roles for the others), or the student's own described style. */
export interface Design {
  main: StyleId;
  roles: Partial<Record<StyleRole, StyleId>>;
  fonts: FontPair;
  custom?: { description: string; colors: StyleDef["colors"]; texture: "none" | "paper" | "lines" | "grid"; radius: number; notes: string } | null;
}

export const defaultDesign = (main: StyleId = "notebook"): Design => ({ main, roles: {}, fonts: { ...styleById(main).pair }, custom: null });
