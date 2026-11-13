// «الرضا فويس» — the harmony generator. From one sung line and its key it builds extra voices on every degree of
// the scale (seconds to tenths, above and below), each with a way of moving (walking with the melody, landing only on
// the chord's notes, sitting calmly, or holding one note under everything), a moment to sing (always, at the ends of
// phrases, on held notes), a throat, a few cents and milliseconds of its own (so it is another singer, not a copy)
// and a PLACE around the listener in 3D. The ready ideas are ordered as advice — what suits this scale and this
// voice comes first, with the reason said — and «مستوى الجنون» grows a stack from one voice to a wall of sixteen.

import { psolaShift } from "./dsp/psola";
import type { PitchTrack } from "./dsp/pitch";
import { hasQuarterTones, type Scale } from "./dsp/scales";
import { harmonyWhen, planHarmony, type HarmonyMotion } from "./dsp/tune";

export interface HarmonyVoice {
  name: string;
  /** scale steps from the line: 2 a third above, −2 a third below, 4 a fifth, 5 a sixth, 6 a seventh; 0 unison */
  steps: number;
  octaves: number;
  /** cents off the exact note, and ms late: the small human differences that make it another singer */
  detune: number;
  delayMs: number;
  /** dB against the lead */
  gain: number;
  /** throat size: under 1 a bigger, darker voice; over 1 a smaller, brighter one */
  formant: number;
  /** where it stands: degrees around (0 front, + right), degrees up, metres away */
  az: number;
  el: number;
  dist: number;
  motion: HarmonyMotion;
  /** for a held note («pedal»): which step of the scale (0 the tonic, 4 its fifth) */
  pedalStep: number;
  /** 0–1: how exactly it sits on its notes (harmonies are tuned tighter than the lead) */
  tight: number;
  when: "always" | "ends" | "long";
}

export interface HarmonyIdea {
  id: string;
  name: string;
  icon: string;
  /** why it is suggested (or what to watch for), shown under the name */
  why: string;
  voices: HarmonyVoice[];
  /** a caution: it may clash with a quarter-tone maqam */
  experimental?: boolean;
}

export const INTERVALS: { label: string; steps: number; octaves: number }[] = [
  { label: "عاشرة فوق (ثالثة + أوكتاف)", steps: 2, octaves: 1 },
  { label: "أوكتاف فوق", steps: 0, octaves: 1 },
  { label: "سابعة فوق", steps: 6, octaves: 0 },
  { label: "سادسة فوق", steps: 5, octaves: 0 },
  { label: "خامسة فوق", steps: 4, octaves: 0 },
  { label: "رابعة فوق", steps: 3, octaves: 0 },
  { label: "ثالثة فوق", steps: 2, octaves: 0 },
  { label: "ثانية فوق", steps: 1, octaves: 0 },
  { label: "نفس النغمة", steps: 0, octaves: 0 },
  { label: "ثانية تحت", steps: -1, octaves: 0 },
  { label: "ثالثة تحت", steps: -2, octaves: 0 },
  { label: "رابعة تحت", steps: -3, octaves: 0 },
  { label: "خامسة تحت", steps: -4, octaves: 0 },
  { label: "سادسة تحت", steps: -5, octaves: 0 },
  { label: "سابعة تحت", steps: -6, octaves: 0 },
  { label: "أوكتاف تحت", steps: 0, octaves: -1 },
  { label: "عاشرة تحت (ثالثة + أوكتاف)", steps: -2, octaves: -1 },
  { label: "أوكتافين تحت", steps: 0, octaves: -2 },
];
export const MOTIONS: { id: HarmonyMotion; name: string; hint: string }[] = [
  { id: "parallel", name: "يمشي مع اللحن", hint: "نفس حركة اللحن على مسافته" },
  { id: "chord", name: "على نغمات الكورد", hint: "ينزل فقط على الأولى والثالثة والخامسة — ما يحتك أبدًا" },
  { id: "lazy", name: "يتحرك بهدوء", hint: "يثبت مكانه إلى أن يبتعد اللحن — صوت الكورال الداخلي" },
  { id: "pedal", name: "قرار ثابت", hint: "نغمة واحدة تحت كل شيء (إيزون)" },
  { id: "fixed", name: "مسافة ثابتة + تصحيح", hint: "يرفع اللحن مسافة واحدة ثابتة، وإذا طلعت نغمة برّا المقام (نشاز) يزيدها درجة لداخله" },
];
export const WHENS: { id: HarmonyVoice["when"]; name: string }[] = [
  { id: "always", name: "طول الوقت" },
  { id: "ends", name: "نهايات الجمل" },
  { id: "long", name: "النغمات الممدودة" },
];

