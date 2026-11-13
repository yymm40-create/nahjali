// «الرضا فويس» — the choirs. Choosing «كورال» lays out the tracks a choir of that kind needs: how many, what
// each one sings (the low «قرار», the tune itself, the high «جواب», a soft airy layer), where it stands left to
// right, how loud against the others, and the tone it is given — so that recording one voice per track, part by
// part, comes out as a balanced choir and not a pile. The tracks arrive inside one group that wears the choir's
// shared mix; every part can still be changed.

import type { EqBand } from "@/lib/ridha/model";

export interface ChoirPart {
  name: string;
  /** what to sing on this track, and how — shown on the track until it is recorded */
  sing: string;
  /** −1 left … +1 right */
  pan: number;
  /** dB against the others */
  gain: number;
  /** its tone: patches for the equalizer's eight bands (low cut, low shelf, four bells, high shelf, high cut) */
  tone: "low" | "mid" | "high" | "soft" | "shout";
}

export interface ChoirKind {
  id: string;
  name: string;
  hint: string;
  /** how far into the shared reverb the whole choir is sent, and the room it suits */
  reverb: number;
  room?: { decay: number; predelay: number; damp: number };
  parts: ChoirPart[];
}

type Patch = Partial<EqBand>;
/** The tone of a part: a low voice keeps its chest, a high one loses it and gains air, a soft one is all air. */
export const CHOIR_TONES: Record<ChoirPart["tone"], Patch[]> = {
  low: [{ on: true, freq: 70 }, { gain: 2, freq: 140 }, { freq: 320, gain: -2, q: 1 }, {}, { freq: 3000, gain: -1.5, q: 0.9 }, {}, { gain: -1, freq: 9000 }],
  mid: [{ on: true, freq: 110 }, {}, { freq: 300, gain: -2.5, q: 1 }, {}, { freq: 3200, gain: 1, q: 0.9 }, {}, { gain: 1, freq: 10000 }],
  high: [{ on: true, freq: 170 }, { gain: -2, freq: 220 }, { freq: 400, gain: -2, q: 1 }, {}, { freq: 3600, gain: 1.5, q: 0.9 }, {}, { gain: 2.5, freq: 10500 }],
  soft: [{ on: true, freq: 200 }, { gain: -3, freq: 250 }, { freq: 500, gain: -1.5, q: 0.9 }, { freq: 2500, gain: -2.5, q: 0.8 }, {}, {}, { gain: 4, freq: 9500 }],
  shout: [{ on: true, freq: 130 }, { gain: -1, freq: 200 }, { freq: 350, gain: -2, q: 1 }, { freq: 1500, gain: 2, q: 0.8 }, { freq: 3000, gain: 1.5, q: 1 }, {}, { gain: -1, freq: 9000 }],
};

const part = (name: string, sing: string, pan: number, gain: number, tone: ChoirPart["tone"]): ChoirPart => ({ name, sing, pan, gain, tone });

