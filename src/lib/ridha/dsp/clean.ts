// «الرضا فويس» — the cleaning bench: the tools a sound engineer reaches for before mixing a voice, each working on
// one channel of 48 kHz sound and returning a new one. cleanVoice() at the end is the «تنظيف احترافي» button: the
// same tools in the order an engineer runs them.

import { biquad, dbToGain, filter, filterZeroPhase } from "./biquad";
import { breathe, FFT, hann, stftGain, type Progress } from "./fft";

const SIZE = 2048;
const BINS = SIZE / 2 + 1;

/** What the room's own hiss looks like, bin by bin: the average of the quietest frames (or of a stretch the person marked as noise). */
export async function noiseProfile(x: Float32Array, noiseOnly = false): Promise<Float32Array> {
  const hop = SIZE / 4;
  let pick: Set<number> | null = null;
  if (!noiseOnly) {
    const frames = Math.max(1, Math.floor(x.length / hop));
    const level: { f: number; e: number }[] = [];
    for (let f = 0; f < frames; f++) {
      let e = 0;
      const a = f * hop, b = Math.min(x.length, a + SIZE);
      for (let i = a; i < b; i++) e += x[i] * x[i];
      // digital silence (a cut, a pause between files) is not the room: skipped
      if (e / (b - a) > 1e-10) level.push({ f, e });
    }
    level.sort((p, q) => p.e - q.e);
    pick = new Set(level.slice(0, Math.max(8, Math.floor(level.length * 0.08))).map((l) => l.f + 3));
  }
  const prof = new Float32Array(BINS);
  let n = 0;
  await stftGain(x, SIZE, (mag, _g, f) => {
    if (pick && !pick.has(f)) return;
    for (let b = 0; b < BINS; b++) prof[b] += mag[b];
    n++;
  });
  if (n) for (let b = 0; b < BINS; b++) prof[b] /= n;
  return prof;
}

/**
 * Broadband noise (hiss, air conditioning, a fan) taken down by spectral gating: every frequency is kept where the
 * voice stands well above the room's profile and lowered where it does not. `amount` 0–1 is how hard; `floorDb` is
 * how far the noise is pushed down (not to nothing: a little of the room sounds more natural than a hole).
 */
export async function reduceNoise(x: Float32Array, profile: Float32Array, amount = 0.6, floorDb = -18, onProgress?: Progress, guard = false) {
  const over = 1 + 3 * amount;
  // «حماية الحروف»: a bin that stands well clear of the room (a vowel's harmonic, a consonant's hiss) is never taken
  // down by more than plain subtraction of the room itself would take it — the hard over-subtraction is kept for
  // what is close to the noise, so loud noise goes and the words keep their edges
  const safe = 1.4;
  const floor = dbToGain(floorDb * (0.4 + 0.6 * amount));
  const held = new Float32Array(BINS).fill(1);
  const raw = new Float32Array(BINS);
  return stftGain(x, SIZE, (mag, g) => {
    for (let b = 0; b < BINS; b++) {
      const m2 = mag[b] * mag[b];
      const n2 = profile[b] * profile[b] * over * over;
      raw[b] = m2 > 0 ? Math.sqrt(Math.max(0, m2 - n2) / m2) : 0;
      if (guard && m2 > 0) {
        const clear = profile[b] * profile[b] * safe * safe;
        // 10 dB over the room: this is the voice
        if (m2 > 10 * profile[b] * profile[b]) raw[b] = Math.max(raw[b], Math.sqrt(Math.max(0, m2 - clear) / m2));
      }
    }
    for (let b = 0; b < BINS; b++) {
      // smoothed across neighbours and in time (opens at once, closes over a few frames): no chirping «musical noise»
      const near = (raw[Math.max(0, b - 1)] + 2 * raw[b] + raw[Math.min(BINS - 1, b + 1)]) / 4;
      held[b] = near > held[b] ? near : 0.6 * held[b] + 0.4 * near;
      g[b] = Math.max(floor, held[b]);
    }
  }, onProgress);
}

