// «الرضا فويس» — the cleaning bench: the tools a sound engineer reaches for before mixing a voice, each working on
// one channel of 48 kHz sound and returning a new one. cleanVoice() at the end is the «تنظيف احترافي» button: the
// same tools in the order an engineer runs them.

import { biquad, dbToGain, filter, filterZeroPhase } from "./biquad";
import { breathe, stftGain, type Progress } from "./fft";

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
export async function reduceNoise(x: Float32Array, profile: Float32Array, amount = 0.6, floorDb = -18, onProgress?: Progress) {
  const over = 1 + 3 * amount;
  const floor = dbToGain(floorDb * (0.4 + 0.6 * amount));
  const held = new Float32Array(BINS).fill(1);
  const raw = new Float32Array(BINS);
  return stftGain(x, SIZE, (mag, g) => {
    for (let b = 0; b < BINS; b++) {
      const m2 = mag[b] * mag[b];
      const n2 = profile[b] * profile[b] * over * over;
      raw[b] = m2 > 0 ? Math.sqrt(Math.max(0, m2 - n2) / m2) : 0;
    }
    for (let b = 0; b < BINS; b++) {
      // smoothed across neighbours and in time (opens at once, closes over a few frames): no chirping «musical noise»
      const near = (raw[Math.max(0, b - 1)] + 2 * raw[b] + raw[Math.min(BINS - 1, b + 1)]) / 4;
      held[b] = near > held[b] ? near : 0.6 * held[b] + 0.4 * near;
      g[b] = Math.max(floor, held[b]);
    }
  }, onProgress);
}

/** A room's tail under the voice, lowered: what rang a moment ago and is still ringing now is treated as echo. */
export async function reduceReverb(x: Float32Array, amount = 0.5, onProgress?: Progress) {
  const late = new Float32Array(BINS);
  const past: Float32Array[] = [];
  const DELAY = 4; // about 43 ms: the direct voice is over, the room is answering
  const floor = dbToGain(-14 * amount - 4);
  return stftGain(x, SIZE, (mag, g) => {
    const old = past.length >= DELAY ? past.shift()! : null;
    for (let b = 0; b < BINS; b++) {
      late[b] = 0.86 * late[b] + (old ? 0.14 * old[b] : 0);
      const v = mag[b] > 0 ? 1 - (1.6 * amount * late[b] * 7) / (mag[b] + 1e-9) : 1;
      g[b] = Math.max(floor, Math.min(1, v));
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
}

export interface CleanReport {
  hum: 0 | 50 | 60;
  clicks: number;
  steps: string[];
}

/** The «تنظيف احترافي» chain, in an engineer's order: rumble, hum, clicks, noise, room echo, hiss, gate. */
export async function cleanVoice(x: Float32Array, sr: number, o: CleanOptions, onProgress?: (done: number, step: string) => void): Promise<{ out: Float32Array; report: CleanReport }> {
  const report: CleanReport = { hum: 0, clicks: 0, steps: [] };
  let y = x;
  const say = (p: number, s: string) => onProgress?.(p, s);
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
  if (o.ai) {
    y = await aiDenoise(y, 0.5 + 0.5 * o.noise, (p) => say(0.12 + 0.3 * p, "إزالة الضجيج بالشبكة العصبية"));
    report.steps.push("إزالة الضجيج المتغيّر (شبكة عصبية)");
  }
  if (o.noise > 0) {
    say(0.44, "قراءة بصمة الضجيج");
    const prof = await noiseProfile(y);
    y = await reduceNoise(y, prof, o.ai ? o.noise * 0.6 : o.noise, -18, (p) => say(0.48 + 0.26 * p, "تخفيض الضجيج الثابت"));
    report.steps.push("تخفيض الهسهسة والضجيج الثابت");
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
