// Who may use what: ONE list, on the dashboard (/admin/limits → «السماح»). An email in it gets the sections ticked for it,
// free and unlimited; everyone else finds them closed. «لأجل المهدي» is not in it: it stays open to everyone.
// The owner and the co-owner (config/site.ts) always have everything. Pure (pages and server alike).

import { capClaudeModel, CLAUDE_MODELS, type ClaudeModelKey } from "./claude-models";

export const PERMS = [
  { key: "image", label: "🖼️ صناعة الصور", hint: "مولّدات الصور في الجواد" },
  { key: "video", label: "🎬 صناعة الفيديو", hint: "مولّدات الفيديو والتعديل الذكي" },
  { key: "voice", label: "🎙️ الأصوات", hint: "قراءة النص وتغيير الصوت" },
  { key: "music", label: "🎵 الموسيقى والمؤثرات", hint: "موسيقى ومؤثرات صوتية" },
  { key: "film", label: "🎞️ صانع الأفلام الذكي", hint: "المشهد القصير والمسلسل الذكي، بكل ما فيهم" },
  { key: "editor", label: "✂️ حيدرة كت", hint: "المحرر نفسه" },
  { key: "editor_ai", label: "🤖 حيدرة (الذكاء الاصطناعي)", hint: "المحادثة مع حيدرة وكل ما يصنعه (كابشن، تلوين، صناعة…)" },
  { key: "student", label: "🎓 الطالب الذكي", hint: "بكل ما فيه (صوره وأصواته معه)" },
  { key: "booklet", label: "📘 كتيب الجداول الذكي", hint: "الكتيب الجاهز وتصميم الجداول مع نور" },
  { key: "games", label: "🎮 صانع الألعاب الذكي", hint: "قنبر: محادثة تصميم الألعاب. يدخل في «الكود السري» الشامل، وينفتح بإيميل أو بكود؛ ومفتاحه الثلاثي في /admin/games" },
  { key: "content", label: "✍️ صانع المحتوى", hint: "محمد باقر: كاروسيل بـ GPT Image 2، سكربتات الريلز، وتسليم الريلز والموشن لحيدرة. يدخل في «الكود السري» الشامل؛ ومفتاحه الثلاثي في /admin/content" },
  { key: "designer", label: "🎨 المصمم الذكي", hint: "كاظم: بطاقات زواج ومولود، دعوات وإعلانات حسينية، ومصغّرات يوتيوب؛ الصورة بـ GPT Image 2 والكلمات طبقات نصية تُعدَّل. يدخل في «الكود السري» الشامل؛ ومفتاحه الثلاثي في /admin/designer" },
  { key: "kharq", label: "🧠 محمد الخارق", hint: "محادثة عامة في أي موضوع، تسأل الأسئلة المهمة بخيارات ثم تسلّم المطلوب نفسه: كلامًا أو رسالة أو جدولًا أو ملف PDF أو صورًا أو فيديو (بعد موافقة صريحة على سعره). يدخل في «الكود السري» الشامل، وينفتح بإيميل أو بكود؛ ومفتاحه الثلاثي في /admin/kharq" },
  { key: "photo", label: "📸 زهراء فوتو ماستر", hint: "برنامج تحرير الصور والتصميم المستقل مع الروبوت زهراء: ألوان وقص ونصوص وأشكال وطبقات، وتنتقل له التصاميم من كاظم وتعود إليه. يدخل في «الكود السري» الشامل، وينفتح بإيميل أو بكود تعلّمه له." },
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
/** What every signed-in person may use once the owner opens the site (/admin «فتح الموقع للجميع»): every section (the booklet is «كتيب الجداول الذكي» in JAWAD AI now). */
export const PUBLIC_PERMS: Perm[] = ALL_PERMS;
/**
 * Who makes for FREE («بلا حدود»): the owners, whoever came in by the all-opening «الكود السري», an e-mail the owner
 * marked unlimited in «السماح», or a code the owner marked unlimited. Everyone else pays in riyals from their wallet.
 */
export interface Access {
  perms: Set<Perm>;
  unlimited: boolean;
  /** what the codes this person entered (and that still open) give besides sections: see `perksByCodes` */
  perks: Perks;
}

/** The gift side of the codes a person entered: pricing at cost, a Claude ceiling, Seedance 2.0 generations. */
export interface Perks {
  /** everything they buy costs what the tool costs us: no profit */
  atCost: boolean;
  /** the dearest Claude model they may use (the cheapest ceiling among their codes); null = any */
  claudeModel: ClaudeModelKey | null;
  /** at most this many Seedance 2.0 generations, counted from `since` (the earliest entry of a code that sets it); null = no ceiling */
  videoGens: { cap: number; since: string } | null;
}
export const NO_PERKS: Perks = { atCost: false, claudeModel: null, videoGens: null };

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
  /** whoever enters it makes for free, without a wallet */
  unlimited: boolean;
  /** riyals put in the wallet of whoever enters it, once (0: none) */
  giftSar: number;
  /** whoever enters it pays the tool's cost for everything they buy (no profit) */
  atCost: boolean;
  /** the dearest Claude model they may use (null: any) */
  claudeModel: ClaudeModelKey | null;
  /** at most this many Seedance 2.0 generations for them (null: no ceiling) */
  videoGens: number | null;
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

/** Whether one of the codes a person entered (and that still opens) makes them unlimited. */
export const unlimitedByCodes = (codes: CodeRow[], uses: CodeUse[], now = Date.now()) => codes.some((c) => c.unlimited && codeOpen(c, uses.find((u) => u.codeId === c.id), now));

/** What the codes a person entered (each still open) give besides sections; every code stands alone, the strictest ceiling wins. */
export function perksByCodes(codes: CodeRow[], uses: CodeUse[], now = Date.now()): Perks {
  const out: Perks = { atCost: false, claudeModel: null, videoGens: null };
  const order = ["haiku", "sonnet", "opus", "fable"];
  for (const c of codes) {
    const use = uses.find((u) => u.codeId === c.id);
    if (!codeOpen(c, use, now)) continue;
    if (c.atCost) out.atCost = true;
    if (c.claudeModel && (!out.claudeModel || order.indexOf(c.claudeModel) < order.indexOf(out.claudeModel))) out.claudeModel = c.claudeModel;
    if (c.videoGens !== null && use) {
      // two codes with a ceiling: the smaller one, counted from the earlier entry
      const cur = out.videoGens;
      out.videoGens = cur ? { cap: Math.min(cur.cap, c.videoGens), since: cur.since < use.at ? cur.since : use.at } : { cap: c.videoGens, since: use.at };
    }
  }
  return out;
}

/** The Claude model id to serve a person whose codes cap it (their pick, unless dearer than the ceiling). */
export const claudeIdFor = (picked: unknown, perks: Perks) => capClaudeModel(picked, perks.claudeModel);

/** «تقدر تسوي فيها»: what a code gives, in plain words, shown to the person who enters it (the gift, then each perk). A price is written «¤35»: the page draws the coin's logo for it. */
export function codeWelcome(c: Pick<CodeRow, "label" | "perms" | "giftSar" | "atCost" | "claudeModel" | "videoGens" | "validHours" | "unlimited">): string[] {
  const lines: string[] = [];
  if (c.giftSar > 0) lines.push(`نزّل في حسابك ¤${c.giftSar} هدية (نقاطك). تنخصم منها كل عملية بعد ما تخلص، وما ينخصم شي من عملية فشلت.`);
  if (c.unlimited) lines.push("تسوي بلا حدود: ما ينخصم منك شي.");
  else if (c.atCost) lines.push("كل شي تشتريه بسعر الأداة نفسها بدون أي ربح علينا، وكلاود يحسب مدخلاته ومخرجاته بسعر استخدامه الفعلي.");
  if (c.claudeModel) {
    const m = CLAUDE_MODELS.find((x) => x.key === c.claudeModel)!;
    lines.push(`كلاود: موديل «${m.name}» (${m.tagline}) هو الأعلى المتاح لك؛ لو اخترت أغلى منه يشتغل «${m.name}».`);
  }
  if (c.videoGens !== null) lines.push(`فيديو Seedance 2.0: ${c.videoGens === 0 ? "ما هو متاح" : c.videoGens === 1 ? "توليد واحد" : c.videoGens === 2 ? "توليدان" : `${c.videoGens} توليدات`} (حتى ١٥ ثانية للتوليد، والعربي في الحوار ما يدعمه رسميًا).`);
  const names = c.perms.map((p) => PERMS.find((x) => x.key === p)?.label).filter(Boolean);
  if (names.length) lines.push(`انفتح لك: ${names.join("، ")}.`);
  if (c.validHours) lines.push(`مدة استخدامك ${c.validHours} ساعة من دخولك.`);
  return lines;
}

/** Sections from the owner's form: only the known ones, no repeats. */
export const normalizePerms = (v: unknown): Perm[] => (Array.isArray(v) ? [...new Set(v.filter(isPerm))] : []);

/** A readable random code (no 0/O/1/I): `XXXX-XXXX`. */
export function newCodeText(random: (n: number) => number = (n) => Math.floor(Math.random() * n)): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = () => abc[random(abc.length)];
  return `${Array.from({ length: 4 }, pick).join("")}-${Array.from({ length: 4 }, pick).join("")}`;
}
