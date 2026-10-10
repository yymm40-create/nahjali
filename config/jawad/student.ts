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
  /** While coins are not required (the free trial), one person's paid steps are capped at this many dollars a day. */
  freeDailyUsd: 8,
} as const;

export const LEVELS = ["ابتدائي", "متوسط", "ثانوي", "جامعي", "دراسات عليا"] as const;

// ───────────────────────────── the brief (the first page) ─────────────────────────────

/** What the material is for: chosen with one tap, or written («أخرى»). */
export const PURPOSES = [
  { id: "exam", label: "مراجعة للاختبار", hint: "أهم ما يُسأل عنه، مختصر ومركّز" },
  { id: "understand", label: "فهم وشرح", hint: "شرح أسهل مع أمثلة" },
  { id: "research", label: "بحث أو تقرير", hint: "موضوع مكتوب بمصادر" },
  { id: "teach", label: "تحضير درس أو شرح لغيري", hint: "للمعلم أو لشرح المادة لزملاء" },
  { id: "present", label: "عرض أو مشروع", hint: "عرض تقديمي أو مشروع للصف" },
  { id: "other", label: "أخرى", hint: "اكتب غرضك" },
] as const;
export type PurposeId = (typeof PURPOSES)[number]["id"];

/** Where the information comes from. */
export const SOURCE_MODES = [
  { id: "files", label: "من ملفاتي", hint: "أرفع صور أو PDF أو أكتب نصًا" },
  { id: "research", label: "صادق يبحث لي", hint: "بدون ملفات: يبحث في مصادر موثوقة" },
  { id: "both", label: "ملفاتي + بحث", hint: "مادتي، ويكملها صادق بالبحث" },
] as const;
export type SourceMode = (typeof SOURCE_MODES)[number]["id"];

export interface Brief {
  purpose: PurposeId;
  /** «أخرى», or details of the purpose */
  purposeNote: string;
  mode: SourceMode;
  /** research: what to look for */
  focus: string;
  /** research: where to look (links or sites to keep to); empty = reliable sources anywhere */
  where: string;
  /** «صادق» goes on through the steps by himself (on unless the student turned it off on the first page) */
  auto: boolean;
}

export const emptyBrief = (): Brief => ({ purpose: "exam", purposeNote: "", mode: "files", focus: "", where: "", auto: true });

/** A stored brief, checked (older materials have none). */
export function readBrief(v: unknown): Brief {
  const b = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const purpose = PURPOSES.some((x) => x.id === b.purpose) ? (b.purpose as PurposeId) : "exam";
  const mode = SOURCE_MODES.some((x) => x.id === b.mode) ? (b.mode as SourceMode) : "files";
  return { purpose, purposeNote: String(b.purposeNote ?? "").slice(0, 1000), mode, focus: String(b.focus ?? "").slice(0, 2000), where: String(b.where ?? "").slice(0, 2000), auto: b.auto !== false };
}

/** The links in «وين يبحث» (https only) and their sites. */
export function researchPlaces(where: string) {
  const links = [...new Set((where.match(/https?:\/\/[^\s,،]+/g) ?? []).map((u) => u.replace(/[).،,]+$/, "")))].slice(0, 10);
  const sites = [
    ...new Set(
      links.flatMap((u) => {
        try {
          return [new URL(u).hostname.replace(/^www\./, "")];
        } catch {
          return [];
        }
      }),
    ),
  ];
  return { links, sites };
}

/** The brief as one line for the writer (Claude). */
export function briefLine(b: Brief) {
  const p = PURPOSES.find((x) => x.id === b.purpose)!;
  const purpose = b.purpose === "other" ? b.purposeNote || "unspecified" : `${p.label}${b.purposeNote ? ` (${b.purposeNote})` : ""}`;
  return `What the student wants this material for: ${purpose}.`;
}

// ───────────────────────────── what each source IS ─────────────────────────────

/**
 * «ساعات أعطيه ملف يكون إليه يمشي، وملف ثاني أو يوتيوب يكون المادة العلمية» — so each file, recording, link or pasted
 * text says what it IS. A TEMPLATE is a shape to follow, not information to copy; the MATERIAL is where every fact
 * comes from; a REFERENCE is background used only when it adds something. One picture is a whole material if that is
 * all the person has, and the subject may be anything — a school book, a university course, a work report, a medical
 * file, a legal text, a hobby.
 */
