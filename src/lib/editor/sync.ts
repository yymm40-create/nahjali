// «حيدرة كت» — «زامن الصوت»: two recordings of the same moment (a camera and a phone, a camera and a microphone track) are
// lined up by their sound. Pure maths on mono samples (browser and tests); the browser side reads the files.
//
// 1) the loudness of each file every 5 ms is compared at every possible shift at once (FFT cross-correlation): the shift where
//    the rises and falls of the two sounds fit best is the answer, to within a few milliseconds;
// 2) around that shift the sound waves themselves are compared (±40 ms), which brings it to a fraction of a frame.
// A shift is trusted only when its peak stands far above all the other shifts; otherwise the answer says so instead of guessing.

export interface Found {
  /** seconds: a moment that is at time t in the first file is at time t + lag in the second */
  lag: number;
  /** how far the best shift stands above the others (a z-score); ≥ HIGH is trustworthy */
  z: number;
  confidence: "high" | "low" | "none";
}

export const ENV_RATE = 200; // loudness values per second
export const HIGH = 7.5;
export const LOW = 5.5;

function fft(re: Float64Array, im: Float64Array, inverse: boolean) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) {
    re[i] /= n;
    im[i] /= n;
  }
}

/** c[l] = Σ a[t]·b[t+l] for every shift l from −(a.length−1) to b.length−1, as `get(l)`. */
export function crossCorrelate(a: ArrayLike<number>, b: ArrayLike<number>) {
  let n = 1;
  while (n < a.length + b.length) n <<= 1;
  const ar = new Float64Array(n);
  const ai = new Float64Array(n);
  const br = new Float64Array(n);
  const bi = new Float64Array(n);
  for (let i = 0; i < a.length; i++) ar[i] = a[i];
  for (let i = 0; i < b.length; i++) br[i] = b[i];
  fft(ar, ai, false);
  fft(br, bi, false);
  // conj(A)·B
  for (let i = 0; i < n; i++) {
    const r = ar[i] * br[i] + ai[i] * bi[i];
    const im = ar[i] * bi[i] - ai[i] * br[i];
    ar[i] = r;
    ai[i] = im;
  }
  fft(ar, ai, true);
  return { get: (l: number) => ar[((l % n) + n) % n], min: -(a.length - 1), max: b.length - 1 };
}

/** The loudness (log of the mean level) of mono samples every 1/ENV_RATE s, with the slow level taken out (only the rises and falls remain). */
export function envelope(x: Float32Array, rate: number): Float32Array {
  const per = Math.max(1, Math.round(rate / ENV_RATE));
  const n = Math.floor(x.length / per);
  const e = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    let s = 0;
    for (let i = k * per; i < (k + 1) * per; i++) s += Math.abs(x[i]);
    e[k] = Math.log(1e-4 + s / per);
  }
  // minus a one-second running mean
  const w = ENV_RATE;
  const out = new Float32Array(n);
  let sum = 0;
  const pre = new Float64Array(n + 1);
  for (let k = 0; k < n; k++) {
    sum += e[k];
    pre[k + 1] = sum;
  }
  for (let k = 0; k < n; k++) {
    const a = Math.max(0, k - w / 2);
    const b = Math.min(n, k + w / 2);
    out[k] = e[k] - (pre[b] - pre[a]) / (b - a);
  }
  return out;
}

/** The best shift of the loudness curves, in envelope steps, and how convincing it is. */
export function envelopeLag(ea: Float32Array, eb: Float32Array) {
  const c = crossCorrelate(ea, eb);
  // only shifts where the two overlap by at least a good part of the shorter one (a sliver of overlap proves nothing)
  const need = Math.min(ENV_RATE * 3, Math.floor(Math.min(ea.length, eb.length) * 0.2));
  const lo = c.min + need;
  const hi = c.max - need;
  if (hi <= lo) return null;
  let best = lo;
  let bv = -Infinity;
  let sum = 0;
  let sq = 0;
  for (let l = lo; l <= hi; l++) {
    const v = c.get(l);
    sum += v;
    sq += v * v;
    if (v > bv) {
      bv = v;
      best = l;
    }
  }
  const n = hi - lo + 1;
  const mean = sum / n;
  const sd = Math.sqrt(Math.max(1e-12, sq / n - mean * mean));
  return { lag: best, z: (bv - mean) / sd };
}

/** Pre-emphasis: the rumble and hum are taken away so the comparison looks at the voice's detail. */
const emphasise = (x: Float32Array) => {
  const y = new Float32Array(x.length);
  for (let i = 1; i < x.length; i++) y[i] = x[i] - 0.95 * x[i - 1];
  return y;
};

/** Around a coarse shift (seconds), compares the waves themselves ±`span` seconds; null when they do not resemble each other. */
export function refineLag(a: Float32Array, b: Float32Array, rate: number, coarse: number, span = 0.04, windowSec = 20): number | null {
  const ha = emphasise(a);
  const hb = emphasise(b);
  const shift = Math.round(coarse * rate);
  const reach = Math.ceil(span * rate);
  // the part of `a` whose partner lies inside `b` (with room for the search)
  const from = Math.max(0, -shift + reach);
  const to = Math.min(a.length, b.length - shift - reach);
  if (to - from < rate) return null;
  // the loudest `windowSec` of it
  const win = Math.min(to - from, Math.round(windowSec * rate));
  const step = Math.max(1, Math.round(rate / 4));
  let start = from;
  let best = -1;
  for (let s = from; s + win <= to; s += step) {
    let e = 0;
    for (let i = s; i < s + win; i += 16) e += ha[i] * ha[i];
    if (e > best) {
      best = e;
      start = s;
    }
  }
  let ea = 0;
  for (let i = start; i < start + win; i++) ea += ha[i] * ha[i];
  let top = { d: 0, v: -Infinity, eb: 1 };
  for (let d = -reach; d <= reach; d++) {
    let s = 0;
    let eb = 0;
    const off = start + shift + d;
    for (let i = 0; i < win; i++) {
      const y = hb[off + i];
      s += ha[start + i] * y;
      eb += y * y;
    }
    if (s > top.v) top = { d, v: s, eb };
  }
  const ncc = top.v / Math.sqrt(Math.max(1e-12, ea * top.eb));
  return ncc >= 0.15 ? coarse + top.d / rate : null;
}

/** The shift between two mono sounds at `rate` Hz (the same rate for both). */
export function findLag(a: Float32Array, b: Float32Array, rate: number): Found {
  const r = envelopeLag(envelope(a, rate), envelope(b, rate));
  if (!r) return { lag: 0, z: 0, confidence: "none" };
  const coarse = r.lag / ENV_RATE;
  const confidence = r.z >= HIGH ? "high" : r.z >= LOW ? "low" : "none";
  if (confidence === "none") return { lag: coarse, z: r.z, confidence };
  const fine = refineLag(a, b, rate, coarse);
  return { lag: fine ?? coarse, z: r.z, confidence };
}

export interface SyncClip {
  id: string;
  start: number;
  in: number;
  speed: number;
}

/**
 * Where `other` must start (ms on the timeline) so that its sound lands on `anchor`'s, given that the moment at the file time t of
 * the anchor's file is at t + lagMs in the other's file.
 */
export function syncedStart(anchor: SyncClip, other: SyncClip, lagMs: number): number {
  const sb = other.speed || 1;
  // the anchor's file time `anchor.in` (its first frame on the timeline) is at `anchor.in + lagMs` in the other's file
  return Math.round(anchor.start - (anchor.in + lagMs - other.in) / sb);
}
