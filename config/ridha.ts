// «الرضا فويس» (JAWAD AI) — the branch's fixed choices: its name, the ready voice chains («التأثيرات الجاهزة»: one
// press, nothing spent), the ready sounds of each effect, the equalizer's ready curves and the 3D harmony ideas.
// The chains for mourning and celebration recordings follow what was measured on studio releases
// (config/ridha-training.ts): a long hall for «العزاء», a shorter, drier room for «المواليد».

import { makeFx, type EqBand, type Fx, type FxKind } from "@/lib/ridha/model";

export const RIDHA = {
  base: "/jawad-ai/ridha",
  name: "الرضا فويس",
  nameEn: "AL-RIDHA VOICE",
  /** the robot of the branch */
  persona: "الرضا ماكس",
  tagline: "استوديو صوت كامل في المتصفح: تسجيل ومسارات ومكس، أوتوتيون ومقامات، تنظيف احترافي، وهارموني ثلاثي الأبعاد.",
  /** the longest single recording or imported file, minutes (it is all held in the device's memory) */
  maxMinutes: 30,
} as const;

type BandPatch = Partial<EqBand>;
/** An equalizer from eight band patches, in the order: low cut, low shelf, four bells, high shelf, high cut. */
const eq = (...bands: BandPatch[]) => makeFx("eq", {}, bands);
const on = (freq: number): BandPatch => ({ on: true, freq });
const bell = (freq: number, gain: number, q = 1.2): BandPatch => ({ freq, gain, q });

export interface ChainPreset {
  id: string;
  name: string;
  icon: string;
  group: "كلام" | "إنشاد وعزاء" | "أفراح ومواليد" | "جماعي" | "ألوان خاصة";
  hint: string;
  /** builds the chain fresh (new ids) each time it is applied */
  build(): Fx[];
  sends: { reverb: number; delay: number };
  /** what the shared reverb should be for this sound (applied only when the person agrees) */
  room?: { decay: number; predelay: number; damp: number };
}

