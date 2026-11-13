// «الرضا فويس» — the rhythm and the floor of a qasida, made in code (no samples, nothing borrowed): the chest beat
// of a mourning gathering, the clap of a celebration, the frame drum's «دُم» and «تَك», and the «أرضية» — a held
// choir-like pad on the tonic and its fifth. The patterns and tempos come from measuring studio releases
// (see config/ridha-training.ts); every one is a grid the person can edit step by step.

import { biquad, filter } from "./biquad";

export type Voice = "latma" | "clap" | "dum" | "tek";
export const VOICES: { id: Voice; name: string; hint: string }[] = [
  { id: "latma", name: "لطمة", hint: "ضربة الصدر الجماعية" },
  { id: "clap", name: "صفقة", hint: "تصفيق الجمهور" },
  { id: "dum", name: "دُم", hint: "قلب الطبل (واطي)" },
  { id: "tek", name: "تَك", hint: "طرف الطبل (حاد)" },
];

export interface RhythmSpec {
  /** which ready pattern it started from */
  pattern: string;
  /** steps in a bar: 16 (four beats in quarters) or 12 (six-eight) */
  steps: 16 | 12;
  /** how hard each voice hits at each step, 0–1 */
  lanes: Record<Voice, number[]>;
  /** how many people: 1 a single hand, 1 = a hall */
  crowd: number;
  /** 0–0.5: every second small step arrives late (a lilt) */
  swing: number;
  /** the gathering speeds up toward the end («النزلة»): bpm added by the last bar */
  rush: number;
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

/** One hit of one voice, by one person, about a third of a second long. */
function oneHit(v: Voice, sr: number, rnd: () => number): Float32Array {
  const n = Math.round(sr * (v === "tek" ? 0.16 : v === "clap" ? 0.22 : 0.4));
  const x = new Float32Array(n);
  if (v === "latma" || v === "dum") {
    // a body's thump: a low note falling fast, under a short slap of the hand
    const f0 = v === "latma" ? 118 + rnd() * 26 : 92 + rnd() * 10, f1 = v === "latma" ? 58 : 52;
    const fall = v === "latma" ? 0.035 : 0.06, len = v === "latma" ? 0.11 : 0.2;
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      ph += (2 * Math.PI * (f1 + (f0 - f1) * Math.exp(-t / fall))) / sr;
      x[i] = Math.sin(ph) * Math.exp(-t / len) * 0.9;
    }
    const slap = new Float32Array(n);
    for (let i = 0; i < n; i++) slap[i] = (rnd() * 2 - 1) * Math.exp(-i / sr / (v === "latma" ? 0.018 : 0.01));
    const s = filter(slap, biquad("bandpass", sr, v === "latma" ? 520 + rnd() * 200 : 900, 0.9));
    for (let i = 0; i < n; i++) x[i] += s[i] * (v === "latma" ? 0.75 : 0.35);
  } else if (v === "clap") {
    // two palms: three quick slaps a hundredth of a second apart, then the room of the cupped hands
    const noise = new Float32Array(n);
    const offs = [0, 0.009 + rnd() * 0.004, 0.019 + rnd() * 0.005];
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let e = 0;
      for (const o of offs) if (t >= o) e = Math.max(e, Math.exp(-(t - o) / 0.006));
      e = Math.max(e, t > 0.024 ? 0.55 * Math.exp(-(t - 0.024) / 0.045) : 0);
      noise[i] = (rnd() * 2 - 1) * e;
    }
    x.set(filter(filter(noise, biquad("bandpass", sr, 1150 + rnd() * 500, 1.3)), biquad("highpass", sr, 500)));
    for (let i = 0; i < n; i++) x[i] *= 2.2;
  } else {
    // the rim: a short ring and a click
    const f = 410 + rnd() * 40;
    const noise = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      x[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.035) * 0.5 + Math.sin(2 * Math.PI * f * 2.31 * t) * Math.exp(-t / 0.02) * 0.25;
      noise[i] = (rnd() * 2 - 1) * Math.exp(-t / 0.012);
    }
    const c = filter(noise, biquad("highpass", sr, 3500));
    for (let i = 0; i < n; i++) x[i] += c[i] * 0.5;
  }
  return x;
}

