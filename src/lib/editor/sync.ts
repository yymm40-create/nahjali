// «حيدرة كت» — «زامن الصوت»: two recordings of the same moment (a camera and a phone, a camera and a microphone track) are
// lined up by their sound. Pure maths on mono samples (browser and tests); the browser side reads the files.
//
// 1) the loudness of each file every 5 ms is compared at every possible shift at once (FFT cross-correlation): the shift where
//    the rises and falls of the two sounds fit best is the answer, to within a few milliseconds;
// 2) around that shift the sound waves themselves are compared (±40 ms), which brings it to a fraction of a frame.
// A shift is trusted only when its peak stands far above all the other shifts. A sound on a beat (a poem, music) fits at every
// beat, so there the waves themselves choose among the tallest peaks (waveLag); when nothing stands out the answer says so
// instead of guessing.

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

/** How many of the tallest loudness peaks are kept as candidates (a rhythmic sound has one on every beat). */
const PEAKS = 10;

/**
 * The best shift of the loudness curves, in envelope steps, and how convincing it is; `peaks`: the tallest shifts (the
 * best first), each at least 0.15 s from the others.
 */
export function envelopeLag(ea: Float32Array, eb: Float32Array) {
  const c = crossCorrelate(ea, eb);
  // only shifts where the two overlap by at least a good part of the shorter one (a sliver of overlap proves nothing)
  const need = Math.min(ENV_RATE * 3, Math.floor(Math.min(ea.length, eb.length) * 0.2));
  const lo = c.min + need;
  const hi = c.max - need;
  if (hi <= lo) return null;
  const n = hi - lo + 1;
  const v = new Float64Array(n);
  let sum = 0;
  let sq = 0;
  for (let i = 0; i < n; i++) {
    const x = c.get(lo + i);
    v[i] = x;
    sum += x;
    sq += x * x;
  }
  const mean = sum / n;
  const sd = Math.sqrt(Math.max(1e-12, sq / n - mean * mean));
  const peaks: number[] = [];
  let top = 0;
  const apart = Math.round(ENV_RATE * 0.15);
  for (let k = 0; k < PEAKS; k++) {
    let bi = -1;
    for (let i = 0; i < n; i++) if (v[i] > -Infinity && (bi < 0 || v[i] > v[bi])) bi = i;
    if (bi < 0) break;
    peaks.push(lo + bi);
    if (k === 0) top = v[bi];
    for (let i = Math.max(0, bi - apart); i <= Math.min(n - 1, bi + apart); i++) v[i] = -Infinity;
  }
  return { lag: peaks[0], z: (top - mean) / sd, peaks };
}

/** Pre-emphasis: the rumble and hum are taken away so the comparison looks at the voice's detail. */
const emphasise = (x: Float32Array) => {
  const y = new Float32Array(x.length);
  for (let i = 1; i < x.length; i++) y[i] = x[i] - 0.95 * x[i - 1];
  return y;
};

/** The emphasised copy of a sound, kept while the sound is (a long master is compared with many clips). */
const emphasised = new WeakMap<Float32Array, Float32Array>();
const emph = (x: Float32Array) => {
  let y = emphasised.get(x);
  if (!y) emphasised.set(x, (y = emphasise(x)));
  return y;
};

/**
 * Around a coarse shift (seconds), compares the waves themselves ±`span` seconds over the loudest `windowSec` of `a`
 * that has a partner in `b`: the shift where they fit best, how alike they are there (`ncc`, 1 = the same wave) and
 * over how many seconds they were compared; null when the two do not overlap enough at that shift.
 */
export function compareWaves(a: Float32Array, b: Float32Array, rate: number, coarse: number, span = 0.04, windowSec = 20): { lag: number; ncc: number; sec: number } | null {
  const ha = emph(a);
  const hb = emph(b);
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
  return { lag: coarse + top.d / rate, ncc: top.v / Math.sqrt(Math.max(1e-12, ea * top.eb)), sec: win / rate };
}

/** Around a coarse shift (seconds), compares the waves themselves ±`span` seconds; null when they do not resemble each other. */
export function refineLag(a: Float32Array, b: Float32Array, rate: number, coarse: number, span = 0.04, windowSec = 20): number | null {
  const r = compareWaves(a, b, rate, coarse, span, windowSec);
  return r && r.ncc >= 0.15 ? r.lag : null;
}

/**
 * A wave match this alike is trusted outright; from WAVE_LOW up (over 20 s of sound; more is asked of a shorter
 * stretch, where chance alone reaches higher) it is trusted when no other beat comes near it. Two unrelated
 * recordings reach about 0.04 by chance.
 */
export const WAVE_HIGH = 0.12;
export const WAVE_LOW = 0.06;
/** …the best beat's waves must be this many times more alike than the next one's */
export const WAVE_LEAD = 2.5;

/**
 * A rhythmic sound (a poem on a beat, music): its loudness fits at every beat, so no shift stands far above the
 * others and the loudness alone cannot say which beat is the right one. The waves can: each of the tallest loudness
 * peaks is compared wave against wave, and the one whose waves really are alike — far more than at any other beat —
 * is the answer. Null when none stands out (two different recordings).
 */
export function waveLag(a: Float32Array, b: Float32Array, rate: number, peaks: number[]): { lag: number; ncc: number } | null {
  // the shorter sound is the one whose loudest part is looked for in the other
  const flip = b.length < a.length;
  const found: { lag: number; ncc: number; sec: number }[] = [];
  for (const p of peaks) {
    const coarse = p / ENV_RATE;
    const r = flip ? compareWaves(b, a, rate, -coarse) : compareWaves(a, b, rate, coarse);
    if (r) found.push({ lag: flip ? -r.lag : r.lag, ncc: r.ncc, sec: r.sec });
  }
  found.sort((x, y) => y.ncc - x.ncc);
  const best = found[0];
  if (!best || best.ncc < WAVE_LOW * Math.sqrt(20 / Math.max(1, Math.min(20, best.sec)))) return null;
  const next = found.find((f) => Math.abs(f.lag - best.lag) > 0.1)?.ncc ?? 0;
  return best.ncc >= WAVE_LEAD * Math.max(next, 1e-6) ? best : null;
}

/** The shift between two mono sounds at `rate` Hz (the same rate for both). */
export function findLag(a: Float32Array, b: Float32Array, rate: number): Found {
  const r = envelopeLag(envelope(a, rate), envelope(b, rate));
  if (!r) return { lag: 0, z: 0, confidence: "none" };
  const coarse = r.lag / ENV_RATE;
  const confidence = r.z >= HIGH ? "high" : r.z >= LOW ? "low" : "none";
  if (confidence === "none") {
    // no shift stands out by loudness (a sound on a beat fits at every beat): let the waves choose among the beats
    const w = waveLag(a, b, rate, r.peaks);
    return w ? { lag: w.lag, z: r.z, confidence: w.ncc >= WAVE_HIGH ? "high" : "low" } : { lag: coarse, z: r.z, confidence };
  }
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
