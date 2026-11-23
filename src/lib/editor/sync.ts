// «حيدرة كت» — «زامن الصوت»: two recordings of the same moment (a camera and a phone, a camera and a microphone track) are
// lined up by their sound. Pure maths on mono samples (browser and tests); the browser side reads the files.
//
// 1) the loudness of each file every 5 ms is compared at every possible shift at once (FFT cross-correlation): the shift where
//    the rises and falls of the two sounds fit best is the answer, to within a few milliseconds;
// 2) around that shift the sound waves themselves are compared (±40 ms), which brings it to a fraction of a frame.
// A shift is trusted only when its peak stands far above all the other shifts. A sound on a beat (a poem, music) fits at every
// beat, so there the waves themselves choose among the tallest peaks (waveLag).
// 3) a camera in a room (echo, people reciting along, a clock a thousandth off) no longer has the master's waves: the two
//    sounds' pictures — energy across 24 pitch bands, 100 times a second — are slid over each other (spectroLag); a place is
//    believed when it stands out, or when the clip's two halves each land on it on their own (halvesAgree), and is then set to
//    the millisecond by where the sounds rise (refineOnsets).
// When nothing stands out the answer says so instead of guessing.

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
export function waveLag(a: Float32Array, b: Float32Array, rate: number, peaks: number[], per = ENV_RATE): { lag: number; ncc: number } | null {
  // the shorter sound is the one whose loudest part is looked for in the other
  const flip = b.length < a.length;
  const found: { lag: number; ncc: number; sec: number }[] = [];
  for (const p of peaks) {
    const coarse = p / per;
    const r = flip ? compareWaves(b, a, rate, -coarse) : compareWaves(a, b, rate, coarse);
    if (r) found.push({ lag: flip ? -r.lag : r.lag, ncc: r.ncc, sec: r.sec });
  }
  found.sort((x, y) => y.ncc - x.ncc);
  const best = found[0];
  if (!best || best.ncc < WAVE_LOW * Math.sqrt(20 / Math.max(1, Math.min(20, best.sec)))) return null;
  const next = found.find((f) => Math.abs(f.lag - best.lag) > 0.1)?.ncc ?? 0;
  return best.ncc >= WAVE_LEAD * Math.max(next, 1e-6) ? best : null;
}

// ---------- the spectrum's picture ----------
// A camera in a room hears the master through echoes, with people reciting along, and its own clock may run a
// thousandth faster: the waves no longer fit, and the loudness fits at every beat. What still fits is the picture of
// the sound — how its energy sits across the pitches from one hundredth of a second to the next (the words). The two
// pictures are slid over each other, every pitch band at once.

/** pictures per second */
export const SPEC_FPS = 100;
const SPEC_WIN = 256;
const SPEC_BANDS = 24;
/** the two halves of the clip must each fit at the same place, this near (seconds), on their own… */
export const SPEC_HALVES = 0.06;
/** …a clip too short to halve must stand this far above the next best place (a ratio over the mean) and above all places */
export const SPEC_LEAD = 1.5;
export const SPEC_Z = 5.5;
export const SPEC_HALVES_LEAD = 1.15;

/** In-place FFT of a power-of-two length (forward). */
function fftForward(re: Float64Array, im: Float64Array) {
  fft(re, im, false);
}

const pictures = new WeakMap<Float32Array, Float32Array[]>();
/**
 * The sound's picture: SPEC_BANDS bands (60 Hz to just under half of `rate`, evenly spaced by ear) every 1/SPEC_FPS s,
 * each as the log of its energy with its slow level taken out and brought to the same spread. Kept while the sound is.
 */
