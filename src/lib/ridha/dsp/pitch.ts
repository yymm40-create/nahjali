// «الرضا فويس» — hears the note a voice is singing, a hundred times a second (the YIN method: the lag at which the
// sound best repeats itself). Everything that tunes, finds the key or writes a harmony reads this track.

import { breathe, type Progress } from "./fft";

export interface PitchTrack {
  /** the sound's sample rate */
  sr: number;
  /** samples between two readings */
  hop: number;
  /** the note in Hz at each reading; 0 where there is no sung note (silence, breath, consonants) */
  f0: Float32Array;
}

export const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);
export const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

const THRESHOLD = 0.15;
/** below this level (about −52 dB) a frame is silence */
const SILENCE = 0.0025;

export async function trackPitch(x: Float32Array, sr: number, opts: { fmin?: number; fmax?: number; onProgress?: Progress } = {}): Promise<PitchTrack> {
  const fmin = opts.fmin ?? 65;
  const fmax = opts.fmax ?? 1000;
  // the note is found on a smaller copy of the sound (about 16 kHz): the same answer, many times faster
  const D = Math.max(1, Math.round(sr / 16000));
  const srd = sr / D;
  const n = Math.floor(x.length / D);
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < D; j++) s += x[i * D + j];
    d[i] = s / D;
  }
  const tauMax = Math.ceil(srd / fmin);
  const tauMin = Math.max(2, Math.floor(srd / fmax));
  const W = tauMax * 2;
  const hopD = Math.max(1, Math.round(srd / 100));
  const frames = Math.max(0, Math.floor((n - W - tauMax) / hopD) + 1);
  const f0 = new Float32Array(Math.ceil(x.length / (hopD * D)) + 1);
  const diff = new Float32Array(tauMax + 1);
  const cmnd = new Float32Array(tauMax + 1);
  // a frame's reading belongs to the middle of its window
  const lead = Math.round(W / 2 / hopD);
  for (let f = 0; f < frames; f++) {
    const at = f * hopD;
    let energy = 0;
    for (let j = 0; j < W; j++) energy += d[at + j] * d[at + j];
    let hz = 0;
    if (Math.sqrt(energy / W) > SILENCE) {
      for (let tau = 1; tau <= tauMax; tau++) {
        let s = 0;
        for (let j = 0; j < W; j++) {
          const e = d[at + j] - d[at + j + tau];
          s += e * e;
        }
        diff[tau] = s;
      }
      cmnd[0] = 1;
      let run = 0;
      for (let tau = 1; tau <= tauMax; tau++) {
        run += diff[tau];
        cmnd[tau] = run > 0 ? (diff[tau] * tau) / run : 1;
      }
      let best = -1;
      for (let tau = tauMin; tau < tauMax; tau++) {
        if (cmnd[tau] < THRESHOLD) {
          while (tau + 1 < tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;
          best = tau;
          break;
        }
      }
      if (best > 0) {
        // the true dip lies between samples: a parabola through the three around it
        const a = cmnd[best - 1], b = cmnd[best], c = cmnd[best + 1];
        const den = a - 2 * b + c;
        const shift = den !== 0 ? (0.5 * (a - c)) / den : 0;
        hz = srd / (best + Math.max(-1, Math.min(1, shift)));
      }
    }
    if (f + lead < f0.length) f0[f + lead] = hz;
    if (f % 600 === 599) {
      opts.onProgress?.(f / frames);
      await breathe();
    }
  }
  return { sr, hop: hopD * D, f0: clean(f0) };
}

/** Octave jumps of a frame or two are mended from their neighbours, and sung islands shorter than 30 ms are dropped. */
function clean(f0: Float32Array): Float32Array {
  const out = f0.slice();
  const win: number[] = [];
  for (let i = 0; i < f0.length; i++) {
    if (!f0[i]) continue;
    win.length = 0;
    for (let j = i - 2; j <= i + 2; j++) if (j >= 0 && j < f0.length && f0[j]) win.push(f0[j]);
    if (win.length >= 3) {
      win.sort((a, b) => a - b);
      const med = win[win.length >> 1];
      if (Math.abs(Math.log2(f0[i] / med)) > 0.4) out[i] = med;
    }
  }
  for (let i = 0; i < out.length; ) {
    if (!out[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < out.length && out[j]) j++;
    if (j - i < 3) out.fill(0, i, j);
    i = j;
  }
  return out;
}

/** The lowest, highest and middle sung notes (MIDI numbers) and how much of the sound is sung at all. */
export function pitchStats(t: PitchTrack) {
  const m: number[] = [];
  for (const hz of t.f0) if (hz) m.push(hzToMidi(hz));
  if (!m.length) return { voiced: 0, low: 0, high: 0, median: 0 };
  m.sort((a, b) => a - b);
  return { voiced: m.length / t.f0.length, low: m[Math.floor(m.length * 0.03)], high: m[Math.floor(m.length * 0.97)], median: m[m.length >> 1] };
}
