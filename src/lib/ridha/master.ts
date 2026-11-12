// «الرضا فويس» — the master in one press, on the person's own device (nothing is sent anywhere). What the mastering
// services do (a style, and how hard it is pushed, BandLab's way), built
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
  /** dB on each of the six bands at the middle strength (50) */
  eq: number[];
  /** how hard the glue compressor squeezes at the middle strength */
  ratio: number;
  /** the compressor's attack, ms: slow lets the hits through (punch), fast holds everything (glue) */
  attack: number;
  /** extra dB of push into the limiter */
  push: number;
  /** rumble below this is removed, Hz */
  lowcut: number;
  /** tape warmth at the middle strength, 0–1 */
  warmth?: number;
  /** a faint shared room around the whole mix at the middle strength, 0–1 (space and depth, never an echo) */
  room?: number;
}

/**
 * The eight ready masters, after the eight of BandLab's mastering (the owner's order of 12 November 2026: «٨ انواع
 * ماستر مختلفة جاهزة … راجع باندلاب»): an all-purpose one, punchy lows, bright detail, tape warmth, a transparent
 * one, a wide and airy one, a big cinematic one, and punch.
 */
export const MASTER_STYLES: MasterStyle[] = [
  { id: "universal", name: "شامل", hint: "متوازن لكل شيء: يلمّع المكس ويحافظ على حركته ونبرته", eq: [0.5, -0.5, 0, 0.5, 0.5, 1], ratio: 1.8, attack: 25, push: 0.5, lowcut: 30 },
  { id: "fire", name: "ناري", hint: "قرار ضارب ووسط أوضح — للإيقاع القوي واللطميات الحماسية", eq: [2.5, -1, 0.5, 1, 0.5, 0.5], ratio: 2.4, attack: 18, push: 1.5, lowcut: 30 },
  { id: "clarity", name: "صفاء", hint: "أعالي أنصع وتفاصيل أكثر — للصوت والقصائد والتلاوة", eq: [-0.5, -1.5, 0, 1.5, 2, 2.5], ratio: 1.8, attack: 25, push: 0.5, lowcut: 40 },
  { id: "tape", name: "شريط", hint: "دفء الشريط وتشبّعه الناعم — يحس قديم وحميم", eq: [1, 0.8, 0, -0.5, -0.8, -1], ratio: 2, attack: 30, push: 0.5, lowcut: 30, warmth: 0.18 },
  { id: "natural", name: "طبيعي", hint: "أخف لمسة: الجهارة ترتفع والصوت يبقى كما سجّلته", eq: [0, 0, 0, 0.3, 0.3, 0.5], ratio: 1.3, attack: 40, push: 0, lowcut: 25 },
  { id: "spatial", name: "فضاء", hint: "هواء ومساحة حول الصوت — يحس المكس أوسع وأبعد", eq: [0.3, -1.2, -0.3, 0.5, 1.2, 2.2], ratio: 1.6, attack: 30, push: 0.5, lowcut: 30, room: 0.08 },
  { id: "cinematic", name: "سينمائي", hint: "قرار عميق وأعالي لامعة وعمق — كأنه موسيقى فيلم", eq: [2.2, -1, -0.8, 0.3, 1, 2], ratio: 2, attack: 30, push: 1, lowcut: 25, room: 0.05 },
  { id: "punch", name: "ضربة", hint: "الضربات تطلع قدّام والصوت يضرب الصدر — للإعلان والمقاطع القصيرة", eq: [1.5, 0.5, 0.5, 1.2, 0.5, 0.5], ratio: 3, attack: 35, push: 2, lowcut: 35 },
];

export const masterStyle = (id: string) => MASTER_STYLES.find((s) => s.id === id) ?? MASTER_STYLES[0];

/** The strength steps, as in BandLab: 0 to 100 in eleven steps; 50 is the style as written. */
export const STRENGTHS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
export const DEFAULT_STRENGTH = 50;
/** A project saved when the strength was 1–5 reads it on the new scale. */
export const strengthOf = (v: number | undefined) => (v == null ? DEFAULT_STRENGTH : v >= 1 && v <= 5 && Number.isInteger(v) ? v * 20 : Math.max(0, Math.min(100, Math.round(v / 10) * 10)));

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const half = (v: number) => Math.round(v * 2) / 2;

/**
 * The master's chain for a style at a strength 0–100 (50 is the style as written; 0 leaves the mix as it is and only
 * keeps its peaks under the ceiling; 100 is twice as far), with a reference's tone added when one was matched.
 */
export function buildMaster(styleId: string, strength: number, match?: number[]): Fx[] {
  const s = masterStyle(styleId);
  const k = clamp(strengthOf(strength), 0, 100) / 50;
  const gains = TONE_FREQS.map((_, i) => half(clamp(s.eq[i] * k + (match?.[i] ?? 0), -9, 9)));
  const bands: Partial<EqBand>[] = [
    { on: k > 0, freq: s.lowcut },
    ...gains.map((gain, i) => ({ freq: TONE_FREQS[i], gain, q: i === 0 || i === 5 ? 0.7 : 0.9 })),
    {},
  ];
  const fx: Fx[] = [makeFx("eq", {}, bands)];
  if (s.warmth && k > 0) fx.push(makeFx("dist", { type: 0, drive: Math.round(clamp(s.warmth * k, 0, 0.6) * 100) / 100, tone: 14000, mix: 0.45, out: 0 }));
  if (s.room && k > 0) fx.push(makeFx("reverb", { decay: 1.6, predelay: 18, damp: 7000, lowcut: 350, mix: Math.round(clamp(s.room * k, 0, 0.2) * 100) / 100 }));
  if (k > 0) fx.push(makeFx("comp", { threshold: Math.round(-10 - 8 * k), ratio: Math.round((1 + (s.ratio - 1) * k) * 10) / 10, attack: s.attack, release: 200, knee: 14, makeup: half(1.5 * k) }));
  // a lower threshold is a louder master: the limiter lifts what it held to the ceiling
  fx.push(makeFx("limiter", { threshold: -half(1 + (2.5 + s.push) * k), ceiling: -1, release: 90 }));
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
