// «الخطيب الذكي» — a hidden branch of JAWAD AI: the same journey as «الطالب الذكي» (material in, work out, every step approved),
// for the one who writes the sermon of the minbar, with «الشيخ» as the assistant, tied to «الذكاء الإسلامي». It is in no menu:
// it opens only from a link nobody lists (a path word the owner sets), then a password the owner sets, both from the dashboard
// (/jawad-ai/admin/khateeb). Pure (pages and server alike).

export const KHATEEB = {
  /** the branch's name in the project table (student_projects.branch) */
  branch: "khateeb",
  name: "الخطيب الذكي",
  icon: "🕌",
  /** where the secret link lives: /jawad-ai/khateeb/<the owner's word> */
  base: "/jawad-ai/khateeb",
  /**
   * The link's word until the owner sets his own (the owner's word, 11 October 2026: «ما يندخل إلا من رابط» — not from
   * JAWAD AI's menus nor from «لأجل المهدي», and no password unless he sets one).
   */
  defaultSlug: "minbar-070f27a3",
  /** the cookie that says the password was given */
  cookie: "jw-khz",
  /** how long the password's word is kept on a device (days) */
  cookieDays: 30,
} as const;

export const STUDENT_BRANCH = "student";

export type Branch = typeof STUDENT_BRANCH | typeof KHATEEB.branch;
export const isKhateeb = (v: unknown): boolean => v === KHATEEB.branch;
export const readBranch = (v: unknown): Branch => (isKhateeb(v) ? KHATEEB.branch : STUDENT_BRANCH);

/** What a branch is called to the person: its name, its assistant and where its pages live. */
export interface BranchLook {
  branch: Branch;
  name: string;
  assistant: string;
  base: string;
  /** the assistant's robot face (components/RobotFace) */
  face: string;
}

export const STUDENT_LOOK: Omit<BranchLook, "base"> = { branch: STUDENT_BRANCH, name: "الطالب الذكي", assistant: "صادق", face: "sadiq" };
export const KHATEEB_LOOK: Omit<BranchLook, "base"> = { branch: KHATEEB.branch, name: KHATEEB.name, assistant: "الشيخ", face: "sheikh" };

// ───────────────────────────── the owner's words ─────────────────────────────

/** The path word of the secret link: letters, digits and dashes, 6–40 long (the owner may write his own). */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{5,39}$/;
export const cleanSlug = (v: unknown) => {
  const s = String(v ?? "").trim().toLowerCase();
  return SLUG_RE.test(s) ? s : "";
};

export const PASSWORD_MIN = 4;
export const PASSWORD_MAX = 80;

/** The longest method and poems the owner can keep (what is sent to the writer with every sermon work). */
export const METHOD_MAX = 60_000;
export const POEMS_MAX = 120_000;

/** The method the Sheikh follows until the owner gives his own: nothing invented, a plain frame only. */
export const DEFAULT_METHOD = `منهجية «المرجعية المأمونة» في التحضير المنبري (الذكاء الاصطناعي المقيَّد): الخطيب يتولى التحقيق وتوفير الأصول، والآلة تنهض بالترتيب الهيكلي والتنظيم البلاغي، ولا تخرج عن النصوص المعتمدة ولا تُقحم روايات غير محققة.

الخطوة ١ — حصر المصادر: المادة التراثية الموثقة (نسب الشخصية، ولادتها، أهم محطات حياتها ومناظراتها، وتفاصيل استشهادها ومظلوميتها) هي المصدر الوحيد للمعلومات التاريخية، ولا يُخرج عنها.

الخطوة ٢ — العصف الموضوعي والربط القرآني: ثلاثة موضوعات منبرية عميقة متباينة تصلح لإحياء المناسبة، بدل السرد التاريخي المجرد. لكل موضوع: (١) فكرة المحور وموضوع المعالجة، (٢) الآية القرآنية المناسبة لتكون مفتاحًا وافتتاحًا، (٣) نقطة التخلص (الكَوْريز) المناسبة للربط بين موضوع البحث ومصيبة الشهادة. ويختار الخطيب الموضوع والآية الأنسب لجمهوره وطبيعة مجلسه.

الخطوة ٣ — العمق التفسيري للآية: لا يفسّر الذكاء الاصطناعي الآية من تلقاء نفسه؛ بل يُؤخذ المقطع الدال من التفاسير الرصينة (مثل الأمثل والميزان، وهنا مجمع البيان للطبرسي) ويُعتمد عليه لفهم دلالات الآية وإبراز رسالتها المركزية في الخطبة.

الخطوة ٤ — الشواهد الأدبية: أبيات فصيحة تخدم المحور؛ إما أبيات يحددها الخطيب، أو بتحديد غرض شعري (كالحكمة وطلب العلم والصبر).

الخطوة ٥ — الهندسة البنائية للمجلس: خطبة منبرية متكاملة بالاعتماد حصرًا على النصوص التاريخية والتفسيرية والشعرية المزوَّدة، وفق الهيكلية التالية:
١. المقدمة: الاستهلال، والآية الكريمة، والربط التفسيري المدعم بالشعر.
٢. صلب المجلس: معالجة الفكرة وطرح الوقائع والمناظرة التاريخية المستخلصة من النص.
٣. الخاتمة والتخلّص (الكَوْريز): الربط المحكم بين البحث الفكري ودوافع المصيبة.
٤. الرثاء: طور النعي الفصيح والدارج المناسب للمقام وفق تفاصيل المصيبة المذكورة في النص.

بهذا المسار تُضمن صحة المحتوى دون تزييف أو استدعاء لروايات ضعيفة.`;

