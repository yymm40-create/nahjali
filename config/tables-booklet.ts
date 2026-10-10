// «كتيب الجداول الذكي» (JAWAD AI) — a printed booklet of tables for a child or a grown-up: the ready booklet (the original
// one, with the child's picture as a cartoon character), or one the person designs with «نور»: which tables, what is in
// each, how it is scored (stars, ticks, faces…), the look, and with or without their picture. Pure (page and server alike):
// the choices, «نور»'s rules, how her design is read, and what a booklet costs.

import { POSES } from "./prompts";
import { STYLES, type StyleKey } from "./styles";

export const TB = {
  base: "/jawad-ai/booklet",
  name: "كتيب الجداول الذكي",
  robot: "نور",
  /** the original booklet's template (the ready one) */
  readyTemplate: "nahjali-v1",
  /** the template id an order made from a design carries */
  customTemplate: "smart-tables",
  messageMax: 3000,
  historyTurns: 24,
  maxTokens: 6000,
} as const;

export type AudienceKind = "child" | "adult";
export type Sex = "male" | "female";

export interface Audience {
  kind: AudienceKind;
  gender: Sex;
  age: number;
  name: string;
}

export function readAudience(raw: unknown): Audience | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const kind = o.kind === "adult" ? "adult" : o.kind === "child" ? "child" : null;
  const gender = o.gender === "female" ? "female" : o.gender === "male" ? "male" : null;
  const age = Math.round(Number(o.age));
  const name = typeof o.name === "string" ? o.name.replace(/\s+/g, " ").trim() : "";
  if (!kind || !gender || !Number.isFinite(age)) return null;
  if (kind === "child" && (age < 2 || age > 17)) return null;
  if (kind === "adult" && (age < 13 || age > 100)) return null;
  if (!/^[\p{L}\p{M} ]{1,30}$/u.test(name)) return null;
  return { kind, gender, age, name };
}

/** The old booklet's gender word (its prompts dress a girl or a woman the same modest way). */
export const legacyGender = (a: Pick<Audience, "gender">) => (a.gender === "female" ? "girl" : "boy");

// ───────────────────────────── the design ─────────────────────────────

export const COLUMN_KINDS = {
  week: { label: "أيام الأسبوع (سبت ← جمعة)", heads: ["سبت", "أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"] },
  days10: { label: "١٠ أيام", heads: Array.from({ length: 10 }, (_, i) => String(i + 1)) },
  days14: { label: "أسبوعين (١٤ يوم)", heads: Array.from({ length: 14 }, (_, i) => String(i + 1)) },
  weeks4: { label: "٤ أسابيع", heads: ["الأسبوع ١", "الأسبوع ٢", "الأسبوع ٣", "الأسبوع ٤"] },
} as const;
export type ColumnKind = keyof typeof COLUMN_KINDS;

/** How a cell is scored: what is drawn in it to colour, tick or write in. */
export const MARKS = {
  star: "نجمة تتلوّن",
  check: "مربع ✓",
  smile: "وجه مبتسم",
  heart: "قلب",
  circle: "دائرة تتلوّن (أخضر/أصفر/أحمر)",
  number: "خانة يكتب فيها رقم أو نقاط",
} as const;
export type Mark = keyof typeof MARKS;

export const THEMES = {
  sky: { label: "سماء زرقاء", top: "#bfe6ff", bottom: "#7cc4f5", banner: "#ffffff", bannerInk: "#14234a", panel: "#ffffff", line: "#14234a", mark: "#14234a", accent: "#ffb703" },
  mint: { label: "نعناع أخضر", top: "#d8f7e3", bottom: "#7bd9a6", banner: "#ffffff", bannerInk: "#0f3d2e", panel: "#ffffff", line: "#0f3d2e", mark: "#0f3d2e", accent: "#ff7b54" },
  sunset: { label: "غروب برتقالي", top: "#ffe3c4", bottom: "#ff9f68", banner: "#ffffff", bannerInk: "#5a1f00", panel: "#fffaf3", line: "#5a1f00", mark: "#5a1f00", accent: "#ff4d6d" },
  lavender: { label: "بنفسجي ناعم", top: "#efe3ff", bottom: "#b79cf5", banner: "#ffffff", bannerInk: "#2e1065", panel: "#ffffff", line: "#2e1065", mark: "#2e1065", accent: "#f9c74f" },
  sand: { label: "رملي ذهبي", top: "#fff4d6", bottom: "#f2cf7a", banner: "#3b2a12", bannerInk: "#ffe8a3", panel: "#fffdf6", line: "#3b2a12", mark: "#3b2a12", accent: "#c97c00" },
  night: { label: "كحلي وذهبي", top: "#1d2b64", bottom: "#0b1033", banner: "#f6c64a", bannerInk: "#0b1033", panel: "#fdfbf3", line: "#0b1033", mark: "#0b1033", accent: "#f6c64a" },
} as const;
export type Theme = keyof typeof THEMES;