export const voice = (name: string, steps: number, octaves: number, az: number, o: Partial<HarmonyVoice> = {}): HarmonyVoice => ({
  name, steps, octaves, az, detune: 0, delayMs: 14, gain: -7, formant: 1, el: 0, dist: 2, motion: "parallel", pedalStep: 0, tight: 0.6, when: "always", ...o,
});
const v = voice;

/** A pair of the same part, one each side, a few cents and milliseconds apart: the oldest widening trick there is. */
const pair = (name: string, steps: number, octaves: number, az: number, o: Partial<HarmonyVoice> = {}): HarmonyVoice[] => [
  v(`${name} يسار`, steps, octaves, -az, { detune: -8, delayMs: 16, formant: (o.formant ?? 1) * 0.98, ...o }),
  v(`${name} يمين`, steps, octaves, az, { detune: 9, delayMs: 27, ...o, formant: (o.formant ?? 1) * 1.02 }),
];

type Maker = (high: boolean) => Omit<HarmonyIdea, "experimental">;
/**
 * The maqam singer's three tries (the method the engineer علي البقال teaches for كرد، عجم، نهاوند): the line moved by
 * one fixed distance — a third, a fifth or a seventh — with every note that falls outside the maqam carried one step
 * in; «one of the three will be right, a hundred percent».
 */
