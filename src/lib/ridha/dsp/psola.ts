// «الرضا فويس» — moves a voice's note without changing its length or its character (TD-PSOLA): the voice is cut
// into its own pulses, one per vibration of the vocal cords, and the pulses are laid down again closer together
// (higher) or further apart (lower). The mouth's resonances ride inside each pulse, so the singer still sounds like
// themselves. The auto-tune, the voice key change and the harmony voices all go through here.

import { biquad, filterZeroPhase } from "./biquad";
import type { PitchTrack } from "./pitch";

/** Where each pulse of the voice sits (in samples); between sung notes a mark every 5 ms keeps the sound as it is. */
export function pitchMarks(x: Float32Array, t: PitchTrack): Float64Array {
  const sr = t.sr;
  // peaks are picked on a copy with only the low part of the voice: one clear bump per vibration
  const lp = filterZeroPhase(x, biquad("lowpass", sr, 700));
  const still = Math.round(sr / 200);
  const marks: number[] = [0];
  const f0At = (s: number) => t.f0[Math.min(t.f0.length - 1, Math.max(0, Math.round(s / t.hop)))] ?? 0;
  let pos = 0;
  let locked = false;
  while (pos < x.length - 1) {
    const hz = f0At(pos);
    if (!hz) {
      pos += still;
      locked = false;
    } else {
      const P = sr / hz;
      // the first pulse of a note is looked for over a whole period; the following ones close to where they are due
      const from = Math.round(pos + (locked ? 0.8 : 0.5) * P);
      const to = Math.round(pos + (locked ? 1.2 : 1.5) * P);
      let best = from;
      for (let i = from; i <= to && i < lp.length; i++) if (lp[i] > lp[best]) best = i;
      pos = Math.max(pos + 1, Math.min(best, x.length - 1));
      locked = true;
    }
    if (pos < x.length) marks.push(pos);
  }
  return Float64Array.from(marks);
}

/**
 * The sound with its note multiplied by `ratio(frame)` at each reading of the pitch track (1 = untouched, 2 = an
 * octave up). `formant` scales the pulses themselves: above 1 a smaller, brighter throat; below 1 a bigger, darker one.
 * A ratio of 1 and a formant of 1 everywhere returns the very samples.
 */
export function psolaShift(x: Float32Array, t: PitchTrack, ratio: (frame: number) => number, formant = 1, marksIn?: Float64Array): Float32Array {
  const marks = marksIn ?? pitchMarks(x, t);
  const out = new Float32Array(x.length);
  const M = marks.length;
  if (M < 3) return x.slice();
  let i = 0;
  let ts = marks[0];
  while (ts < x.length && i < M) {
    while (i + 1 < M && Math.abs(marks[i + 1] - ts) <= Math.abs(marks[i] - ts)) i++;
    const m = marks[i];
    const left = i > 0 ? m - marks[i - 1] : marks[1] - marks[0];
    const right = i + 1 < M ? marks[i + 1] - m : left;
    const frame = Math.min(t.f0.length - 1, Math.round(ts / t.hop));
    const r = t.f0[frame] ? Math.max(0.25, Math.min(4, ratio(frame))) : 1;
    const sung = t.f0[frame] > 0;
    const fm = sung ? formant : 1;
    // fewer pulses a second carry less power, more carry more: each pulse is scaled so the loudness stays
    const g = r === 1 ? 1 : 1 / Math.sqrt(r);
    const L = left / fm, R = right / fm;
    const a = Math.max(0, Math.ceil(ts - L)), b = Math.min(x.length - 1, Math.floor(ts + R));
    for (let n = a; n <= b; n++) {
      const d = n - ts;
      const win = d < 0 ? 0.5 + 0.5 * Math.cos((Math.PI * d) / L) : 0.5 + 0.5 * Math.cos((Math.PI * d) / R);
      const p = m + d * fm;
      const k = Math.floor(p);
      if (k < 0 || k + 1 >= x.length) continue;
      const f = p - k;
      out[n] += (x[k] * (1 - f) + x[k + 1] * f) * win * g;
    }
    ts += Math.max(1, right / r);
  }
  return out;
}
