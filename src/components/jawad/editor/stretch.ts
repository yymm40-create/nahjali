// «حيدرة كت» — faster or slower sound that keeps its pitch (a voice at ×1.5 still sounds like the person, not a
// cartoon). WSOLA — the method browsers use for their own speed button: short overlapping windows of the source, each
// placed where it continues the previous one best. At ×1 the sound is copied exactly, untouched.

/** The window: about 23 ms of sound (1024 samples at 44.1/48 kHz, 2048 at 88.2/96 kHz). */
const windowFor = (sr: number) => (sr > 64_000 ? 2048 : sr < 32_000 ? 512 : 1024);

const windows = new Map<number, Float32Array>();
const hann = (n: number) => {
  let w = windows.get(n);
  if (!w) {
    w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
    windows.set(n, w);
  }
  return w;
};

/**
 * Plays `channels` from sample `from` at `speed` × and returns `outLen` samples per channel. The source must hold
 * about `outLen × speed + 2 × window` samples after `from` (fewer: the end is silent). `sr` is the sample rate (it
 * sizes the window; 48 kHz when not given).
 */
export function stretch(channels: Float32Array[], from: number, speed: number, outLen: number, sr = 48_000): Float32Array[] {
  const len = channels[0]?.length ?? 0;
  if (speed === 1) {
    // nothing to stretch: the very samples, so ×1 never loses a thing
    return channels.map((ch) => {
      const o = new Float32Array(outLen);
      o.set(ch.subarray(Math.max(0, from), Math.max(0, from) + outLen));
      return o;
    });
  }
  const N = windowFor(sr);
  const HOP = N / 2;
  // how far a window may move to line up with the last one (about ±5 ms), and how finely that is searched
  const TOLERANCE = N / 4;
  const STEP = Math.max(1, N / 256);
  const w = hann(N);
  const out = channels.map(() => new Float32Array(outLen + N));
  const norm = new Float32Array(outLen + N);
  const mono = new Float32Array(len);
  for (const ch of channels) for (let i = 0; i < len; i++) mono[i] += ch[i] / channels.length;

  let prev = -1;
  for (let o = 0; o < outLen; o += HOP) {
    let pos = Math.round(from + o * speed);
    if (prev >= 0) {
      // the natural continuation of the last window, and the nearby window that matches it best — matched by shape
      // (normalised), not by loudness, so a louder spot nearby never wins over the right one
      const nat = prev + HOP;
      let best = 0;
      let score = -Infinity;
      for (let d = -TOLERANCE; d <= TOLERANCE; d += STEP) {
        const p = pos + d;
        if (p < 0 || p + N > len || nat + N > len) continue;
        let sc = 0;
        let en = 0;
        for (let i = 0; i < N; i += STEP) {
          const v = mono[p + i];
          sc += mono[nat + i] * v;
          en += v * v;
        }
        const s = en > 1e-12 ? sc / Math.sqrt(en) : sc;
        if (s > score) {
          score = s;
          best = d;
        }
      }
      pos += best;
    }
    pos = Math.max(0, Math.min(pos, len - N));
    if (pos < 0) break;
    for (let c = 0; c < channels.length; c++) {
      const src = channels[c];
      const dst = out[c];
      for (let i = 0; i < N; i++) dst[o + i] += (src[pos + i] ?? 0) * w[i];
    }
    for (let i = 0; i < N; i++) norm[o + i] += w[i];
    prev = pos;
  }
  for (const dst of out) for (let i = 0; i < outLen; i++) if (norm[i] > 1e-3) dst[i] /= norm[i];
  return out.map((a) => a.subarray(0, outLen));
}