const maqamTry = (name: string, steps: number, why: string): Maker => (high) => ({
  id: `maqam${steps + 1}`, name, icon: "🎼", why,
  voices: high
    ? pair(`${name} تحت`, -steps, 0, 55, { motion: "fixed", formant: 0.96, gain: -8, tight: 0.9 })
    : pair(name, steps, 0, 55, { motion: "fixed", formant: 1.04, gain: -8, tight: 0.9 }),
});
const IDEAS: Record<string, Maker> = {
  maqam3: maqamTry("ثالثة ثابتة", 2, "طريقة المقامات: اللحن كله يرتفع ثالثة ثابتة، وأي نغمة تطلع برّا المقام تنصلح درجة — جرّب الثالثة والخامسة والسابعة، وحدة منها تركب"),
  maqam5: maqamTry("خامسة ثابتة", 4, "الخامسة الثابتة: أفخم الثلاث وأقلها خطرًا، وتنصلح نغماتها اللي تطلع برّا المقام"),
  maqam7: maqamTry("سابعة ثابتة", 6, "السابعة الثابتة: لون أغنى وأحدّ — تركب على بعض الألحان أحلى من الثالثة؛ اسمعها قبل الاعتماد"),
  unison: () => ({
    id: "unison", name: "جوقة موحّدة", icon: "👥", why: "ستة أصوات على نفس النغمة حول المستمع — صوت المجلس حين يردّ، ويصلح لكل المقامات",
    voices: [
      v("يسار قريب", 0, 0, -55, { detune: -9, delayMs: 18, formant: 0.97, gain: -8, tight: 0.2 }),
      v("يمين قريب", 0, 0, 55, { detune: 8, delayMs: 24, formant: 1.03, gain: -8, tight: 0.2 }),
      v("يسار بعيد", 0, 0, -110, { detune: 14, delayMs: 38, formant: 0.94, dist: 3.2, gain: -9, tight: 0.2 }),
      v("يمين بعيد", 0, 0, 110, { detune: -13, delayMs: 44, formant: 1.05, dist: 3.2, gain: -9, tight: 0.2 }),
      v("خلف يسار", 0, 0, -160, { detune: 6, delayMs: 55, formant: 0.92, dist: 4, gain: -10, tight: 0.2 }),
      v("خلف يمين", 0, 0, 160, { detune: -7, delayMs: 61, formant: 1.06, dist: 4, gain: -10, tight: 0.2 }),
    ],
  }),
  octaves: (high) => ({
    id: "octaves", name: "قرار وجواب", icon: "🪜", why: high ? "صوتك عالٍ: أوكتاف تحته يعطيه ثقلًا وهيبة" : "أوكتاف تحت للثقل وأوكتاف فوق كهالة خفيفة — آمن مع كل المقامات",
    voices: [
      v("قرار (أوكتاف تحت)", 0, -1, 0, { formant: 0.9, gain: -6, dist: 1.6, el: -15, delayMs: 10 }),
      ...pair("دبل", 0, 0, 70, { gain: -9, tight: 0.2 }),
      ...(high ? [] : [v("جواب (أوكتاف فوق)", 0, 1, 0, { formant: 1.08, gain: -14, dist: 3, el: 40, delayMs: 22 })]),
    ],
  }),
  ison: () => ({
    id: "ison", name: "قرار ثابت (إيزون)", icon: "🕯️", why: "نغمة واحدة ممسوكة تحت اللحن كله — أقدم هارموني في الترتيل، وأنسبه للمقامات والنعي",
    voices: [
      v("القرار", 0, -1, -25, { motion: "pedal", pedalStep: 0, formant: 0.9, gain: -9, tight: 1, dist: 2.4, delayMs: 0 }),
      v("القرار (دبل)", 0, -1, 25, { motion: "pedal", pedalStep: 0, formant: 0.94, gain: -10, tight: 1, dist: 2.4, detune: 7, delayMs: 20 }),
      v("خامسة القرار", 0, -1, 180, { motion: "pedal", pedalStep: 4, formant: 0.96, gain: -13, tight: 1, dist: 3.2, delayMs: 30 }),
    ],
  }),
  fifth: (high) => ({
    id: "fifth", name: "خامسة مفتوحة", icon: "🏛️", why: "الخامسة أنقى مسافة بعد الأوكتاف: فخامة بلا لون ماجور أو مينور",
    voices: [
      high ? v("رابعة تحت", -3, 0, -60, { formant: 0.95, gain: -8, delayMs: 16 }) : v("خامسة فوق", 4, 0, -60, { formant: 1.04, gain: -9, delayMs: 16 }),
      v("أوكتاف تحت", 0, -1, 60, { formant: 0.9, gain: -8, delayMs: 12 }),
      v("دبل خلف", 0, 0, 180, { detune: 10, delayMs: 40, gain: -11, dist: 3.5, tight: 0.2 }),
    ],
  }),
  organum: () => ({
    id: "organum", name: "أورغانوم (رابعات)", icon: "⛪", why: "رابعة تحت وأوكتاف تحت تمشيان مع اللحن — صوت الأناشيد القديمة، مهيب وخالٍ من الثالثات",
    voices: [
      ...pair("رابعة تحت", -3, 0, 55, { formant: 0.96, gain: -9 }),
      v("أوكتاف تحت", 0, -1, 0, { formant: 0.9, gain: -7, dist: 1.8, el: -10 }),
    ],
  }),
  duo: (high) => ({
    id: "duo", name: "ثنائي دافئ (ثالثات)", icon: "🤝", why: high ? "ثالثة تحت الصوت العالي أدفأ من ثالثة فوقه" : "ثالثة فوق يسارًا وثالثة تحت يمينًا — أكثر هارموني مألوف للأذن",
    voices: high
      ? [v("ثالثة تحت", -2, 0, -50, { formant: 0.96, gain: -7 }), v("سادسة تحت", -5, 0, 50, { formant: 0.93, gain: -9, delayMs: 22 })]
      : [v("ثالثة فوق", 2, 0, -50, { formant: 1.04, gain: -8 }), v("ثالثة تحت", -2, 0, 50, { formant: 0.96, gain: -8, delayMs: 22 })],
  }),
  sixths: (high) => ({
    id: "sixths", name: "سادسات مفتوحة", icon: "🌅", why: "السادسة أوسع من الثالثة وتترك هواءً بين الصوتين — أنعم وأقل زحمة حول الرئيسي",
    voices: high ? pair("سادسة تحت", -5, 0, 60, { formant: 0.94, gain: -8 }) : [v("سادسة فوق", 5, 0, -60, { formant: 1.06, gain: -10 }), v("ثالثة تحت", -2, 0, 60, { formant: 0.96, gain: -8, delayMs: 22 })],
  }),
  triad: () => ({
    id: "triad", name: "ثلاثي كامل", icon: "🔺", why: "ثالثة وخامسة وقرار: كورد كامل يتحرك مع اللحن",
    voices: [
      v("ثالثة فوق", 2, 0, -65, { formant: 1.04, gain: -8 }),
      v("خامسة فوق", 4, 0, 65, { formant: 1.06, gain: -10, delayMs: 20 }),
      v("أوكتاف تحت", 0, -1, 0, { formant: 0.9, gain: -8, dist: 1.6, el: -15, delayMs: 10 }),
    ],
  }),
  chord: () => ({
    id: "chord", name: "على الكورد دائمًا", icon: "🧲", why: "ثلاثة أصوات تنزل فقط على نغمات كورد المقام (١-٣-٥): ما تحتك مع اللحن مهما تحرك — أضمن هارموني",
    voices: [
      v("فوق — على الكورد", 2, 0, -60, { motion: "chord", formant: 1.04, gain: -8, tight: 0.9 }),
      v("تحت — على الكورد", -2, 0, 60, { motion: "chord", formant: 0.96, gain: -8, tight: 0.9, delayMs: 20 }),
      v("قرار — على الكورد", -4, -1, 0, { motion: "chord", formant: 0.9, gain: -9, tight: 0.9, dist: 2.2, el: -10 }),
    ],
  }),
  calm: () => ({
    id: "calm", name: "كورال هادئ", icon: "🌊", why: "الأصوات تثبت مكانها ولا تتحرك إلا حين يبتعد اللحن — يعطي سجادة تحت الصوت بدل ظلٍّ يلاحقه",
    voices: [
      ...pair("ثالثة هادئة", 2, 0, 75, { motion: "lazy", formant: 1.03, gain: -10, tight: 0.9 }),
      v("خامسة هادئة", -3, 0, 0, { motion: "lazy", formant: 0.95, gain: -10, tight: 0.9, dist: 2.6, el: 15 }),
      v("قرار ثابت", 0, -1, 180, { motion: "pedal", formant: 0.9, gain: -11, tight: 1, dist: 3 }),
    ],
  }),
  endings: () => ({
    id: "endings", name: "نهايات الجمل فقط", icon: "🎯", why: "الهارموني يسكت في أول الجملة ويدخل في آخرها — الكلمة تبقى واضحة والقفلة تكبر (حيلة المحترفين)",
    voices: [
      v("ثالثة فوق", 2, 0, -55, { when: "ends", formant: 1.04, gain: -6, tight: 0.9 }),
      v("ثالثة تحت", -2, 0, 55, { when: "ends", formant: 0.96, gain: -6, tight: 0.9, delayMs: 18 }),
      v("أوكتاف تحت", 0, -1, 0, { when: "ends", formant: 0.9, gain: -8, dist: 1.8 }),
    ],
  }),
  held: () => ({
    id: "held", name: "على النغمات الممدودة", icon: "🫧", why: "الأصوات تطلع فقط حين تمدّ النغمة وتختفي في الكلام السريع — كورد يفتح تحت كل مدّة",
    voices: [
      ...pair("ثالثة فوق", 2, 0, 65, { when: "long", motion: "chord", formant: 1.04, gain: -7, tight: 1 }),
      v("خامسة تحت", -4, 0, 0, { when: "long", motion: "chord", formant: 0.95, gain: -8, tight: 1, dist: 2.4, el: 20 }),
    ],
  }),
  sevenths: () => ({
    id: "sevenths", name: "سابعات (جاز)", icon: "🎷", why: "ثالثة وخامسة وسابعة: لون غني ومتوتر شعرة — للأناشيد الهادئة والمقدمات",
    voices: [
      v("ثالثة فوق", 2, 0, -70, { formant: 1.03, gain: -9, tight: 1 }),
      v("خامسة فوق", 4, 0, 0, { formant: 1.05, gain: -11, tight: 1, dist: 2.6, el: 20 }),
      v("سابعة فوق", 6, 0, 70, { formant: 1.07, gain: -13, tight: 1, delayMs: 22 }),
    ],
  }),
  halo: () => ({
    id: "halo", name: "هالة علوية", icon: "🌙", why: "أصوات خفيفة فوق الرأس ومن الخلف — للمقدمات والوقفات",
    voices: [
      v("أوكتاف فوق يسار", 0, 1, -40, { formant: 1.1, gain: -14, el: 50, dist: 3 }),
      v("أوكتاف فوق يمين", 0, 1, 40, { formant: 1.07, gain: -14, el: 50, dist: 3, detune: 9, delayMs: 30 }),
      v("خامسة خلف", 4, 0, 180, { formant: 1.03, gain: -13, el: 25, dist: 4, delayMs: 45 }),
    ],
  }),
  circle: () => ({
    id: "circle", name: "جوقة حول المستمع", icon: "⭕", why: "خمسة أصوات على دائرة كاملة: دبل، ثالثة، خامسة وقرار — أعرض توزيع",
    voices: [
      ...pair("دبل", 0, 0, 90, { gain: -9, tight: 0.2 }),
      v("ثالثة أمام يسار", 2, 0, -35, { formant: 1.04, gain: -9 }),
      v("خامسة أمام يمين", 4, 0, 35, { formant: 1.05, gain: -11, delayMs: 18 }),
      v("قرار خلف", 0, -1, 180, { formant: 0.9, gain: -8, dist: 2.6, delayMs: 12 }),
    ],
  }),
  gospel: () => ({
    id: "gospel", name: "ستاك كامل (٨ أصوات)", icon: "🎪", why: "ثالثة وخامسة وأوكتاف فوق، وثالثة وأوكتاف تحت، كل واحد بدبله — جدار كورال من صوت واحد",
    voices: [
      ...pair("ثالثة فوق", 2, 0, 45, { formant: 1.04, gain: -11, tight: 1 }),
      ...pair("خامسة فوق", 4, 0, 95, { formant: 1.06, gain: -13, tight: 1 }),
      ...pair("ثالثة تحت", -2, 0, 140, { formant: 0.96, gain: -11, tight: 1, dist: 2.8 }),
      v("أوكتاف تحت", 0, -1, 0, { formant: 0.9, gain: -9, dist: 1.8, el: -15, tight: 1 }),
      v("أوكتاف فوق", 0, 1, 0, { formant: 1.1, gain: -16, dist: 3.4, el: 55, tight: 1 }),
    ],
  }),
};

