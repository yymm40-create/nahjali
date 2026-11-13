// «الرضا فويس» — the Fourier transform every spectral tool here stands on (the spectrum view, noise removal, the
// room-echo reducer, the music key finder). Radix-2, in place, tables built once per size.

export class FFT {
  readonly n: number;
  private readonly cos: Float32Array;
  private readonly sin: Float32Array;
  private readonly rev: Uint32Array;

  constructor(n: number) {
    if (n < 2 || (n & (n - 1)) !== 0) throw new Error("FFT size must be a power of two");
    this.n = n;
    this.cos = new Float32Array(n / 2);
    this.sin = new Float32Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / n);
      this.sin[i] = Math.sin((2 * Math.PI * i) / n);
    }
    this.rev = new Uint32Array(n);
    const bits = Math.log2(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
  }

  /** Forward transform of (re, im), in place. */
  forward(re: Float32Array, im: Float32Array) {
    this.run(re, im, false);
  }

  /** Inverse transform, in place, scaled by 1/n (forward then inverse gives the signal back). */
  inverse(re: Float32Array, im: Float32Array) {
    this.run(re, im, true);
    const k = 1 / this.n;
    for (let i = 0; i < this.n; i++) {
      re[i] *= k;
      im[i] *= k;
    }
  }

  private run(re: Float32Array, im: Float32Array, inv: boolean) {
    const { n, rev, cos, sin } = this;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        const tr = re[i];
        re[i] = re[j];
        re[j] = tr;
        const ti = im[i];
        im[i] = im[j];
        im[j] = ti;
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1;
      const step = n / size;
      for (let start = 0; start < n; start += size) {
        for (let k = 0, t = 0; k < half; k++, t += step) {
          const wr = cos[t];
          const wi = inv ? sin[t] : -sin[t];
          const a = start + k;
          const b = a + half;
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
      }
    }
  }
}

const windows = new Map<number, Float32Array>();
/** The periodic Hann window of length n (four of them a quarter apart add to a constant). */
export function hann(n: number): Float32Array {
  let w = windows.get(n);
  if (!w) {
    w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
    windows.set(n, w);
  }
  return w;
}

/** Lets the page breathe during a long job (and lets a progress bar move). */
export const breathe = () => new Promise<void>((r) => setTimeout(r, 0));
export type Progress = (done: number) => void;

/**
 * Runs `gain` on every frame of a short-time Fourier transform of `x` and returns the rebuilt sound: the frame's
 * magnitudes go in, a gain per bin comes out (written into `g`), the phases are kept. Frames are `size` long, a
 * quarter apart; the same Hann shapes the frame going in and coming out, and the sum of their squares divides the
 * result, so a gain of one everywhere returns the very sound.
 */
export async function stftGain(
  x: Float32Array,
  size: number,
  gain: (mag: Float32Array, g: Float32Array, frame: number) => void,
  onProgress?: Progress,
): Promise<Float32Array> {
  const hop = size / 4;
  const fft = new FFT(size);
  const w = hann(size);
  const bins = size / 2 + 1;
  const re = new Float32Array(size);
  const im = new Float32Array(size);
  const mag = new Float32Array(bins);
  const g = new Float32Array(bins);
  const out = new Float32Array(x.length);
  const norm = new Float32Array(x.length);
  const frames = Math.ceil((x.length + size) / hop);
  for (let f = 0; f < frames; f++) {
    const at = f * hop - size + hop;
    for (let i = 0; i < size; i++) {
      const k = at + i;
      re[i] = k >= 0 && k < x.length ? x[k] * w[i] : 0;
      im[i] = 0;
    }
    fft.forward(re, im);
    for (let b = 0; b < bins; b++) mag[b] = Math.hypot(re[b], im[b]);
    g.fill(1);
    gain(mag, g, f);
    for (let b = 0; b < bins; b++) {
      re[b] *= g[b];
      im[b] *= g[b];
      if (b > 0 && b < bins - 1) {
        re[size - b] = re[b];
        im[size - b] = -im[b];
      }
    }
    fft.inverse(re, im);
    for (let i = 0; i < size; i++) {
      const k = at + i;
      if (k >= 0 && k < x.length) {
        out[k] += re[i] * w[i];
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