export const CHOIRS: ChoirKind[] = [
  {
    id: "radda", name: "ردّة المجلس", hint: "أربعة أصوات على نفس اللحن — كأن المجلس كله يردّ", reverb: 0.5, room: { decay: 3.4, predelay: 45, damp: 5000 },
    parts: [
      part("ردّة يسار", "اللحن نفسه بصوتك العادي — لا تقلّد التسجيل السابق بالضبط، الفرق الصغير هو اللي يصنع الجماعة", -0.7, -4, "mid"),
      part("ردّة يمين", "اللحن نفسه مرة ثانية، بنبرة أخشن شعرة", 0.7, -4, "mid"),
      part("ردّة وسط بعيد", "اللحن نفسه وأنت أبعد عن المايك بشبر", 0, -7, "shout"),
      part("القرار", "اللحن أوكتاف تحت (النغمة الواطية)، صدري وهادئ", 0, -5, "low"),
    ],
  },
  {
    id: "trio", name: "كورال ثلاثي", hint: "قرار ووسط وجواب — أبسط كورال كامل", reverb: 0.4,
    parts: [
      part("القرار", "اللحن أوكتاف تحت، بصوت صدري ثقيل وهادئ", -0.35, -4, "low"),
      part("الوسط", "اللحن نفسه بطبقتك المريحة — هو عمود الكورال", 0, -3, "mid"),
      part("الجواب", "اللحن أوكتاف فوق، أو الثالثة فوقه، بصوت خفيف غير مضغوط", 0.35, -7, "high"),
    ],
  },
  {
    id: "quartet", name: "كورال رباعي", hint: "قرار، لحن، ثالثة، وجواب ناعم — أربعة أدوار مختلفة", reverb: 0.4,
    parts: [
      part("القرار (باص)", "اللحن أوكتاف تحت أو نغمة القرار ممسوكة، صدري وثابت", -0.5, -4, "low"),
      part("اللحن (باريتون)", "اللحن نفسه بطبقتك المريحة", -0.15, -3, "mid"),
      part("الثالثة (تينور)", "نغمتين فوق اللحن (الثالثة)، بنفس الكلام والتوقيت", 0.15, -6, "high"),
      part("الجواب الناعم", "أوكتاف فوق بصوت رأسي ناعم، كأنك تهمس النغمة", 0.5, -9, "soft"),
    ],
  },
  {
    id: "full", name: "كورال كامل (٦)", hint: "ثلاثة أدوار، كل دور مسجّل مرتين يمين ويسار — عريض وممتلئ", reverb: 0.45,
    parts: [
      part("قرار يسار", "اللحن أوكتاف تحت، صدري وهادئ", -0.45, -6, "low"),
      part("قرار يمين", "نفس القرار مرة ثانية", 0.45, -6, "low"),
      part("وسط يسار", "اللحن نفسه بطبقتك المريحة", -0.85, -5, "mid"),
      part("وسط يمين", "اللحن نفسه مرة ثانية", 0.85, -5, "mid"),
      part("جواب يسار", "أوكتاف فوق أو الثالثة، بصوت خفيف", -0.6, -9, "high"),
      part("جواب يمين", "نفس الجواب مرة ثانية", 0.6, -9, "high"),
    ],
  },
  {
    id: "grand", name: "جوقة كبيرة (٨)", hint: "أربعة على اللحن، اثنان قرار، اثنان جواب — للخواتيم والمقاطع الكبيرة", reverb: 0.55, room: { decay: 3.8, predelay: 50, damp: 4800 },
    parts: [
      part("لحن ١", "اللحن نفسه بصوتك العادي", -0.9, -6, "mid"),
      part("لحن ٢", "اللحن نفسه بنبرة أخشن", 0.9, -6, "mid"),
      part("لحن ٣", "اللحن نفسه وأنت أبعد عن المايك", -0.4, -8, "shout"),
      part("لحن ٤", "اللحن نفسه بنبرة أنعم", 0.4, -8, "mid"),
      part("قرار ١", "أوكتاف تحت، صدري", -0.25, -6, "low"),
      part("قرار ٢", "نفس القرار مرة ثانية", 0.25, -6, "low"),
      part("جواب ١", "أوكتاف فوق بصوت خفيف", -0.65, -10, "high"),
      part("جواب ٢", "نفس الجواب مرة ثانية", 0.65, -10, "soft"),
    ],
  },
  {
    id: "soft", name: "كورال ناعم (آهات)", hint: "طبقات هادئة من «آه» وهمس تحت الصوت الرئيسي — للنعي والمقدمات", reverb: 0.6, room: { decay: 4.4, predelay: 60, damp: 4200 },
    parts: [
      part("آه يسار", "«آه» ممدودة على نغمة القرار، بنَفَس كثير وصوت قليل", -0.8, -8, "soft"),
      part("آه يمين", "«آه» ممدودة على خامسة القرار، بنفس النعومة", 0.8, -8, "soft"),
      part("قرار ناعم", "نغمة القرار أوكتاف تحت، همهمة مغلقة «مممم»", 0, -9, "low"),
      part("هواء عالٍ", "أوكتاف فوق، همس شبه بلا صوت", 0, -12, "soft"),
    ],
  },
  {
    id: "hosa", name: "كورال حماسي (هوسة)", hint: "صيحة جماعية قوية على لحن واحد مع قرار — للمقاطع الحماسية والمواليد", reverb: 0.3, room: { decay: 1.8, predelay: 25, damp: 7000 },
    parts: [
      part("صيحة يسار", "اللحن بقوة وحماس، من الصدر", -0.8, -4, "shout"),
      part("صيحة يمين", "نفسه مرة ثانية بنفس القوة", 0.8, -4, "shout"),
      part("صيحة وسط", "نفسه وأنت أبعد عن المايك بشبرين", 0, -6, "shout"),
      part("صيحة خلف", "نفسه مرة رابعة، بصوت مبحوح شعرة", 0.3, -8, "mid"),
      part("القرار", "أوكتاف تحت، ثقيل", -0.3, -5, "low"),
    ],
  },
  {
    id: "kids", name: "كورال أطفال", hint: "ثلاثة على اللحن وواحد ثالثة — خفيف ولامع (سجّله بأصوات أطفال أو غيّر الصوت إلى «طفل واقعي»)", reverb: 0.3, room: { decay: 1.5, predelay: 18, damp: 8000 },
    parts: [
      part("طفل ١", "اللحن نفسه بصوت عالٍ مرح", -0.7, -5, "high"),
      part("طفل ٢", "اللحن نفسه مرة ثانية", 0.7, -5, "high"),
      part("طفل ٣", "اللحن نفسه، أنعم", 0, -7, "high"),
      part("الثالثة", "نغمتين فوق اللحن", 0.35, -9, "soft"),
    ],
  },
];
export const choirById = (id: string) => CHOIRS.find((c) => c.id === id) ?? null;