/**
 * The harmony ideas for a line, best first. A maqam with quarter tones is answered the way its own tradition does —
 * unison, a held tonic, octaves, fourths and fifths — and anything built on thirds comes last, marked as an
 * experiment. A high voice gets its harmonies underneath, a low one on top.
 */
export function suggestHarmony(range: { low: number; high: number; median: number }, scale: Scale): HarmonyIdea[] {
  const high = range.median >= 62;
  const quarter = hasQuarterTones(scale);
  // كرد، عجم (ماجور) and نهاوند take the maqam singer's three tries first; حجاز, whose wide step between its second
  // and third notes makes a moved line fall outside it more often, starts from what always sits — the chord, octaves,
  // the fifth — with the tries after; a quarter-tone maqam is answered the way its own tradition does
  const hijaz = scale.id === "hijaz";
  const order = quarter
    ? ["unison", "ison", "octaves", "fifth", "maqam5", "organum", "halo", "endings", "held", "duo", "maqam3", "sixths", "chord", "calm", "triad", "circle", "gospel", "sevenths"]
    : scale.id === "chromatic"
      ? ["unison", "octaves", "ison", "fifth", "organum", "halo"]
      : hijaz
        ? ["chord", "octaves", "maqam5", "fifth", "ison", "maqam3", "endings", "unison", "maqam7", "duo", "held", "calm", "organum", "triad", "sixths", "circle", "gospel", "sevenths", "halo"]
        : ["maqam3", "maqam5", "maqam7", "duo", "chord", "endings", "triad", "sixths", "held", "calm", "circle", "gospel", "octaves", "unison", "ison", "fifth", "organum", "sevenths", "halo"];
  return order.map((id, i) => {
    const idea = IDEAS[id](high);
    const thirds = idea.voices.some((x) => x.motion !== "pedal" && [2, 5, 6].includes(Math.abs(x.steps)));
    return { ...idea, experimental: quarter && thirds, why: quarter && thirds ? `تجريبي مع ${scale.name}: الثالثات والسادسات قد تصطدم بأرباع النغمة — اسمعه قبل الاعتماد` : i === 0 ? `الأنسب هنا — ${idea.why}` : idea.why };
  });
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const WILD_LEVELS = ["لمسة", "ثنائي", "كورال", "جوقة كاملة", "جنون"];

/**
 * «مستوى الجنون»: a stack grown to order. Level 1 is one voice; 5 is a wall of up to sixteen — every part doubled
 * left and right, a held tonic under it, octaves below and above, a halo over the head, and parts that enter only at
 * the ends of phrases. The parts are chosen for the scale (no thirds forced on a quarter-tone maqam) and the voice's
 * range, placed evenly around the listener; `seed` re-rolls the choice («🎲»).
 */
export function wildHarmony(level: number, range: { low: number; high: number; median: number }, scale: Scale, seed = 1): HarmonyIdea {
  const rnd = mulberry(seed * 7919 + level);
  const high = range.median >= 62;
  const quarter = hasQuarterTones(scale) || scale.id === "chromatic";
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  // the parts this scale takes kindly, nearest the lead first
  const colour: [string, number, number][] = quarter
    ? [["رابعة تحت", -3, 0], ["خامسة فوق", 4, 0], ["خامسة تحت", -4, 0], ["رابعة فوق", 3, 0]]
    : high
      ? [["ثالثة تحت", -2, 0], ["سادسة تحت", -5, 0], ["رابعة تحت", -3, 0], ["ثالثة فوق", 2, 0], ["خامسة تحت", -4, 0]]
      : [["ثالثة فوق", 2, 0], ["ثالثة تحت", -2, 0], ["خامسة فوق", 4, 0], ["سادسة فوق", 5, 0], ["رابعة تحت", -3, 0]];
  const voices: HarmonyVoice[] = [];
  const L = Math.max(1, Math.min(5, Math.round(level)));
  const first = seed % 2 ? colour[0] : pick(colour.slice(0, 3));
  if (L === 1) voices.push(v(first[0], first[1], first[2], pick([-45, 45]), { gain: -8, tight: 0.9, formant: first[1] > 0 ? 1.04 : 0.96 }));
  if (L >= 2) {
    const second = colour.find((c) => c !== first)!;
    voices.push(v(first[0], first[1], first[2], -50, { gain: -8, tight: 0.9, formant: first[1] > 0 ? 1.04 : 0.96 }));
    voices.push(v(second[0], second[1], second[2], 50, { gain: -9, tight: 0.9, formant: second[1] > 0 ? 1.05 : 0.95, delayMs: 22 }));
  }
  if (L >= 3) {
    voices.push(v("أوكتاف تحت", 0, -1, 0, { formant: 0.9, gain: -8, dist: 1.8, el: -12, tight: 0.9 }));
    voices.push(...pair("دبل", 0, 0, 100, { gain: -11, tight: 0.2, dist: 2.6 }));
  }
  if (L >= 4) {
    const third = colour.filter((c) => !voices.some((x) => x.steps === c[1] && x.octaves === c[2]))[0];
    if (third) voices.push(...pair(third[0], third[1], third[2], 135, { gain: -12, tight: 1, dist: 3, formant: third[1] > 0 ? 1.05 : 0.95, motion: pick(["parallel", "chord", "lazy"] as const) }));
    voices.push(v("قرار ثابت", 0, -1, 180, { motion: "pedal", pedalStep: 0, formant: 0.92, gain: -12, tight: 1, dist: 3.4 }));
  }
  if (L >= 5) {
    // every colour doubled, the fifth of the key held behind, a halo overhead, and a part that blooms at phrase ends
    for (const c of colour.slice(0, 3)) {
      if (voices.filter((x) => x.steps === c[1] && x.octaves === c[2]).length >= 2) continue;
      voices.push(...pair(c[0], c[1], c[2], 30 + Math.round(rnd() * 130), { gain: -13, tight: 1, dist: 2.2 + rnd() * 1.6, formant: c[1] > 0 ? 1.03 + rnd() * 0.05 : 0.93 + rnd() * 0.04, when: rnd() > 0.6 ? "ends" : "always" }));
    }
    voices.push(v("خامسة القرار", 0, -1, -150, { motion: "pedal", pedalStep: 4, formant: 0.95, gain: -14, tight: 1, dist: 3.6 }));
    voices.push(...pair("هالة (أوكتاف فوق)", 0, 1, 40, { gain: -17, tight: 1, el: 55, dist: 3.2, formant: 1.1, when: "long" }));
    if (!quarter) voices.push(v("عاشرة فوق", 2, 1, 0, { gain: -18, tight: 1, el: 65, dist: 3.8, formant: 1.12, when: "ends" }));
  }
  const capped = voices.slice(0, 16);
  return {
    id: `wild-${L}-${seed}`, name: `${WILD_LEVELS[L - 1]} · ${capped.length} ${capped.length > 10 ? "صوتًا" : "أصوات"}`, icon: ["✨", "🤝", "🎶", "🎪", "🤯"][L - 1],
    why: quarter ? "مولّدة لهذا المقام: رابعات وخامسات وأوكتافات وقرار ثابت، بلا ثالثات" : "مولّدة لهذا السلّم ولمدى صوتك — اضغط 🎲 لتوليفة ثانية",
    voices: capped,
  };
}

/** The advice shown beside an idea: what engineers and arrangers do with a stack like this one. */
export function harmonyTips(idea: HarmonyIdea, scale: Scale): string[] {
  const n = idea.voices.length;
  const tips: string[] = [];
  if (idea.voices.some((x) => x.motion === "fixed")) tips.push("طريقة المقامات: جرّب الثالثة الثابتة ثم الخامسة ثم السابعة على نفس الجملة — غالبًا وحدة منها تركب مية بالمية. النغمة اللي تطلع برّا المقام تنصلح درجة لداخله تلقائيًا، فما يصير نشاز.");
  if (scale.id === "hijaz") tips.push("الحجاز فيه مسافة واسعة بين درجته الثانية والثالثة، فالمسافة الثابتة تطلع برّاه أكثر من غيره: التصحيح يشتغل، بس اسمع؛ وإذا ما ارتحت خذ «على الكورد دائمًا» أو الخامسة.");
  if (hasQuarterTones(scale)) tips.push(`مقام ${scale.name} فيه أرباع نغمة: هارمونيه الطبيعي يونيسون وقرار ثابت وأوكتاف وخامسة. الثالثات تُسمع نشازًا عند أغلب الناس.`);
  else tips.push("الثالثات والسادسات أدفأ ما يرافق اللحن؛ الخامسات والرابعات المتوازية الطويلة تعطي لونًا قديمًا مهيبًا — جميل لو قصدته، وفارغ لو ما قصدته.");
  tips.push(n > 4 ? "ستاك كبير: كل صوت يكون أوطى من الرئيسي بـ 10–14 dB (مجموعها هو اللي يُسمع). مضبوطة هنا، وفيدر القروب يحكمها كلها." : "الهارموني يجلس تحت الرئيسي بـ 4–8 dB: يُحَسّ أكثر مما يُسمع.");
  tips.push("الرئيسي في الوسط، والهارموني مفروش حوله: كل جزء له يمين ويسار (دبل) يعطي عرضًا بلا ما يزاحم الكلمة.");
  if (idea.voices.some((x) => x.when !== "always")) tips.push("هذا التوزيع يدخل في نهايات الجمل أو على المدّات: الكلمة تبقى للرئيسي والقفلة تكبر — جرّبه في الردّة والمقاطع الأخيرة.");
  else tips.push("لا تشغّل الهارموني طول القصيدة: خله للردّة أو آخر كل بيت (اقطع مقطعه في الخط الزمني)، فيكون له وقع حين يدخل.");
  tips.push("الهارموني يُضبط أشد من الرئيسي («شدّ النغمة» عالٍ) ويُقصّ واطيه ويُنعّم سينه — وهذا يُركَّب تلقائيًا على قروب الهارموني عند الإضافة.");
  if (idea.voices.some((x) => x.motion === "pedal")) tips.push("القرار الثابت يحتاج مستوى واطيًا وريفيربًا أطول من غيره: هو أرضية بشرية، لا صوت ثانٍ.");
  return tips;
}

/** One harmony voice sung from the lead: the same words and timing, on its own notes, in its own throat, at its own moments. */
export function singHarmony(x: Float32Array, track: PitchTrack, marks: Float64Array, key: { tonic: number; scale: Scale }, voice: HarmonyVoice): Float32Array {
  const ratio = planHarmony(track, { tonic: key.tonic, scale: key.scale, steps: voice.steps, octaves: voice.octaves, detuneCents: voice.detune, motion: voice.motion, pedalStep: voice.pedalStep, tight: voice.tight });
  const y = psolaShift(x, track, (f) => ratio[f], voice.formant, marks);
  if (voice.when === "always") return y;
  const level = harmonyWhen(track, voice.when);
  for (let i = 0; i < y.length; i++) {
    const p = i / track.hop;
    const k = Math.min(level.length - 1, Math.floor(p));
    const next = Math.min(level.length - 1, k + 1);
    y[i] *= level[k] + (level[next] - level[k]) * (p - k);
  }
  return y;
}