export const CHAIN_PRESETS: ChainPreset[] = [
  {
    id: "podcast", name: "بودكاست", icon: "🎙️", group: "كلام", hint: "صوت قريب دافئ وثابت، بلا صدى — جاهز للنشر",
    build: () => [
      eq(on(80), { gain: 1.5, freq: 140 }, bell(280, -2.5, 1.1), bell(900, -1, 1), bell(3600, 2.5, 1), bell(6500, 0), { gain: 2, freq: 11000 }),
      makeFx("gate", { threshold: -50, range: -18, hold: 180, release: 240 }),
      makeFx("comp", { threshold: -22, ratio: 3.5, attack: 8, release: 150, knee: 14, makeup: 5 }),
      makeFx("deess", { freq: 6200, threshold: -30, amount: 0.55 }),
      makeFx("limiter", { threshold: -5, ceiling: -1, release: 90 }),
    ],
    sends: { reverb: 0, delay: 0 },
  },
  {
    id: "voiceover", name: "تعليق صوتي / إعلان", icon: "📣", group: "كلام", hint: "حضور قوي ولمعة — يثبت فوق الموسيقى",
    build: () => [
      eq(on(90), { gain: 2, freq: 110 }, bell(320, -3, 1.2), bell(1200, 0), bell(4200, 3.5, 0.9), bell(7000, 1), { gain: 3, freq: 10500 }),
      makeFx("comp", { threshold: -24, ratio: 5, attack: 5, release: 110, knee: 8, makeup: 6.5 }),
      makeFx("deess", { freq: 6500, threshold: -32, amount: 0.65 }),
      makeFx("dist", { type: 0, drive: 0.12, tone: 12000, mix: 0.5, out: 0 }),
      makeFx("limiter", { threshold: -6, ceiling: -1, release: 70 }),
    ],
    sends: { reverb: 0.04, delay: 0 },
  },
  {
    id: "lesson", name: "درس / محاضرة", icon: "📖", group: "كلام", hint: "وضوح الكلمة أولًا، وإسكات ضجيج القاعة بين الجمل",
    build: () => [
      eq(on(110), { gain: -1, freq: 150 }, bell(260, -3.5, 1), bell(2400, 2, 0.9), bell(4500, 2, 1.2), bell(7000, 0), { gain: 1, freq: 10000 }),
      makeFx("gate", { threshold: -46, range: -14, hold: 260, release: 320 }),
      makeFx("comp", { threshold: -24, ratio: 4, attack: 12, release: 220, knee: 16, makeup: 6 }),
      makeFx("limiter", { threshold: -5, ceiling: -1, release: 100 }),
    ],
    sends: { reverb: 0, delay: 0 },
  },
  {
    id: "solo", name: "سولو — منشد منفرد", icon: "🎤", group: "إنشاد وعزاء", hint: "صوت منفرد نظيف ومتوازن بقاعة متوسطة — نقطة بداية لأي إنشاد",
    build: () => [
      eq(on(90), { gain: 0.5, freq: 150 }, bell(290, -2.5, 1.1), bell(1000, 0.5, 0.9), bell(3200, 2.5, 1), bell(6500, 0), { gain: 2, freq: 10000 }),
      makeFx("comp", { threshold: -23, ratio: 3.5, attack: 8, release: 140, knee: 12, makeup: 5 }),
      makeFx("deess", { freq: 6200, threshold: -30, amount: 0.55 }),
    ],
    sends: { reverb: 0.26, delay: 0.05 },
    room: { decay: 2.4, predelay: 30, damp: 6000 },
  },
  {
    id: "radood", name: "رادود — عزاء استوديو", icon: "🏴", group: "إنشاد وعزاء", hint: "صوت متقدم ثقيل الوسط، بقاعة طويلة وراءه — لون إصدارات العزاء",
    build: () => [
      eq(on(95), { gain: 1, freq: 160 }, bell(300, -2, 1.1), bell(950, 1.5, 0.8), bell(2900, 2.5, 1), bell(6000, -1, 1.5), { gain: 1.5, freq: 9500 }),
      makeFx("comp", { threshold: -24, ratio: 4.5, attack: 6, release: 130, knee: 10, makeup: 6 }),
      makeFx("deess", { freq: 5800, threshold: -30, amount: 0.6 }),
      makeFx("dist", { type: 0, drive: 0.15, tone: 11000, mix: 0.6, out: 0 }),
      makeFx("delay", { time: 310, feedback: 0.22, damp: 3200, ping: 1, mix: 0.1 }),
    ],
    sends: { reverb: 0.34, delay: 0.08 },
    room: { decay: 3.2, predelay: 45, damp: 5200 },
  },
  {
    id: "naai", name: "نعي / أبوذية", icon: "🕯️", group: "إنشاد وعزاء", hint: "هادئ وحزين: دفء أكثر، صدى عميق وبعيد",
    build: () => [
      eq(on(85), { gain: 2, freq: 180 }, bell(350, -1.5, 1), bell(1100, 1, 0.8), bell(3000, 1.5, 1), bell(6500, -1.5, 1.4), { gain: 0.5, freq: 9000 }),
      makeFx("comp", { threshold: -26, ratio: 3, attack: 14, release: 260, knee: 18, makeup: 5 }),
      makeFx("deess", { freq: 5800, threshold: -32, amount: 0.5 }),
    ],
    sends: { reverb: 0.48, delay: 0.14 },
    room: { decay: 4.4, predelay: 60, damp: 4200 },
  },
  {
    id: "quran", name: "تلاوة / دعاء", icon: "📿", group: "إنشاد وعزاء", hint: "نقي بلا تلوين، ومسجد واسع بهدوء",
    build: () => [
      eq(on(80), { gain: 0.5, freq: 150 }, bell(300, -1.5, 1), bell(1000, 0), bell(3200, 1.5, 0.9), bell(6500, 0), { gain: 1.5, freq: 10000 }),
      makeFx("comp", { threshold: -22, ratio: 2.5, attack: 18, release: 280, knee: 20, makeup: 3.5 }),
      makeFx("deess", { freq: 6000, threshold: -30, amount: 0.45 }),
    ],
    sends: { reverb: 0.4, delay: 0 },
    room: { decay: 5.2, predelay: 70, damp: 5000 },
  },
  {
    id: "mawlid", name: "منشد — مواليد وأفراح", icon: "🎉", group: "أفراح ومواليد", hint: "مشرق ومنطلق، بغرفة قصيرة وصدى إيقاعي خفيف — لون المواليد",
    build: () => [
      eq(on(100), { gain: 0.5, freq: 140 }, bell(280, -3, 1.1), bell(1000, 0.5, 0.9), bell(3400, 3, 1), bell(7500, 1.5, 1.2), { gain: 3, freq: 10500 }),
      makeFx("comp", { threshold: -22, ratio: 4, attack: 5, release: 100, knee: 8, makeup: 5.5 }),
      makeFx("deess", { freq: 6400, threshold: -30, amount: 0.6 }),
      makeFx("delay", { time: 240, feedback: 0.18, damp: 5200, ping: 1, mix: 0.09 }),
    ],
    sends: { reverb: 0.2, delay: 0.06 },
    room: { decay: 1.6, predelay: 22, damp: 7500 },
  },
  {
    id: "anasheed", name: "أنشودة أطفال", icon: "🧒", group: "أفراح ومواليد", hint: "صوت خفيف لامع ومزدوج شعرة",
    build: () => [
      eq(on(130), { gain: -1, freq: 180 }, bell(350, -2.5, 1), bell(1400, 0), bell(3800, 2.5, 1), bell(8000, 2, 1.2), { gain: 3.5, freq: 11000 }),
      makeFx("comp", { threshold: -21, ratio: 3.5, attack: 6, release: 110, knee: 10, makeup: 5 }),
      makeFx("chorus", { rate: 0.6, depth: 0.25, delay: 16, feedback: 0, mix: 0.22 }),
      makeFx("deess", { freq: 6800, threshold: -30, amount: 0.55 }),
    ],
    sends: { reverb: 0.18, delay: 0.04 },
    room: { decay: 1.4, predelay: 18, damp: 8000 },
  },
  {
    id: "choir", name: "كورال / ردّة", icon: "👥", group: "جماعي", hint: "أصوات كثيرة تصير كتلة واحدة عريضة خلف الرادود",
    build: () => [
      eq(on(150), { gain: -2, freq: 200 }, bell(400, -3, 0.9), bell(1200, -1, 0.8), bell(3000, 1.5, 0.9), bell(6000, 0), { gain: 2, freq: 9500 }),
      makeFx("comp", { threshold: -26, ratio: 5, attack: 20, release: 180, knee: 12, makeup: 5 }),
      makeFx("chorus", { rate: 0.4, depth: 0.35, delay: 22, feedback: 0, mix: 0.35 }),
      makeFx("width", { amount: 0.6, time: 17 }),
    ],
    sends: { reverb: 0.42, delay: 0 },
  },
  {
    id: "crowd", name: "ردّة المجلس", icon: "🕌", group: "جماعي", hint: "جمهور بعيد في حسينية: وسط فقط وصدى كبير",
    build: () => [
      eq(on(220), { gain: -4, freq: 250 }, bell(500, -1, 0.9), bell(1300, 2, 0.8), bell(2800, 0, 1), bell(5000, -3, 1), { gain: -4, freq: 8000 }, on(9000)),
      makeFx("comp", { threshold: -28, ratio: 6, attack: 25, release: 200, knee: 10, makeup: 5 }),
      makeFx("width", { amount: 0.7, time: 22 }),
    ],
    sends: { reverb: 0.6, delay: 0.05 },
  },
  {
    id: "double", name: "دبل (تثخين)", icon: "👯", group: "جماعي", hint: "نسخة ثانية خفيفة تثخّن الصوت المنفرد",
    build: () => [
      eq(on(120), {}, bell(300, -2, 1), {}, bell(3500, 1, 1), {}, { gain: 1.5, freq: 10000 }),
      makeFx("comp", { threshold: -24, ratio: 4, attack: 10, release: 140, knee: 10, makeup: 4 }),
      makeFx("chorus", { rate: 0.3, depth: 0.2, delay: 24, feedback: 0, mix: 0.45 }),
      makeFx("width", { amount: 0.5, time: 13 }),
    ],
    sends: { reverb: 0.2, delay: 0 },
  },
  {
    id: "phone", name: "هاتف / راديو قديم", icon: "📻", group: "ألوان خاصة", hint: "صوت مكالمة أو مذياع — للمشاهد والمقدمات",
    build: () => [
      eq({ on: true, freq: 380, q: 0.9 }, {}, bell(700, 3, 1.2), bell(1800, 4, 1), {}, {}, {}, { on: true, freq: 3200, q: 0.9 }),
      makeFx("dist", { type: 1, drive: 0.45, tone: 3500, mix: 1, out: -2 }),
      makeFx("comp", { threshold: -26, ratio: 8, attack: 2, release: 80, knee: 4, makeup: 6 }),
    ],
    sends: { reverb: 0, delay: 0 },
  },
  {
    id: "megaphone", name: "مكبّر الموكب", icon: "📢", group: "ألوان خاصة", hint: "بوق خشن كأنه من سماعة الموكب في الشارع",
    build: () => [
      eq({ on: true, freq: 500, q: 1 }, {}, bell(900, 2, 1), bell(2200, 6, 1.4), {}, {}, {}, { on: true, freq: 4500, q: 1 }),
      makeFx("dist", { type: 2, drive: 0.55, tone: 4500, mix: 1, out: -4 }),
      makeFx("delay", { time: 130, feedback: 0.2, damp: 2500, ping: 0, mix: 0.18 }),
    ],
    sends: { reverb: 0.25, delay: 0 },
  },
  {
    id: "whisper", name: "هالة حالمة", icon: "✨", group: "ألوان خاصة", hint: "صوت طافٍ بصدى طويل وترديد — للمقدمات والخواتيم",
    build: () => [
      eq(on(160), { gain: -3, freq: 200 }, bell(400, -2, 1), {}, bell(4000, 2, 0.8), {}, { gain: 4, freq: 9000 }),
      makeFx("comp", { threshold: -26, ratio: 4, attack: 10, release: 200, knee: 14, makeup: 5 }),
      makeFx("phaser", { rate: 0.2, depth: 0.4, feedback: 0.2, mix: 0.25 }),
      makeFx("delay", { time: 460, feedback: 0.5, damp: 3500, ping: 1, mix: 0.28 }),
      makeFx("reverb", { decay: 6, predelay: 40, damp: 5500, lowcut: 300, mix: 0.4 }),
    ],
    sends: { reverb: 0.3, delay: 0 },
  },
];
export const chainById = (id: string) => CHAIN_PRESETS.find((c) => c.id === id) ?? null;

