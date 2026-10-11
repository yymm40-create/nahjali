// «الكي» — the maths of the colour key, shared by the GPU shader (key-gl.ts, the same formulas in GLSL), the CPU
// fallback and the tests that train it on a thousand made-up green/blue screens (tests/editor/key-training.test.ts).
//
// The old key measured how far each pixel's chroma (Cb/Cr) was from the key colour. Chroma shrinks with brightness,
// so the screen's shadows, its uneven light and its darker folds fell outside the tolerance and stayed — «ما يزيل».
// This one works the way the big keyers do (Keylight's screen-colour difference, Ultra Key's tolerance/pedestal,
// Resolve's HSL qualifier, Primatte's distance in a brightness-free space): a pixel is the screen when its HUE is the
// screen's and its SATURATION is close to the screen's — both independent of how bright it is — and it isn't nearly
// black. Then the matte is cleaned like Ultra Key's «Clip black / Clip white» («تنظيف الخلفية» / «سد الفراغات»),
// choked, softened, and the screen's colour cast taken off what stays by limiting the screen's own channel
// (Keylight's despill: green never higher than the brightest of red and blue).

export interface KeyLike {
  color: string;
  tolerance: number;
  soft: number;
  spill: number;
  choke: number;
  clean?: number;
  fill?: number;
}

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export function rgbToHex([r, g, b]: RGB) {
  const h = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Hue in turns (0…1), saturation (0…1) and value (the brightest channel), as HSV. */
export function hsv(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, mx > 1e-6 ? d / mx : 0, mx];
}
export const hueDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % 1;
  return Math.min(d, 1 - d);
};
export const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0 || 1e-6)));
  return t * t * (3 - 2 * t);
};

/** The numbers the key works with (the shader gets exactly these as uniforms). */
export function keyParams(k: KeyLike) {
  const [r, g, b] = hexToRgb(k.color);
  const [h, s, v] = hsv(r, g, b);
  const tol = Math.min(1, Math.max(0, k.tolerance));
  const soft = Math.min(1, Math.max(0, k.soft));
  // the despill's channel: the key's brightest one, when it clearly leads (a green or blue screen); otherwise (a
  // yellow wall, a grey one) the cast is taken off along the key's chroma instead
  const ch = [r, g, b];
  const d = ch.indexOf(Math.max(r, g, b));
  const rest = ch.filter((_, i) => i !== d);
  const lead = ch[d] - Math.max(...rest) > 0.3 * ch[d] ? d : -1;
  const clean = Math.min(1, Math.max(0, k.clean ?? 0.15));
  const fill = Math.min(1, Math.max(0, k.fill ?? 0.15));
  return {
    hue: h,
    // a key picked off a nearly grey colour still needs some saturation to compare with
    sat: Math.max(0.12, s),
    val: v,
    hTol: 0.03 + tol * 0.12,
    hSoft: 0.015 + soft * 0.08,
    sLo: 0.7 - tol * 0.55,
    sSoft: 0.05 + soft * 0.35,
    // the colour's strength (max − min) against the screen's: the screen's shadows (weaker but the same colour) still
    // go, while a dark shirt with a little of the screen's glow on it — the same hue, but faint — stays (Keylight's
    // colour difference, which brightness-free saturation alone would lose)
    chroma: Math.max(0.08, Math.max(r, g, b) - Math.min(r, g, b)),
    cLo: 0.45 - tol * 0.25,
    cSoft: 0.08 + soft * 0.2,
    clip0: clean * 0.6,
    clip1: 1 - fill * 0.6,
    spill: Math.min(1, Math.max(0, k.spill)),
    choke: Math.min(1, Math.max(0, k.choke)),
    lead,
    rgb: [r, g, b] as RGB,
  };
}
export type KeyP = ReturnType<typeof keyParams>;

/** How much of a pixel is the screen (1 = all screen), before the clean-up. */
export function screenness(r: number, g: number, b: number, P: KeyP) {
  const [h, s, v] = hsv(r, g, b);
  const hueW = 1 - smooth(P.hTol, P.hTol + P.hSoft, hueDist(h, P.hue));
  const satW = smooth(P.sLo - P.sSoft, P.sLo, s / P.sat);
  const valW = smooth(0.035, 0.09, v) * smooth(P.cLo - P.cSoft, P.cLo, (s * v) / P.chroma);
  return hueW * satW * valW;
}

