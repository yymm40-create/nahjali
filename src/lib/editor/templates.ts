// «حيدرة كت» — «قوالب المونتاج» (project templates, the CapCut way). Pure (browser, server and tests).
//
// A template is a timeline skeleton: slots on the main track («حط مقطعك هنا», each with a suggested length), texts
// tied to a slot (their words editable before and after), the transition between slots, effects and an entrance on a
// slot, a colour look, beat marks and a place for music, the shape of the video, and the captions look it suggests.
// The person fills the slots with their own files (by hand, or in order), and `buildTemplate` turns it into an ordinary
// timeline — after that nothing is special about it: every clip and text edits like any other.
//
// The ready templates are below (`READY_TEMPLATES`); the person's own («احفظ كقالب») are made from a project by
// `templateFromTimeline` and kept in the database (0115), read back through `readTemplate`.

import { applyLook, LOOKS, NEUTRAL_GRADE, readGrades, type Grade } from "./grade";
import { FX_BY_ID } from "./effects";
import { isFont } from "./fonts";
import { TR_BY_ID } from "./transitions";
import {
  ANIMS,
  CAPTION_STYLES,
  clipLength,
  DEFAULT_TEXT,
  DEFAULT_TRANSFORM,
  EDITOR_VERSION,
  LIMITS,
  mainTrack,
  newId,
  RATIOS,
  ratioOf,
  STILL_MS,
  TRANSITION_MS,
  type AnimKind,
  type AssetInfo,
  type CaptionStyle,
  type Clip,
  type Ratio,
  type TextStyle,
  type Timeline,
  type Track,
} from "./model";

export interface TplSlot {
  /** what goes here, in words («الهوك», «النقطة ١») */
  label: string;
  /** the suggested length (ms) */
  ms: number;
  /** takes the whole file (a talking video, a podcast): `ms` is only the suggestion shown */
  whole?: boolean;
  /** a picture or a video fits best (both are taken) */
  kind?: "video" | "image" | "any";
  /** effects on the clip (effects.ts ids) */
  fx?: string[];
  /** its entrance: a media entrance id (ANIMS), "kenburns" for a slow push in */
  anim?: AnimKind | null;
  /** into the next slot (absent = the template's) */
  transition?: { kind: string; ms: number } | null;
  /** a little closer (1 = as filmed) */
  zoom?: number;
  /** a saved template keeps each slot's own grading */
  grades?: Grade[];
}

export interface TplText {
  /** the slot it belongs to (index) */
  slot: number;
  /** ms into that slot */
  at: number;
  /** how long (null = to the end of the slot) */
  ms: number | null;
  /** what it is, shown beside the box where the words are changed */
  label: string;
  body: string;
  style: Partial<TextStyle>;
  /** the middle of the text, as a share of the frame's height (0.5 = middle) */
  y: number;
  in?: AnimKind | null;
  out?: AnimKind | null;
}

export interface Template {
  id: string;
  name: string;
  icon: string;
  desc: string;
  ratio: Ratio;
  slots: TplSlot[];
  texts: TplText[];
  /** the look of the captions it suggests (made from the speech afterwards, at the captions' price) */
  captions: CaptionStyle | null;
  /** a colour look over every slot (grade.ts LOOKS id) */
  look: string | null;
  /** between every two slots (a slot can have its own) */
  transition: { kind: string; ms: number } | null;
  /** beat marks at this tempo (the cuts snap to them) */
  bpm: number | null;
  /** a music place (a sound file the person adds; the template is fine without it) */
  music: boolean;
  /** the card's colour */
  accent: string;
  background: string;
}

export const TEMPLATE_LIMITS = { slots: 30, texts: 40, name: 40, minSlotMs: 500, maxSlotMs: 120_000, wholeMaxMs: 10 * 60_000, body: 200 } as const;

// ───────── the ready templates ─────────

const T = (o: Partial<TplText> & Pick<TplText, "slot" | "label" | "body">): TplText => ({ at: 0, ms: null, y: 0.22, style: {}, in: "pop", out: "fade", ...o });
const HOOK: Partial<TextStyle> = { size: 0.07, weight: 900, color: "#ffffff", box: null, font: "readex", highlight: null };
const LABEL: Partial<TextStyle> = { size: 0.045, weight: 700, color: "#111111", box: "#facc15", font: "readex" };
const BIG: Partial<TextStyle> = { size: 0.085, weight: 900, color: "#ffffff", font: "kufi" };

