// «الرضا فويس» — listens to a recording and writes down what an engineer would note before touching it: how fast
// it moves, which rhythm it walks on, its key, how loud and how squeezed it is, where its weight sits across the
// spectrum, how long its room rings, how much noise lies under it. These numbers are what the quick arrangement is
// built from and what «الرضا ماكس» reads (he cannot hear; he reads measurements).

import { FFT, hann } from "./fft";
import { detectHum } from "./clean";
import { loudness, peakDb } from "./loudness";
import { pitchStats, trackPitch } from "./pitch";
import { RHYTHMS } from "./rhythm";
import { detectKey, detectMusicKey, type KeyGuess } from "./scales";

const N = 1024;

/** Onset strength per frame in three bands (the thump, the body, the clap), and the long-term spectrum. */
function bands(x: Float32Array, sr: number) {
  const hop = Math.round(sr / 94);
  const fft = new FFT(N);
  const w = hann(N);
  const frames = Math.max(0, Math.floor((x.length - N) / hop));
  const re = new Float32Array(N), im = new Float32Array(N);
  const edges = [50, 220, 2000, 2500, 9000].map((f) => Math.round((f * N) / sr));
  const low = new Float32Array(frames), mid = new Float32Array(frames), high = new Float32Array(frames);
  const prev = new Float32Array(N / 2 + 1);
  const avg = new Float64Array(N / 2 + 1);
  const hiEnv = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const at = f * hop;
    for (let i = 0; i < N; i++) {
      re[i] = x[at + i] * w[i];
      im[i] = 0;
    }
    fft.forward(re, im);
    let l = 0, m = 0, h = 0, he = 0;
    for (let b = 1; b <= N / 2; b++) {
      const mag = Math.hypot(re[b], im[b]);
      avg[b] += mag * mag;
      const lg = Math.log1p(40 * mag);
      const d = lg - prev[b];
      prev[b] = lg;
      if (b >= edges[3] && b < edges[4]) he += mag;
      if (d <= 0) continue;
      if (b >= edges[0] && b < edges[1]) l += d;
      else if (b >= edges[1] && b < edges[2]) m += d;
      else if (b >= edges[3] && b < edges[4]) h += d;
    }
    low[f] = l;
    mid[f] = m;
    high[f] = h;
    hiEnv[f] = 20 * Math.log10(he + 1e-6);
  }
  const fps = sr / hop;
  // each band keeps only what rises above its own half-second average: steady sound is not an onset
  const lift = (e: Float32Array) => {
    const out = new Float32Array(e.length);
    const half = Math.round(fps / 4);
    let run = 0;
    for (let i = 0; i < e.length; i++) {
      run += e[i];
      if (i >= 2 * half) run -= e[i - 2 * half];
      out[i] = Math.max(0, e[i] - run / Math.min(i + 1, 2 * half));
    }
    return out;
  };
  for (let b = 0; b <= N / 2; b++) avg[b] /= Math.max(1, frames);
  return { low: lift(low), mid: lift(mid), high: lift(high), hiEnv, avg, fps };
}

function autocorr(e: Float32Array, maxLag: number): Float32Array {
  let mean = 0;
  for (const v of e) mean += v / e.length;
  const ac = new Float32Array(maxLag + 1);
  for (let lag = 0; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i + lag < e.length; i++) s += (e[i] - mean) * (e[i + lag] - mean);
    ac[lag] = s;
  }
  const z = ac[0] || 1;
  for (let i = 0; i <= maxLag; i++) ac[i] /= z;
  return ac;
}

/** The tempo an onset curve walks at (50–190 bpm), preferring the middle of that range when two readings tie. */
function tempoOf(env: Float32Array, fps: number): { bpm: number; strength: number } {
  const ac = autocorr(env, Math.min(env.length - 1, Math.round((60 / 50) * fps * 4) + 2));
  let best = 0, score = -Infinity;
  for (let bpm = 50; bpm <= 190; bpm += 0.5) {
    const lag = (60 / bpm) * fps;
    let s = 0;
    for (const [k, wt] of [[1, 1], [2, 0.6], [4, 0.4]] as const) {
      const i = Math.round(lag * k);
      if (i < ac.length) s += ac[i] * wt;
    }
    s *= Math.exp(-0.5 * (Math.log2(bpm / 100) / 0.9) ** 2);
    if (s > score) {
      score = s;
      best = bpm;
    }
  }
  return { bpm: best, strength: Math.max(0, Math.min(1, score)) };
}

