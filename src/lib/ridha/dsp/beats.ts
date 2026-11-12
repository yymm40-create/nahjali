// «الرضا فويس» — hearing where a crowd strikes. A majlis recording carries the people's latm (the chest beat: a low
// thump with a slap on top) under the radood's voice; to lay a clean studio latma on it, the studio must know WHEN
// every strike falls — and a crowd is human: it drifts, speeds up toward the end of a qasida, and leans early or late.
//
// So: an onset strength curve built from what a strike sounds like (a sudden rise in the low thump band and in the
// slap band, not in the voice's middle), the crowd's tempo from that curve, every beat followed by dynamic
// programming (Ellis 2007: beats near the tempo, on the loudest onsets), and each beat finally pulled to the real
// strike nearest it — so the placed latma lands where the people's hands landed, not on a metronome.
// Then the latma the person chose is laid on those beats: a single strike is put on each one; a recorded pattern
// (several strikes) is cut into its own strikes and each is laid on its own beat in turn.

import { changeSpeed } from "./stretch";
import { FFT, hann } from "./fft";

export interface Onsets {
  /** onset strength, one value per hop */
  env: Float32Array;
  /** hops per second */
  fps: number;
}

const SIZE = 2048;
const HOP = 256;
/**
 * A frame's onset value rises as a strike ENTERS its window, a window-length before the frame is «at» the strike:
 * a strike found in frame f began at f / fps + LAG seconds (measured on clean strikes; within a few ms).
 */
const LAG = 0.0395;
const frameTime = (f: number, fps: number) => Math.max(0, f / fps + LAG);
const timeFrame = (t: number, fps: number) => Math.round((t - LAG) * fps);

/**
 * How sharply a strike begins at each moment: the positive change of the log spectrum, summed over the thump band
 * (45–250 Hz) and the slap band (1.2–5 kHz) — the voice's own middle is weighted lightly so a sung word is not a beat.
 */
export function onsetStrength(x: Float32Array, sr: number): Onsets {
  const fft = new FFT(SIZE);
  const w = hann(SIZE);
  const bins = SIZE / 2 + 1;
  const re = new Float32Array(SIZE), im = new Float32Array(SIZE);
  const prev = new Float32Array(bins);
  const frames = Math.max(1, Math.floor((x.length - SIZE) / HOP) + 1);
  const env = new Float32Array(frames);
  const binHz = sr / SIZE;
  const weight = new Float32Array(bins);
  for (let b = 0; b < bins; b++) {
    const hz = b * binHz;
    weight[b] = hz >= 45 && hz <= 250 ? 1.6 : hz >= 1200 && hz <= 5000 ? 1 : hz > 250 && hz < 1200 ? 0.25 : 0;
  }
  for (let f = 0; f < frames; f++) {
    const at = f * HOP;
    for (let i = 0; i < SIZE; i++) {
      re[i] = (x[at + i] ?? 0) * w[i];
      im[i] = 0;
    }
    fft.forward(re, im);
    let s = 0;
    for (let b = 1; b < bins; b++) {
      if (!weight[b]) continue;
      const m = Math.log1p(1000 * Math.hypot(re[b], im[b]));
      const d = m - prev[b];
      if (d > 0) s += weight[b] * d;
      prev[b] = m;
    }
    env[f] = s;
  }
  // the slow part of the curve (a swelling voice, the crowd's general roar) is taken away: only the attacks remain
  const out = new Float32Array(frames);
  const half = Math.round((0.4 * sr) / HOP);
  let acc = 0;
  for (let f = 0; f < frames; f++) {
    acc += env[f];
    if (f > 2 * half) acc -= env[f - 2 * half - 1];
    const n = Math.min(f + 1, 2 * half + 1);
    out[f] = Math.max(0, env[f] - acc / n);
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, v);
  if (peak > 0) for (let f = 0; f < frames; f++) out[f] /= peak;
  return { env: out, fps: sr / HOP };
}

/**
 * The crowd's tempo in BPM: the lag at which the onset curve best repeats itself, between 50 and 170 beats a minute,
 * leaning toward the 70–110 where latm usually sits (a doubled or halved reading is the usual mistake, and the lean
 * settles it the way an ear would).
 */