/** A voice's hit as the gathering makes it: `people` hands a few milliseconds apart, spread a little left and right. */
function crowdHit(v: Voice, sr: number, crowd: number, rnd: () => number): [Float32Array, Float32Array] {
  const people = v === "dum" || v === "tek" ? 1 + Math.round(crowd * 2) : 1 + Math.round(crowd * 11);
  const spread = v === "latma" ? 0.022 : 0.016;
  const n = Math.round(sr * 0.5);
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let k = 0; k < people; k++) {
    const h = oneHit(v, sr, rnd);
    const at = k === 0 ? 0 : Math.round(rnd() * spread * crowd * sr);
    const pan = k === 0 ? 0 : (rnd() * 2 - 1) * 0.8;
    const g = (k === 0 ? 1 : 0.55 + rnd() * 0.4) / Math.sqrt(people);
    const gl = g * Math.cos(((pan + 1) * Math.PI) / 4), gr = g * Math.sin(((pan + 1) * Math.PI) / 4);
    for (let i = 0; i < h.length && at + i < n; i++) {
      L[at + i] += h[i] * gl * 1.4;
      R[at + i] += h[i] * gr * 1.4;
    }
  }
  return [L, R];
}

/** `bars` bars of the pattern at `bpm`, as stereo sound. The same spec always renders the same sound. */
export function renderRhythm(spec: RhythmSpec, bpm: number, bars: number, sr: number): Float32Array[] {
  const beats = spec.steps === 12 ? 2 : 4;
  // a six-eight bar is two dotted beats, each of three small steps
  const stepsPerBeat = spec.steps / beats;
  const rnd = mulberry(4021);
  // a handful of different hits per voice, so a repeated step never sounds stamped
  const bank = new Map<Voice, [Float32Array, Float32Array][]>();
  for (const v of VOICES) bank.set(v.id, [0, 1, 2, 3].map(() => crowdHit(v.id, sr, spec.crowd, rnd)));
  // where each step falls, with the tempo rising across the last third when «النزلة» is on
  const times: number[] = [];
  let t = 0;
  const totalSteps = bars * spec.steps;
  for (let s = 0; s <= totalSteps; s++) {
    times.push(t);
    const prog = s / totalSteps;
    const now = bpm + spec.rush * Math.max(0, (prog - 0.66) / 0.34);
    t += 60 / now / stepsPerBeat;
  }
  const len = Math.round((times[totalSteps] + 0.6) * sr);
  const L = new Float32Array(len), R = new Float32Array(len);
  for (let s = 0; s < totalSteps; s++) {
    const step = s % spec.steps;
    const late = step % 2 === 1 ? spec.swing * (times[s + 1] - times[s]) : 0;
    for (const v of VOICES) {
      const vel = spec.lanes[v.id]?.[step] ?? 0;
      if (vel <= 0) continue;
      const [hl, hr] = bank.get(v.id)![Math.floor(rnd() * 4)];
      // hands are human: a few milliseconds early or late, a little louder or softer
      const at = Math.max(0, Math.round((times[s] + late + (rnd() - 0.5) * 0.008 * spec.crowd) * sr));
      const g = vel * (0.9 + rnd() * 0.2);
      for (let i = 0; i < hl.length && at + i < len; i++) {
        L[at + i] += hl[i] * g;
        R[at + i] += hr[i] * g;
      }
    }
  }
  return [L, R];
}

const lane = (steps: number, hits: Record<number, number>) => Array.from({ length: steps }, (_, i) => hits[i] ?? 0);
const none = (steps: number) => new Array(steps).fill(0);

export interface RhythmPreset {
  id: string;
  name: string;
  kind: "aza" | "mawlid";
  hint: string;
  /** the tempo it usually sits at */
  bpm: [number, number];
  spec: RhythmSpec;
}

const mk = (pattern: string, steps: 16 | 12, lanes: Partial<Record<Voice, Record<number, number>>>, crowd = 0.8, swing = 0): RhythmSpec => ({
  pattern, steps, crowd, swing, rush: 0,
  lanes: { latma: lanes.latma ? lane(steps, lanes.latma) : none(steps), clap: lanes.clap ? lane(steps, lanes.clap) : none(steps), dum: lanes.dum ? lane(steps, lanes.dum) : none(steps), tek: lanes.tek ? lane(steps, lanes.tek) : none(steps) },
});

