// The grade's colour part on the CPU, step for step the same as the GPU program (grade-gl.ts) for a picture that is
// not log: exposure, warmth and tint in linear light → lift / gamma / gain / offset → contrast around the pivot →
// highlights, shadows, whites, blacks → saturation and vibrance → RGB curves → hue / sat / luma curves → split toning
// → the amount. Not here: log decoding, secondaries, windows, the LUT, halation, grain, vignette and sharpening (they
// need the GPU or the whole frame). Used to build «حيدرة»'s grading library (its before/after pairs) and to check a
// grade on a still without a browser. Pure.

import { curveAt, hueCurveAt, type Grade, type Pt } from "./grade";

const LUMA = [0.2126, 0.7152, 0.0722] as const;
const luma = (c: number[]) => c[0] * LUMA[0] + c[1] * LUMA[1] + c[2] * LUMA[2];
const dec = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const enc = (v: number) => {
  const x = Math.max(0, v);
  return x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
};
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const fract = (x: number) => x - Math.floor(x);

function rgb2hsv(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 1e-10) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, mx > 1e-10 ? d / mx : 0, mx];
}

function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

const hueDist = (a: number, b: number) => {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
};

const isLine = (p: Pt[]) => p.length === 2 && p[0].x === 0 && p[0].y === 0 && p[1].x === 1 && p[1].y === 1;
const isFlat = (p: Pt[]) => p.every((q) => Math.abs(q.y - 0.5) < 1e-6);

/** A curve as a 256-entry table (as the GPU samples it), or null when it does nothing. */
function table(p: Pt[], periodic: boolean): Float32Array | null {
  if (periodic ? isFlat(p) : isLine(p)) return null;
  const t = new Float32Array(256);
  for (let i = 0; i < 256; i++) t[i] = clamp01(periodic ? hueCurveAt(p, i / 255) : curveAt(p, i / 255));
  return t;
}
const at = (t: Float32Array, x: number) => {
  const f = clamp01(x) * 255;
  const i = Math.floor(f);
  const j = Math.min(255, i + 1);
  return t[i] + (t[j] - t[i]) * (f - i);
};

/** What a grade does to colours, made ready once (curve tables, wheels) and then applied to any number of pixels. */
export function gradeFn(g: Grade): (r: number, gr: number, b: number) => [number, number, number] {
  const w = (wh: Grade["lift"]) => [wh.rgb[0] + wh.y, wh.rgb[1] + wh.y, wh.rgb[2] + wh.y];
  const L = w(g.lift).map((v) => v * 0.5);
  const G = w(g.gain).map((v) => 1 + v * 0.5);
  const M = w(g.gamma).map((v) => Math.max(1 + v * 0.6, 0.05));
  const O = w(g.offset).map((v) => v * 0.3);
  const mul = [1 + 0.22 * g.temp - 0.08 * g.tint, 1 - 0.06 * Math.abs(g.temp) + 0.14 * g.tint, 1 - 0.22 * g.temp - 0.08 * g.tint];
  const ex = Math.pow(2, g.exposure);
  const cv = g.curves;
  const master = table(cv.master, false);
  const rgbT = [table(cv.r, false), table(cv.g, false), table(cv.b, false)];
  const hueHue = table(cv.hueHue, true);
  const hueSat = table(cv.hueSat, true);
  const hueLum = table(cv.hueLum, true);
  const lumSat = table(cv.lumSat, false);
  const satSat = table(cv.satSat, false);
  const anyHue = hueHue || hueSat || hueLum || lumSat || satSat;
  const sp = g.split;
  const sCol = hsv2rgb(sp.shadowHue, 1, 1);
  const hCol = hsv2rgb(sp.highHue, 1, 1);
  const bal = 0.5 + sp.balance * 0.4;
  const amount = g.on === false ? 0 : g.amount;

  return (r0, g0, b0) => {
    let c = [dec(r0) * ex * mul[0], dec(g0) * ex * mul[1], dec(b0) * ex * mul[2]].map((v) => enc(Math.max(0, v)));
    // wheels
    c = c.map((v, i) => Math.pow(Math.max(G[i] * (v + L[i] * (1 - v)), 0), 1 / M[i]) + O[i]);
    // contrast
    c = c.map((v) => (v - g.pivot) * g.contrast + g.pivot);
    // tone
    let y = luma(c.map(clamp01));
    const ms = 1 - smooth(0, 0.6, y);
    const mh = smooth(0.35, 1, y);
    c = c.map((v) => v + g.shadows * 0.35 * ms * (1 - v) * (v + 0.1));
    c = c.map((v) => v + g.highlights * 0.35 * mh * (1 - v));
    const kb = g.blacks * 0.15 * (1 - smooth(0, 0.5, y));
    const kw = g.whites * 0.2 * smooth(0.4, 1, y);
    c = c.map((v) => v + kb + kw);
    // saturation and vibrance
    y = luma(c);
    const hsv0 = rgb2hsv(clamp01(c[0]), clamp01(c[1]), clamp01(c[2]));
    const skin = 1 - smooth(0.03, 0.09, hueDist(hsv0[0], 0.07));
    const vib = 1 + g.vibrance * (1 - hsv0[1]) * (1 - 0.6 * skin);
    c = c.map((v) => y + (v - y) * g.saturation * vib);
    // RGB curves
    c = c.map(clamp01);
    if (master) c = c.map((v) => at(master, v));
    c = c.map((v, i) => (rgbT[i] ? at(rgbT[i]!, v) : v));
    // hue curves
    if (anyHue) {
      const hsv = rgb2hsv(c[0], c[1], c[2]);
      const hh = hueHue ? at(hueHue, hsv[0]) - 0.5 : 0;
      const hs = hueSat ? at(hueSat, hsv[0]) * 2 : 1;
      const hl = hueLum ? at(hueLum, hsv[0]) - 0.5 : 0;
      const ls = lumSat ? at(lumSat, luma(c)) * 2 : 1;
      const ss = satSat ? at(satSat, hsv[1]) * 2 : 1;
      c = hsv2rgb(fract(hsv[0] + hh * 0.5), clamp01(hsv[1] * hs * ls * ss), clamp01(hsv[2] * (1 + hl * 0.8)));
    }
    // split toning
    if (sp.shadowSat || sp.highSat) {
      const yy = luma(c.map(clamp01));
      const wS = 1 - smooth(0, bal + 0.25, yy);
      const wH = smooth(bal - 0.25, 1, yy);
      c = c.map((v, i) => v + (sCol[i] - 0.5) * sp.shadowSat * 0.35 * wS + (hCol[i] - 0.5) * sp.highSat * 0.35 * wH);
    }
    // the amount
    return [r0 + (clamp01(c[0]) - r0) * amount, g0 + (clamp01(c[1]) - g0) * amount, b0 + (clamp01(c[2]) - b0) * amount];
  };
}

/** Grades RGBA bytes (a still), returning new bytes. */
export function gradePixels(px: Uint8Array | Uint8ClampedArray, grade: Grade): Uint8ClampedArray {
  const f = gradeFn(grade);
  const out = new Uint8ClampedArray(px.length);
  for (let i = 0; i < px.length; i += 4) {
    const [r, g, b] = f(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255);
    out[i] = r * 255 + 0.5;
    out[i + 1] = g * 255 + 0.5;
    out[i + 2] = b * 255 + 0.5;
    out[i + 3] = px[i + 3];
  }
  return out;
}