export const READY_TEMPLATES: Template[] = [
  {
    id: "hook-points-cta",
    name: "هوك + ٣ نقاط + دعوة",
    icon: "🎯",
    desc: "أقوى شكل للريلز: جملة توقف التمرير، ثلاث نقاط مرقّمة، وتختم بدعوة.",
    ratio: "9:16",
    slots: [
      { label: "الهوك", ms: 3000, kind: "video", fx: ["shakeLight"] },
      { label: "النقطة ١", ms: 4000 },
      { label: "النقطة ٢", ms: 4000 },
      { label: "النقطة ٣", ms: 4000 },
      { label: "الدعوة", ms: 3000, anim: "settle" },
    ],
    texts: [
      T({ slot: 0, label: "الهوك", body: "وقف! هذا الشي يغيّر طريقتك", style: HOOK, in: "punch" }),
      T({ slot: 1, label: "النقطة ١", body: "١ — أول نقطة", style: LABEL, in: "fromRight" }),
      T({ slot: 2, label: "النقطة ٢", body: "٢ — ثاني نقطة", style: LABEL, in: "fromRight" }),
      T({ slot: 3, label: "النقطة ٣", body: "٣ — ثالث نقطة", style: LABEL, in: "fromRight" }),
      T({ slot: 4, label: "الدعوة", body: "احفظه وتابعني للمزيد", style: { ...HOOK, size: 0.06 }, y: 0.5, in: "pop" }),
    ],
    captions: "pop2",
    look: "clean",
    transition: { kind: "whipLeft", ms: 280 },
    bpm: null,
    music: true,
    accent: "#facc15",
    background: "#000000",
  },
  {
    id: "before-after",
    name: "قبل وبعد",
    icon: "🔁",
    desc: "الحال قبل، ثم النتيجة بمسح يكشفها — للتصميم والترتيب والتعديل.",
    ratio: "9:16",
    slots: [
      { label: "قبل", ms: 3000, fx: ["bw"] },
      { label: "بعد", ms: 4000, transition: null, anim: "kenburns" },
      { label: "اللمسة الأخيرة", ms: 3000 },
    ],
    texts: [
      T({ slot: 0, label: "كلمة قبل", body: "قبل", style: LABEL, y: 0.15, in: "settle" }),
      T({ slot: 1, label: "كلمة بعد", body: "بعد ✨", style: { ...LABEL, box: "#22c55e", color: "#ffffff" }, y: 0.15, in: "pop" }),
      T({ slot: 2, label: "الخلاصة", body: "الفرق واضح؟", style: HOOK, y: 0.75, in: "rise" }),
    ],
    captions: null,
    look: "clean",
    transition: { kind: "wipe", ms: 700 },
    bpm: null,
    music: true,
    accent: "#22c55e",
    background: "#000000",
  },
  {
    id: "beat-montage",
    name: "مونتاج على الإيقاع",
    icon: "🥁",
    desc: "ثماني لقطات قصيرة كل وحدة على ضربتين، بفلاش ونبض مع الإيقاع (١٢٠ ضربة).",
    ratio: "9:16",
    slots: [
      { label: "لقطة ١", ms: 1000, fx: ["pulseBeat"] },
      { label: "لقطة ٢", ms: 1000 },
      { label: "لقطة ٣", ms: 1000, fx: ["pulseBeat"] },
      { label: "لقطة ٤", ms: 1000 },
      { label: "لقطة ٥", ms: 1000, fx: ["pulseBeat"] },
      { label: "لقطة ٦", ms: 1000 },
      { label: "لقطة ٧", ms: 1000, fx: ["pulseBeat"] },
      { label: "لقطة ٨ (الختام)", ms: 2000, anim: "kenburns" },
    ],
    texts: [T({ slot: 7, label: "العنوان", body: "يومي بثواني", style: BIG, y: 0.5, in: "punch" })],
    captions: null,
    look: "teal-orange",
    transition: { kind: "flashWhite", ms: 200 },
    bpm: 120,
    music: true,
    accent: "#38bdf8",
    background: "#000000",
  },
  {
    id: "talking-captions",
    name: "كلام للكاميرا مع كابشن",
    icon: "🗣️",
    desc: "مقطعك كامل وانت تتكلم، عنوان فوق أول ثلاث ثواني، وكابشن كلمة بكلمة.",
    ratio: "9:16",
    slots: [{ label: "مقطعك وانت تتكلم", ms: 30000, whole: true, kind: "video", zoom: 1.05 }],
    texts: [T({ slot: 0, label: "العنوان", body: "السؤال اللي يجاوبه الفيديو", style: { ...LABEL, size: 0.05 }, ms: 3500, y: 0.16, in: "pop" })],
    captions: "karaoke",
    look: "warm-portrait",
    transition: null,
    bpm: null,
    music: false,
    accent: "#a78bfa",
    background: "#000000",
  },
  {
    id: "product",
    name: "عرض منتج",
    icon: "🛍️",
    desc: "المنتج أول، ميزتين، طريقة الاستخدام، وختام «اطلبه الحين».",
    ratio: "9:16",
    slots: [
      { label: "المنتج كامل", ms: 2500, anim: "kenburns", kind: "image" },
      { label: "تفصيلة ١", ms: 2000, zoom: 1.15 },
      { label: "تفصيلة ٢", ms: 2000, zoom: 1.15 },
      { label: "وهو يُستخدم", ms: 3000 },
      { label: "الختام", ms: 3000, anim: "kenburns", fx: ["bloomSoft"] },
    ],
    texts: [
      T({ slot: 0, label: "اسم المنتج", body: "اسم منتجك", style: BIG, y: 0.78, in: "rise" }),
      T({ slot: 1, label: "الميزة ١", body: "خامة تدوم", style: LABEL, y: 0.8, in: "fromRight" }),
      T({ slot: 2, label: "الميزة ٢", body: "حجم يناسبك", style: LABEL, y: 0.8, in: "fromRight" }),
      T({ slot: 4, label: "الدعوة", body: "اطلبه الحين", style: { ...LABEL, size: 0.06, box: "#ef4444", color: "#ffffff" }, y: 0.78, in: "pop" }),
    ],
    captions: null,
    look: "clean",
    transition: { kind: "slideLeft", ms: 400 },
    bpm: 100,
    music: true,
    accent: "#f97316",
    background: "#0b0b0b",
  },
  {
    id: "quote",
    name: "اقتباس",
    icon: "💬",
    desc: "جملة واحدة كبيرة تنكتب كلمة كلمة فوق لقطة هادية.",
    ratio: "9:16",
    slots: [{ label: "خلفية هادية (صورة أو فيديو)", ms: 8000, anim: "kenburns", fx: ["vignette", "filmGrain"] }],
    texts: [
      T({ slot: 0, label: "الاقتباس", body: "«اكتب الجملة اللي تبي الناس تحفظها»", style: { size: 0.06, weight: 700, color: "#fef3c7", font: "naskh" }, at: 400, y: 0.46, in: "words", out: "fade" }),
      T({ slot: 0, label: "القائل", body: "— اسم القائل", style: { size: 0.035, weight: 400, color: "#e5e7eb", font: "readex" }, at: 2500, y: 0.6, in: "fade" }),
    ],
    captions: null,
    look: "nordic",
    transition: null,
    bpm: null,
    music: true,
    accent: "#fde68a",
    background: "#000000",
  },
  {
    id: "tutorial",
    name: "شرح بالخطوات",
    icon: "🧩",
    desc: "عنوان، أربع خطوات مرقّمة كل وحدة بلقطتها، والنتيجة في الآخر.",
    ratio: "9:16",
    slots: [
      { label: "العنوان", ms: 3000 },
      { label: "الخطوة ١", ms: 4000 },
      { label: "الخطوة ٢", ms: 4000 },
      { label: "الخطوة ٣", ms: 4000 },
      { label: "الخطوة ٤", ms: 4000 },
      { label: "النتيجة", ms: 3000, anim: "kenburns" },
    ],
    texts: [
      T({ slot: 0, label: "العنوان", body: "كيف تسويها في ٤ خطوات", style: HOOK, y: 0.2, in: "punch" }),
      T({ slot: 1, label: "الخطوة ١", body: "١. الخطوة الأولى", style: { ...LABEL, box: "#0ea5e9", color: "#ffffff" }, y: 0.14, in: "fromRight" }),
      T({ slot: 2, label: "الخطوة ٢", body: "٢. الخطوة الثانية", style: { ...LABEL, box: "#0ea5e9", color: "#ffffff" }, y: 0.14, in: "fromRight" }),
      T({ slot: 3, label: "الخطوة ٣", body: "٣. الخطوة الثالثة", style: { ...LABEL, box: "#0ea5e9", color: "#ffffff" }, y: 0.14, in: "fromRight" }),
      T({ slot: 4, label: "الخطوة ٤", body: "٤. الخطوة الرابعة", style: { ...LABEL, box: "#0ea5e9", color: "#ffffff" }, y: 0.14, in: "fromRight" }),
      T({ slot: 5, label: "النتيجة", body: "وهذي النتيجة ✅", style: HOOK, y: 0.78, in: "pop" }),
    ],
    captions: "box",
    look: "documentary",
    transition: { kind: "pushUp", ms: 350 },
    bpm: null,
    music: true,
    accent: "#0ea5e9",
    background: "#000000",
  },
  {
    id: "travel",
    name: "رحلة",
    icon: "🧳",
    desc: "سبع لقطات من رحلتك بضوء ذهبي وزووم ناعم بين المشاهد.",
    ratio: "9:16",
    slots: [
      { label: "الوصول", ms: 2500, fx: ["leakWarm"] },
      { label: "المكان", ms: 2000, anim: "kenburns" },
      { label: "الأكل", ms: 2000 },
      { label: "الطريق", ms: 2000 },
      { label: "منظر", ms: 2500, anim: "kenburns" },
      { label: "لحظة حلوة", ms: 2000 },
      { label: "الختام", ms: 3000, fx: ["leakGold"] },
    ],
    texts: [
      T({ slot: 0, label: "الوجهة", body: "اسم الوجهة", style: { ...BIG, size: 0.09 }, y: 0.5, in: "letters" }),
      T({ slot: 6, label: "الختام", body: "لين الرحلة الجاية", style: { ...HOOK, size: 0.05, weight: 700 }, y: 0.8, in: "fade" }),
    ],
    captions: null,
    look: "golden",
    transition: { kind: "zoomBlurT", ms: 450 },
    bpm: 110,
    music: true,
    accent: "#f59e0b",
    background: "#000000",
  },
  {
    id: "podcast",
    name: "مقطع بودكاست",
    icon: "🎙️",
    desc: "مقطع من حلقتك كامل، اسم البرنامج فوق طول الوقت، وكابشن كلمتين كلمتين.",
    ratio: "9:16",
    slots: [{ label: "مقطع الحلقة", ms: 60000, whole: true, kind: "video", zoom: 1.1 }],
    texts: [
      T({ slot: 0, label: "اسم البرنامج", body: "اسم البودكاست · الحلقة ١", style: { ...LABEL, size: 0.035, box: "#000000b3", color: "#ffffff" }, y: 0.1, in: "fade", out: null }),
      T({ slot: 0, label: "الهوك", body: "الجملة الأقوى من الحلقة", style: HOOK, ms: 3000, y: 0.22, in: "punch" }),
    ],
    captions: "pop2",
    look: "warm-portrait",
    transition: null,
    bpm: null,
    music: false,
    accent: "#ef4444",
    background: "#000000",
  },
  {
    id: "announcement",
    name: "إعلان",
    icon: "📣",
    desc: "تشويق قصير، كشف الخبر بلمعة ذهبية، التفاصيل، ثم الموعد.",
    ratio: "9:16",
    slots: [
      { label: "التشويق", ms: 2000, fx: ["blackFlash"] },
      { label: "الكشف", ms: 3000, fx: ["goldSparkle"], anim: "kenburns" },
      { label: "التفاصيل", ms: 4000 },
      { label: "الموعد", ms: 3000, anim: "settle" },
    ],
    texts: [
      T({ slot: 0, label: "التشويق", body: "عندنا خبر…", style: BIG, y: 0.5, in: "type" }),
      T({ slot: 1, label: "الخبر", body: "اكتب الخبر هنا", style: { ...HOOK, color: "#facc15" }, y: 0.2, in: "punch" }),
      T({ slot: 2, label: "التفاصيل", body: "التفاصيل في سطر", style: LABEL, y: 0.8, in: "rise" }),
      T({ slot: 3, label: "الموعد", body: "الخميس ٨ مساءً", style: { ...BIG, size: 0.07 }, y: 0.5, in: "pop" }),
    ],
    captions: null,
    look: "blockbuster",
    transition: { kind: "flashGold", ms: 300 },
    bpm: 128,
    music: true,
    accent: "#eab308",
    background: "#000000",
  },
  {
    id: "listicle",
    name: "قائمة: ٥ أشياء",
    icon: "🔢",
    desc: "مقدمة، خمسة أشياء بالعدّ التنازلي، وسؤال في الآخر يفتح التعليقات.",
    ratio: "9:16",
    slots: [
      { label: "المقدمة", ms: 3000 },
      { label: "رقم ٥", ms: 2500 },
      { label: "رقم ٤", ms: 2500 },
      { label: "رقم ٣", ms: 2500 },
      { label: "رقم ٢", ms: 2500 },
      { label: "رقم ١", ms: 3000, fx: ["bloomSoft"] },
      { label: "السؤال", ms: 2500 },
    ],
    texts: [
      T({ slot: 0, label: "العنوان", body: "٥ أشياء لازم تعرفها", style: HOOK, y: 0.2, in: "punch" }),
      ...["٥", "٤", "٣", "٢", "١"].map((n, i) => T({ slot: i + 1, label: `رقم ${n}`, body: `${n}. اكتب هنا`, style: { ...LABEL, box: "#ec4899", color: "#ffffff" }, y: 0.15, in: "fromRight" })),
      T({ slot: 6, label: "السؤال", body: "أي واحد فاجأك؟ قول بالتعليقات", style: { ...HOOK, size: 0.05 }, y: 0.5, in: "pop" }),
    ],
    captions: null,
    look: "clean",
    transition: { kind: "slide", ms: 300 },
    bpm: null,
    music: true,
    accent: "#ec4899",
    background: "#000000",
  },
  {
    id: "story",
    name: "قصة: بداية وعقدة ونهاية",
    icon: "📖",
    desc: "أربع فصول بشريط سينما وانتقال عبر الأسود — لقصة قصيرة أو يوميات.",
    ratio: "9:16",
    slots: [
      { label: "البداية", ms: 4000, fx: ["letterbox"] },
      { label: "المشكلة", ms: 4000, fx: ["letterbox"] },
      { label: "اللحظة الفارقة", ms: 4000, fx: ["letterbox"] },
      { label: "النهاية", ms: 4500, fx: ["letterbox"], anim: "kenburns" },
    ],
    texts: [
      T({ slot: 0, label: "الفصل ١", body: "البداية", style: { size: 0.035, weight: 400, color: "#e5e7eb", font: "readex" }, ms: 2000, y: 0.88, in: "fade" }),
      T({ slot: 1, label: "الفصل ٢", body: "ثم صار شي…", style: { size: 0.035, weight: 400, color: "#e5e7eb", font: "readex" }, ms: 2000, y: 0.88, in: "fade" }),
      T({ slot: 2, label: "الفصل ٣", body: "اللحظة اللي غيّرت كل شي", style: { size: 0.035, weight: 400, color: "#e5e7eb", font: "readex" }, ms: 2000, y: 0.88, in: "fade" }),
      T({ slot: 3, label: "الخاتمة", body: "والنهاية؟", style: { size: 0.06, weight: 700, color: "#ffffff", font: "naskh" }, at: 1500, y: 0.5, in: "words" }),
    ],
    captions: null,
    look: "kodak-2383",
    transition: { kind: "black", ms: 700 },
    bpm: null,
    music: true,
    accent: "#94a3b8",
    background: "#000000",
  },
];

