// The scopes a colourist reads, as numbers «حيدرة» can judge a frame by (it sees the picture too, but numbers don't
// lie about a cast or a clip): the brightness spread like a waveform (IRE 0–100: the darkest, the middle, the
// brightest), what is crushed or blown, the saturation, the colour cast in the shadows, mid-tones and highlights (where
// R, G and B should meet on anything neutral), and the skin: how much of the frame looks like skin and its hue (the
// vectorscope's skin line is ~20–30°). Pure.

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
}

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
  };
}

/** A scope as one short line for Claude. */
export const scopeLine = (s: Scope) =>
  `IRE p2 ${s.p2} / p50 ${s.p50} / p98 ${s.p98}; crushed ${s.crushed}% blown ${s.blown}%; sat ${s.sat}; cast (r,b vs g) shadows ${s.cast.shadows.r},${s.cast.shadows.b} mids ${s.cast.mids.r},${s.cast.mids.b} highs ${s.cast.highs.r},${s.cast.highs.b}; skin ${s.skin ? `${s.skin.share}% hue ${s.skin.hue}° sat ${s.skin.sat}` : "none"}`;

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
  return all.every((x) => Number.isFinite(x)) ? s : null;
}