/** Ready sounds of a single effect: the knobs set at once. */
export const FX_PRESETS: Partial<Record<FxKind, { name: string; p: Record<string, number> }[]>> = {
  reverb: [
    { name: "غرفة صغيرة", p: { decay: 0.6, predelay: 5, damp: 8000, lowcut: 200, mix: 0.16 } },
    { name: "استوديو", p: { decay: 1.2, predelay: 15, damp: 7500, lowcut: 180, mix: 0.18 } },
    { name: "بليت لامع", p: { decay: 1.9, predelay: 30, damp: 11000, lowcut: 250, mix: 0.22 } },
    { name: "قاعة", p: { decay: 2.8, predelay: 35, damp: 6000, lowcut: 200, mix: 0.25 } },
    { name: "حسينية", p: { decay: 3.6, predelay: 50, damp: 4800, lowcut: 220, mix: 0.3 } },
    { name: "مسجد كبير", p: { decay: 5.5, predelay: 75, damp: 4500, lowcut: 240, mix: 0.32 } },
    { name: "صحن الحرم", p: { decay: 7.5, predelay: 110, damp: 3800, lowcut: 280, mix: 0.3 } },
  ],
  delay: [
    { name: "ترديد قصير (سلاب)", p: { time: 110, feedback: 0.05, damp: 6000, ping: 0, mix: 0.2 } },
    { name: "صدى الرادود", p: { time: 310, feedback: 0.25, damp: 3200, ping: 1, mix: 0.16 } },
    { name: "صدى طويل", p: { time: 520, feedback: 0.45, damp: 3000, ping: 1, mix: 0.24 } },
    { name: "جبل (يا حسين…)", p: { time: 780, feedback: 0.55, damp: 2400, ping: 0, mix: 0.3 } },
    { name: "تضعيف", p: { time: 38, feedback: 0, damp: 9000, ping: 1, mix: 0.3 } },
  ],
  dist: [
    { name: "دفء شريط", p: { type: 0, drive: 0.2, tone: 12000, mix: 0.6, out: 0 } },
    { name: "صمّام ناعم", p: { type: 1, drive: 0.35, tone: 9000, mix: 0.8, out: 0 } },
    { name: "راديو", p: { type: 1, drive: 0.5, tone: 3600, mix: 1, out: -2 } },
    { name: "خشن", p: { type: 2, drive: 0.6, tone: 6000, mix: 1, out: -4 } },
    { name: "فَز", p: { type: 3, drive: 0.7, tone: 5000, mix: 1, out: -6 } },
    { name: "لوفاي", p: { type: 4, drive: 0.6, tone: 5000, mix: 1, out: -3 } },
  ],
  comp: [
    { name: "تثبيت خفيف", p: { threshold: -20, ratio: 2.5, attack: 15, release: 200, knee: 18, makeup: 3 } },
    { name: "صوت قدّام", p: { threshold: -24, ratio: 4, attack: 6, release: 120, knee: 10, makeup: 6 } },
    { name: "كبس قوي", p: { threshold: -30, ratio: 8, attack: 3, release: 80, knee: 6, makeup: 9 } },
    { name: "لصق المكس", p: { threshold: -16, ratio: 2, attack: 30, release: 250, knee: 20, makeup: 2 } },
  ],
  chorus: [
    { name: "تثخين", p: { rate: 0.35, depth: 0.25, delay: 22, feedback: 0, mix: 0.35 } },
    { name: "كورس واسع", p: { rate: 0.8, depth: 0.5, delay: 18, feedback: 0, mix: 0.5 } },
    { name: "فلانجر", p: { rate: 0.25, depth: 0.8, delay: 4, feedback: 0.7, mix: 0.5 } },
  ],
};