export function spectrogram(x: Float32Array, rate: number): Float32Array[] {
  const had = pictures.get(x);
  if (had) return had;
  const hop = Math.max(1, Math.round(rate / SPEC_FPS));
  const frames = Math.max(1, Math.floor((x.length - SPEC_WIN) / hop) + 1);
  const out = Array.from({ length: SPEC_BANDS }, () => new Float32Array(frames));
  const re = new Float64Array(SPEC_WIN);
  const im = new Float64Array(SPEC_WIN);
  const win = Float64Array.from({ length: SPEC_WIN }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / SPEC_WIN));
  const lo = Math.max(1, Math.round((60 * SPEC_WIN) / rate));
  const hi = Math.round(SPEC_WIN * 0.47);
  const edges = Array.from({ length: SPEC_BANDS + 1 }, (_, b) => Math.round(lo * Math.pow(hi / lo, b / SPEC_BANDS)));
  for (let b = 1; b <= SPEC_BANDS; b++) if (edges[b] <= edges[b - 1]) edges[b] = edges[b - 1] + 1;
  for (let f = 0; f < frames; f++) {
    const at = f * hop;
    for (let i = 0; i < SPEC_WIN; i++) {
      re[i] = (x[at + i] ?? 0) * win[i];
      im[i] = 0;
    }
    fftForward(re, im);
    for (let b = 0; b < SPEC_BANDS; b++) {
      let e = 0;
      for (let k = edges[b]; k < edges[b + 1]; k++) e += re[k] * re[k] + im[k] * im[k];
      out[b][f] = e;
    }
  }
  // the log of the energy over a floor a thousandth of the band's own mean: silence is "quiet", not minus infinity
  // (a pause would otherwise weigh more than any word)
  for (const e of out) {
    let mean = 0;
    for (let k = 0; k < frames; k++) mean += e[k];
    const floor = 1e-12 + (mean / frames) * 1e-3;
    for (let k = 0; k < frames; k++) e[k] = Math.log(floor + e[k]);
  }
  // each band: minus a one-second running mean (the microphone's colour and level go), then the same spread
  const half = SPEC_FPS / 2;
  const pre = new Float64Array(frames + 1);
  for (const e of out) {
    for (let k = 0; k < frames; k++) pre[k + 1] = pre[k] + e[k];
    let sq = 0;
    for (let k = 0; k < frames; k++) {
      const a = Math.max(0, k - half);
      const b = Math.min(frames, k + half);
      const v = e[k] - (pre[b] - pre[a]) / (b - a);
      e[k] = v;
      sq += v * v;
    }
    const sd = Math.sqrt(sq / frames) || 1;
    for (let k = 0; k < frames; k++) e[k] /= sd;
  }
  pictures.set(x, out);
  return out;
}

/** A picture's bands in the frequency domain at one FFT size (the master's is asked for again with every clip). */
const spectra = new WeakMap<Float32Array[], { n: number; re: Float64Array[]; im: Float64Array[] }>();
function bandSpectra(s: Float32Array[], n: number) {
  const had = spectra.get(s);
  if (had && had.n === n) return had;
  const re: Float64Array[] = [];
  const im: Float64Array[] = [];
  for (const e of s) {
    const r = new Float64Array(n);
    const i = new Float64Array(n);
    r.set(e);
    fftForward(r, i);
    re.push(r);
    im.push(i);
  }
  const made = { n, re, im };
  spectra.set(s, made);
  return made;
}

/**
 * Where the second picture fits the first: the shift (seconds: the moment at t in the first is at t + lag in the
 * second), how far it stands above all the shifts (`z`) and above the next best place (`lead`), and the tallest
 * places (seconds) for the waves to be tried at.
 */