/**
 * A room's tail under the voice, lowered. The room answers a sound some tens of milliseconds after it: so at every
 * frequency, a share of the POWER that sounded a moment ago is taken to be the room and subtracted. While a note is
 * held, that share is small against the note itself and it passes almost untouched (under 1.5 dB at full amount);
 * when the note stops and only its ring is left, the ring IS that share, and it is pulled down.
 */
export async function reduceReverb(x: Float32Array, amount = 0.5, onProgress?: Progress) {
  const late = new Float32Array(BINS);
  const past: Float32Array[] = [];
  const DELAY = 4; // about 43 ms: the direct voice is over, the room is answering
  const share = 0.45 * amount;
  const floor = dbToGain(-16 * amount - 4);
  return stftGain(x, SIZE, (mag, g) => {
    const old = past.length >= DELAY ? past.shift()! : null;
    for (let b = 0; b < BINS; b++) {
      late[b] = 0.7 * late[b] + (old ? 0.3 * old[b] * old[b] : 0);
      const p = mag[b] * mag[b];
      g[b] = p > 0 ? Math.max(floor, Math.sqrt(Math.max(0, 1 - (share * late[b]) / p))) : floor;
    }
    past.push(mag.slice());
  }, onProgress);
}

/** Is there mains hum, and which (50 Hz or 60 Hz)? 0 when neither stands out of what surrounds it. */
export function detectHum(x: Float32Array, sr: number): 0 | 50 | 60 {
  const n = Math.min(x.length, sr * 8);
  const tone = (f: number) => {
    const w = (2 * Math.PI * f) / sr;
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) {
      re += x[i] * Math.cos(w * i);
      im += x[i] * Math.sin(w * i);
    }
    return Math.hypot(re, im) / n;
  };
  const score = (f: number) => (tone(f) + tone(2 * f)) / (tone(f * 0.87) + tone(f * 1.13) + tone(2 * f * 0.94) + tone(2 * f * 1.06) + 1e-9);
  const a = score(50), b = score(60);
  if (Math.max(a, b) < 4) return 0;
  return a > b ? 50 : 60;
}

/** Mains hum cut out: a narrow notch on the hum's note and on its first overtones. */
export function removeHum(x: Float32Array, sr: number, base: 50 | 60, harmonics = 6): Float32Array {
  let y = x;
  for (let h = 1; h <= harmonics; h++) y = filter(y, biquad("notch", sr, base * h, 28));
  return y;
}

/** Everything under `freq` rolled off (desk thumps, traffic rumble, the pop of a «p»), 24 dB an octave with no shift in time. */
export const cutRumble = (x: Float32Array, sr: number, freq = 80) => filterZeroPhase(x, biquad("highpass", sr, freq));

/** Mouth clicks and crackle: a sample that leaps far out of its surroundings for under a millisecond and a half is redrawn from its neighbours. */
export function removeClicks(x: Float32Array, sr: number, sensitivity = 0.5): { out: Float32Array; fixed: number } {
  const out = x.slice();
  const hp = filter(x, biquad("highpass", sr, 4000));
  const win = Math.round(sr * 0.01);
  const maxRun = Math.round(sr * 0.0015);
  const thr = 9 - 5 * sensitivity;
  let acc = 0;
  const power = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    acc += hp[i] * hp[i];
    if (i >= win) acc -= hp[i - win] * hp[i - win];
    power[i] = acc / Math.min(i + 1, win);
  }
  let fixed = 0;
  for (let i = win; i < x.length - win; i++) {
    // against the level a moment BEFORE the leap, so the click does not hide inside its own average
    const ref = Math.sqrt(power[i - 4]) + 1e-5;
    if (Math.abs(hp[i]) < thr * ref) continue;
    let j = i;
    while (j < x.length - 3 && j - i <= maxRun && Math.abs(hp[j]) > 0.5 * thr * ref) j++;
    if (j - i > maxRun) {
      // too long to be a click: a consonant. Left alone.
      i = j;
      continue;
    }
    const a = i - 2, b = j + 2;
    for (let k = a + 1; k < b; k++) out[k] = out[a] + ((out[b] - out[a]) * (k - a)) / (b - a);
    fixed++;
    i = b;
  }
  return { out, fixed };
}