/** The pixel's alpha (1 = kept) after «تنظيف الخلفية» and «سد الفراغات». */
export function alphaOf(r: number, g: number, b: number, P: KeyP) {
  const a = 1 - screenness(r, g, b, P);
  return Math.min(1, Math.max(0, (a - P.clip0) / Math.max(0.02, P.clip1 - P.clip0)));
}

/** The screen's cast taken off a kept pixel (in place). */
export function despill(c: RGB, P: KeyP): RGB {
  if (P.spill <= 0) return c;
  if (P.lead >= 0) {
    const o = [0, 1, 2].filter((i) => i !== P.lead);
    const limit = Math.max(c[o[0]], c[o[1]]);
    const over = c[P.lead] - limit;
    if (over > 0) c[P.lead] -= over * P.spill;
    return c;
  }
  // along the key's chroma (Cb/Cr), brightness kept
  const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const ky = 0.2126 * P.rgb[0] + 0.7152 * P.rgb[1] + 0.0722 * P.rgb[2];
  let kb = (P.rgb[2] - ky) / 1.8556;
  let kr = (P.rgb[0] - ky) / 1.5748;
  const len = Math.hypot(kb, kr);
  if (len < 0.02) return c;
  kb /= len;
  kr /= len;
  let cb = (c[2] - y) / 1.8556;
  let cr = (c[0] - y) / 1.5748;
  const along = cb * kb + cr * kr;
  if (along <= 0) return c;
  cb -= kb * along * P.spill;
  cr -= kr * along * P.spill;
  const r = y + 1.5748 * cr;
  const b = y + 1.8556 * cb;
  const g = (y - 0.2126 * r - 0.0722 * b) / 0.7152;
  c[0] = Math.min(1, Math.max(0, r));
  c[1] = Math.min(1, Math.max(0, g));
  c[2] = Math.min(1, Math.max(0, b));
  return c;
}

/**
 * The whole key on a picture's pixels (RGBA 0–255, in place; not premultiplied): the colour first evened out over
 * the pixel and its four neighbours (video noise and compression blocks), the matte, the choke (the smallest matte
 * around, up to 4 px), then the despill. `show` writes the matte itself (white kept, black gone).
 */
export function keyPixels(px: Uint8ClampedArray, w: number, h: number, k: KeyLike, show = false) {
  const P = keyParams(k);
  const at = (x: number, y: number) => ((Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4);
  const m = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        b = 0;
      for (const [dx, dy, wt] of TAPS) {
        const i = at(x + dx, y + dy);
        r += px[i] * wt;
        g += px[i + 1] * wt;
        b += px[i + 2] * wt;
      }
      m[y * w + x] = alphaOf(r / 255, g / 255, b / 255, P);
    }
  let matte = m;
  if (P.choke > 0) {
    const rr = Math.max(1, Math.round(P.choke * 4));
    matte = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const v = m[y * w + x];
        const l = m[y * w + Math.max(0, x - rr)];
        const rt = m[y * w + Math.min(w - 1, x + rr)];
        const u = m[Math.max(0, y - rr) * w + x];
        const d = m[Math.min(h - 1, y + rr) * w + x];
        // a partial choke: between the matte and its smallest neighbour
        const lo = Math.min(v, l, rt, u, d);
        matte[y * w + x] = v + (lo - v) * Math.min(1, P.choke * 2);
      }
  }
  for (let i = 0, j = 0; j < w * h; i += 4, j++) {
    const a = matte[j];
    if (show) {
      px[i] = px[i + 1] = px[i + 2] = Math.round(a * 255);
      px[i + 3] = 255;
      continue;
    }
    const c = despill([px[i] / 255, px[i + 1] / 255, px[i + 2] / 255], P);
    px[i] = Math.round(c[0] * 255);
    px[i + 1] = Math.round(c[1] * 255);
    px[i + 2] = Math.round(c[2] * 255);
    px[i + 3] = Math.round(a * px[i + 3]);
  }
  return px;
}
/** The noise filter's taps: the pixel and its four neighbours. */
const TAPS: [number, number, number][] = [
  [0, 0, 0.4],
  [1, 0, 0.15],
  [-1, 0, 0.15],
  [0, 1, 0.15],
  [0, -1, 0.15],
];