export const templateById = (id: string) => READY_TEMPLATES.find((t) => t.id === id) ?? null;

/** The template's length as suggested (the files' own lengths can change it). */
export const templateMs = (t: Pick<Template, "slots">) => t.slots.reduce((m, s) => m + s.ms, 0);

// ───────── filling the slots ─────────

/** A slot's file: the library file and where in it to start (ms; a long video used for several slots goes on). */
export interface Fill {
  assetId: string;
  in?: number;
}

const usable = (a: AssetInfo) => a.kind === "video" || a.kind === "image";

/**
 * «عبّي بالترتيب»: the files in their order into the empty slots (what is filled stays). Too few: the files are used
 * again from the start, a video going on from where its last slot ended (when enough of it is left). Too many: the
 * rest are counted (they stay in the library). The first sound file is the music, when the template has a place for it.
 */
export function autoFill(t: Pick<Template, "slots" | "music">, files: AssetInfo[], have: (Fill | null)[] = []): { fills: (Fill | null)[]; extra: number; reused: boolean; music: string | null } {
  const media = files.filter(usable);
  const music = t.music ? (files.find((f) => f.kind === "audio")?.id ?? null) : null;
  const fills: (Fill | null)[] = t.slots.map((_, i) => have[i] ?? null);
  const empty = fills.map((f, i) => (f ? -1 : i)).filter((i) => i >= 0);
  if (!media.length) return { fills, extra: 0, reused: false, music };
  // where each video was left (ms into it) by the slots filled so far
  const used = new Map<string, number>();
  const lengthIn = (slot: TplSlot, a: AssetInfo, from: number) => (a.kind === "image" ? 0 : slot.whole ? Math.max(0, (a.durationMs ?? 0) - from) : Math.min(slot.ms, Math.max(0, (a.durationMs ?? slot.ms) - from)));
  for (const [i, f] of fills.entries()) {
    if (!f) continue;
    const a = media.find((m) => m.id === f.assetId);
    if (a) used.set(a.id, Math.max(used.get(a.id) ?? 0, (f.in ?? 0) + lengthIn(t.slots[i], a, f.in ?? 0)));
  }
  let k = 0;
  let reused = false;
  for (const i of empty) {
    const a = media[k % media.length];
    if (k >= media.length) reused = true;
    k++;
    const slot = t.slots[i];
    let from = a.kind === "video" ? (used.get(a.id) ?? 0) : 0;
    // not enough of the video left for this slot: from its start again
    if (a.kind === "video" && a.durationMs != null && a.durationMs - from < Math.min(slot.ms, a.durationMs) * 0.6) from = 0;
    fills[i] = { assetId: a.id, ...(from ? { in: from } : {}) };
    if (a.kind === "video") used.set(a.id, from + lengthIn(slot, a, from));
  }
  return { fills, extra: Math.max(0, media.length - empty.length), reused, music };
}

