// «الرضا فويس» — the master in one press. What the mastering services do (a style, and how hard it is pushed), built
// from the studio's own effects so it is heard live and can be opened and changed knob by knob: an equalizer that
// tilts the whole mix toward the style, a gentle compressor that glues it, and a limiter that makes it loud without
// passing the ceiling. And «طابق مرجع»: the tone of a song the person admires is measured against the tone of their
// own mix, band by band, and the difference is added to the master's equalizer.

import { FFT, hann } from "./dsp/fft";
import { makeFx, type EqBand, type Fx } from "./model";

/** The six bands the master's equalizer moves: its low shelf, its four bells and its high shelf, at their usual places. */
export const TONE_FREQS = [120, 300, 1000, 3200, 6500, 10000];
export const TONE_NAMES = ["القرار", "الدفء", "الوسط", "الحضور", "الوضوح", "اللمعة"];
// where one band ends and the next begins, Hz
const EDGES = [30, 190, 550, 1800, 4600, 8000, 16000];

export interface MasterStyle {
  id: string;
  name: string;
  hint: string;
  /** dB on each of the six bands at the middle intensity */
  eq: number[];
  /** how hard the glue compressor squeezes */
  ratio: number;
  /** extra dB of push into the limiter */
  push: number;
  /** rumble below this is removed, Hz */
  lowcut: number;
  /** a little tape warmth, 0–1 */
  warmth?: number;
}

export const MASTER_STYLES: MasterStyle[] = [
  { id: "balanced", name: "متوازن", hint: "يلمّع المكس كما هو: لمسة وضوح ولمسة قرار", eq: [0.5, -0.5, 0, 0.5, 0.5, 1], ratio: 1.8, push: 0, lowcut: 30 },
  { id: "warm", name: "دافئ", hint: "قرار أسمن وأعالي أنعم — يريح الأذن في الاستماع الطويل", eq: [1.5, 0.6, 0, -0.4, -0.6, -0.5], ratio: 1.8, push: 0, lowcut: 30, warmth: 0.12 },
  { id: "bright", name: "لامع وواضح", hint: "يفتح الأعالي ويخفف العكارة — يبان على سماعة الجوال", eq: [0, -1, 0, 1, 1.5, 2], ratio: 1.8, push: 0, lowcut: 35 },
  { id: "loud", name: "قوي وعالي", hint: "أعلى جهارة وضغط أكثر — للمقاطع القصيرة والإعلانات", eq: [1, -1, 0.4, 1, 1, 1.5], ratio: 2.6, push: 2, lowcut: 35 },
  { id: "speech", name: "كلام وبودكاست", hint: "يثبّت الكلام ويبرز مخارج الحروف ويشيل الدوي", eq: [-1, -1.5, 0, 1.5, 0.6, 0.5], ratio: 3, push: 0.5, lowcut: 70 },
  { id: "latm", name: "عزاء (قرار ثقيل)", hint: "ضربة اللطم ثقيلة والصوت قدّام — على قياس إصدارات الاستوديو", eq: [2, -0.3, -0.5, 0.6, 0.2, 0.6], ratio: 2.2, push: 1, lowcut: 30 },
];

export const masterStyle = (id: string) => MASTER_STYLES.find((s) => s.id === id) ?? MASTER_STYLES[0];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const half = (v: number) => Math.round(v * 2) / 2;

/**
 * The master's chain for a style at an intensity 1–5 (3 is the style as written; 1 barely touches the mix; 5 pushes
 * hard), with a reference's tone added when one was matched.
 */
export function buildMaster(styleId: string, intensity: number, match?: number[]): Fx[] {
  const s = masterStyle(styleId);
  const lv = clamp(Math.round(intensity), 1, 5);
  const k = lv / 3;
  const gains = TONE_FREQS.map((_, i) => half(clamp(s.eq[i] * k + (match?.[i] ?? 0), -9, 9)));
  const bands: Partial<EqBand>[] = [
    { on: true, freq: s.lowcut },
    ...gains.map((gain, i) => ({ freq: TONE_FREQS[i], gain, q: i === 0 || i === 5 ? 0.7 : 0.9 })),
    {},
  ];
  const fx: Fx[] = [makeFx("eq", {}, bands)];
  if (s.warmth) fx.push(makeFx("dist", { type: 0, drive: half(s.warmth * k * 20) / 20, tone: 14000, mix: 0.4, out: 0 }));
  fx.push(makeFx("comp", { threshold: -14 - 2 * lv, ratio: Math.round((1 + (s.ratio - 1) * clamp(k, 0.5, 1.4)) * 10) / 10, attack: 30, release: 220, knee: 14, makeup: half(0.5 * lv) }));
  // a lower threshold is a louder master: the limiter lifts what it held to the ceiling
  fx.push(makeFx("limiter", { threshold: -half(1 + 1.3 * lv + s.push), ceiling: -1, release: 90 }));
  return fx;
}

/**
 * The tone of a sound: how much of it lives in each of the six bands, in dB around its own average — so two sounds
 * of different loudness can be compared by their balance alone.
 */
export function toneOf(channels: Float32Array[], sr: number): number[] {
  const size = 4096;
  const len = channels[0]?.length ?? 0;
  const power = new Array<number>(TONE_FREQS.length).fill(0);
  if (len < size) return power;
  const fft = new FFT(size);
  const w = hann(size);
  const re = new Float32Array(size), im = new Float32Array(size);
  // up to 500 frames spread over the whole sound: enough for a steady average of a long song
  const frames = Math.min(500, Math.floor(len / size));
  const step = (len - size) / Math.max(1, frames - 1);
  const edge = EDGES.map((hz) => Math.round((hz / sr) * size));
  for (let f = 0; f < frames; f++) {
    const at = Math.floor(f * step);
    for (let i = 0; i < size; i++) {
      let v = 0;
      for (const ch of channels) v += ch[at + i];
      re[i] = (v / channels.length) * w[i];
      im[i] = 0;
    }
    fft.forward(re, im);
    for (let b = 0; b < power.length; b++) {
      let s = 0;
      for (let i = edge[b]; i < edge[b + 1]; i++) s += re[i] * re[i] + im[i] * im[i];
      // the average power of a bin in the band (wide bands are not louder for being wide)
      power[b] += s / Math.max(1, edge[b + 1] - edge[b]);
    }
  }
  const db = power.map((p) => (p > 1e-20 ? 10 * Math.log10(p / frames) : -120));
  const live = db.filter((v) => v > -110);
  const mean = live.length ? live.reduce((a, v) => a + v, 0) / live.length : 0;
  return db.map((v) => (v > -110 ? v - mean : -60));
}

/**
 * What to add to each band so the mix's balance moves toward the reference's: the difference, taken at `strength`
 * (a master is a nudge, not a copy), never more than `max` dB, in half-dB steps.
 */
export function matchTone(mix: number[], ref: number[], strength = 0.7, max = 6): number[] {
  return mix.map((m, i) => (m <= -60 || ref[i] <= -60 ? 0 : half(clamp((ref[i] - m) * strength, -max, max))));
}