export const SOURCE_ROLES = [
  {
    id: "material",
    ar: "مادة علمية",
    icon: "📘",
    hint: "منها كل المعلومات (كتاب، محاضرة، فيديو، صورة وحدة تكفي)",
    rule: "MATERIAL: this is where the facts come from. Everything written for the student must trace back to it.",
  },
  {
    id: "template",
    ar: "نموذج أتبعه",
    icon: "📐",
    hint: "شكل أمشي عليه: أقسامه وترتيبه وعناوينه وطوله — بلا نقل معلوماته",
    rule: "TEMPLATE (a shape to follow, NOT a source of facts): follow its structure exactly — the same sections in the same order, the same headings and their wording style, the same numbering, the same depth and length per section, the same tone and the same way of citing. Do NOT copy its subject matter, its examples or its numbers into the student's work, and never present its content as the material's. If the template and the material disagree about the shape, the template wins; if they disagree about a fact, the material wins.",
  },
  {
    id: "reference",
    ar: "مرجع إضافي",
    icon: "🔗",
    hint: "خلفية أستفيد منها إذا أضافت شي",
    rule: "REFERENCE: background only. Use it when it adds something the material lacks, and mark what came from it.",
  },
] as const;
export type SourceRole = (typeof SOURCE_ROLES)[number]["id"];
export const sourceRole = (v: unknown) => SOURCE_ROLES.find((r) => r.id === v) ?? null;
/** Anything read as a role the pipeline knows (a source from before the roles existed is the material). */
export const readSourceRole = (v: unknown): SourceRole => (v === "template" || v === "reference" ? v : "material");

/**
 * The rules of the roles that are really present, for the writer. Nothing is said about a role nobody used, so a
 * plain project (every source the material) reads exactly as it did before.
 */
export function rolesBrief(roles: unknown[]): string {
  const present = [...new Set(roles.map(readSourceRole))];
  // nothing to say when there is no role but the material (which is what a plain project is)
  if (!present.some((r) => r !== "material")) return "";
  const lines = SOURCE_ROLES.filter((r) => present.includes(r.id)).map((r) => `- ${r.rule}`);
  return ["EACH SOURCE HAS A ROLE, written in its label («نموذج أتبعه», «مادة علمية», «مرجع إضافي»):", ...lines].join("\n");
}

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
  /** a thin frame around every page (PDF and Word); on unless the student turned it off */
  frame?: boolean;
}

export const defaultDesign = (main: StyleId = "notebook"): Design => ({ main, roles: {}, fonts: { ...styleById(main).pair }, custom: null });

/** «صادق»: the assistant of «الطالب الذكي» (he reads, understands, researches, plans and makes everything). */
export const STUDENT_ASSISTANT = { name: "صادق", icon: "🧑‍🎓" } as const;

/** The written source a research becomes is named «بحث صادق: …» (older projects: «بحث كلاود: …»). */
export const RESEARCH_PREFIX = "بحث صادق";
export const isResearchSource = (name: string) => name.startsWith(RESEARCH_PREFIX) || name.startsWith("بحث كلاود");

// ───────────────────────────── the student's own choices for a file ─────────────────────────────

/** Outputs with a design (style, fonts): the design step is shown when one of them is chosen. */
export const DESIGNED_KINDS: string[] = ["summary", "explain", "book", "slides", "quiz"];

/** Written outputs made as pages (PDF, and Word when asked): they take a page count, a file format and a design. */
export const PAGED_KINDS = ["summary", "explain", "book"] as const;
export const isPaged = (k: string) => (PAGED_KINDS as readonly string[]).includes(k);

/** The page count the student asked for (0 = as the material needs). Kept exactly in the PDF. */
export const MAX_PAGES = 300;
export const pagesOf = (s: Record<string, unknown>) => Math.max(0, Math.min(MAX_PAGES, Math.round(Number(s.pages) || 0)));

/** The file types of a written output: PDF, Word (DOCX, editable) or both. */
export const FORMATS = [
  { id: "pdf", label: "PDF" },
  { id: "docx", label: "Word (DOCX) قابل للتعديل" },
  { id: "both", label: "الاثنين" },
] as const;
export type FormatId = (typeof FORMATS)[number]["id"];
export const formatOf = (s: Record<string, unknown>): FormatId => (FORMATS.some((f) => f.id === s.format) ? (s.format as FormatId) : "pdf");
export const wantsDocx = (s: Record<string, unknown>) => formatOf(s) !== "pdf";

/**
 * What the student said about the design (the design step; empty when skipped): a style of the branch, their own
 * ideas, fonts and whether pages have a frame. It always comes before Sadiq's own taste.
 */
export interface DesignWish {
  style: StyleId | "";
  ideas: string;
  heading: string;
  body: string;
  frame: boolean;
}
export const emptyWish = (): DesignWish => ({ style: "", ideas: "", heading: "", body: "", frame: true });
export function readWish(v: unknown): DesignWish {
  const w = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const font = (x: unknown) => (FONTS.some((f) => f.id === x) ? String(x) : "");
  return {
    style: STYLES.some((s) => s.id === w.style) ? (w.style as StyleId) : "",
    ideas: String(w.ideas ?? "").slice(0, 3000),
    heading: font(w.heading),
    body: font(w.body),
    frame: w.frame !== false,
  };
}
export const wishGiven = (w: DesignWish) => Boolean(w.style || w.ideas.trim() || w.heading || w.body);