/** How long each slot will be with these files (ms; null for an empty slot): a video shorter than its slot shortens it. */
export function slotLengths(t: Pick<Template, "slots">, fills: (Fill | null)[], assets: Map<string, AssetInfo>): (number | null)[] {
  return t.slots.map((s, i) => {
    const f = fills[i];
    const a = f ? assets.get(f.assetId) : null;
    if (!f || !a || !usable(a)) return null;
    if (a.kind === "image") return s.ms;
    const dur = a.durationMs ?? s.ms;
    const from = Math.min(Math.max(0, f.in ?? 0), Math.max(0, dur - LIMITS.minClipMs));
    const left = Math.max(LIMITS.minClipMs, dur - from);
    return Math.round(s.whole ? Math.min(left, TEMPLATE_LIMITS.wholeMaxMs) : Math.min(s.ms, left));
  });
}

export interface Built {
  timeline: Timeline;
  /** slot i → its clip's id on the main track */
  clips: string[];
  /** said to the person (a slot made shorter by a short video…) */
  notes: string[];
}

/**
 * The template as an ordinary timeline with these files in its slots (every slot must have a usable file), the words
 * the person wrote in place of the template's (`words[i]` for text i; empty = the template's), and a music file.
 */
export function buildTemplate(t: Template, fills: (Fill | null)[], assets: Map<string, AssetInfo>, o: { words?: string[]; music?: string | null } = {}): Built {
  const lens = slotLengths(t, fills, assets);
  const missing = lens.map((l, i) => (l == null ? i + 1 : 0)).filter(Boolean);
  if (missing.length) throw new Error(`باقي ${missing.length === 1 ? "خانة" : `${missing.length} خانات`} فاضية: ${missing.join("، ")}.`);
  const { width, height } = RATIOS[t.ratio] ?? RATIOS["9:16"];
  const look = t.look ? LOOKS.find((l) => l.id === t.look) : null;
  const grade = look ? [applyLook(NEUTRAL_GRADE, look)] : [];
  const notes: string[] = [];
  const clips: Clip[] = [];
  const starts: number[] = [];
  let at = 0;
  t.slots.forEach((s, i) => {
    const f = fills[i]!;
    const a = assets.get(f.assetId)!;
    const len = lens[i]!;
    if (!s.whole && a.kind === "video" && len < s.ms - 50) notes.push(`«${s.label}»: الفيديو أقصر من الخانة، فصارت ${(len / 1000).toFixed(1)} ث بدل ${(s.ms / 1000).toFixed(1)} ث.`);
    const from = a.kind === "video" ? Math.min(Math.max(0, f.in ?? 0), Math.max(0, (a.durationMs ?? len) - len)) : 0;
    const last = i === t.slots.length - 1;
    const tr = s.transition === undefined ? t.transition : s.transition;
    const anim = s.anim ?? (a.kind === "image" && !s.fx?.length ? "kenburns" : null);
    starts.push(at);
    clips.push({
      id: newId("c"),
      assetId: a.id,
      seq: null,
      start: at,
      in: from,
      out: from + (a.kind === "image" ? (len || STILL_MS) : len),
      speed: 1,
      volume: 1,
      fit: "cover",
      transform: { ...DEFAULT_TRANSFORM, scale: s.zoom && s.zoom > 0 ? Math.min(3, s.zoom) : 1 },
      text: null,
      keys: [],
      color: null,
      grades: s.grades?.length ? structuredClone(s.grades) : structuredClone(grade),
      transition: !last && tr && TR_BY_ID.has(tr.kind) ? { kind: tr.kind, ms: Math.min(TRANSITION_MS.max, Math.max(TRANSITION_MS.min, tr.ms)) } : null,
      fadeIn: 0,
      fadeOut: 0,
      shape: "rect",
      crop: null,
      blend: "normal",
      key: null,
      words: [],
      bg: null,
      sound: null,
      anim: anim ? { in: anim, out: null, inMs: ANIMS[anim].ms || 400, outMs: 400 } : null,
      fx: (s.fx ?? []).filter((x) => FX_BY_ID.has(x)).slice(0, 3).map((id) => ({ id, amount: 0.8 })),
      own: false,
      fix: null,
    });
    at += len;
  });
  const total = at;

  // the texts, each inside its slot; two at the same moment go on two tracks
  const textTracks: Track[] = [];
  t.texts.forEach((x, i) => {
    const s = Math.min(Math.max(0, x.slot), t.slots.length - 1);
    const slotStart = starts[s];
    const slotEnd = slotStart + lens[s]!;
    const start = Math.min(slotStart + Math.max(0, x.at), slotEnd - LIMITS.minClipMs);
    const end = x.ms == null ? slotEnd : Math.min(slotEnd, start + Math.max(LIMITS.minClipMs, x.ms));
    const body = (o.words?.[i]?.trim() || x.body).slice(0, LIMITS.text);
    const anim = x.in || x.out ? { in: x.in ?? null, out: x.out ?? null, inMs: x.in ? ANIMS[x.in].ms || 400 : 400, outMs: x.out ? ANIMS[x.out].ms || 400 : 400 } : null;
    const c: Clip = {
      id: newId("c"),
      assetId: null,
      seq: null,
      start,
      in: 0,
      out: end - start,
      speed: 1,
      volume: 1,
      fit: "contain",
      transform: { ...DEFAULT_TRANSFORM, y: Math.min(0.95, Math.max(0.05, x.y)) },
      text: { ...DEFAULT_TEXT, ...x.style, body },
      keys: [],
      color: null,
      grades: [],
      transition: null,
      fadeIn: 0,
      fadeOut: 0,
      shape: "rect",
      crop: null,
      blend: "normal",
      key: null,
      words: [],
      bg: null,
      sound: null,
      anim,
      fx: [],
      own: true,
      fix: null,
    };
    let tr = textTracks.find((k) => k.clips.every((o2) => o2.start + clipLength(o2) <= c.start || o2.start >= end));
    if (!tr) {
      tr = { id: newId("t"), kind: "text", name: textTracks.length ? `نصوص القالب ${textTracks.length + 1}` : "نصوص القالب", muted: false, hidden: false, locked: false, duck: false, clips: [] };
      textTracks.push(tr);
    }
    tr.clips.push(c);
  });
  for (const tr of textTracks) tr.clips.sort((a, b) => a.start - b.start);

  const sound: Track = { id: newId("t"), kind: "audio", name: t.music ? "الموسيقى" : "صوت", muted: false, hidden: false, locked: false, duck: false, clips: [] };
  const music = o.music ? assets.get(o.music) : null;
  if (music && music.kind === "audio") {
    const len = Math.max(LIMITS.minClipMs, Math.min(total, music.durationMs ?? total));
    sound.clips.push({ id: newId("c"), assetId: music.id, seq: null, start: 0, in: 0, out: len, speed: 1, volume: 0.8, fit: "cover", transform: { ...DEFAULT_TRANSFORM }, text: null, keys: [], color: null, grades: [], transition: null, fadeIn: 0, fadeOut: Math.min(1500, Math.round(len / 3)), shape: "rect", crop: null, blend: "normal", key: null, words: [], bg: null, sound: null, anim: null, fx: [], own: false, fix: null });
    if ((music.durationMs ?? total) < total - 500) notes.push("الموسيقى أقصر من الفيديو.");
    // a voice in the slots: the music steps down while someone talks
    if (t.slots.some((s) => s.whole)) sound.duck = true;
  }
  const markers: number[] = [];
  if (t.bpm && t.bpm >= 40 && t.bpm <= 240) for (let m = 0; m <= total && markers.length < LIMITS.markers; m += 60_000 / t.bpm) markers.push(Math.round(m));

  const timeline: Timeline = {
    v: EDITOR_VERSION,
    width,
    height,
    fps: 30,
    background: /^#[0-9a-f]{6}$/i.test(t.background) ? t.background : "#000000",
    magnetic: true,
    magnetAll: false,
    markers,
    tracks: [{ id: "main", kind: "video", name: "الرئيسي", muted: false, hidden: false, locked: false, duck: false, clips }, ...textTracks, sound],
  };
  return { timeline, clips: clips.map((c) => c.id), notes };
}

