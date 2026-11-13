// «الرضا فويس» — second-order filters for the offline tools (hum notches, the loudness meter's weighting, the
// de-esser's split). The live equalizer uses the browser's own filter nodes; these follow the same cookbook formulas
// (Robert Bristow-Johnson's) with a plain Q.

export type BiquadKind = "lowpass" | "highpass" | "bandpass" | "notch" | "peaking" | "lowshelf" | "highshelf";
export interface Coefs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

export function biquad(kind: BiquadKind, sr: number, freq: number, q = Math.SQRT1_2, gainDb = 0): Coefs {
  const w0 = (2 * Math.PI * Math.min(Math.max(freq, 1), sr / 2 - 1)) / sr;
  const cs = Math.cos(w0);
  const sn = Math.sin(w0);
  const A = 10 ** (gainDb / 40);
  const alpha = sn / (2 * q);
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  switch (kind) {
    case "lowpass":
      b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha;
      break;
    case "highpass":
      b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha;
      break;
    case "bandpass":
      b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha;
      break;
    case "notch":
      b0 = 1; b1 = -2 * cs; b2 = 1; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha;
      break;
    case "peaking":
      b0 = 1 + alpha * A; b1 = -2 * cs; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cs; a2 = 1 - alpha / A;
      break;
    case "lowshelf": {
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 - (A - 1) * cs + s); b1 = 2 * A * (A - 1 - (A + 1) * cs); b2 = A * (A + 1 - (A - 1) * cs - s);
      a0 = A + 1 + (A - 1) * cs + s; a1 = -2 * (A - 1 + (A + 1) * cs); a2 = A + 1 + (A - 1) * cs - s;
      break;
    }
    case "highshelf": {
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 + (A - 1) * cs + s); b1 = -2 * A * (A - 1 + (A + 1) * cs); b2 = A * (A + 1 + (A - 1) * cs - s);
      a0 = A + 1 - (A - 1) * cs + s; a1 = 2 * (A - 1 - (A + 1) * cs); a2 = A + 1 - (A - 1) * cs - s;
      break;
    }
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

/** The filter run over `x` (a new array; `x` is left alone). */
export function filter(x: Float32Array, c: Coefs): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

/** Forward then backward: twice the slope and no shift in time (peaks stay where they were). */
export function filterZeroPhase(x: Float32Array, c: Coefs): Float32Array {
  const y = filter(x, c).reverse();
  return filter(y, c).reverse();
}

/** How loud the filter passes `freq`, in dB. */
export function responseDb(c: Coefs, sr: number, freq: number): number {
  const w = (2 * Math.PI * freq) / sr;
  const c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
  const nr = c.b0 + c.b1 * c1 + c.b2 * c2, ni = -(c.b1 * s1 + c.b2 * s2);
  const dr = 1 + c.a1 * c1 + c.a2 * c2, di = -(c.a1 * s1 + c.a2 * s2);
  return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di) + 1e-30);
}

export const dbToGain = (db: number) => 10 ** (db / 20);
export const gainToDb = (g: number) => 20 * Math.log10(Math.max(g, 1e-9));