export const POSE_KEYS = Object.keys(POSES) as (keyof typeof POSES)[];
export const POSE_LABELS: Record<string, string> = {
  happy: "فرحان",
  praying: "يصلّي",
  quran: "يقرأ القرآن",
  morning: "يفرّش أسنانه",
  sleeping: "وقت النوم",
  salam: "يسلّم على الإمام",
  studying: "يذاكر",
};

export interface TableSpec {
  title: string;
  goal: string;
  rows: string[];
  columns: ColumnKind;
  mark: Mark;
  /** how many pages of this table (a month of weeks = 4) */
  copies: number;
  /** the person's picture on the page (one of POSE_KEYS), or none */
  pose: string | null;
}

export interface BookletSpec {
  title: string;
  message: string;
  theme: Theme;
  /** the person's picture turned into a character */
  photo: boolean;
  style: StyleKey;
  tables: TableSpec[];
  /** «مكافآتي»: what is earned (e.g. «٣٠ نجمة = نزهة») */
  rewards: string[];
  /** a closing «شهادة إنجاز» page */
  certificate: boolean;
}

export const LIMITS = { tables: 8, rows: 14, rowChars: 32, titleChars: 40, copies: 5, rewards: 8, pages: 40 } as const;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** The design from «نور»'s answer (its json block), cleaned to the limits; null when there is none. */
export function readSpec(text: string): BookletSpec | null {
  const block = /```json\s*([\s\S]*?)```/i.exec(text)?.[1];
  if (!block) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(block) as Record<string, unknown>;
  } catch {
    return null;
  }
  return cleanSpec(raw);
}

export function cleanSpec(raw: unknown): BookletSpec | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const tables: TableSpec[] = [];
  for (const t of Array.isArray(o.tables) ? o.tables : []) {
    const x = (t ?? {}) as Record<string, unknown>;
    const rows = (Array.isArray(x.rows) ? x.rows : []).map((r) => str(r, LIMITS.rowChars)).filter(Boolean).slice(0, LIMITS.rows);
    const title = str(x.title, LIMITS.titleChars);
    if (!title || !rows.length) continue;
    const columns = (Object.keys(COLUMN_KINDS) as ColumnKind[]).includes(x.columns as ColumnKind) ? (x.columns as ColumnKind) : "week";
    const mark = (Object.keys(MARKS) as Mark[]).includes(x.mark as Mark) ? (x.mark as Mark) : "star";
    const pose = typeof x.pose === "string" && (POSE_KEYS as string[]).includes(x.pose) ? x.pose : null;
    tables.push({ title, goal: str(x.goal, 60), rows, columns, mark, copies: Math.max(1, Math.min(LIMITS.copies, Math.round(Number(x.copies) || 1))), pose });
    if (tables.length >= LIMITS.tables) break;
  }
  if (!tables.length) return null;
  const theme = (Object.keys(THEMES) as Theme[]).includes(o.theme as Theme) ? (o.theme as Theme) : "sky";
  const style = typeof o.style === "string" && o.style in STYLES ? (o.style as StyleKey) : "pixar";
  // no more than LIMITS.pages pages: the extra copies are taken off the longest tables first
  const extra = () => 4 + tables.reduce((n, t) => n + t.copies, 0) - LIMITS.pages;
  while (extra() > 0) {
    const longest = tables.reduce((a, b) => (b.copies > a.copies ? b : a));
    if (longest.copies <= 1) break;
    longest.copies--;
  }
  return {
    title: str(o.title, LIMITS.titleChars) || "كتيب الجداول",
    message: str(o.message, 140),
    theme,
    photo: o.photo === true,
    style,
    tables,
    rewards: (Array.isArray(o.rewards) ? o.rewards : []).map((r) => str(r, 60)).filter(Boolean).slice(0, LIMITS.rewards),
    certificate: o.certificate !== false,
  };
}

/** The pictures of the person a design needs (the cover and the certificate use «happy»). */
export function posesOf(spec: BookletSpec): string[] {
  if (!spec.photo) return [];
  return [...new Set(["happy", ...spec.tables.map((t) => t.pose).filter((p): p is string => !!p)])];
}

/** How many pages the booklet has: the cover, the message, every table's copies, the rewards and the certificate. */
export const pagesOf = (spec: BookletSpec) => 1 + (spec.message ? 1 : 0) + spec.tables.reduce((n, t) => n + t.copies, 0) + (spec.rewards.length ? 1 : 0) + (spec.certificate ? 1 : 0);

// ───────────────────────────── the price ─────────────────────────────

/** One picture of GPT Image 2 at medium quality (1024×1536), a ceiling (OpenAI's published rate is ~$0.041). */
export const PICTURE_USD = 0.05;