// ───────── the person's own templates ─────────

const COLOR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const clamp = (v: unknown, lo: number, hi: number, d: number) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Math.min(hi, Math.max(lo, Number(v))) : d);
const str = (v: unknown, max: number, d = "") => (typeof v === "string" ? v.trim().slice(0, max) : d);
const animOf = (v: unknown, only: "text" | "media"): AnimKind | null => {
  if (typeof v !== "string" || !(v in ANIMS)) return null;
  const o = (ANIMS[v as AnimKind] as { only?: string }).only;
  return !o || o === only ? (v as AnimKind) : null;
};
const trOf = (v: unknown): { kind: string; ms: number } | null => {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return typeof o.kind === "string" && TR_BY_ID.has(o.kind) ? { kind: o.kind, ms: Math.round(clamp(o.ms, TRANSITION_MS.min, TRANSITION_MS.max, TRANSITION_MS.default)) } : null;
};

function readStyle(v: unknown): Partial<TextStyle> {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  const out: Partial<TextStyle> = {};
  if (o.size != null) out.size = clamp(o.size, 0.01, 0.4, DEFAULT_TEXT.size);
  if (typeof o.color === "string" && COLOR.test(o.color)) out.color = o.color;
  if (o.box === null || (typeof o.box === "string" && COLOR.test(o.box))) out.box = o.box as string | null;
  if (o.highlight === null || (typeof o.highlight === "string" && COLOR.test(o.highlight))) out.highlight = o.highlight as string | null;
  if ([400, 700, 900].includes(Number(o.weight))) out.weight = Number(o.weight) as 400 | 700 | 900;
  if (o.align === "center" || o.align === "right" || o.align === "left") out.align = o.align;
  if (isFont(o.font)) out.font = o.font as string;
  if (typeof o.glow === "string" && COLOR.test(o.glow)) out.glow = o.glow;
  if (typeof o.grad === "string" && COLOR.test(o.grad)) out.grad = o.grad;
  return out;
}