/** Harsh «س» and «ش»: only the top of the voice is turned down, and only while it hisses. */
export function deEss(x: Float32Array, sr: number, freq = 6000, thresholdDb = -28, amount = 0.6): Float32Array {
  const high = filterZeroPhase(x, biquad("highpass", sr, freq));
  const out = new Float32Array(x.length);
  const thr = dbToGain(thresholdDb);
  const att = Math.exp(-1 / (sr * 0.001)), rel = Math.exp(-1 / (sr * 0.06));
  let env = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(high[i]);
    env = a > env ? att * env + (1 - att) * a : rel * env + (1 - rel) * a;
    // above the threshold the hiss is squeezed (up to 6:1 at full amount)
    const g = env > thr ? (thr / env) ** (amount * 0.84) : 1;
    out[i] = x[i] - high[i] + high[i] * g;
  }
  return out;
}

/** A gate: between the phrases, where only the room is left, the sound is lowered by `rangeDb`. */
export function gate(x: Float32Array, sr: number, thresholdDb = -45, rangeDb = -24, holdMs = 120, releaseMs = 160): Float32Array {
  const out = new Float32Array(x.length);
  const thr = dbToGain(thresholdDb), low = dbToGain(rangeDb);
  const att = Math.exp(-1 / (sr * 0.003)), rel = Math.exp(-1 / (sr * (releaseMs / 1000)));
  const hold = Math.round((sr * holdMs) / 1000);
  // looks 5 ms ahead so the first consonant of a phrase is not clipped off
  const ahead = Math.round(sr * 0.005);
  let env = 0, g = low, open = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[Math.min(x.length - 1, i + ahead)]);
    env = Math.max(a, env * 0.9995);
    if (env > thr) open = hold;
    const want = open > 0 ? 1 : low;
    if (open > 0) open--;
    g = want > g ? att * g + (1 - att) * want : rel * g + (1 - rel) * want;
    out[i] = x[i] * g;
  }
  return out;
}

interface Rn {
  frameSize: number;
  createDenoiseState(): { processFrame(f: Float32Array): number; destroy(): void };
}
let rn: Promise<Rn> | null = null;
/** RNNoise hands each frame back two frames (20 ms) later. */
const RN_DELAY = 960;

/** Noise taken out by a small neural network trained on voices (RNNoise, on the device): strongest on changing noise — street, keyboard, crowd. 48 kHz only. */
export async function aiDenoise(x: Float32Array, amount = 1, onProgress?: Progress): Promise<Float32Array> {
  const r = await (rn ??= import("@shiguredo/rnnoise-wasm").then((m) => m.Rnnoise.load() as Promise<Rn>));
  const N = r.frameSize;
  const st = r.createDenoiseState();
  const out = new Float32Array(x.length);
  const f = new Float32Array(N);
  try {
    for (let i = 0, n = 0; i < x.length + RN_DELAY; i += N, n++) {
      for (let j = 0; j < N; j++) f[j] = i + j < x.length ? x[i + j] * 32768 : 0;
      st.processFrame(f);
      for (let j = 0; j < N; j++) {
        const k = i + j - RN_DELAY;
        if (k >= 0 && k < x.length) out[k] = amount * (f[j] / 32768) + (1 - amount) * x[k];
      }
      if (n % 1500 === 1499) {
        onProgress?.(i / x.length);
        await breathe();
      }
    }
  } finally {
    st.destroy();
  }
  return out;
}