export function spectroLag(sa: Float32Array[], sb: Float32Array[]): { lag: number; z: number; lead: number; peaks: number[] } | null {
  const la = sa[0].length;
  const lb = sb[0].length;
  // only places where a good half of the shorter one (or ten seconds) lies over the other: a few words of overlap
  // fit somewhere by chance
  const need = Math.min(SPEC_FPS * 10, Math.floor(Math.min(la, lb) * 0.5));
  const lo = -(la - 1) + need;
  const hi = lb - 1 - need;
  if (hi <= lo) return null;
  let n = 1;
  while (n < la + lb) n <<= 1;
  const A = bandSpectra(sa, n);
  const B = bandSpectra(sb, n);
  // Σ over the bands of conj(A)·B, turned back to shifts once
  const cr = new Float64Array(n);
  const ci = new Float64Array(n);
  for (let b = 0; b < sa.length; b++) {
    const ar = A.re[b];
    const ai = A.im[b];
    const br = B.re[b];
    const bi = B.im[b];
    for (let i = 0; i < n; i++) {
      cr[i] += ar[i] * br[i] + ai[i] * bi[i];
      ci[i] += ar[i] * bi[i] - ai[i] * br[i];
    }
  }
  fft(cr, ci, true);
  const m = hi - lo + 1;
  const v = new Float64Array(m);
  let sum = 0;
  let sq = 0;
  for (let i = 0; i < m; i++) {
    const l = lo + i;
    // a shift where less of the two overlap has less to add up: weighed by how much does
    // (a[t] meets b[t + l]: t runs from max(0, −l) to min(la, lb − l))
    const overlap = Math.min(la, lb - l) - Math.max(0, -l);
    const x = cr[((l % n) + n) % n] / Math.sqrt(Math.max(1, overlap));
    v[i] = x;
    sum += x;
    sq += x * x;
  }
  const mean = sum / m;
  const sd = Math.sqrt(Math.max(1e-12, sq / m - mean * mean));
  const apart = Math.round(SPEC_FPS * 0.15);
  const tops: { i: number; v: number }[] = [];
  const left = Float64Array.from(v);
  for (let k = 0; k < PEAKS; k++) {
    let bi = -1;
    for (let i = 0; i < m; i++) if (left[i] > -Infinity && (bi < 0 || left[i] > left[bi])) bi = i;
    if (bi < 0) break;
    tops.push({ i: bi, v: left[bi] });
    for (let i = Math.max(0, bi - apart); i <= Math.min(m - 1, bi + apart); i++) left[i] = -Infinity;
  }
  const best = tops[0];
  // between two pictures: the top of the curve through the best place and its neighbours
  const y0 = v[best.i - 1] ?? best.v;
  const y2 = v[best.i + 1] ?? best.v;
  const bend = y0 - 2 * best.v + y2;
  const frac = bend < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / bend)) : 0;
  const second = tops[1]?.v ?? mean;
  return { lag: (lo + best.i + frac) / SPEC_FPS, z: (best.v - mean) / sd, lead: (best.v - mean) / Math.max(1e-9, second - mean), peaks: tops.map((t) => (lo + t.i) / SPEC_FPS) };
}

/** how fine the attacks are compared (values per second) and how far around the place (seconds) */
const ONSET_RATE = 1000;
const ONSET_SPAN = 0.08;
const onsetCache = new WeakMap<Float32Array, Float32Array>();
/** Where the sound rises: the rise of its loudness from one millisecond to the next (falls count for nothing). */
function onsets(x: Float32Array, rate: number): Float32Array {
  const had = onsetCache.get(x);
  if (had) return had;
  const per = Math.max(1, Math.round(rate / ONSET_RATE));
  const n = Math.floor(x.length / per);
  const e = new Float32Array(n);
  // the level over 8 ms, in log
  const w = 8;
  let run = 0;
  const lvl = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    let s = 0;
    for (let i = k * per; i < (k + 1) * per; i++) s += Math.abs(x[i]);
    lvl[k] = s / per;
  }
  let mean = 0;
  for (let k = 0; k < n; k++) mean += lvl[k];
  const floor = 1e-7 + (mean / Math.max(1, n)) * 0.02;
  const lg = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    run += lvl[k] - (k >= w ? lvl[k - w] : 0);
    lg[k] = Math.log(floor + run / Math.min(w, k + 1));
  }
  for (let k = 3; k < n; k++) e[k] = Math.max(0, lg[k] - lg[k - 3]);
  onsetCache.set(x, e);
  return e;
}

/**
 * A place found by the sound's picture is right to a hundredth of a second, and in a room it leans late: the echo
 * drags every sound's weight after it. The attacks do not move — a sound begins when it begins, whatever rings on
 * after. Around the place (±80 ms) the rises of the two sounds are laid over each other, to the millisecond.
 */
