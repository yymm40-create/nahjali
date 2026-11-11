// «الرضا فويس» — changing WHO is speaking. A voice is two things: the note the vocal cords give, and the size of
// the throat and mouth that colours it (its formants). A child is not a man played faster: the note is far higher
// AND the throat a quarter smaller, with a livelier melody; an old man is hardly lower at all, but his note
// wavers and trembles and there is air in it. So a character here is a recipe — where the middle of the voice
// lands (in Hz, worked out from THIS speaker's own middle, so it lands right whether he is deep or light), how
// much smaller or larger the throat, how wide the melody, how steady, how airy, how bright.
//
// The work is done in two moves, so that nothing of the original is left behind: first the WHOLE sound — voice,
// breath, the room's ring, whatever the note-finder missed — is moved by the throat's factor (note and colour
// together); then only the note is moved the rest of the way, pulse by pulse, keeping that colour.

import { biquad, filter } from "./biquad";
import { breathe } from "./fft";
import { hzToMidi, trackPitch, type PitchTrack } from "./pitch";
import { psolaShift } from "./psola";
import { shiftAll } from "./stretch";

export interface VoiceShape {
  /** where the middle of the voice should land, Hz (worked out against the speaker's own middle) … */
  targetHz?: number;
  /** … or simply how many times higher or lower than now */
  ratio?: number;
  /** throat size: 1.25 a child's, 1.16 a woman's, 0.9 a bigger man's */
  formant: number;
  /** the melody of speech widened (above 1) or flattened (below 1) around its middle */
  range?: number;
  /** unsteadiness of the note from one moment to the next, 0–0.02 (an old voice) */
  jitter?: number;
  /** a slow tremble of note and level, 0–0.03 */
  tremor?: number;
  /** air in the voice, 0–0.15 */
  breath?: number;
  /** dB at the bottom (around 200 Hz) and at the top (above 5 kHz) */
  low?: number;
  high?: number;
}

export interface VoiceCharacter extends VoiceShape {
  id: string;
  name: string;
  hint: string;
}

export const VOICE_CHARACTERS: VoiceCharacter[] = [
  { id: "child", name: "طفل واقعي", hint: "طبقة طفل وحنجرة صغيرة ولحن كلام أنشط", targetHz: 285, formant: 1.27, range: 1.15, jitter: 0.004, breath: 0.04, low: -4, high: 2 },
  { id: "woman", name: "امرأة واقعية", hint: "طبقة نسائية طبيعية وحنجرة أصغر ونَفَس خفيف", targetHz: 205, formant: 1.16, range: 1.1, jitter: 0.003, breath: 0.05, low: -3, high: 1.5 },
  { id: "elder", name: "رجل كبير واقعي", hint: "نفس الطبقة تقريبًا، برعشة العمر ونَفَس في الصوت", ratio: 0.95, formant: 0.97, range: 0.9, jitter: 0.012, tremor: 0.02, breath: 0.1, low: 1, high: -4 },
  { id: "young", name: "شاب", hint: "أعلى شعرة وأخف", ratio: 1.14, formant: 1.05, range: 1.05, high: 1 },
  { id: "deep", name: "رجل أضخم وأوقر", hint: "أوطى بحنجرة أكبر", ratio: 0.85, formant: 0.9, range: 0.95, low: 2, high: -1 },
  { id: "giant", name: "عملاق", hint: "واطي جدًا وضخم (غير واقعي بقصد)", ratio: 0.62, formant: 0.78, low: 3, high: -2 },
];

/** The middle note of a voice (Hz) — the median of what was sung or said; 0 when no note was found. */
export function middleHz(t: PitchTrack): number {
  const v: number[] = [];
  for (const hz of t.f0) if (hz) v.push(hz);
  if (v.length < 10) return 0;
  v.sort((a, b) => a - b);
  return v[v.length >> 1];
}

/**
 * The note-finder leaves gaps: the faint end of a word, a breathy vowel, the room still ringing after it. Left
 * alone those moments would keep the ORIGINAL note while everything around them moved — the speaker heard humming
 * behind his own new voice. So a gap is given the note of its neighbours when the sound in it is voice-like (its
 * weight in the low part of the spectrum, as vowels and room rings are; a «س» or a «ش» is all top and is left out).
 */
export function holdPitch(x: Float32Array, t: PitchTrack): PitchTrack {
  const f0 = t.f0.slice();
  const n = f0.length;
  const fps = t.sr / t.hop;
  const lowpassed = filter(x, biquad("lowpass", t.sr, 900));
  const voiceLike = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, Math.round((i - 0.5) * t.hop)), b = Math.min(x.length, Math.round((i + 0.5) * t.hop));
    let all = 0, low = 0;
    for (let k = a; k < b; k++) {
      all += x[k] * x[k];
      low += lowpassed[k] * lowpassed[k];
    }
    // audible (above −62 dB) and mostly below 900 Hz
    voiceLike[i] = b > a && all / (b - a) > 6e-7 && low > 0.55 * all ? 1 : 0;
  }
  const maxGap = Math.round(fps * 0.22), tail = Math.round(fps * 0.35);
  let last = -1;
  for (let i = 0; i < n; i++) {
    if (!t.f0[i]) continue;
    if (last >= 0 && i - last > 1 && i - last <= maxGap) {
      // a short gap between two notes: bridged, sliding from one to the other
      for (let k = last + 1; k < i; k++) if (voiceLike[k]) f0[k] = t.f0[last] * (t.f0[i] / t.f0[last]) ** ((k - last) / (i - last));
    }
    last = i;
  }
  // the dying end of a phrase, and its faint beginning: the nearest note is held over them
  for (let i = 0; i < n; i++) {
    if (!f0[i]) continue;
    for (let k = i + 1; k < Math.min(n, i + tail) && !f0[k] && voiceLike[k]; k++) f0[k] = f0[i];
  }
  for (let i = n - 1; i >= 0; i--) {
    if (!f0[i]) continue;
    for (let k = i - 1; k >= Math.max(0, i - Math.round(fps * 0.08)) && !f0[k] && voiceLike[k]; k--) f0[k] = f0[i];
  }
  return { ...t, f0 };
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