/**
 * «حماية الحروف» after a strong cleaner (the neural one above, or any other): the cleaned sound `y` is compared with
 * the original `x` frequency by frequency, and wherever the original stood clearly above the room's own noise
 * (`profile`) — a vowel's harmonics, the hiss of a «س», the burst of a «ت» — the cleaner is not allowed to have taken
 * more than the room itself accounts for. What it removed from the noise stays removed; what it ate from the words
 * is given back. The phase is the original's, so nothing is smeared. This is the cure for cleaners that make the
 * letters come out wrong, worst with nasheed where held notes are mistaken for noise.
 */
export async function guardWords(x: Float32Array, y: Float32Array, profile: Float32Array, onProgress?: Progress, snrDb = 9): Promise<Float32Array> {
  const size = SIZE, hop = size / 4;
  const fft = new FFT(size);
  const w = hann(size);
  const xr = new Float32Array(size), xi = new Float32Array(size), yr = new Float32Array(size), yi = new Float32Array(size);
  const out = new Float32Array(x.length), norm = new Float32Array(x.length);
  const clearK = 10 ** (snrDb / 10);
  const frames = Math.ceil((x.length + size) / hop);
  const g = new Float32Array(BINS);
  for (let f = 0; f < frames; f++) {
    const at = f * hop - size + hop;
    for (let i = 0; i < size; i++) {
      const k = at + i;
      const inside = k >= 0 && k < x.length;
      xr[i] = inside ? x[k] * w[i] : 0;
      yr[i] = inside && k < y.length ? y[k] * w[i] : 0;
      xi[i] = 0;
      yi[i] = 0;
    }
    fft.forward(xr, xi);
    fft.forward(yr, yi);
    for (let b = 0; b < BINS; b++) {
      const mx2 = xr[b] * xr[b] + xi[b] * xi[b];
      const my2 = yr[b] * yr[b] + yi[b] * yi[b];
      let gain = mx2 > 1e-20 ? Math.min(1, Math.sqrt(my2 / mx2)) : 0;
      const n2 = profile[b] * profile[b];
      if (mx2 > clearK * n2) gain = Math.max(gain, Math.sqrt(Math.max(0, 1 - (1.4 * 1.4 * n2) / mx2)));
      g[b] = gain;
    }
    for (let b = 0; b < BINS; b++) {
      // a touch of smoothing across neighbours: no single bin flickers in and out
      const gg = (g[Math.max(0, b - 1)] + 2 * g[b] + g[Math.min(BINS - 1, b + 1)]) / 4;
      xr[b] *= gg;
      xi[b] *= gg;
      if (b > 0 && b < BINS - 1) {
        xr[size - b] = xr[b];
        xi[size - b] = -xi[b];
      }
    }
    fft.inverse(xr, xi);
    for (let i = 0; i < size; i++) {
      const k = at + i;
      if (k >= 0 && k < x.length) {
        out[k] += xr[i] * w[i];
        norm[k] += w[i] * w[i];
      }
    }
    if (f % 400 === 399) {
      onProgress?.(f / frames);
      await breathe();
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = norm[i] > 1e-6 ? out[i] / norm[i] : 0;
  return out;
}

export interface ClipReport {
  /** stretches that were cut flat by an overloaded input, and were redrawn */
  runs: number;
  /** the level the clipping sat at (0–1), and how far the whole sound was lowered so the redrawn peaks fit */
  level: number;
  gainDb: number;
}

/** Where a recording was cut flat («مضروب»): runs of samples stuck at the same top level, two or more long. */
export function findClipping(x: Float32Array): { level: number; runs: [number, number][] } {
  let peak = 0;
  for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > peak) peak = Math.abs(x[i]);
  const level = peak * 0.993;
  const runs: [number, number][] = [];
  if (peak < 0.05) return { level, runs };
  // a natural wave also lingers near its own peak; a clipped one PILES UP there. The share of samples in the top
  // 0.7 % against the share just under it (per unit of height) tells the two apart: about 4 for a pure tone, far
  // less for a voice, and tens or hundreds when the tops were cut flat
  let top = 0, under = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]);
    if (a >= level) top++;
    else if (a >= peak * 0.96 && a < peak * 0.985) under++;
  }
  const pile = top / 0.007 / (Math.max(1, under) / 0.025);
  if (pile < 12) return { level, runs };
  for (let i = 0; i < x.length; i++) {
    if (Math.abs(x[i]) < level) continue;
    const sign = Math.sign(x[i]);
    let j = i;
    while (j < x.length && Math.abs(x[j]) >= level && Math.sign(x[j]) === sign) j++;
    if (j - i >= 2) runs.push([i, j]);
    i = j;
  }
  // a handful of touches of the top is a loud recording, not a clipped one
  return { level, runs: runs.length >= 3 ? runs : [] };
}