export const RHYTHMS: RhythmPreset[] = [
  { id: "latma-1", name: "لطمة واحدة", kind: "aza", hint: "ضربة ثقيلة على رأس كل بار — للأطوار البطيئة والنعي", bpm: [56, 72], spec: mk("latma-1", 16, { latma: { 0: 1 } }, 1) },
  { id: "latma-2", name: "لطمتين", kind: "aza", hint: "على الأولى والثالثة — أهدأ إيقاع يمشي معه المجلس", bpm: [60, 80], spec: mk("latma-2", 16, { latma: { 0: 1, 8: 0.85 } }, 1) },
  { id: "latma-3", name: "ثلاث وسكتة", kind: "aza", hint: "ثلاث لطمات والرابعة نفَس — يعطي الرادود مكانًا للكلمة", bpm: [66, 90], spec: mk("latma-3", 16, { latma: { 0: 1, 4: 0.8, 8: 0.9 } }, 1) },
  { id: "latma-4", name: "لطم متواصل", kind: "aza", hint: "على كل ضربة مع نبرة خفيفة بينها — أكثر ما سمعناه في إصدارات الاستوديو", bpm: [68, 116], spec: mk("latma-4", 16, { latma: { 0: 1, 4: 0.8, 6: 0.3, 8: 0.95, 10: 0.3, 12: 0.8, 14: 0.3 } }, 1) },
  { id: "karachi", name: "كراتشي", kind: "aza", hint: "ثنائي سريع، اللطمة على آخر الزمن — للمقطع الحماسي", bpm: [96, 126], spec: mk("karachi", 16, { tek: { 0: 0.7, 3: 0.4, 4: 0.6, 8: 0.7, 11: 0.4, 12: 0.6 }, latma: { 6: 1, 14: 1 } }, 0.9) },
  { id: "six-eight", name: "سداسي (٦/٨)", kind: "aza", hint: "متأرجح عراقي، اللطمة قبل رأس البار", bpm: [50, 76], spec: mk("six-eight", 12, { dum: { 0: 0.9, 6: 0.6 }, tek: { 3: 0.4, 9: 0.4 }, latma: { 10: 1, 4: 0.5 } }, 0.9) },
  { id: "nazla", name: "النزلة", kind: "aza", hint: "ختام سريع يتصاعد — لطم على كل ضربة والسرعة ترتفع", bpm: [104, 132], spec: { ...mk("nazla", 16, { latma: { 0: 1, 4: 0.9, 8: 1, 12: 0.9 }, tek: { 2: 0.3, 6: 0.3, 10: 0.3, 14: 0.3 } }, 1), rush: 14 } },
  { id: "clap-332", name: "صفقة ثلاثية (٣-٣-٢)", kind: "mawlid", hint: "النمط الخليجي الراقص — سمعناه في أكثر من مولد", bpm: [78, 100], spec: mk("clap-332", 16, { clap: { 0: 1, 3: 0.8, 6: 0.9, 8: 0.9, 11: 0.8, 14: 0.9 }, dum: { 0: 0.9, 8: 0.8 } }, 0.9) },
  { id: "ayoub", name: "أيوب", kind: "mawlid", hint: "دُم — تَك تَك — دُم تَك: حركة ثنائية دوّارة للمواليد", bpm: [78, 96], spec: mk("ayoub", 16, { dum: { 0: 1, 4: 0.75, 8: 1, 12: 0.75 }, tek: { 3: 0.5, 6: 0.7, 11: 0.5, 14: 0.7 }, clap: { 6: 0.8, 14: 0.8 } }, 0.8) },
  { id: "clap-back", name: "صفقة على الضربة", kind: "mawlid", hint: "دُم على الأولى والثالثة وصفقة على الثانية والرابعة — بسيط وواضح", bpm: [80, 110], spec: mk("clap-back", 16, { dum: { 0: 1, 8: 0.9, 10: 0.5 }, clap: { 4: 1, 12: 1 } }, 0.9) },
  { id: "clap-double", name: "صفقة مزدوجة", kind: "mawlid", hint: "صفقتان متتاليتان بعد كل دُم — للأفراح والزواج", bpm: [84, 108], spec: mk("clap-double", 16, { dum: { 0: 1, 8: 0.9 }, clap: { 4: 1, 6: 0.85, 12: 1, 14: 0.85 }, tek: { 2: 0.3, 10: 0.3 } }, 0.9) },
  { id: "maqsum", name: "مقسوم", kind: "mawlid", hint: "دُم تَك — تَك دُم — تَك: الإيقاع العربي الأشهر", bpm: [84, 112], spec: mk("maqsum", 16, { dum: { 0: 1, 8: 0.9 }, tek: { 2: 0.7, 6: 0.7, 12: 0.8 }, clap: { 12: 0.6 } }, 0.7) },
];
export const rhythmById = (id: string) => RHYTHMS.find((r) => r.id === id) ?? RHYTHMS[3];

// ───────── the floor («الأرضية») ─────────