export function refineOnsets(a: Float32Array, b: Float32Array, rate: number, lag: number): number {
  const oa = onsets(a, rate);
  const ob = onsets(b, rate);
  const shift = Math.round(lag * ONSET_RATE);
  const reach = Math.round(ONSET_SPAN * ONSET_RATE);
  const from = Math.max(0, -shift + reach);
  const to = Math.min(oa.length, ob.length - shift - reach);
  if (to - from < ONSET_RATE * 2) return lag;
  const score = new Float64Array(2 * reach + 1);
  let best = reach;
  for (let d = -reach; d <= reach; d++) {
    let s = 0;
    const off = shift + d;
    for (let i = from; i < to; i++) s += oa[i] * ob[i + off];
    score[d + reach] = s;
    if (s > score[best]) best = d + reach;
  }
  const y0 = score[best - 1] ?? score[best];
  const y2 = score[best + 1] ?? score[best];
  const bend = y0 - 2 * score[best] + y2;
  const frac = bend < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / bend)) : 0;
  return (shift + best - reach + frac) / ONSET_RATE;
}

/**
 * The proof a place is the right one when it does not stand out by itself: the shorter sound cut in two, each half
 * looked for in the other sound on its own. Two halves of the same recording land at the same place; two halves of
 * anything else land wherever chance puts them (one beat among hundreds). Null when the halves would be under four
 * seconds (nothing to prove with).
 */
export function halvesAgree(sa: Float32Array[], sb: Float32Array[], lag: number): boolean | null {
  const flip = sb[0].length <= sa[0].length;
  const short = flip ? sb : sa;
  const h = Math.floor(short[0].length / 2);
  if (h < SPEC_FPS * 4) return null;
  for (const [from, to] of [[0, h], [h, short[0].length]] as const) {
    const part = short.map((e) => e.subarray(from, to));
    const r = flip ? spectroLag(sa, part) : spectroLag(part, sb);
    if (!r) return false;
    // the half that starts `from` pictures in: a moment of the first is `from` earlier in it (later, when it is the first that was cut)
    const whole = flip ? r.lag + from / SPEC_FPS : r.lag - from / SPEC_FPS;
    if (Math.abs(whole - lag) > SPEC_HALVES) return false;
  }
  return true;
}

/** The shift between two mono sounds at `rate` Hz (the same rate for both). */
export function findLag(a: Float32Array, b: Float32Array, rate: number): Found {
  const r = envelopeLag(envelope(a, rate), envelope(b, rate));
  if (!r) return { lag: 0, z: 0, confidence: "none" };
  const coarse = r.lag / ENV_RATE;
  const confidence = r.z >= HIGH ? "high" : r.z >= LOW ? "low" : "none";
  if (confidence !== "none") {
    const fine = refineLag(a, b, rate, coarse);
    return { lag: fine ?? coarse, z: r.z, confidence };
  }
  // no shift stands out by loudness (a sound on a beat fits at every beat): let the waves choose among the beats
  const w = waveLag(a, b, rate, r.peaks);
  if (w) return { lag: w.lag, z: r.z, confidence: w.ncc >= WAVE_HIGH ? "high" : "low" };
  // a room, people reciting along, a clock a thousandth off: the waves do not fit anywhere. The sound's picture does.
  const sp = spectroLag(spectrogram(a, rate), spectrogram(b, rate));
  if (sp) {
    const w2 = waveLag(a, b, rate, sp.peaks, 1);
    // (ten more places tried: more is asked of the waves here, chance has had twenty goes)
    if (w2 && w2.ncc >= WAVE_LOW * 1.5) return { lag: w2.lag, z: sp.z, confidence: w2.ncc >= WAVE_HIGH ? "high" : "low" };
    // believed when the two halves of the clip each land on it; a clip too short to halve must stand out by a long way
    const halves = sp.lead >= SPEC_HALVES_LEAD ? halvesAgree(spectrogram(a, rate), spectrogram(b, rate), sp.lag) : false;
    if (halves || (halves === null && sp.lead >= SPEC_LEAD && sp.z >= SPEC_Z)) return { lag: refineOnsets(a, b, rate, sp.lag), z: sp.z, confidence: "low" };
  }
  return { lag: coarse, z: r.z, confidence: "none" };
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