/** A band's onsets folded onto one bar of `steps` steps, starting where the bar's heaviest beat falls. */
function foldBar(env: Float32Array, barFrames: number, steps: number, shift: number): number[] {
  const sum = new Array(steps).fill(0), cnt = new Array(steps).fill(0);
  for (let i = shift; i < env.length; i++) {
    const s = Math.floor((((i - shift) % barFrames) / barFrames) * steps) % steps;
    sum[s] += env[i];
    cnt[s]++;
  }
  const v = sum.map((x, i) => x / Math.max(1, cnt[i]));
  const lo = Math.min(...v), hi = Math.max(...v);
  return v.map((x) => (hi > lo ? (x - lo) / (hi - lo) : 0));
}

export interface Listening {
  seconds: number;
  bpm: number;
  /** 0–1: how clearly a beat was heard at all */
  beatStrength: number;
  /** the ready rhythm whose shape is nearest to what was heard, and how near (0–1) */
  rhythm: string;
  rhythmFit: number;
  /** the heard pattern itself: low hits and high hits over 16 steps of a bar */
  lowSteps: number[];
  highSteps: number[];
  key: KeyGuess | null;
  lufs: number;
  peak: number;
  /** peak minus average level: small = squeezed hard, large = left open */
  crest: number;
  /** energy per octave band relative to the 500 Hz–2 kHz middle, dB: sub, bass, low-mid, 250–500, mid, 2–4k, 4–8k, air */
  tilt: number[];
  /** how long the top of the sound takes to fall 12 dB after a hit, ms: a dry booth is short, a hall is long */
  ringMs: number;
  /** the level of the quietest moments, dB: the noise under everything (null when the sound never pauses, so it cannot be read) */
  noiseDb: number | null;
  hum: 0 | 50 | 60;
  /** share of the sound that is one sung line (a solo voice is high, a full mix or a crowd is low) */
  voiced: number;
  /** harshness of «س»: level of 5–9 kHz against 1–4 kHz, dB */
  sibilance: number;
}

export const TILT_BANDS = ["تحت 60", "60–120", "120–250", "250–500", "500–2k", "2–4k", "4–8k", "8–16k"];