export interface PadSpec {
  /** the root as a MIDI note (the tonic, in a low octave) */
  root: number;
  kind: "choir" | "strings" | "deep" | "air";
  /** which notes are held: the tonic alone, with its fifth, or with fifth and octave */
  notes: 1 | 2 | 3;
  /** 0–1: how bright */
  bright: number;
}
export const PAD_KINDS: { id: PadSpec["kind"]; name: string; hint: string }[] = [
  { id: "choir", name: "آه كورال", hint: "جوقة تحمل «آه» طويلة" },
  { id: "strings", name: "وتريات ناعمة", hint: "سجادة وتريات دافئة" },
  { id: "deep", name: "قرار عميق", hint: "دُرون واطي تحت الصوت" },
  { id: "air", name: "نَفَس", hint: "هواء وهمس بلا نغمة ثقيلة" },
];

/** `seconds` of a held pad, stereo, fading in and out over two seconds. */
export function renderPad(spec: PadSpec, seconds: number, sr: number): Float32Array[] {
  const n = Math.round(seconds * sr);
  const L = new Float32Array(n), R = new Float32Array(n);
  const rnd = mulberry(777);
  const notes = [spec.root, spec.root + 7, spec.root + 12].slice(0, spec.notes);
  if (spec.kind === "deep") notes.unshift(spec.root - 12);
  const voices = spec.kind === "air" ? 2 : spec.kind === "deep" ? 3 : 5;
  const harmonics = spec.kind === "deep" ? 4 : spec.kind === "strings" ? 14 : 10;
  for (const note of notes) {
    const hz = 440 * 2 ** ((note - 69) / 12);
    for (let v = 0; v < voices; v++) {
      // several singers a few cents apart, each drifting slowly: that is what makes one note a choir
      const det = 2 ** (((rnd() - 0.5) * 22) / 1200);
      const drift = 0.08 + rnd() * 0.25, dph = rnd() * 6.28;
      const pan = (rnd() * 2 - 1) * 0.85;
      const gl = Math.cos(((pan + 1) * Math.PI) / 4), gr = Math.sin(((pan + 1) * Math.PI) / 4);
      // one period of this singer's tone, drawn once and then read round and round (fast enough for minutes of pad)
      const TABLE = 2048;
      const table = new Float32Array(TABLE + 1);
      for (let h = 1; h <= harmonics; h++) {
        const f = hz * h;
        if (f > sr * 0.45) break;
        // the throat of «آه»: resonances near 700, 1100 and 2600 Hz lift the harmonics that fall on them
        const vowel = spec.kind === "choir" || spec.kind === "air" ? 0.35 + Math.exp(-(((f - 700) / 260) ** 2)) + 0.7 * Math.exp(-(((f - 1150) / 320) ** 2)) + 0.25 * Math.exp(-(((f - 2600) / 500) ** 2)) : 1;
        const amp = (vowel / h ** (1.9 - spec.bright * 0.9)) * (spec.kind === "air" ? 0.35 : 1);
        const ph0 = rnd() * 6.28;
        for (let i = 0; i <= TABLE; i++) table[i] += amp * Math.sin((2 * Math.PI * h * i) / TABLE + ph0);
      }
      const g = 0.16 / Math.sqrt(notes.length * voices);
      let ph = rnd() * TABLE;
      const inc = (hz * det * TABLE) / sr;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        ph += inc * (1 + 0.0016 * Math.sin(2 * Math.PI * drift * t + dph));
        if (ph >= TABLE) ph -= TABLE;
        const k = ph | 0;
        const s = table[k] + (table[k + 1] - table[k]) * (ph - k);
        const swell = 0.8 + 0.2 * Math.sin(2 * Math.PI * (drift * 0.4) * t + dph * 2);
        L[i] += s * g * gl * swell;
        R[i] += s * g * gr * swell;
      }
    }
  }
  if (spec.kind === "air" || spec.kind === "choir") {
    // breath: a hiss shaped by the same vowel
    const breath = new Float32Array(n);
    for (let i = 0; i < n; i++) breath[i] = rnd() * 2 - 1;
    const shaped = filter(filter(breath, biquad("bandpass", sr, 1100, 0.7)), biquad("lowpass", sr, 5000));
    const k = spec.kind === "air" ? 0.05 : 0.012;
    for (let i = 0; i < n; i++) {
      L[i] += shaped[i] * k;
      R[i] += shaped[(i + 977) % n] * k;
    }
  }
  const fade = Math.min(n / 2, Math.round(2 * sr));
  for (let i = 0; i < fade; i++) {
    const g = 0.5 - 0.5 * Math.cos((Math.PI * i) / fade);
    L[i] *= g;
    R[i] *= g;
    L[n - 1 - i] *= g;
    R[n - 1 - i] *= g;
  }
  return [L, R];
}
