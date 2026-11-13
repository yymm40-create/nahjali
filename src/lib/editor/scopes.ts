// The scopes a colourist reads, as numbers «حيدرا ماكس» can judge a frame by (it sees the picture too, but numbers don't
// lie about a cast or a clip): the brightness spread like a waveform (IRE 0–100: the darkest, the middle, the
// brightest), what is crushed or blown, the saturation, the colour cast in the shadows, mid-tones and highlights (where
// R, G and B should meet on anything neutral), and the skin: how much of the frame looks like skin and its hue (the
// vectorscope's skin line is ~20–30°). Then the colourist's own measurements in Oklab (the perceptual space the grade
// program works in, K.oklch): how colourful the frame is, where THIS skin sits and whether its highlights burn, where
// the greens and the bright near-whites (walls, sky) sit, and whether the frame looks like ungraded log. Pure.

export interface Scope {
  /** brightness percentiles, IRE 0–100 */
  p2: number;
  p50: number;
  p98: number;
  /** % of the frame crushed to black (≤ 1 IRE) or blown to white (≥ 99 IRE) */
  crushed: number;
  blown: number;
  /** mean saturation 0–100 */
  sat: number;
  /** colour cast by tonal range: how far red and blue sit from green, in IRE (+r = warm/red, +b = blue) */
  cast: { shadows: { r: number; b: number }; mids: { r: number; b: number }; highs: { r: number; b: number } };
  /** skin-like pixels: share of the frame %, their hue in degrees and saturation 0–100 (null: none) */
  skin: { share: number; hue: number; sat: number } | null;
  /** the colourist's measurements in Oklab (K.oklch's units: C 0…~0.37, h in degrees); absent on old scopes */
  ok?: OkFacts;
}

export interface OkFacts {
  /** chroma of the whole frame: its mean and its 95th percentile */
  c: number;
  c95: number;
  /** % of the frame with a channel at 255 (a clipped channel: hue jumps, «فاقع») */
  clipped: number;
  /** the skin pixels: their Oklab hue, chroma and lightness, and «hot»: % of the FRAME that is skin-coloured light at the top of the range (burning faces — or sun on a warm wall: look which) */
  skin: { h: number; c: number; l: number; hot: number } | null;
  /** greens (foliage): share of the frame %, hue, chroma */
  green: { share: number; h: number; c: number } | null;
  /** bright near-whites (walls, sky, paper): share %, hue, chroma — a peach/pink or green cast shows here first */
  bright: { share: number; h: number; c: number } | null;
  /** lifted blacks, no whites, little colour: it looks like log footage that was never decoded */
  flat: boolean;
}

const SRGB_LIN = Array.from({ length: 256 }, (_, i) => {
  const x = i / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
});
const r3 = (n: number) => Math.round(n * 1000) / 1000;
/** Oklab of an 8-bit sRGB pixel. */
function oklab(r: number, g: number, b: number) {
  const R = SRGB_LIN[r],
    G = SRGB_LIN[g],
    B = SRGB_LIN[b];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B),
    m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B),
    s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
/** A running circular mean of hues (with chroma and lightness). */
const acc = () => ({ n: 0, x: 0, y: 0, c: 0, l: 0, hot: 0 });
type Acc = ReturnType<typeof acc>;
function add(a: Acc, L: number, A: number, B: number, C: number) {
  a.n++;
  a.x += A / (C || 1);
  a.y += B / (C || 1);
  a.c += C;
  a.l += L;
}
const hueOf = (a: Acc) => Math.round(((Math.atan2(a.y, a.x) * 180) / Math.PI + 360) % 360);

const r1 = (n: number) => Math.round(n * 10) / 10;