export function crowdTempo(o: Onsets, lo = 50, hi = 170): number {
  const { env, fps } = o;
  const minLag = Math.floor((60 / hi) * fps), maxLag = Math.ceil((60 / lo) * fps);
  let best = 0, bestLag = Math.round((60 / 90) * fps);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = lag; i < env.length; i++) s += env[i] * env[i - lag];
    s /= Math.max(1, env.length - lag);
    const bpm = (60 * fps) / lag;
    // a gentle prior centred on 90 BPM (log scale, an octave wide)
    const lean = Math.exp(-0.5 * (Math.log2(bpm / 90) / 0.7) ** 2);
    const score = s * (0.4 + 0.6 * lean);
    if (score > best) {
      best = score;
      bestLag = lag;
    }
  }
  // the peak refined between its neighbours
  return Math.round(((60 * fps) / bestLag) * 10) / 10;
}

/**
 * Every beat, in seconds: chosen by dynamic programming so that consecutive beats sit about one period apart and
 * land on strong onsets (Ellis 2007), then each pulled to the strongest onset within a fifth of a period of it.
 */
export function trackBeats(o: Onsets, bpm: number, tightness = 80): number[] {
  const { env, fps } = o;
  const n = env.length;
  if (n < 4) return [];
  const period = (60 / bpm) * fps;
  const score = new Float32Array(n);
  const back = new Int32Array(n).fill(-1);
  const lo = Math.round(period * 0.5), hi = Math.round(period * 2);
  for (let i = 0; i < n; i++) {
    let best = 0, from = -1;
    for (let j = i - hi; j <= i - lo; j++) {
      if (j < 0) continue;
      const d = Math.log((i - j) / period);
      const s = score[j] - tightness * d * d;
      if (from < 0 || s > best) {
        best = s;
        from = j;
      }
    }
    score[i] = env[i] + (from >= 0 ? Math.max(0, best) : 0);
    back[i] = from >= 0 && best > 0 ? from : -1;
  }
  // the chain ends at the best-scoring frame in the last period
  let end = n - 1;
  for (let i = Math.max(0, n - Math.round(period)); i < n; i++) if (score[i] > score[end]) end = i;
  const beats: number[] = [];
  for (let i = end; i >= 0; i = back[i]) {
    beats.push(i);
    if (back[i] < 0) break;
  }
  beats.reverse();
  // the chain may start late: earlier beats are walked back one period at a time while strikes are still there
  const first: number[] = [];
  for (let t = beats[0] - period; t >= 0; t -= period) {
    const k = strongestNear(env, Math.round(t), Math.round(period * 0.2));
    if (env[k] < 0.08) break;
    first.unshift(k);
    t = k;
  }
  const all = [...first, ...beats];
  // each beat on the real strike nearest it
  const snapped = all.map((b) => strongestNear(env, b, Math.round(period * 0.2)));
  // the hop's own latency: the onset curve rises a few ms after the strike's first sample
  return dedupe(snapped).map((f) => frameTime(f, fps));
}

function strongestNear(env: Float32Array, at: number, r: number): number {
  let k = Math.max(0, Math.min(env.length - 1, at));
  for (let i = Math.max(0, at - r); i <= Math.min(env.length - 1, at + r); i++) if (env[i] > env[k]) k = i;
  return k;
}
const dedupe = (a: number[]) => a.filter((v, i) => i === 0 || v > a[i - 1]);

/** Where the strikes of a recorded latma are, in seconds from its start (onsets that stand out from the curve). */
export function strikesIn(x: Float32Array, sr: number): number[] {
  // a latma file usually starts ON its strike: a window of silence is put before it so that strike is heard as one
  const padded = new Float32Array(x.length + SIZE);
  padded.set(x, SIZE);
  const o = onsetStrength(padded, sr);
  const shift = SIZE / sr;
  const out: number[] = [];
  const gap = Math.round(0.12 * o.fps);
  for (let i = 1; i < o.env.length - 1; i++) {
    if (o.env[i] < 0.25 || o.env[i] < o.env[i - 1] || o.env[i] < o.env[i + 1]) continue;
    if (out.length && i - out[out.length - 1] < gap) {
      if (o.env[i] > o.env[out[out.length - 1]]) out[out.length - 1] = i;
      continue;
    }
    out.push(i);
  }
  return out.map((f) => Math.max(0, frameTime(f, o.fps) - shift));
}

export interface CrowdBeats {
  bpm: number;
  beats: number[];
  /** how clearly a strike was heard at each beat, 0–1 (low where the crowd was silent: a verse, a pause) */
  strength: number[];
}

