// «الممنتج الذكي» — faster or slower sound that keeps its pitch (a voice at ×1.5 still sounds like the person, not a
// cartoon). WSOLA: short overlapping windows of the source, each placed where it continues the previous one best.

const N = 1024;
const HOP = N / 2;
const TOLERANCE = 256;
const STEP = 8;

let window: Float32Array | null = null;
const hann = () => {
  if (!window) {
    window = new Float32Array(N);
    for (let i = 0; i < N; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  }
  return window;
};

/**
 * Plays `channels` from sample `from` at `speed` × and returns `outLen` samples per channel. The source must hold
 * about `outLen × speed + 2 × N` samples after `from` (fewer: the end is silent).
 */
export function stretch(channels: Float32Array[], from: number, speed: number, outLen: number): Float32Array[] {
  const len = channels[0]?.length ?? 0;
  const w = hann();
  const out = channels.map(() => new Float32Array(outLen + N));
  const norm = new Float32Array(outLen + N);
  const mono = new Float32Array(len);
  for (const ch of channels) for (let i = 0; i < len; i++) mono[i] += ch[i] / channels.length;

  let prev = -1;
  for (let o = 0; o < outLen; o += HOP) {
    let pos = Math.round(from + o * speed);
    if (prev >= 0) {
      // the natural continuation of the last window, and the nearby window that matches it best
      const nat = prev + HOP;
      let best = 0;
      let score = -Infinity;
      for (let d = -TOLERANCE; d <= TOLERANCE; d += STEP) {
        const p = pos + d;
        if (p < 0 || p + N > len || nat + N > len) continue;
        let sc = 0;
        for (let i = 0; i < N; i += STEP) sc += mono[nat + i] * mono[p + i];
        if (sc > score) {
          score = sc;
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