/** The scope of an RGBA frame (any size; every pixel is used up to ~120k, else sampled evenly). */
export function scopeOf(px: ArrayLike<number>, w: number, h: number): Scope {
  const n = w * h;
  const step = Math.max(1, Math.floor(n / 120_000));
  const hist = new Uint32Array(256);
  let count = 0,
    crushed = 0,
    blown = 0,
    satSum = 0;
  const band = [0, 1, 2].map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
  let skinN = 0,
    skinX = 0,
    skinY = 0,
    skinS = 0;
  const okSkin = acc(),
    okGreen = acc(),
    okBright = acc(),
    cHist = new Uint32Array(401);
  let cSum = 0,
    clipped = 0;
  const skinC: number[] = [];
  for (let i = 0; i < n; i += step) {
    const r = px[i * 4],
      g = px[i * 4 + 1],
      b = px[i * 4 + 2];
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    hist[Math.min(255, Math.round(y))]++;
    count++;
    if (y <= 2.55) crushed++;
    if (y >= 252.45) blown++;
    const mx = Math.max(r, g, b),
      mn = Math.min(r, g, b);
    const s = mx ? (mx - mn) / mx : 0;
    satSum += s;
    const [L, A, B] = oklab(r, g, b);
    const C = Math.hypot(A, B);
    cSum += C;
    cHist[Math.min(400, Math.round(C * 1000))]++;
    if (mx >= 255) clipped++;
    const H = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
    if (C >= 0.02 && H >= 85 && H <= 175 && L > 0.15 && L < 0.97) add(okGreen, L, A, B, C);
    if (L >= 0.8 && C < 0.05) add(okBright, L, A, B, C);
    // skin burning: skin-coloured light at the top of the range (the skin class above stops below it)
    if (mx >= 250 && r >= g && g >= b && H >= 30 && H <= 68 && C >= 0.035 && C < 0.13) okSkin.hot++;
    // neutral-ish pixels show the cast best (a red wall says nothing about the white balance)
    if (s < 0.35) {
      const k = y < 64 ? 0 : y < 192 ? 1 : 2;
      band[k].r += r;
      band[k].g += g;
      band[k].b += b;
      band[k].n++;
    }
    // skin: reddish-orange, not grey and not neon, not too dark or too bright
    if (mx > 50 && mx < 250 && s > 0.12 && s < 0.68 && r >= g && g >= b) {
      const hue = mx === mn ? 0 : 60 * ((g - b) / (mx - mn));
      if (hue >= 5 && hue <= 50) {
        skinN++;
        // averaged as an angle
        skinX += Math.cos((hue * Math.PI) / 180);
        skinY += Math.sin((hue * Math.PI) / 180);
        skinS += s;
        // the Oklab skin is chosen after the loop (it needs the frame's chroma): kept as a candidate for now
        // (Oklab 30–68°: skin of every complexion sits there; dry palms and sand are yellower, ~75–90°)
        if (H >= 30 && H <= 68 && skinC.length < 60_000) skinC.push(L, A, B, C);
      }
    }
  }
  const pct = (q: number) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= q * count) return (v / 255) * 100;
    }
    return 100;
  };
  const c95 = (() => {
    let acc2 = 0;
    for (let v = 0; v <= 400; v++) {
      acc2 += cHist[v];
      if (acc2 >= 0.95 * count) return v / 1000;
    }
    return 0.4;
  })();
  const cMean = cSum / count;
  // a cream wall has skin's hue but less chroma: only skin candidates with enough colour for THIS frame count
  const skinFloor = Math.min(0.03, Math.max(0.012, 0.35 * c95));
  for (let i = 0; i < skinC.length; i += 4) if (skinC[i + 3] >= skinFloor) add(okSkin, skinC[i], skinC[i + 1], skinC[i + 2], skinC[i + 3]);
  const share = (a: Acc) => (a.n / count) * 100;
  const ok: OkFacts = {
    c: r3(cMean),
    c95: r3(c95),
    clipped: r1((clipped / count) * 100),
    skin: skinN / count > 0.005 && okSkin.n ? { h: hueOf(okSkin), c: r3(okSkin.c / okSkin.n), l: r3(okSkin.l / okSkin.n), hot: r1((okSkin.hot / count) * 100) } : null,
    green: share(okGreen) > 0.3 ? { share: r1(share(okGreen)), h: hueOf(okGreen), c: r3(okGreen.c / okGreen.n) } : null,
    bright: share(okBright) > 0.5 ? { share: r1(share(okBright)), h: hueOf(okBright), c: r3(okBright.c / okBright.n) } : null,
    flat: pct(0.02) >= 8 && pct(0.98) <= 93 && cMean < 0.03,
  };
  const castOf = (k: number) => (band[k].n ? { r: r1(((band[k].r - band[k].g) / band[k].n / 255) * 100), b: r1(((band[k].b - band[k].g) / band[k].n / 255) * 100) } : { r: 0, b: 0 });
  return {
    p2: r1(pct(0.02)),
    p50: r1(pct(0.5)),
    p98: r1(pct(0.98)),
    crushed: r1((crushed / count) * 100),
    blown: r1((blown / count) * 100),
    sat: r1((satSum / count) * 100),
    cast: { shadows: castOf(0), mids: castOf(1), highs: castOf(2) },
    skin: skinN / count > 0.005 ? { share: r1((skinN / count) * 100), hue: Math.round((Math.atan2(skinY, skinX) * 180) / Math.PI), sat: r1((skinS / skinN) * 100) } : null,
    ok,
  };
}