/**
 * A clipped recording repaired («إصلاح التشويش»): every flat-topped stretch is redrawn as the wave that was cut off —
 * a curve fitted to the samples on both sides of it and carried over the top (it can only go higher than the cut,
 * never lower) — then the whole sound is lowered so the redrawn peaks sit under −1 dB. What was a buzzing, «مفقوع»
 * voice comes back as if it had been recorded at a sane level. Very long flat stretches (a voice pinned for more than
 * a few milliseconds) are only rounded.
 */
export function declip(x: Float32Array): { out: Float32Array; report: ClipReport } {
  const { level, runs } = findClipping(x);
  if (!runs.length) return { out: x, report: { runs: 0, level, gainDb: 0 } };
  const y = x.slice();
  const K = 6;
  for (const [a, b] of runs) {
    const sign = Math.sign(x[a]);
    const len = b - a;
    // the samples around the run, as (t, v), centred so the fit is well-conditioned
    const ts: number[] = [], vs: number[] = [];
    for (let i = a - K; i < a; i++) {
      if (i < 0 || Math.abs(x[i]) >= level) continue;
      ts.push(i - a);
      vs.push(x[i]);
    }
    for (let i = b; i < b + K; i++) {
      if (i >= x.length || Math.abs(x[i]) >= level) continue;
      ts.push(i - a);
      vs.push(x[i]);
    }
    if (ts.length < 4) continue;
    const c = fitCubic(ts, vs);
    // a long run gets a gentler curve: the fit is held to a believable height (no more than 2.5× the clip level)
    const cap = level * Math.min(2.5, 1 + len / 24);
    for (let i = a; i < b; i++) {
      const t = i - a;
      const v = c[0] + c[1] * t + c[2] * t * t + c[3] * t * t * t;
      y[i] = sign * Math.min(cap, Math.max(level, sign * v));
    }
  }
  let peak = 0;
  for (let i = 0; i < y.length; i++) if (Math.abs(y[i]) > peak) peak = Math.abs(y[i]);
  const k = peak > 0.891 ? 0.891 / peak : 1;
  if (k < 1) for (let i = 0; i < y.length; i++) y[i] *= k;
  return { out: y, report: { runs: runs.length, level, gainDb: 20 * Math.log10(k) } };
}

