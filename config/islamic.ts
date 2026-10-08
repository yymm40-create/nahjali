// «الذكاء الإسلامي» (JAWAD AI) — the branch's fixed choices. Everything the owner trains it on (the method, the
// sources, the persona files) lives in the database (islamic_kv, islamic_sources) and is edited from /admin/islamic.

export const ISLAMIC = {
  base: "/jawad-ai/islamic",
  name: "الذكاء الإسلامي",
  /** one reading run of a source: how long a request works before it saves where it stopped */
  crawlBudgetMs: 230_000,
  /** pages fetched at once from one site (polite) */
  crawlConcurrency: 4,
  /** chunk sizes (characters): what a search returns and Claude reads */
  chunkChars: 1400,
  chunkOverlap: 100,
  /** passages given to Claude for one answer, and at most this many from one document */
  passages: 12,
  perDoc: 3,
  /** the general reader («site» sources): pages at most, from the sitemap or the site's own links */
  sitePages: 600,
} as const;

/** The keys in islamic_kv the owner edits. */
export const ISLAMIC_KV = {
  /** «المنهج»: the owner's rules, read before every answer */
  method: "method",
  /** the persona file (ethics and way of speaking), extracted from the sources and approved by the owner */
  persona: "persona",
  /** the analysis file (how the sources reason), extracted and approved */
  analysis: "analysis",
  /** what the last «استخرج» wrote, waiting for the owner's look and «اعتمد» */
  personaDraft: "persona_draft",
  analysisDraft: "analysis_draft",
} as const;

/**
 * Who the assistant is. Fixed in code (the owner's decision): from within the school of the Prophet's household —
 * the Twelver Imami school — as the truth it speaks from, never named as a label in its answers, never offered as
 * one opinion beside others. The owner's method (islamic_kv.method) comes after it and adds to it.
 */
export const ISLAMIC_IDENTITY = `أنت مساعد «الذكاء الإسلامي» في منصة JAWAD AI.
هويتك: تنتمي إلى مدرسة أهل البيت عليهم السلام (الإمامية الاثنا عشرية) انتماءً كاملًا، وتتكلم من داخلها بوصفها الحق الذي تعتقده، لا بوصفها رأيًا من آراء. لا تذكر اسم المذهب في أجوبتك ولا تصف نفسك به؛ تتكلم كما يتكلم أهله فيما بينهم بطبيعتهم. لا تعرض قولًا يخالف هذه المدرسة على أنه الصحيح، ولا تساوي بين الحق وغيره.
أدبك: الصلاة على محمد وآله عند ذكر النبي، و«عليه السلام» عند ذكر الأئمة والصدّيقة الزهراء، والتعظيم لله سبحانه، والرفق بالسائل، والتواضع في القول.
صدقك: لا تنسب كلامًا إلى أحد إلا نقلًا حرفيًا من المصادر المعطاة لك مع ذكر المصدر. ما لم تجده في المصادر تقول صراحة إنك لم تجده، ولا تؤلّف. تفرّق دائمًا بين النص المنقول وفهمك أنت له.
اسمك: إن احتجت إلى اسم فأنت «مساعد الذكاء الإسلامي»، ولا تذكر اسم أي نموذج ذكاء اصطناعي أبدًا.`;
