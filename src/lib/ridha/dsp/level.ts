// «الرضا فويس» — the level of a sound over time, and the three jobs that stand on it: finding where somebody is
// actually speaking or singing (so the silences between can be taken out), riding a voice's level phrase by phrase
// the way an engineer's hand rides a fader (so quiet words come up and loud ones come down without the squeeze of a
// compressor), and dipping music under a voice (ducking).

export interface Region {
  /** seconds from the start of the sound */
  a: number;
  b: number;
}

/** RMS level in dB of a window `winMs` long around every `hopMs` step. */
export function levelDb(x: Float32Array, sr: number, winMs = 50, hopMs = 10): Float32Array {
  const hop = Math.max(1, Math.round((sr * hopMs) / 1000));
  const half = Math.max(1, Math.round((sr * winMs) / 2000));
  const n = Math.ceil(x.length / hop);
  // a running sum of squares: every window costs the same however long it is
  const sum = new Float64Array(x.length + 1);
  for (let i = 0; i < x.length; i++) sum[i + 1] = sum[i] + x[i] * x[i];
  const out = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    const c = f * hop;
    const a = Math.max(0, c - half), b = Math.min(x.length, c + half);
    const p = b > a ? (sum[b] - sum[a]) / (b - a) : 0;
    out[f] = p > 1e-12 ? 10 * Math.log10(p) : -120;
  }
  return out;
}

const mono = (channels: Float32Array[]): Float32Array => {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (const ch of channels) for (let i = 0; i < out.length; i++) out[i] += ch[i] / channels.length;
  return out;
};

function percentile(v: Float32Array, q: number): number {
  if (!v.length) return -120;
  const s = Float32Array.from(v).sort();
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
}

/**
 * The line between «sound» and «silence» for THIS recording: `relDb` under its loud passages, but never inside its
 * own noise floor (a noisy room's hiss is silence too) and never closer than 10 dB to the loud passages.
 */
export function soundThreshold(level: Float32Array, relDb = -30): number {
  const loud = percentile(level, 0.95);
  const floor = percentile(level, 0.1);
  // a recording that never rises above −80 dB is silence from end to end: nothing in it is «sound»
  if (loud < -80) return Infinity;
  return Math.min(loud - 10, Math.max(loud + relDb, floor + 8));
}

export interface FindOptions {
  /** how far under the loud passages still counts as sound, dB (−30) */
  relDb?: number;
  /** a pause shorter than this is part of the phrase, seconds (0.4) */
  minSilence?: number;
  /** a sound shorter than this is a click, not a phrase, seconds (0.08) */
  minSound?: number;
  /** kept before and after each phrase so no first letter or last breath is clipped, seconds (0.08) */
  pad?: number;
}

/** Where there is sound: the stretches louder than the recording's own silence, in order, not touching. */
export function findSound(channels: Float32Array[], sr: number, o: FindOptions = {}): Region[] {
  const { relDb = -30, minSilence = 0.4, minSound = 0.08, pad = 0.08 } = o;
  const x = mono(channels);
  const total = x.length / sr;
  if (!x.length) return [];
  const hopMs = 10;
  const level = levelDb(x, sr, 40, hopMs);
  const thr = soundThreshold(level, relDb);
  const raw: Region[] = [];
  let open = -1;
  for (let f = 0; f <= level.length; f++) {
    const on = f < level.length && level[f] > thr;
    if (on && open < 0) open = f;
    if (!on && open >= 0) {
      raw.push({ a: (open * hopMs) / 1000, b: (f * hopMs) / 1000 });
      open = -1;
    }
  }
  // short pauses belong to the phrase around them; what is left too short to be a phrase is dropped
  const joined: Region[] = [];
  for (const r of raw) {
    const last = joined[joined.length - 1];
    if (last && r.a - last.b < minSilence) last.b = r.b;
    else joined.push({ ...r });
  }
  const out: Region[] = [];
  for (const r of joined) {
    if (r.b - r.a < minSound) continue;
    const a = Math.max(0, r.a - pad), b = Math.min(total, r.b + pad);
    const last = out[out.length - 1];
    if (last && a <= last.b) last.b = b;
    else out.push({ a, b });
  }
  return out;
}

/** The silences between the regions (and before the first, after the last) of a sound `total` seconds long. */
export function gapsOf(regions: Region[], total: number): Region[] {
  const out: Region[] = [];
  let at = 0;
  for (const r of regions) {
    if (r.a - at > 1e-3) out.push({ a: at, b: r.a });
    at = r.b;
  }
  if (total - at > 1e-3) out.push({ a: at, b: total });
  return out;
}

export interface RideOptions {
  /** the most the hand moves up or down, dB (8) */
  range?: number;
  /** how fast the hand follows, seconds (0.25): shorter evens out words, longer evens out phrases */
  speed?: number;
  /** the level every phrase is brought toward, dB RMS; none = the voice's own usual level (so its loudness stays) */
  targetDb?: number;
}

