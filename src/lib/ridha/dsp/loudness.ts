// «الرضا فويس» — loudness the way broadcasters and streaming platforms measure it (ITU-R BS.1770 / EBU R128: LUFS),
// the gain that brings a sound to a target, and a look-ahead limiter that keeps the peaks under a ceiling.

import { dbToGain, filter, type Coefs } from "./biquad";

// the standard's K-weighting, as two filters at 48 kHz: a shelf for the head's effect, then a low cut
const SHELF: Coefs = { b0: 1.53512485958697, b1: -2.69169618940638, b2: 1.19839281085285, a1: -1.69065929318241, a2: 0.73248077421585 };
const LOWCUT: Coefs = { b0: 1, b1: -2, b2: 1, a1: -1.99004745483398, a2: 0.99007225036621 };

/** Integrated loudness in LUFS of 48 kHz channels (−Infinity for silence). */
export function loudness(channels: Float32Array[], sr = 48000): number {
  const block = Math.round(sr * 0.4), hop = Math.round(sr * 0.1);
  const weighted = channels.map((c) => filter(filter(c, SHELF), LOWCUT));
  const len = weighted[0]?.length ?? 0;
  const powers: number[] = [];
  for (let at = 0; at + block <= len; at += hop) {
    let p = 0;
    for (const ch of weighted) {
      let s = 0;
      for (let i = at; i < at + block; i++) s += ch[i] * ch[i];
      p += s / block;
    }
    powers.push(p);
  }
  if (!powers.length) {
    // shorter than one block: measured whole
    let p = 0;
    for (const ch of weighted) {
      let s = 0;
      for (let i = 0; i < len; i++) s += ch[i] * ch[i];
      p += len ? s / len : 0;
    }
    return p > 0 ? -0.691 + 10 * Math.log10(p) : -Infinity;
  }
  const lufs = (p: number) => -0.691 + 10 * Math.log10(p);
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  // silence is not counted (−70), nor what lies 10 below the rest
  const loud = powers.filter((p) => p > 0 && lufs(p) > -70);
  if (!loud.length) return -Infinity;
  const rel = lufs(mean(loud)) - 10;
  const kept = loud.filter((p) => lufs(p) > rel);
  return kept.length ? lufs(mean(kept)) : -Infinity;
}

export function peakDb(channels: Float32Array[]): number {
  let p = 0;
  for (const ch of channels) for (let i = 0; i < ch.length; i++) if (Math.abs(ch[i]) > p) p = Math.abs(ch[i]);
  return p > 0 ? 20 * Math.log10(p) : -Infinity;
}

/** Peaks held under `ceilingDb`: the gain dips just before a peak arrives and recovers after it (the channels move together). */
export function limit(channels: Float32Array[], sr: number, ceilingDb = -1): Float32Array[] {
  const ceil = dbToGain(ceilingDb);
  const len = channels[0]?.length ?? 0;
  const ahead = Math.round(sr * 0.004);
  const rel = Math.exp(-1 / (sr * 0.08));
  const need = new Float32Array(len).fill(1);
  for (let i = 0; i < len; i++) {
    let a = 0;
    for (const ch of channels) a = Math.max(a, Math.abs(ch[i]));
    if (a > ceil) need[i] = ceil / a;
  }
  // each sample takes the lowest gain needed in the next few ms, approached smoothly
  const g = new Float32Array(len);
  let cur = 1;
  for (let i = len - 1, min = 1; i >= 0; i--) {
    min = Math.min(need[i], min + (1 - min) / ahead);
    g[i] = min;
  }
  for (let i = 0; i < len; i++) {
    cur = g[i] < cur ? g[i] : Math.min(g[i], rel * cur + (1 - rel) * 1);
    g[i] = Math.min(cur, g[i]);
  }
  return channels.map((ch) => {
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) out[i] = ch[i] * g[i];
    return out;
  });
}

/** The channels brought to `targetLufs`, their peaks limited at `ceilingDb`. Silence is returned as it is. */
export function normalizeLoudness(channels: Float32Array[], sr: number, targetLufs: number, ceilingDb = -1): { channels: Float32Array[]; before: number; gainDb: number } {
  const before = loudness(channels, sr);
  if (!Number.isFinite(before)) return { channels, before, gainDb: 0 };
  const gainDb = Math.max(-30, Math.min(30, targetLufs - before));
  const k = dbToGain(gainDb);
  const scaled = channels.map((ch) => {
    const o = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) o[i] = ch[i] * k;
    return o;
  });
  return { channels: limit(scaled, sr, ceilingDb), before, gainDb };
}

/** The loudest peak brought to `peakDbTarget`. */
export function normalizePeak(channels: Float32Array[], peakDbTarget = -1): Float32Array[] {
  const p = peakDb(channels);
  if (!Number.isFinite(p)) return channels;
  const k = dbToGain(peakDbTarget - p);
  return channels.map((ch) => {
    const o = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) o[i] = ch[i] * k;
    return o;
  });
}
