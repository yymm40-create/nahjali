// «زهراء فوتو ماستر» — what the sliders do to the pixels of the base picture: light, contrast, colour, tone, tilt of
// hue, blur and sharpness, the dark edges and the film grain. Plain arrays in, plain arrays out (the page hands it a
// canvas's pixels; the tests hand it a few numbers), so it works the same in every browser and can be checked.
// The order is the colourist's: light and colour first, then detail, then the finishing touches. Pure.

import { ADJUSTS, FILTERS, NO_ADJUST, type Adjust } from "@config/photo";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The sliders after the look is added (a look is its sliders scaled by its strength, then clamped to each slider's range). */
export function effectiveAdjust(adjust: Adjust, filter: { id: string; strength: number }): Adjust {
  const f = FILTERS.find((x) => x.id === filter.id);
  const k = Math.max(0, Math.min(100, filter.strength)) / 100;
  const out = { ...NO_ADJUST };
  for (const a of ADJUSTS) {
    const v = (adjust[a.key] ?? 0) + (f?.adjust[a.key] ?? 0) * k;
    out[a.key] = Math.max(a.min, Math.min(a.max, v));
  }
  return out;
}

export const isIdentity = (a: Adjust) => ADJUSTS.every((x) => !a[x.key]);

/** A box blur of the RGB channels, `radius` pixels, two passes (close to a soft Gaussian). Alpha is left alone. */
function boxBlur(data: Uint8ClampedArray, w: number, h: number, radius: number) {
  const r = Math.max(1, Math.round(radius));
  if (r < 1 || w < 2 || h < 2) return;
  const tmp = new Float32Array(Math.max(w, h));
  for (let pass = 0; pass < 2; pass++) {
    for (let c = 0; c < 3; c++) {
      for (let y = 0; y < h; y++) {
        let sum = 0;
        for (let x = -r; x <= r; x++) sum += data[(y * w + Math.min(w - 1, Math.max(0, x))) * 4 + c];
        for (let x = 0; x < w; x++) {
          tmp[x] = sum / (2 * r + 1);
          sum += data[(y * w + Math.min(w - 1, x + r + 1)) * 4 + c] - data[(y * w + Math.max(0, x - r)) * 4 + c];
        }
        for (let x = 0; x < w; x++) data[(y * w + x) * 4 + c] = tmp[x];
      }
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let y = -r; y <= r; y++) sum += data[(Math.min(h - 1, Math.max(0, y)) * w + x) * 4 + c];
        for (let y = 0; y < h; y++) {
          tmp[y] = sum / (2 * r + 1);
          sum += data[(Math.min(h - 1, y + r + 1) * w + x) * 4 + c] - data[(Math.max(0, y - r) * w + x) * 4 + c];
        }
        for (let y = 0; y < h; y++) data[(y * w + x) * 4 + c] = tmp[y];
      }
    }
  }
}

/** A pixel's noise in [-1, 1], the same for the same place (so a preview and an export grain alike). */
const noise = (x: number, y: number) => {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return ((n >>> 0) / 4294967295) * 2 - 1;
};

/** Applies the sliders to RGBA pixels in place. */
export function adjustPixels(data: Uint8ClampedArray, w: number, h: number, a: Adjust): void {
  if (isIdentity(a)) return;
  const gain = Math.pow(2, a.exposure / 100);
  const t = a.temperature / 100;
  const ti = a.tint / 100;
  const rGain = (1 + 0.25 * t) * (1 + 0.05 * ti);
  const bGain = (1 - 0.25 * t) * (1 + 0.05 * ti);
  const gGain = 1 - 0.15 * ti;
  const contrast = a.contrast >= 0 ? 1 + a.contrast / 100 : 1 + a.contrast / 100;
  const sat = 1 + a.saturation / 100;
  const sh = a.shadows / 100;
  const hi = a.highlights / 100;
  const ang = (a.hue * Math.PI) / 180;
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  // the CSS hue-rotate matrix
  const m = [
    0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928,
    0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.14, 0.072 - cos * 0.072 - sin * 0.283,
    0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072,
  ];
  const doHue = a.hue !== 0;
  for (let i = 0; i < w * h * 4; i += 4) {
    let r = (data[i] / 255) * gain * rGain;
    let g = (data[i + 1] / 255) * gain * gGain;
    let b = (data[i + 2] / 255) * gain * bGain;
    if (sh || hi) {
      const l = clamp01(0.2126 * r + 0.7152 * g + 0.0722 * b);
      const add = sh * 0.3 * (1 - l) * (1 - l) + hi * 0.3 * l * l;
      r += add;
      g += add;
      b += add;
    }
    if (contrast !== 1) {
      r = (r - 0.5) * contrast + 0.5;
      g = (g - 0.5) * contrast + 0.5;
      b = (b - 0.5) * contrast + 0.5;
    }
    if (sat !== 1) {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = l + (r - l) * sat;
      g = l + (g - l) * sat;
      b = l + (b - l) * sat;
    }
    if (doHue) {
      const nr = m[0] * r + m[1] * g + m[2] * b;
      const ng = m[3] * r + m[4] * g + m[5] * b;
      const nb = m[6] * r + m[7] * g + m[8] * b;
      r = nr;
      g = ng;
      b = nb;
    }
    data[i] = clamp01(r) * 255;
    data[i + 1] = clamp01(g) * 255;
    data[i + 2] = clamp01(b) * 255;
  }
  const side = Math.min(w, h);
  if (a.blur > 0) boxBlur(data, w, h, (a.blur / 100) * side * 0.04);
  if (a.sharpen > 0) {
    // unsharp mask: the picture plus its difference from a blurred copy
    const copy = new Uint8ClampedArray(data);
    boxBlur(copy, w, h, Math.max(1, side * 0.002));
    const k = (a.sharpen / 100) * 1.6;
    for (let i = 0; i < w * h * 4; i += 4) for (let c = 0; c < 3; c++) data[i + c] = data[i + c] + (data[i + c] - copy[i + c]) * k;
  }
  if (a.vignette > 0) {
    const cx = (w - 1) / 2;
    const cy = (h - 1) / 2;
    const max = Math.hypot(cx, cy) || 1;
    const k = a.vignette / 100;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = Math.hypot(x - cx, y - cy) / max;
        const s = d <= 0.35 ? 0 : (d - 0.35) / 0.65;
        const f = 1 - k * 0.85 * s * s;
        const i = (y * w + x) * 4;
        data[i] *= f;
        data[i + 1] *= f;
        data[i + 2] *= f;
      }
    }
  }
  if (a.grain > 0) {
    const amp = (a.grain / 100) * 38;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = noise(x, y) * amp;
        const i = (y * w + x) * 4;
        data[i] += n;
        data[i + 1] += n;
        data[i + 2] += n;
      }
    }
  }
}
