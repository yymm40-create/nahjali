// JAWAD AI — mixes sound effects into one track of an exact length, as 16-bit mono WAV. Pure (no I/O).
// Used by «مؤثرات من فيديو»: each effect is placed at its moment; the background fills the whole track.

export interface MixClip {
  /** Mono samples in −1…1 at `rate`. */
  samples: Float32Array;
  rate: number;
  /** Where the clip starts in the track (seconds). */
  at: number;
  /** Loudness, 0–1. */
  gain: number;
  /** An effect: its sound starts where it is placed (silence the generator put before it is cut away). */
  trimLead?: boolean;
  /** The background: repeated until the end of the track. */
  loop?: boolean;
  /** Seconds of fade when the clip reaches the end of the track (a short one by default; music fades out gently). */
  fadeOut?: number;
}

/** Linear resampling (the generator's 24 or 48 kHz to the track's rate). */
export function resample(x: Float32Array, from: number, to: number): Float32Array {
  if (from === to || !x.length) return x;
  const n = Math.max(1, Math.round((x.length * to) / from));
  const out = new Float32Array(n);
  const step = from / to;
  for (let i = 0; i < n; i++) {
    const p = i * step;
    const j = Math.floor(p);
    const a = x[Math.min(j, x.length - 1)];
    const b = x[Math.min(j + 1, x.length - 1)];
    out[i] = a + (b - a) * (p - j);
  }
  return out;
}

/** Index of the first sample of the sound itself (above about −34 dBFS), within its first second; 5 ms of lead kept. */
export function soundStart(x: Float32Array, rate: number, threshold = 0.02) {
  const limit = Math.min(x.length, rate);
  for (let i = 0; i < limit; i++) if (Math.abs(x[i]) >= threshold) return Math.max(0, i - Math.round(rate * 0.005));
  return 0;
}

/**
 * The track: `durationMs` long at `rate`. Short fades remove clicks where a clip starts, or is cut by the end of the
 * track; the background fades in and out gently. The result is brought to a −1 dBFS peak when it would clip, or raised
 * (×3 at most) when it is very quiet.
 */
export function mixTrack(clips: MixClip[], durationMs: number, rate = 48_000): Float32Array {
  const n = Math.max(1, Math.round((durationMs / 1000) * rate));
  const mix = new Float32Array(n);
  for (const c of clips) {
    let x = resample(c.samples, c.rate, rate);
    if (c.trimLead) x = x.subarray(soundStart(x, rate));
    if (!x.length) continue;
    const start = Math.max(0, Math.round(c.at * rate));
    const end = c.loop ? n : Math.min(n, start + x.length);
    const len = end - start;
    if (len <= 0) continue;
    const fadeIn = Math.min(len, Math.round(rate * (c.loop ? 0.3 : 0.004)));
    // Reaching the end of the track (cut by it, or ending right on it): faded out
    const cut = !c.loop && start + x.length >= n;
    const fadeOut = Math.min(len, Math.round(rate * (c.loop ? 0.4 : cut ? (c.fadeOut ?? 0.03) : 0.004)));
    for (let i = 0; i < len; i++) {
      let g = c.gain;
      if (i < fadeIn) g *= i / fadeIn;
      if (i >= len - fadeOut) g *= (len - i) / fadeOut;
      mix[start + i] += x[i % x.length] * g;
    }
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(mix[i]));
  const target = 0.89;
  const gain = peak > target ? target / peak : peak > 0 && peak < 0.25 ? Math.min(3, 0.7 / peak) : 1;
  if (gain !== 1) for (let i = 0; i < n; i++) mix[i] *= gain;
  return mix;
}

/** 16-bit PCM mono WAV. */
export function wav(samples: Float32Array, rate: number): Buffer {
  const data = samples.length * 2;
  const b = Buffer.alloc(44 + data);
  b.write("RIFF", 0, "ascii");
  b.writeUInt32LE(36 + data, 4);
  b.write("WAVE", 8, "ascii");
  b.write("fmt ", 12, "ascii");
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); // PCM
  b.writeUInt16LE(1, 22); // mono
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36, "ascii");
  b.writeUInt32LE(data, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    b.writeInt16LE(Math.round(v < 0 ? v * 32768 : v * 32767), 44 + i * 2);
  }
  return b;
}
