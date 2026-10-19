// The loudness of a mix the way the platforms hear it (ITU-R BS.1770-4 / EBU R128: K-weighting, 400 ms blocks every
// 100 ms, the −70 LUFS absolute and −10 LU relative gates), and a master to a target: the reel's −14 LUFS with its
// true peak held under −1.5 dBTP (4× oversampled, a short look-ahead limiter). Pure: channels in, channels out —
// used by «مختبر الموشن»'s mix in the browser, tested in Node.

export const TARGET_LUFS = -14;
export const CEILING_DBTP = -1.5;
/** never lift a quiet recording by more than this (its noise comes up with it) */
export const MAX_GAIN_DB = 12;

function biquad(x: Float32Array, b0: number, b1: number, b2: number, a1: number, a2: number): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

/** The K-weighting filter of BS.1770 at any sample rate (a high shelf, then a high pass). */
function kWeight(x: Float32Array, rate: number): Float32Array {
  let K = Math.tan((Math.PI * 1681.974450955533) / rate);
  const Q1 = 0.7071752369554196, Vh = Math.pow(10, 3.999843853973347 / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q1 + K * K;
  const s = biquad(x, (Vh + (Vb * K) / Q1 + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q1 + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q1 + K * K) / a0);
  K = Math.tan((Math.PI * 38.13547087602444) / rate);
  const Q2 = 0.5003270373238773;
  a0 = 1 + K / Q2 + K * K;
  return biquad(s, 1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q2 + K * K) / a0);
}

/** Integrated loudness in LUFS (−Infinity for silence). */
export function integratedLufs(channels: Float32Array[], rate: number): number {
  const w = channels.map((c) => kWeight(c, rate));
  const block = Math.round(0.4 * rate), hop = Math.round(0.1 * rate), n = w[0]?.length ?? 0;
  const powers: number[] = [];
  for (let start = 0; start + block <= n; start += hop) {
    let sum = 0;
    for (const c of w) {
      let e = 0;
      for (let i = start; i < start + block; i++) e += c[i] * c[i];
      sum += e / block;
    }
    powers.push(sum);
  }
  // a piece shorter than one block: measured whole
  if (!powers.length && n) powers.push(w.reduce((s, c) => s + c.reduce((a, v) => a + v * v, 0) / n, 0));
  const lufs = (p: number) => -0.691 + 10 * Math.log10(p);
  const above = powers.filter((p) => p > 0 && lufs(p) > -70);
  if (!above.length) return -Infinity;
  const rel = lufs(above.reduce((a, b) => a + b, 0) / above.length) - 10;
  const gated = above.filter((p) => lufs(p) > rel);
  return lufs(gated.reduce((a, b) => a + b, 0) / gated.length);
}

/** The true peak (linear), estimated with 4× oversampling (cubic interpolation between samples). */
export function truePeak(channels: Float32Array[]): number {
  let peak = 0;
  for (const c of channels) {
    for (let i = 0; i < c.length; i++) {
      const v = Math.abs(c[i]);
      if (v > peak) peak = v;
      if (i < 1 || i + 2 >= c.length) continue;
      const p0 = c[i - 1], p1 = c[i], p2 = c[i + 1], p3 = c[i + 2];
      for (let k = 1; k < 4; k++) {
        const t = k / 4;
        const s = p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
        if (Math.abs(s) > peak) peak = Math.abs(s);
      }
    }
  }
  return peak;
}

/**
 * The mix mastered in place: lifted or lowered to `target` LUFS (the lift capped at MAX_GAIN_DB), then any peak over
 * the ceiling held down by a look-ahead limiter (1.5 ms ahead, 60 ms release) on all channels together.
 */
export function master(channels: Float32Array[], rate: number, target = TARGET_LUFS, ceilingDb = CEILING_DBTP): { lufs: number; gainDb: number; after: number } {
  const lufs = integratedLufs(channels, rate);
  if (!Number.isFinite(lufs)) return { lufs, gainDb: 0, after: lufs };
  const gainDb = Math.min(MAX_GAIN_DB, target - lufs);
  const g = Math.pow(10, gainDb / 20);
  for (const c of channels) for (let i = 0; i < c.length; i++) c[i] *= g;
  // the limiter: each sample's needed gain, the minimum over the look-ahead, released smoothly
  const ceiling = Math.pow(10, ceilingDb / 20) * 0.98;
  const n = channels[0].length, ahead = Math.max(1, Math.round(0.0015 * rate)), rel = Math.exp(-1 / (0.06 * rate));
  const need = new Float32Array(n);
  // what each sample needs, judged on the TRUE peak around it (the values between it and the next, 4× oversampled)
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (const c of channels) {
      m = Math.max(m, Math.abs(c[i]));
      if (i >= 1 && i + 2 < n) {
        const p0 = c[i - 1], p1 = c[i], p2 = c[i + 1], p3 = c[i + 2];
        for (let k = 1; k < 4; k++) {
          const t = k / 4;
          m = Math.max(m, Math.abs(p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)))));
        }
      }
    }
    need[i] = m > ceiling ? ceiling / m : 1;
  }
  // the lowest need within the next `ahead` samples (a sliding minimum), so the gain is already down when the peak comes
  const gainAt = new Float32Array(n);
  const q: number[] = [];
  let head = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (q.length > head && need[q[q.length - 1]] >= need[i]) q.pop();
    q.push(i);
    while (q[head] > i + ahead) head++;
    gainAt[i] = need[q[head]];
  }
  // down at once, back up slowly
  let env = 1;
  for (let i = 0; i < n; i++) {
    const want = gainAt[i];
    env = want < env ? want : want + (env - want) * rel;
    for (const c of channels) c[i] *= env;
  }
  return { lufs, gainDb, after: integratedLufs(channels, rate) };
}