/**
 * A template as stored or sent, made safe (unknown fields dropped, numbers kept in bounds, effects, transitions and
 * looks that don't exist removed); null when nothing usable is left (no slot).
 */
export function readTemplate(v: unknown, id?: string): Template | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const slots: TplSlot[] = (Array.isArray(o.slots) ? o.slots : []).slice(0, TEMPLATE_LIMITS.slots).flatMap((x): TplSlot[] => {
    if (!x || typeof x !== "object") return [];
    const s = x as Record<string, unknown>;
    const fx = (Array.isArray(s.fx) ? s.fx : []).filter((f): f is string => typeof f === "string" && FX_BY_ID.has(f)).slice(0, 3);
    const grades = readGrades(s.grades);
    return [
      {
        label: str(s.label, 40) || "مقطع",
        ms: Math.round(clamp(s.ms, TEMPLATE_LIMITS.minSlotMs, TEMPLATE_LIMITS.maxSlotMs, 3000)),
        ...(s.whole === true ? { whole: true } : {}),
        ...(s.kind === "video" || s.kind === "image" ? { kind: s.kind } : {}),
        ...(fx.length ? { fx } : {}),
        ...(animOf(s.anim, "media") ? { anim: animOf(s.anim, "media") } : {}),
        ...(s.transition === null ? { transition: null } : trOf(s.transition) ? { transition: trOf(s.transition) } : {}),
        ...(s.zoom != null && Number(s.zoom) !== 1 ? { zoom: clamp(s.zoom, 0.5, 3, 1) } : {}),
        ...(grades.length ? { grades } : {}),
      },
    ];
  });
  if (!slots.length) return null;
  const texts: TplText[] = (Array.isArray(o.texts) ? o.texts : []).slice(0, TEMPLATE_LIMITS.texts).flatMap((x): TplText[] => {
    if (!x || typeof x !== "object") return [];
    const s = x as Record<string, unknown>;
    const body = str(s.body, TEMPLATE_LIMITS.body);
    if (!body) return [];
    return [
      {
        slot: Math.round(clamp(s.slot, 0, slots.length - 1, 0)),
        at: Math.round(clamp(s.at, 0, TEMPLATE_LIMITS.maxSlotMs, 0)),
        ms: s.ms == null ? null : Math.round(clamp(s.ms, LIMITS.minClipMs, TEMPLATE_LIMITS.wholeMaxMs, 3000)),
        label: str(s.label, 40) || "نص",
        body,
        style: readStyle(s.style),
        y: clamp(s.y, 0.05, 0.95, 0.5),
        in: animOf(s.in, "text"),
        out: animOf(s.out, "text"),
      },
    ];
  });
  const ratio = (Object.keys(RATIOS) as Ratio[]).includes(o.ratio as Ratio) ? (o.ratio as Ratio) : "9:16";
  return {
    id: id ?? (str(o.id, 60) || "mine"),
    name: str(o.name, TEMPLATE_LIMITS.name) || "قالبي",
    icon: str(o.icon, 4) || "⭐",
    desc: str(o.desc, 200),
    ratio,
    slots,
    texts,
    captions: typeof o.captions === "string" && o.captions in CAPTION_STYLES ? (o.captions as CaptionStyle) : null,
    look: typeof o.look === "string" && LOOKS.some((l) => l.id === o.look) ? o.look : null,
    transition: trOf(o.transition),
    bpm: o.bpm == null ? null : Math.round(clamp(o.bpm, 40, 240, 120)),
    music: o.music === true,
    accent: typeof o.accent === "string" && /^#[0-9a-f]{6}$/i.test(o.accent) ? o.accent : "#a78bfa",
    background: typeof o.background === "string" && /^#[0-9a-f]{6}$/i.test(o.background) ? o.background : "#000000",
  };
}