/**
 * What the writer is told in this branch: who he is, how the owner's method binds him, and the poems the owner keeps. Empty
 * method and poems say nothing about them (the sermon is then written on the general rules only).
 */
export function khateebRules(method: string, poems: string): string {
  const m = method.trim();
  const p = poems.trim();
  return [
    "THIS IS «الخطيب الذكي» — the branch for the one who writes the sermon of the minbar. Your name here is «الشيخ» (never صادق, never Claude or any model). You write for a preacher who will say these words aloud on the minbar: sound, careful, plain Arabic for the ear, and nothing religious that is not in the sources given (a verse, a narration, a ruling, a poem, an attribution).",
    m ? `THE OWNER'S METHOD FOR WRITING A SERMON — follow it in every sermon work, its order, its parts, its wording style and its length, exactly; where it speaks, it wins over your own taste:\n<method>\n${m}\n</method>` : "",
    p ? `THE OWNER'S COLLECTION OF POEMS AND VERSES (words kept by the owner): when a poem or a line suits the sermon, take it from here exactly as written and say whose it is as written; never make up a line and never put a line in someone's name that is not here:\n<poems>\n${p}\n</poems>` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ───────────────────────────── the sermon's length ─────────────────────────────

/**
 * The three lengths a sermon is made in. `words` is the body of the sermon; `minutes` is about how long it takes to say it
 * (a preacher's pace of about 130 words a minute). The owner may change these numbers here.
 */
export const SERMON_LENGTHS = [
  { id: "short", label: "قصيرة", minutes: 7, words: 900 },
  { id: "medium", label: "متوسطة", minutes: 12, words: 1600 },
  { id: "long", label: "طويلة", minutes: 20, words: 2700 },
] as const;
export type SermonLength = (typeof SERMON_LENGTHS)[number]["id"];
export const readSermonLength = (v: unknown): (typeof SERMON_LENGTHS)[number] => SERMON_LENGTHS.find((l) => l.id === v) ?? SERMON_LENGTHS[1];
/** What a sermon's chapters (its parts) are at most: even the long one is a few parts, not a book. */
export const SERMON_MAX_PARTS = 7;

/** Does this branch offer this output? The sermon only in «الخطيب الذكي»; everything else in both. */
export const kindOffered = (branch: unknown, kind: string) => kind !== "sermon" || isKhateeb(branch);

// ───────────────────────────── the method's steps and fields ─────────────────────────────
// «المرجعية المأمونة» (the owner's method, see DEFAULT_METHOD): material → three topics with a key verse and a takhallus
// point (the preacher picks one) → the verse's tafsir from a trusted tafsir (here مجمع البيان) → poetry → the four parts.

/** The four parts of the sermon, in order: the method's own names and roles; `share` is each one's part of the words. */
export const SERMON_PARTS = [
  { id: "intro", title: "المقدمة", role: "الاستهلال، والآية الكريمة، والربط التفسيري المدعم بالشعر", share: 0.2 },
  { id: "body", title: "صلب المجلس", role: "معالجة الفكرة وطرح الوقائع والمناظرة التاريخية المستخلصة من النص", share: 0.42 },
  { id: "khatima", title: "الخاتمة والتخلّص (الكَوْريز)", role: "الربط المحكم بين البحث الفكري ودوافع المصيبة", share: 0.14 },
  { id: "rithaa", title: "الرثاء", role: "طور النعي الفصيح والدارج المناسب للمقام وفق تفاصيل المصيبة المذكورة في النص", share: 0.24 },
] as const;

/** The most verses of one topic's key verse (the preacher opens with a short passage). */
export const SERMON_MAX_AYAT = 4;

/** The tafsir the method takes the verse's meaning from, «for now» (the owner's word): مجمع البيان for الطبرسي, on ablibrary.net. */
export const MAJMA = {
  title: "مجمع البيان في تفسير القرآن",
  author: "أبو علي الفضل بن الحسن الطبرسي",
  /** the book id of each volume on ablibrary.net, volume 1 first */
  volumes: [3868, 3870, 3871, 3872, 3873, 3874, 3875, 3876, 3877, 3869],
  site: "https://ablibrary.net",
} as const;

export const ablibraryUrl = (bookId: number | string, page?: number | string) => `${MAJMA.site}/books/${bookId}${page ? `?page=${page}` : ""}`;