/** One channel of a voice, as another person would say it. The length never changes. */
export async function changeVoice(x: Float32Array, sr: number, shape: VoiceShape, onProgress?: (done: number, what: string) => void): Promise<Float32Array> {
  const say = (p: number, w: string) => onProgress?.(p, w);
  say(0.02, "سماع طبقة الصوت");
  const first = await trackPitch(x, sr, { onProgress: (p) => say(0.02 + 0.2 * p, "سماع طبقة الصوت") });
  const middle = middleHz(first);
  // how far the note travels in all: to the character's own range, from wherever this speaker is
  const total = Math.max(0.45, Math.min(2.6, shape.ratio ?? (middle && shape.targetHz ? shape.targetHz / middle : 1)));
  const fm = Math.max(0.7, Math.min(1.4, shape.formant));

  // first move: everything, by the throat's factor (note and colour together) — nothing of the original stays
  say(0.25, "تغيير حجم الحنجرة");
  await breathe();
  const moved = fm === 1 ? x : shiftAll([x], 12 * Math.log2(fm), sr)[0];

  // second move: the note alone, the rest of the way
  const rest = total / fm;
  let y = moved;
  const range = shape.range ?? 1, jitter = shape.jitter ?? 0, tremor = shape.tremor ?? 0;
  if (Math.abs(rest - 1) > 0.01 || range !== 1 || jitter || tremor) {
    say(0.4, "نقل الطبقة");
    const found = await trackPitch(moved, sr, { fmin: 55, fmax: 1100, onProgress: (p) => say(0.4 + 0.25 * p, "نقل الطبقة") });
    const track = holdPitch(moved, found);
    const mid = middleHz(found) || middle * fm || 150;
    const fps = sr / track.hop;
    const rnd = mulberry(20261111);
    // an old voice's unsteadiness: a slow random drift, not a new jump at every reading
    const drift = new Float32Array(track.f0.length);
    let d = 0;
    for (let i = 0; i < drift.length; i++) {
      d = 0.9 * d + 0.1 * (rnd() * 2 - 1) * 4;
      drift[i] = d;
    }
    await breathe();
    y = psolaShift(moved, track, (f) => {
      const hz = track.f0[f];
      // the melody of speech around its middle, widened or flattened; then the unsteadiness and the tremble
      const melody = hz ? (hz / mid) ** (range - 1) : 1;
      return rest * melody * (1 + jitter * drift[f]) * (1 + tremor * Math.sin((2 * Math.PI * 5.3 * f) / fps));
    });
  }
  say(0.8, "اللمسات الأخيرة");
  await breathe();

  // air in the voice: a hiss in the top of the spectrum that follows the voice's own level
  const breath = shape.breath ?? 0;
  if (breath > 0) {
    const rnd = mulberry(99);
    const air = new Float32Array(y.length);
    for (let i = 0; i < air.length; i++) air[i] = rnd() * 2 - 1;
    const shaped = filter(filter(air, biquad("highpass", sr, 2200)), biquad("lowpass", sr, 9000));
    let env = 0;
    const a = Math.exp(-1 / (sr * 0.012));
    for (let i = 0; i < y.length; i++) {
      env = Math.max(Math.abs(y[i]), env * a);
      y[i] += shaped[i] * env * breath * 1.6;
    }
  }
  // the tremble is in the level too
  if (tremor > 0) for (let i = 0; i < y.length; i++) y[i] *= 1 + tremor * 3.5 * Math.sin((2 * Math.PI * 5.3 * i) / sr + 1);
  // colour: less chest for a small body, less shine for an old one
  if (shape.low) y = filter(y, biquad("lowshelf", sr, 230, Math.SQRT1_2, shape.low));
  if (shape.high) y = filter(y, biquad("highshelf", sr, 5200, Math.SQRT1_2, shape.high));
  // as loud as it was
  let pin = 0, pout = 0;
  for (let i = 0; i < x.length; i++) {
    pin += x[i] * x[i];
    pout += y[i] * y[i];
  }
  const k = pout > 0 ? Math.min(4, Math.sqrt(pin / pout)) : 1;
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = Math.max(-1, Math.min(1, y[i] * k));
  say(1, "تم");
  return out;
}

/** How far a voice is from a character's home range, in semitones (shown before changing). */
export const travel = (middle: number, shape: VoiceShape) => (middle ? 12 * Math.log2(shape.ratio ?? (shape.targetHz ? shape.targetHz / middle : 1)) : 0);
export const middleNote = (t: PitchTrack) => (middleHz(t) ? hzToMidi(middleHz(t)) : 0);