/**
 * «احفظ كقالب»: the open timeline as a template — every picture or video on the main track a slot (its length, effects,
 * entrance, transition, grading, closeness), the texts that aren't spoken captions tied to the slot they start in, the
 * beat, whether there is music, the shape, and the captions' look when it has captions. The files themselves are not
 * kept (the slots are for the next files).
 */
export function templateFromTimeline(tl: Timeline, assets: Map<string, AssetInfo>, name: string): Template {
  const main = mainTrack(tl);
  const media = (main?.clips ?? []).filter((c) => c.assetId && !c.text && !c.seq && assets.get(c.assetId)?.kind !== "audio");
  if (!media.length) throw new Error("ما فيه صور أو فيديو في المسار الرئيسي يصيرون خانات القالب.");
  const slots: TplSlot[] = media.slice(0, TEMPLATE_LIMITS.slots).map((c, i) => {
    const a = assets.get(c.assetId!);
    return {
      label: `مقطع ${i + 1}`,
      ms: Math.max(TEMPLATE_LIMITS.minSlotMs, Math.min(TEMPLATE_LIMITS.maxSlotMs, clipLength(c))),
      kind: a?.kind === "image" ? "image" : "video",
      ...(c.fx.length ? { fx: c.fx.map((f) => f.id) } : {}),
      ...(c.anim?.in && (ANIMS[c.anim.in] as { only?: string }).only !== "text" ? { anim: c.anim.in } : {}),
      transition: c.transition ? { kind: c.transition.kind, ms: c.transition.ms } : null,
      ...(c.transform.scale !== 1 ? { zoom: c.transform.scale } : {}),
      ...(c.grades.length ? { grades: structuredClone(c.grades) } : {}),
    };
  });
  const spans = media.slice(0, slots.length).map((c) => [c.start, c.start + clipLength(c)] as const);
  const slotAt = (ms: number) => {
    const i = spans.findIndex(([a, b]) => ms >= a && ms < b);
    return i >= 0 ? i : ms < spans[0][0] ? 0 : spans.length - 1;
  };
  const texts: TplText[] = [];
  let captions: CaptionStyle | null = null;
  for (const tr of tl.tracks) {
    if (tr.kind !== "text" || tr.motion) continue;
    for (const c of tr.clips) {
      if (!c.text || c.motion) continue;
      if (c.words.length) {
        // spoken captions belong to that speech: only their look is kept
        captions ??= (Object.keys(CAPTION_STYLES) as CaptionStyle[]).find((k) => CAPTION_STYLES[k].style.color === c.text!.color && (CAPTION_STYLES[k].style.highlight ?? null) === c.text!.highlight) ?? "karaoke";
        continue;
      }
      if (texts.length >= TEMPLATE_LIMITS.texts || !c.text.body.trim()) continue;
      const s = slotAt(c.start);
      const { body, ...style } = c.text;
      const len = clipLength(c);
      texts.push({ slot: s, at: Math.max(0, c.start - spans[s][0]), ms: c.start + len >= spans[s][1] - 20 ? null : len, label: body.slice(0, 24), body, style, y: c.transform.y, in: c.anim?.in ?? null, out: c.anim?.out ?? null });
    }
  }
  const marks = tl.markers;
  let bpm: number | null = null;
  if (marks.length >= 4) {
    const gaps = marks.slice(1).map((m, i) => m - marks[i]).sort((x, y) => x - y);
    const mid = gaps[Math.floor(gaps.length / 2)];
    if (mid > 0) bpm = Math.round(Math.min(240, Math.max(40, 60_000 / mid)));
  }
  return readTemplate({
    name: name.trim().slice(0, TEMPLATE_LIMITS.name) || "قالبي",
    icon: "⭐",
    desc: `${slots.length} ${slots.length > 2 && slots.length < 11 ? "خانات" : "خانة"} من مشروعك`,
    ratio: ratioOf(tl),
    slots,
    texts,
    captions,
    look: null,
    transition: null,
    bpm,
    music: tl.tracks.some((t) => t.kind === "audio" && t.clips.some((c) => assets.get(c.assetId ?? "")?.kind === "audio")),
    background: tl.background,
  })!;
}