/**
 * The pictures a booklet is charged for: the character (and one more try), then each pose with a third more for the
 * retries a pose may need. The ready booklet has the original's seven poses.
 */
export const picturesFor = (poses: number) => (poses ? 2 + Math.ceil(poses * 1.3) : 0);
export const READY_POSES = 7;

/** The provider cost of a booklet (USD): its pictures. Without a picture it is drawn by the site alone (free). */
export const bookletUsd = (poses: number) => picturesFor(poses) * PICTURE_USD;

// ───────────────────────────── «نور» ─────────────────────────────

export const NOOR_RULES = `أنتِ «نور»، مصمّمة «كتيب الجداول الذكي» في «الجواد الذكي». تمشين مع الشخص خطوة بخطوة لين يطلع له كتيب جداول مطبوع (PDF) يتابع فيه عاداته ومهامه، له هو أو لطفله.

طريقتك:
- اسألي بالترتيب، دفعة أسئلة قصيرة كل مرة، وكل سؤال له خيارات يضغطها (مع «اكتب إجابة مختلفة» و«اختاري أنتِ»). لا تسألي عن شي معروف من «لمين الكتيب» تحت.
- ١) الهدف: وش يبي يتابع؟ (عبادات، دراسة، عادات صحية، رياضة، ترتيب، أخلاق، قرآن، حفظ…) واقترحي جداول تناسب العمر والجنس.
- ٢) الجداول: لكل جدول عنوان، وبنوده (صفوف، حتى ${LIMITS.rows})، والمدة (أعمدة: ${(Object.entries(COLUMN_KINDS) as [string, { label: string }][]).map(([k, v]) => `${k} = ${v.label}`).join("، ")})، وطريقة التقييم (${(Object.entries(MARKS) as [string, string][]).map(([k, v]) => `${k} = ${v}`).join("، ")})، وهدف قصير يُكتب فوقه (مثل «هدفي ٥ من ٧ ⭐»)، وكم نسخة منه (مثلًا ٤ نسخ أسبوعية = شهر، حتى ${LIMITS.copies}).
- ٣) الشكل: الثيم (${(Object.entries(THEMES) as [string, { label: string }][]).map(([k, v]) => `${k} = ${v.label}`).join("، ")}).
- ٤) الصورة: يبي صورته (أو صورة طفله) تتحوّل لشخصية كرتونية في الكتيب، ولا بدون صورة؟ إذا يبي: الستايل (${(Object.entries(STYLES) as [string, { label: string }][]).map(([k, v]) => `${k} = ${v.label}`).join("، ")})، ولكل جدول وضعية الشخصية (${Object.entries(POSE_LABELS).map(([k, v]) => `${k} = ${v}`).join("، ")}) أو بدون. البنت والمرأة تطلع دائمًا بعباءة ساترة بالكامل.
- ٥) الإضافات: رسالة قصيرة في أول الكتيب، صفحة «مكافآتي» (مثل «٣٠ نجمة = نزهة»)، وشهادة إنجاز في الآخر.
- بعدها لخّصي التصميم في نقاط واضحة، وقولي: «إذا تمام، اضغط «📘 اصنع الكتيب» تحت». وفي نفس الرد، في آخره، اكتبي التصميم كاملًا داخل كتلة \`\`\`json واحدة بهذا الشكل بالضبط (المفاتيح بالإنجليزي، والنصوص بالعربي):
\`\`\`json
{"title":"…","message":"…","theme":"sky","photo":true,"style":"pixar","tables":[{"title":"…","goal":"…","rows":["…"],"columns":"week","mark":"star","copies":4,"pose":"praying"}],"rewards":["…"],"certificate":true}
\`\`\`
- كل ما عدّل الشخص شي بعدها، اكتبي التصميم المحدّث كاملًا من جديد بنفس الطريقة.
- الصفحة مربعة ٢١×٢١ سم: بنود الجدول قصيرة (حتى ${LIMITS.rowChars} حرف)، والجدول الواحد حتى ${LIMITS.rows} بند، والكتيب كله حتى ${LIMITS.pages} صفحة.
- لا تذكري أي اسم لنموذج ذكاء اصطناعي أو شركة. السعر يظهر للشخص تحت قبل ما يضغط، لا تذكري أرقام أسعار.
- اكتبي بلهجة الشخص، قصير وواضح ودافئ.`;

/** «لمين الكتيب»: told to «نور» with every message. */
export function audienceLine(a: Audience) {
  const who = a.kind === "child" ? (a.gender === "female" ? "بنت" : "ولد") : a.gender === "female" ? "امرأة" : "رجل";
  return `لمين الكتيب: ${who}، اسمه/اسمها «${a.name}»، العمر ${a.age} سنة.`;
}