/** Ready curves for the equalizer, as band patches (the eight bands in order). */
export const EQ_PRESETS: { name: string; hint: string; bands: BandPatch[] }[] = [
  { name: "مسطّح", hint: "بلا تغيير", bands: [{ on: false }, { gain: 0 }, { gain: 0 }, { gain: 0 }, { gain: 0 }, { gain: 0 }, { gain: 0 }, { on: false }] },
  { name: "صوت رجالي", hint: "يقص الهدير، يخفف الطين عند 250، يرفع الوضوح", bands: [on(90), { gain: 1, freq: 140 }, bell(260, -3, 1.1), bell(1000, 0), bell(3200, 2.5, 1), bell(6500, 0), { gain: 2, freq: 10000 }, { on: false }] },
  { name: "صوت نسائي / طفل", hint: "قص أعلى ولمعة أنعم", bands: [on(130), { gain: 0, freq: 200 }, bell(380, -2.5, 1.1), bell(1300, 0), bell(4200, 2, 1), bell(7500, 1, 1.2), { gain: 3, freq: 11000 }, { on: false }] },
  { name: "إزالة الطين", hint: "صوت مكتوم من غرفة صغيرة", bands: [on(100), { gain: -2, freq: 160 }, bell(280, -5, 1.4), bell(500, -2, 1.2), bell(3000, 2, 0.9), bell(6000, 0), { gain: 1, freq: 10000 }, { on: false }] },
  { name: "حضور وكلمة", hint: "يقدّم مخارج الحروف", bands: [on(90), {}, bell(300, -1.5, 1), bell(1800, 2, 0.9), bell(4200, 3.5, 1), bell(7000, 1, 1.2), { gain: 1, freq: 10000 }, { on: false }] },
  { name: "دفء", hint: "جسم أكثر وحدّة أقل", bands: [on(70), { gain: 3, freq: 170 }, bell(350, 1, 0.9), bell(1000, 0), bell(3500, -1.5, 1), bell(6500, -2, 1.3), { gain: -1, freq: 9000 }, { on: false }] },
  { name: "هواء ولمعة", hint: "يفتح أعلى الصوت", bands: [on(90), {}, bell(300, -1, 1), bell(1000, 0), bell(4000, 1, 1), bell(8000, 2, 1), { gain: 5, freq: 12000 }, { on: false }] },
  { name: "ترويض الحدّة", hint: "صوت جارح عند 3–5 كيلو", bands: [on(80), {}, bell(300, 0), bell(1200, 0), bell(3400, -4, 2), bell(5200, -3, 2.2), { gain: 0, freq: 10000 }, { on: false }] },
  { name: "ماستر: لمسة أخيرة", hint: "على المجموع: قاع أنظف وقمة أهدأ", bands: [on(32), { gain: 1, freq: 90 }, bell(250, -1, 0.8), bell(1000, 0), bell(3000, 0.5, 0.7), bell(7000, 0), { gain: 1.5, freq: 12000 }, { on: false }] },
  { name: "موسيقى تحت الكلام", hint: "يحفر مكانًا للصوت في وسط الموسيقى", bands: [on(40), { gain: 1, freq: 100 }, bell(300, -1, 0.8), bell(1500, -3, 0.7), bell(3200, -4, 0.9), bell(7000, 0), { gain: 1, freq: 11000 }, { on: false }] },
];