export interface RideReport {
  /** how far apart the quiet and the loud phrases were, and are now, dB (the spread between the 10th and 90th percent of the sung level) */
  before: number;
  after: number;
  /** the most it lifted and the most it lowered, dB */
  up: number;
  down: number;
}

/**
 * A fader ridden by hand, done ahead of time: the voice's level is followed phrase by phrase and brought toward its
 * usual level, at most `range` dB either way. Silences are left alone (the hand waits where it was), so breaths and
 * room noise do not pump up between phrases. All channels move together.
 */
export function rideLevel(channels: Float32Array[], sr: number, o: RideOptions = {}): { channels: Float32Array[]; report: RideReport } {
  const { range = 8, speed = 0.25 } = o;
  const x = mono(channels);
  const hopMs = 20;
  const hop = Math.round((sr * hopMs) / 1000);
  const level = levelDb(x, sr, 300, hopMs);
  const n = level.length;
  const none: RideReport = { before: 0, after: 0, up: 0, down: 0 };
  if (!n) return { channels, report: none };
  const thr = soundThreshold(level, -26);
  const voiced: number[] = [];
  for (let f = 0; f < n; f++) if (level[f] > thr) voiced.push(level[f]);
  if (voiced.length < 5) return { channels, report: none };
  const sung = Float32Array.from(voiced);
  const target = o.targetDb ?? percentile(sung, 0.5);

  // what the hand wants at each step; in a silence it holds what it last wanted
  const want = new Float32Array(n);
  let held = 0;
  for (let f = 0; f < n; f++) {
    if (level[f] > thr) held = Math.max(-range, Math.min(range, target - level[f]));
    want[f] = held;
  }
  // the first silence takes the first phrase's gain (no swell into the opening word)
  const first = level.findIndex((v) => v > thr);
  for (let f = 0; f < first; f++) want[f] = want[first];
  // a hand does not jump: smoothed forward and back, so the move is centred on the phrase and not late
  const k = Math.exp(-hopMs / 1000 / Math.max(0.02, speed));
  const g = Float32Array.from(want);
  for (let f = 1; f < n; f++) g[f] = k * g[f - 1] + (1 - k) * g[f];
  for (let f = n - 2; f >= 0; f--) g[f] = k * g[f + 1] + (1 - k) * g[f];

  const out = channels.map((ch) => {
    const y = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) {
      const p = i / hop;
      const f = Math.min(n - 1, Math.floor(p));
      const db = g[f] + (g[Math.min(n - 1, f + 1)] - g[f]) * (p - f);
      y[i] = ch[i] * 10 ** (db / 20);
    }
    return y;
  });
  const after: number[] = [];
  let up = 0, down = 0;
  for (let f = 0; f < n; f++) {
    if (level[f] <= thr) continue;
    after.push(level[f] + g[f]);
    up = Math.max(up, g[f]);
    down = Math.min(down, g[f]);
  }
  const spread = (v: Float32Array) => percentile(v, 0.9) - percentile(v, 0.1);
  return { channels: out, report: { before: spread(sung), after: spread(Float32Array.from(after)), up, down: -down } };
}

export interface DuckOptions {
  /** how far the music drops under the voice, dB (−12) */
  depthDb?: number;
  /** the music is already down this long before the first word, seconds (0.3) */
  down?: number;
  /** it stays down this long after the last word, so it does not jump up in every breath, seconds (0.6) */
  hold?: number;
  /** then comes back over this long, seconds (0.8) */
  up?: number;
}

/**
 * The gain, sample by sample, of music `len` samples long that should sit under a voice heard in `regions` (seconds
 * from the music's own start): 1 where nobody speaks, down by `depthDb` where somebody does, with gentle slopes.
 */
export function duckGain(len: number, sr: number, regions: Region[], o: DuckOptions = {}): Float32Array {
  const { depthDb = -12, down = 0.3, hold = 0.6, up = 0.8 } = o;
  // how «ducked» each sample is, 0–1: the deepest any region asks for
  const amt = new Float32Array(len);
  for (const r of regions) {
    const a = r.a * sr, b = (r.b + hold) * sr;
    const d = Math.max(1, down * sr), u = Math.max(1, up * sr);
    const from = Math.max(0, Math.floor(a - d)), to = Math.min(len, Math.ceil(b + u));
    for (let i = from; i < to; i++) {
      const v = i < a ? (i - (a - d)) / d : i <= b ? 1 : 1 - (i - b) / u;
      if (v > amt[i]) amt[i] = v;
    }
  }
  const g = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    // an eased slope (not a straight line in dB) sounds like a hand on a fader
    const s = amt[i] * amt[i] * (3 - 2 * amt[i]);
    g[i] = 10 ** ((depthDb * s) / 20);
  }
  return g;
}

export const applyGain = (channels: Float32Array[], g: Float32Array): Float32Array[] =>
  channels.map((ch) => {
    const y = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) y[i] = ch[i] * (g[i] ?? 1);
    return y;
  });