/**
 * «🪄 كشف تلقائي»: the screen's colour and the tolerance it needs, found in a picture (RGBA 0–255): the most common
 * strong hue (the frame's edges count three times — the screen is usually around the person), its median colour,
 * and how far its own hues and saturations spread (shadows, uneven light). Null when no colour fills enough of it.
 */
export function detectKey(px: Uint8ClampedArray, w: number, h: number): { color: string; tolerance: number; cover: number } | null {
  const BINS = 72;
  const hist = new Float64Array(BINS);
  let total = 0;
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 40000)));
  const pts: { h: number; s: number; v: number; r: number; g: number; b: number; w: number }[] = [];
  for (let y = 0; y < h; y += step)
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      const r = px[i] / 255,
        g = px[i + 1] / 255,
        b = px[i + 2] / 255;
      const edge = Math.min(x / w, y / h, 1 - x / w, 1 - y / h) < 0.15 ? 3 : 1;
      total += edge;
      const [hh, s, v] = hsv(r, g, b);
      if (s < 0.2 || v < 0.12) continue;
      hist[Math.floor(hh * BINS) % BINS] += edge;
      pts.push({ h: hh, s, v, r, g, b, w: edge });
    }
  if (!pts.length || !total) return null;
  // the peak of the hues, smoothed over its neighbours
  let best = 0;
  let bestV = -1;
  for (let i = 0; i < BINS; i++) {
    const v = hist[(i + BINS - 1) % BINS] + hist[i] * 2 + hist[(i + 1) % BINS];
    if (v > bestV) {
      bestV = v;
      best = i;
    }
  }
  const centre = (best + 0.5) / BINS;
  const near = pts.filter((p) => hueDist(p.h, centre) < 12 / 360);
  const cover = near.reduce((a, p) => a + p.w, 0) / total;
  if (cover < 0.12) return null;
  const med = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const key: RGB = [med(near.map((p) => p.r)), med(near.map((p) => p.g)), med(near.map((p) => p.b))];
  const [kh, ks] = hsv(...key);
  // how wide the screen's own hues and saturations go (within 40° of it): the tolerance that covers 97 % of them
  const screen = pts.filter((p) => hueDist(p.h, kh) < 40 / 360 && p.s > 0.18);
  const pct = (xs: number[], q: number) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * s.length)))];
  };
  // (90 %: the rest is the person's edge and the glow on their clothes, which the clean-up and the despill handle)
  const dh = pct(screen.map((p) => hueDist(p.h, kh)), 0.9);
  const sr = pct(screen.map((p) => p.s / Math.max(0.12, ks)), 0.1);
  const byHue = (dh + 0.01 - 0.03) / 0.12;
  const bySat = (0.7 - (sr - 0.04)) / 0.55;
  const tolerance = Math.round(Math.min(0.55, Math.max(0.25, byHue, bySat)) * 100) / 100;
  return { color: rgbToHex(key), tolerance, cover: Math.round(cover * 100) / 100 };
}

/** The average colour of a square around a point (RGBA 0–255) — what «🎯 اختر من الشاشة» takes. */
export function sampleAt(px: Uint8ClampedArray, w: number, h: number, x: number, y: number, r = 3): string {
  let R = 0,
    G = 0,
    B = 0,
    n = 0;
  for (let j = Math.max(0, y - r); j <= Math.min(h - 1, y + r); j++)
    for (let i = Math.max(0, x - r); i <= Math.min(w - 1, x + r); i++) {
      const o = (j * w + i) * 4;
      R += px[o];
      G += px[o + 1];
      B += px[o + 2];
      n++;
    }
  return n ? rgbToHex([R / n / 255, G / n / 255, B / n / 255]) : "#00ff00";
}