export async function listenTo(channels: Float32Array[], sr: number, opts: { voice?: boolean } = {}): Promise<Listening> {
  // judged on at most the first three minutes, in mono
  const len = Math.min(channels[0].length, sr * 180);
  const x = new Float32Array(len);
  for (const ch of channels) for (let i = 0; i < len; i++) x[i] += ch[i] / channels.length;

  const b = bands(x, sr);
  const sd = (e: Float32Array) => {
    let m = 0, s = 0;
    for (const v of e) m += v / e.length;
    for (const v of e) s += ((v - m) * (v - m)) / e.length;
    return Math.sqrt(s) || 1;
  };
  const sl = sd(b.low), sm = sd(b.mid), sh = sd(b.high);
  const all = new Float32Array(b.low.length);
  for (let i = 0; i < all.length; i++) all[i] = b.low[i] / sl + b.high[i] / sh + (0.5 * b.mid[i]) / sm;
  const { bpm, strength } = tempoOf(all, b.fps);
  const bar = (60 / bpm) * b.fps * 4;
  // the bar starts on its heaviest low hit
  const accent = new Float32Array(all.length);
  for (let i = 0; i < all.length; i++) accent[i] = b.low[i] / sl + (0.3 * b.high[i]) / sh;
  let shift = 0, top = -1;
  for (let s = 0; s < Math.round(bar); s++) {
    let sum = 0, n = 0;
    for (let i = s; i < accent.length; i += bar) {
      sum += accent[Math.round(i)] ?? 0;
      n++;
    }
    if (n && sum / n > top) {
      top = sum / n;
      shift = s;
    }
  }
  const lowSteps = foldBar(b.low, bar, 16, shift), highSteps = foldBar(b.high, bar, 16, shift);
  let rhythm = "latma-4", rhythmFit = 0;
  for (const r of RHYTHMS) {
    if (r.spec.steps !== 16) continue;
    const wantLow = r.spec.lanes.latma.map((v, i) => Math.max(v, r.spec.lanes.dum[i]));
    const wantHigh = r.spec.lanes.clap.map((v, i) => Math.max(v, r.spec.lanes.tek[i]));
    const cos = (p: number[], q: number[]) => {
      let pq = 0, pp = 0, qq = 0;
      for (let i = 0; i < 16; i++) {
        pq += p[i] * q[i];
        pp += p[i] * p[i];
        qq += q[i] * q[i];
      }
      return pp && qq ? pq / Math.sqrt(pp * qq) : 0;
    };
    const hasHigh = wantHigh.some(Boolean);
    const fit = hasHigh ? 0.55 * cos(lowSteps, wantLow) + 0.45 * cos(highSteps, wantHigh) : cos(lowSteps, wantLow);
    // the tempo has to be one the rhythm lives at (or its double or half)
    const inRange = [bpm, bpm * 2, bpm / 2].some((t) => t >= r.bpm[0] - 6 && t <= r.bpm[1] + 6);
    if (fit * (inRange ? 1 : 0.8) > rhythmFit) {
      rhythmFit = fit * (inRange ? 1 : 0.8);
      rhythm = r.id;
    }
  }

  // the spectrum's balance, by octave bands, against the middle
  const edges = [30, 60, 120, 250, 500, 2000, 4000, 8000, 16000];
  const power = (lo: number, hi: number) => {
    let s = 0;
    for (let k = Math.max(1, Math.round((lo * N) / sr)); k < Math.min(N / 2, Math.round((hi * N) / sr)); k++) s += b.avg[k];
    return 10 * Math.log10(s + 1e-12);
  };
  const ref = power(500, 2000);
  const tilt = edges.slice(0, -1).map((lo, i) => Math.round((power(lo, edges[i + 1]) - ref) * 10) / 10);
  const sibilance = Math.round((power(5000, 9000) - power(1000, 4000)) * 10) / 10;

  // the room: after the strongest high hits, how long until the top has fallen 12 dB
  const order = Array.from(b.high.keys()).sort((p, q) => b.high[q] - b.high[p]).slice(0, 60);
  const falls: number[] = [];
  for (const h of order) {
    if (h + 60 >= b.hiEnv.length) continue;
    const t0 = Math.max(b.hiEnv[h + 1], b.hiEnv[h + 2], b.hiEnv[h + 3]);
    let k = 1;
    while (k < 59 && b.hiEnv[h + 1 + k] > t0 - 12) k++;
    falls.push((k / b.fps) * 1000);
  }
  falls.sort((p, q) => p - q);
  const ringMs = falls.length ? Math.round(falls[falls.length >> 1]) : 0;

  // the noise under everything: the level of the quietest moments (digital silence left out). It can only be read
  // where the sound pauses: when even the quietest moments are within 12 dB of the usual level there is no pause
  // to look into, and the floor is left unknown rather than guessed.
  const piece = Math.round(sr * 0.02);
  const levels: number[] = [];
  for (let at = 0; at + piece <= len; at += piece) {
    let s = 0;
    for (let i = at; i < at + piece; i++) s += x[i] * x[i];
    const db = 10 * Math.log10(s / piece + 1e-12);
    if (db > -95) levels.push(db);
  }
  levels.sort((p, q) => p - q);
  const quiet = levels.length ? levels[Math.floor(levels.length * 0.03)] : -96;
  const usual = levels.length ? levels[levels.length >> 1] : -96;
  const noiseDb = usual - quiet >= 12 ? Math.round(quiet * 10) / 10 : null;

  const lufs = loudness([x], sr);
  const peak = peakDb([x]);
  let rms = 0;
  for (let i = 0; i < len; i++) rms += (x[i] * x[i]) / len;
  const crest = Math.round((peak - 10 * Math.log10(rms + 1e-12)) * 10) / 10;

  let key: KeyGuess | null = null;
  let voiced = 0;
  if (opts.voice !== false) {
    const track = await trackPitch(x.subarray(0, Math.min(len, sr * 90)), sr);
    voiced = pitchStats(track).voiced;
    if (voiced > 0.25) key = detectKey(track)[0] ?? null;
  }
  key ??= detectMusicKey(x, sr)[0] ?? null;

  return {
    seconds: channels[0].length / sr, bpm, beatStrength: strength, rhythm, rhythmFit, lowSteps, highSteps, key,
    lufs: Math.round(lufs * 10) / 10, peak: Math.round(peak * 10) / 10, crest, tilt, ringMs, noiseDb, hum: detectHum(x, sr), voiced: Math.round(voiced * 100) / 100, sibilance,
  };
}