/** The least-squares cubic through the points: [c0, c1, c2, c3]. */
function fitCubic(ts: number[], vs: number[]): number[] {
  const A = Array.from({ length: 4 }, () => new Array<number>(5).fill(0));
  for (let k = 0; k < ts.length; k++) {
    const p = [1, ts[k], ts[k] ** 2, ts[k] ** 3];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) A[r][c] += p[r] * p[c];
      A[r][4] += p[r] * vs[k];
    }
  }
  // Gauss–Jordan with a little ridge so a near-flat set of points does not blow up
  for (let r = 0; r < 4; r++) A[r][r] += 1e-9;
  for (let c = 0; c < 4; c++) {
    let piv = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    const d = A[c][c] || 1e-12;
    for (let k = c; k < 5; k++) A[c][k] /= d;
    for (let r = 0; r < 4; r++) {
      if (r === c) continue;
      const f = A[r][c];
      for (let k = c; k < 5; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((row) => row[4]);
}

/**
 * The harsh, buzzing top that an overloaded microphone or a saturated preamp leaves on the LOUDEST moments of a voice
 * (distortion without flat tops: a husseiniya's PA pushed too hard): in those moments only, the 2.5–8 kHz band —
 * where the buzz lives — is lowered by up to `amount` × 9 dB, smoothly. Quiet and normal passages are not touched.
 */
export function softenDistortion(x: Float32Array, sr: number, amount = 0.6): Float32Array {
  const band = filterZeroPhase(filterZeroPhase(x, biquad("highpass", sr, 2500, 0.7)), biquad("lowpass", sr, 8000, 0.7));
  const n = x.length;
  const win = Math.round(sr * 0.03);
  // the level of the whole and of the band, as running RMS
  const full = new Float32Array(n), hi = new Float32Array(n);
  let sf = 0, sb = 0;
  for (let i = 0; i < n; i++) {
    sf += x[i] * x[i];
    sb += band[i] * band[i];
    if (i >= win) {
      sf -= x[i - win] * x[i - win];
      sb -= band[i - win] * band[i - win];
    }
    const m = Math.min(i + 1, win);
    full[i] = Math.sqrt(Math.max(0, sf) / m);
    hi[i] = Math.sqrt(Math.max(0, sb) / m);
  }
  // what is «loud» and what share of the band is usual, for THIS recording
  const sorted = Float32Array.from(full.filter((_, i) => i % 64 === 0)).sort();
  const loud = sorted[Math.floor(sorted.length * 0.8)] ?? 0;
  const ratios: number[] = [];
  for (let i = 0; i < n; i += 64) if (full[i] > loud * 0.3) ratios.push(hi[i] / (full[i] + 1e-9));
  ratios.sort((a, b) => a - b);
  const usual = ratios[Math.floor(ratios.length * 0.5)] ?? 0.2;
  const out = new Float32Array(n);
  const rel = Math.exp(-1 / (sr * 0.05));
  let g = 1;
  for (let i = 0; i < n; i++) {
    const loudness = loud > 0 ? Math.min(1, Math.max(0, (full[i] / loud - 0.85) / 0.5)) : 0;
    const harsh = Math.min(1, Math.max(0, (hi[i] / (full[i] + 1e-9) / (usual + 1e-9) - 1.1) / 0.8));
    const want = 10 ** ((-9 * amount * loudness * harsh) / 20);
    g = want < g ? want : rel * g + (1 - rel) * want;
    out[i] = x[i] - band[i] + band[i] * g;
  }
  return out;
}

export interface CleanOptions {
  /** 0–1: how hard the noise is taken down */
  noise: number;
  /** the neural noise remover as well (for changing noise) */
  ai: boolean;
  rumbleHz: number;
  hum: boolean;
  clicks: boolean;
  /** 0–1 (0 = off) */
  deEss: number;
  /** 0–1 (0 = off) */
  reverb: number;
  gate: boolean;
  /** redraw a clipped («مضروب») recording and soften the buzz of an overloaded one (on by default) */
  declip?: boolean;
  /** «حماية الحروف»: the cleaners may not eat what stands clearly above the room — vowels and consonants (on by default) */
  guard?: boolean;
}

export interface CleanReport {
  hum: 0 | 50 | 60;
  clicks: number;
  /** clipped stretches redrawn */
  clipped: number;
  steps: string[];
}

/** The «تنظيف احترافي» chain, in an engineer's order: rumble, hum, clicks, noise, room echo, hiss, gate. */
export async function cleanVoice(x: Float32Array, sr: number, o: CleanOptions, onProgress?: (done: number, step: string) => void): Promise<{ out: Float32Array; report: CleanReport }> {
  const report: CleanReport = { hum: 0, clicks: 0, clipped: 0, steps: [] };
  let y = x;
  const say = (p: number, s: string) => onProgress?.(p, s);
  const guard = o.guard !== false;
  if (o.declip !== false) {
    // first of all: a clipped wave is redrawn before any filter smears its flat tops into the rest
    say(0.01, "فحص التشويش");
    const r = declip(y);
    if (r.report.runs) {
      y = r.out;
      report.clipped = r.report.runs;
      report.steps.push(`إصلاح ${r.report.runs} موضع مضروب (تشويش من قوة التسجيل) وخفض الصوت ${Math.abs(r.report.gainDb).toFixed(1)} dB ليتسع لها`);
      // a recording that clipped was overloaded: the buzz around the cuts is softened too
      y = softenDistortion(y, sr, 0.55);
      report.steps.push("تنعيم الطنين الخشن في أعلى المقاطع");
    }
    await breathe();
  }
  if (o.rumbleHz > 0) {
    say(0.02, "قص الهدير");
    y = cutRumble(y, sr, o.rumbleHz);
    report.steps.push(`قص الترددات تحت ${o.rumbleHz} هرتز`);
    await breathe();
  }
  if (o.hum) {
    say(0.06, "فحص طنين الكهرباء");
    report.hum = detectHum(y, sr);
    if (report.hum) {
      y = removeHum(y, sr, report.hum);
      report.steps.push(`إزالة طنين الكهرباء (${report.hum} هرتز)`);
    }
    await breathe();
  }
  if (o.clicks) {
    say(0.1, "إزالة الطقطقة");
    const r = removeClicks(y, sr);
    y = r.out;
    report.clicks = r.fixed;
    if (r.fixed) report.steps.push(`إصلاح ${r.fixed} طقطقة`);
    await breathe();
  }
  // the room's noise, read once from the sound as it came in (before anything has thinned it)
  const before = y;
  const prof = o.ai || o.noise > 0 ? await noiseProfile(before) : null;
  if (o.ai) {
    y = await aiDenoise(y, 0.5 + 0.5 * o.noise, (p) => say(0.12 + 0.24 * p, "إزالة الضجيج بالشبكة العصبية"));
    report.steps.push("إزالة الضجيج المتغيّر (شبكة عصبية)");
    if (guard && prof) {
      y = await guardWords(before, y, prof, (p) => say(0.36 + 0.08 * p, "حماية الحروف"));
      report.steps.push("حماية الحروف: ما أكلته الشبكة من الكلام رجع، والضجيج بقي مشال");
    }
  }
  if (o.noise > 0 && prof) {
    say(0.44, "قراءة بصمة الضجيج");
    const p2 = o.ai ? await noiseProfile(y) : prof;
    y = await reduceNoise(y, p2, o.ai ? o.noise * 0.6 : o.noise, -18, (p) => say(0.48 + 0.26 * p, "تخفيض الضجيج الثابت"), guard);
    report.steps.push(guard ? "تخفيض الهسهسة والضجيج الثابت مع حماية الحروف" : "تخفيض الهسهسة والضجيج الثابت");
  }
  if (o.reverb > 0) {
    y = await reduceReverb(y, o.reverb, (p) => say(0.76 + 0.14 * p, "تخفيف صدى الغرفة"));
    report.steps.push("تخفيف صدى الغرفة");
  }
  if (o.deEss > 0) {
    say(0.92, "تنعيم السين والشين");
    y = deEss(y, sr, 6000, -30, o.deEss);
    report.steps.push("تنعيم السين والشين");
    await breathe();
  }
  if (o.gate) {
    say(0.96, "إسكات الفراغات");
    y = gate(y, sr);
    report.steps.push("إسكات الفراغات بين الجمل");
  }
  say(1, "تم");
  return { out: y, report };
}
