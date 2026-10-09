// Who may use what: ONE list, on the dashboard (/admin/limits → «السماح»). An email in it gets the sections ticked for it,
// free and unlimited; everyone else finds them closed. «لأجل المهدي» is not in it: it stays open to everyone.
// The owner and the co-owner (config/site.ts) always have everything. Pure (pages and server alike).

export const PERMS = [
  { key: "image", label: "🖼️ صناعة الصور", hint: "مولّدات الصور في الجواد" },
  { key: "video", label: "🎬 صناعة الفيديو", hint: "مولّدات الفيديو والتعديل الذكي" },
  { key: "voice", label: "🎙️ الأصوات", hint: "قراءة النص وتغيير الصوت" },
  { key: "music", label: "🎵 الموسيقى والمؤثرات", hint: "موسيقى ومؤثرات صوتية" },
  { key: "film", label: "🎞️ صانع الأفلام الذكي", hint: "المشهد القصير والمسلسل الذكي، بكل ما فيهم" },
  { key: "editor", label: "✂️ حيدرة كت", hint: "المحرر نفسه" },
  { key: "editor_ai", label: "🤖 حيدرة (الذكاء الاصطناعي)", hint: "المحادثة مع حيدرة وكل ما يصنعه (كابشن، تلوين، صناعة…)" },
  { key: "student", label: "🎓 الطالب الذكي", hint: "بكل ما فيه (صوره وأصواته معه)" },
  { key: "booklet", label: "📖 كتيب نهج علي", hint: "بلا حد للتجارب" },
  { key: "games", label: "🎮 صانع الألعاب الذكي", hint: "قنبر: محادثة تصميم الألعاب. يدخل في «الكود السري» الشامل، وينفتح بإيميل أو بكود؛ ومفتاحه الثلاثي في /admin/games" },
  { key: "content", label: "✍️ صانع المحتوى", hint: "محمد باقر: كاروسيل بـ GPT Image 2، سكربتات الريلز، وتسليم الريلز والموشن لحيدرة. يدخل في «الكود السري» الشامل؛ ومفتاحه الثلاثي في /admin/content" },
  { key: "designer", label: "🎨 المصمم الذكي", hint: "كاظم: بطاقات زواج ومولود، دعوات وإعلانات حسينية، ومصغّرات يوتيوب؛ الصورة بـ GPT Image 2 والكلمات طبقات نصية تُعدَّل. يدخل في «الكود السري» الشامل؛ ومفتاحه الثلاثي في /admin/designer" },
] as const;

export type Perm = (typeof PERMS)[number]["key"];
export const ALL_PERMS: Perm[] = PERMS.map((p) => p.key);
export const isPerm = (v: unknown): v is Perm => typeof v === "string" && (ALL_PERMS as string[]).includes(v);

/**
 * Sections that only open by name: «الكود السري» (the one that opens everything), and the owner's «اختر الكل»,
 * never include them. Whoever has them gets exactly them, and no free use of the paid generators.
 * (None at the moment: the owner put «صانع الألعاب» and «صانع المحتوى» inside the all-opening code.)
 */
export const NAMED_ONLY: Perm[] = [];
/** What the all-opening secret code opens (everything but the named-only sections). */
export const OPEN_PERMS: Perm[] = ALL_PERMS.filter((p) => !NAMED_ONLY.includes(p));
/** Free, unlimited use of the paid generators goes with any section except the named-only ones. */
export const hasUnlimited = (perms: ReadonlySet<Perm>) => [...perms].some((p) => !NAMED_ONLY.includes(p));

// ───────── the owner's codes («الأكواد»): many, each with its own sections and time ─────────

/** One code, as the owner set it: only the sections it names, until it expires, for as many people as it allows. */
export interface CodeRow {
  id: string;
  label: string;
  code: string;
  perms: Perm[];
  /** the code stops working at this moment for everyone (null: never) */
  expiresAt: string | null;
  /** each person's access lasts this many hours from when THEY entered it (null: as long as the code lives) */
  validHours: number | null;
  /** at most this many different people (null: no limit) */
  maxUses: number | null;
  enabled: boolean;
}
export interface CodeUse {
  codeId: string;
  email: string;
  at: string;
}

/** Whether a person's entry of a code still opens its sections now. */
export function codeOpen(c: CodeRow, use: CodeUse | null | undefined, now = Date.now()): boolean {
  if (!use || !c.enabled) return false;
  if (c.expiresAt && new Date(c.expiresAt).getTime() <= now) return false;
  if (c.validHours && new Date(use.at).getTime() + c.validHours * 3600_000 <= now) return false;
  return true;
}

/**
 * What a person's codes open together. Every code stands alone: a code that is off, expired, or past its hours
 * opens nothing, and takes nothing from another code (no overlap, no override): the sections are only ever added.
 */
export function permsByCodes(codes: CodeRow[], uses: CodeUse[], now = Date.now()): Set<Perm> {
  const out = new Set<Perm>();
  for (const c of codes) {
    const use = uses.find((u) => u.codeId === c.id);
    if (codeOpen(c, use, now)) for (const p of c.perms) out.add(p);
  }
  return out;
}

/** Sections from the owner's form: only the known ones, no repeats. */
export const normalizePerms = (v: unknown): Perm[] => (Array.isArray(v) ? [...new Set(v.filter(isPerm))] : []);

/** A readable random code (no 0/O/1/I): `XXXX-XXXX`. */
export function newCodeText(random: (n: number) => number = (n) => Math.floor(Math.random() * n)): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = () => abc[random(abc.length)];
  return `${Array.from({ length: 4 }, pick).join("")}-${Array.from({ length: 4 }, pick).join("")}`;
}