/** The crowd's beats in a majlis recording. */
export function hearCrowd(channels: Float32Array[], sr: number): CrowdBeats {
  const x = channels.length === 1 ? channels[0] : channels[0].map((v, i) => (v + channels[1][i]) / 2);
  const o = onsetStrength(x, sr);
  const bpm = crowdTempo(o);
  const beats = trackBeats(o, bpm);
  const strength = beats.map((t) => {
    const f = timeFrame(t, o.fps);
    let m = 0;
    for (let i = Math.max(0, f - 2); i <= Math.min(o.env.length - 1, f + 2); i++) m = Math.max(m, o.env[i]);
    return m;
  });
  return { bpm, beats, strength };
}

/**
 * The beats where the crowd is actually striking: a beat counts when a strike was heard on it — or, a single weak
 * strike between two clear ones, so one soft hand does not break the run. A verse sung with no latm stays clear.
 */
export function struckBeats(c: CrowdBeats, threshold = 0.1): number[] {
  const strong = c.strength.map((v) => v >= threshold);
  return c.beats.filter((_, i) => strong[i] || (i > 0 && i < c.beats.length - 1 && strong[i - 1] && strong[i + 1]));
}

export interface LayOptions {
  /** every beat (1) or every other beat (2) */
  every: 1 | 2;
  /** which beat to start on (0 or 1 when every other) */
  phase: number;
  /** a nudge in ms: + later, − earlier (a crowd that leans early or late) */
  nudgeMs: number;
  /** the placed latma's level, dB */
  gainDb: number;
}

/**
 * The chosen latma laid on the beats, as a new sound as long as the majlis recording. A single strike goes on every
 * chosen beat; a pattern's strikes are taken in turn, each cut from its own strike to the next and fitted to the gap
 * to the next beat (stretched or squeezed without changing its note when the crowd is faster or slower than the
 * pattern), so a «لطمتين وسكتة» keeps its shape at the crowd's speed.
 */
export function layLatma(len: number, sr: number, beats: number[], latma: Float32Array[], o: LayOptions): { channels: Float32Array[]; placed: number } {
  const width = Math.max(1, Math.min(2, latma.length));
  const out = Array.from({ length: width }, () => new Float32Array(len));
  const k = 10 ** (o.gainDb / 20);
  const chosen = beats.filter((_, i) => (o.every === 1 ? true : i % 2 === (o.phase % 2)));
  const strikes = strikesIn(latma[0], sr);
  const latLen = latma[0].length;
  // the pieces: one per strike (from just before it to just before the next), or the whole sound when it is one strike
  const pre = Math.round(0.006 * sr);
  const cuts = strikes.length > 1 ? strikes.map((t) => Math.max(0, Math.round(t * sr) - pre)) : [Math.max(0, Math.round((strikes[0] ?? 0) * sr) - pre)];
  const pieces = cuts.map((a, i) => {
    const b = i + 1 < cuts.length ? cuts[i + 1] : latLen;
    return latma.map((ch) => ch.subarray(a, b));
  });
  const nudge = Math.round((o.nudgeMs / 1000) * sr);
  let placed = 0;
  for (let i = 0; i < chosen.length; i++) {
    let piece = pieces[i % pieces.length];
    const at = Math.round(chosen[i] * sr) - pre + nudge;
    if (pieces.length > 1 && i + 1 < chosen.length) {
      // a pattern's piece fills the gap to the next beat: fitted when the crowd's gap differs by more than 3 %
      const gap = Math.round((chosen[i + 1] - chosen[i]) * sr);
      const ratio = piece[0].length / gap;
      if (gap > 0 && Math.abs(ratio - 1) > 0.03 && ratio > 0.5 && ratio < 2) piece = changeSpeed(piece.map((c) => c.slice()), ratio, sr);
    }
    const plen = piece[0].length;
    // a short fade at the piece's end so the cut does not click
    const fade = Math.min(plen, Math.round(0.008 * sr));
    for (let c = 0; c < width; c++) {
      const src = piece[Math.min(c, piece.length - 1)];
      for (let j = 0; j < plen; j++) {
        const t = at + j;
        if (t < 0 || t >= len) continue;
        const f = j >= plen - fade ? (plen - j) / fade : 1;
        out[c][t] += src[j] * k * f;
      }
    }
    placed++;
  }
  return { channels: out, placed };
}