/** The Oklab measurements as one short line (the grade program's own units). */
export const okLine = (o: OkFacts) =>
  `Oklab: chroma mean ${o.c} p95 ${o.c95}; clipped channels ${o.clipped}%; skin ${o.skin ? `h ${o.skin.h}° C ${o.skin.c} L ${o.skin.l}, skin-coloured light at the top ${o.skin.hot}% of the frame` : "none"}; greens ${o.green ? `${o.green.share}% h ${o.green.h}° C ${o.green.c}` : "none"}; bright near-whites ${o.bright ? `${o.bright.share}% h ${o.bright.h}° C ${o.bright.c}` : "none"}${o.flat ? "; LOOKS LIKE UNDECODED LOG (lifted blacks, no whites, little colour)" : ""}`;

/** A scope as one short line for Claude. */
export const scopeLine = (s: Scope) =>
  `IRE p2 ${s.p2} / p50 ${s.p50} / p98 ${s.p98}; crushed ${s.crushed}% blown ${s.blown}%; sat ${s.sat}; cast (r,b vs g) shadows ${s.cast.shadows.r},${s.cast.shadows.b} mids ${s.cast.mids.r},${s.cast.mids.b} highs ${s.cast.highs.r},${s.cast.highs.b}; skin ${s.skin ? `${s.skin.share}% hue ${s.skin.hue}° sat ${s.skin.sat}` : "none"}${s.ok ? ` | ${okLine(s.ok)}` : ""}`;

/** A scope sent by the page, checked (null when it isn't one). */
export function readScope(v: unknown): Scope | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.round(x * 10) / 10 : NaN);
  const rb = (x: unknown) => {
    const c = (x ?? {}) as { r?: unknown; b?: unknown };
    return { r: n(c.r), b: n(c.b) };
  };
  const c = (o.cast ?? {}) as Record<string, unknown>;
  const sk = o.skin && typeof o.skin === "object" ? (o.skin as Record<string, unknown>) : null;
  const s: Scope = {
    p2: n(o.p2),
    p50: n(o.p50),
    p98: n(o.p98),
    crushed: n(o.crushed),
    blown: n(o.blown),
    sat: n(o.sat),
    cast: { shadows: rb(c.shadows), mids: rb(c.mids), highs: rb(c.highs) },
    skin: sk ? { share: n(sk.share), hue: n(sk.hue), sat: n(sk.sat) } : null,
  };
  const all = [s.p2, s.p50, s.p98, s.crushed, s.blown, s.sat, s.cast.shadows.r, s.cast.shadows.b, s.cast.mids.r, s.cast.mids.b, s.cast.highs.r, s.cast.highs.b, ...(s.skin ? [s.skin.share, s.skin.hue, s.skin.sat] : [])];
  if (!all.every((x) => Number.isFinite(x))) return null;
  const ok = readOk(o.ok);
  return ok ? { ...s, ok } : s;
}

/** The Oklab block of a scope sent by the page (null when it isn't one). */
function readOk(v: unknown): OkFacts | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const n = (x: unknown, lo: number, hi: number) => (typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi ? Math.round(x * 1000) / 1000 : NaN);
  const part = <T extends Record<string, number>>(x: unknown, keys: [keyof T & string, number, number][]): T | null => {
    if (!x || typeof x !== "object") return null;
    const r = Object.fromEntries(keys.map(([k, lo, hi]) => [k, n((x as Record<string, unknown>)[k], lo, hi)])) as T;
    return Object.values(r).every((y) => Number.isFinite(y)) ? r : null;
  };
  const out: OkFacts = {
    c: n(o.c, 0, 1),
    c95: n(o.c95, 0, 1),
    clipped: n(o.clipped, 0, 100),
    skin: part(o.skin, [["h", 0, 360], ["c", 0, 1], ["l", 0, 1], ["hot", 0, 100]]) as OkFacts["skin"],
    green: part(o.green, [["share", 0, 100], ["h", 0, 360], ["c", 0, 1]]) as OkFacts["green"],
    bright: part(o.bright, [["share", 0, 100], ["h", 0, 360], ["c", 0, 1]]) as OkFacts["bright"],
    flat: o.flat === true,
  };
  return [out.c, out.c95, out.clipped].every((x) => Number.isFinite(x)) ? out : null;
}
