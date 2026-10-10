// «زهراء فوتو ماستر» — what the sliders do to the pixels of the base picture: light, contrast, colour, tone, tilt of
// hue, blur and sharpness, the dark edges and the film grain. Plain arrays in, plain arrays out (the page hands it a
// canvas's pixels; the tests hand it a few numbers), so it works the same in every browser and can be checked.
// The order is the colourist's: light and colour first, then detail, then the finishing touches. Pure.

import { ADJUSTS, FILTERS, HSL_BANDS, NO_ADJUST, hslKey, type Adjust, type AdjustKey } from "@config/photo";

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

/** The mixer's cells, read once: each colour family with the hue it sits on and its three amounts. */
const HSL_CELLS = HSL_BANDS.map((b) => ({ hue: b.hue, h: hslKey("h", b.id) as AdjustKey, s: hslKey("s", b.id) as AdjustKey, l: hslKey("l", b.id) as AdjustKey }));

/** How much a pixel of this hue belongs to a family centred on `centre` (1 at its centre, 0 at 45° away). */
export function bandWeight(hue: number, centre: number): number {
  const d = Math.abs(((hue - centre + 540) % 360) - 180);
  return d >= 45 ? 0 : Math.cos((d / 45) * (Math.PI / 2)) ** 2;
}

/** RGB (0–1) → hue in degrees, saturation and lightness (0–1). */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 1e-6) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

/** Hue in degrees, saturation and lightness (0–1) → RGB (0–1). */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s <= 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    let x = (t / 360) % 1;
    if (x < 0) x += 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [f(h + 120), f(h), f(h - 120)];
}

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
  const wh = a.whites / 100;
  const bl = a.blacks / 100;
  const vib = a.vibrance / 100;
  // only the families the person actually touched are mixed (the loop stays cheap on an untouched picture)
  const cells = HSL_CELLS.filter((c) => a[c.h] || a[c.s] || a[c.l]).map((c) => ({ hue: c.hue, h: a[c.h] / 100, s: a[c.s] / 100, l: a[c.l] / 100 }));
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
    // the ends of the scale: the whites roll the top, the blacks the floor (each weighted to its own end only)
    if (wh || bl) {
      const l = clamp01(0.2126 * r + 0.7152 * g + 0.0722 * b);
      const add = wh * 0.28 * l * l * l + bl * 0.28 * (1 - l) ** 3;
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
    // «الحيوية»: the paler a colour is, the more it gains — a saturated colour and skin are left nearly alone
    if (vib) {
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      const cur = mx <= 0 ? 0 : (mx - mn) / mx;
      const k = 1 + vib * (1 - cur) * 0.9;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = l + (r - l) * k;
      g = l + (g - l) * k;
      b = l + (b - l) * k;
    }
    // the colour mixer: every family's own hue, saturation and brightness
    if (cells.length) {
      const [hh, ss, ll] = rgbToHsl(clamp01(r), clamp01(g), clamp01(b));
      if (ss > 0.02) {
        let dh = 0;
        let ks = 1;
        let kl = 1;
        for (const c of cells) {
          const w = bandWeight(hh, c.hue);
          if (!w) continue;
          dh += c.h * 28 * w;
          ks *= 1 + c.s * w;
          kl *= 1 + c.l * 0.6 * w;
        }
        if (dh || ks !== 1 || kl !== 1) {
          const [nr, ng, nb] = hslToRgb(hh + dh, clamp01(ss * ks), clamp01(ll * kl));
          r = nr;
          g = ng;
          b = nb;
        }
      }
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
  // «إزالة الضباب»: the haze is the flat, pale veil over everything — contrast and colour against it
  if (a.dehaze) {
    const k = a.dehaze / 100;
    const lift = 1 + k * 0.45;
    const sat2 = 1 + k * 0.35;
    for (let i = 0; i < w * h * 4; i += 4) {
      let r = data[i] / 255;
      let g = data[i + 1] / 255;
      let b = data[i + 2] / 255;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = clamp01(0.5 + (r - 0.5) * lift - k * 0.06 * (1 - l));
      g = clamp01(0.5 + (g - 0.5) * lift - k * 0.06 * (1 - l));
      b = clamp01(0.5 + (b - 0.5) * lift - k * 0.06 * (1 - l));
      const l2 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      data[i] = clamp01(l2 + (r - l2) * sat2) * 255;
      data[i + 1] = clamp01(l2 + (g - l2) * sat2) * 255;
      data[i + 2] = clamp01(l2 + (b - l2) * sat2) * 255;
    }
  }
  // «الوضوح» (a wide halo, the midtones only) and «النسيج» (a narrow one, no colour shift): local contrast
  for (const [amount, radius, mid] of [
    [a.clarity, Math.max(2, side * 0.012), true],
    [a.texture, Math.max(1, side * 0.0035), false],
  ] as [number, number, boolean][]) {
    if (!amount) continue;
    const copy = new Uint8ClampedArray(data);
    boxBlur(copy, w, h, radius);
    const k = (amount / 100) * (mid ? 0.9 : 0.75);
    for (let i = 0; i < w * h * 4; i += 4) {
      // the midtones take the most of «الوضوح»: the ends of the scale keep their detail instead of clipping
      const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      const guard = mid ? 1 - (2 * l - 1) ** 2 : 1;
      for (let c = 0; c < 3; c++) data[i + c] = data[i + c] + (data[i + c] - copy[i + c]) * k * guard;
    }
  }
  if (a.blur > 0) boxBlur(data, w, h, (a.blur / 100) * side * 0.04);
  if (a.sharpen > 0) {
    // unsharp mask: the picture plus its difference from a blurred copy
    const copy = new Uint8ClampedArray(data);
    boxBlur(copy, w, h, Math.max(1, side * 0.002));
    const k = (a.sharpen / 100) * 1.6;
    for (let i = 0; i < w * h * 4; i += 4) for (let c = 0; c < 3; c++) data[i + c] = data[i + c] + (data[i + c] - copy[i + c]) * k;
  }
  if (a.vignette) {
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
