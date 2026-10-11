// «السكوبات» — the colourist's instruments, worked out from a picture's pixels: the RGB parade, the luma waveform, the
// histogram and the vectorscope (with its skin-tone line). Pure maths here (so it is tested); ScopesPanel.tsx paints
// the numbers on canvases. Densities are counted per column (parade, waveform) or per cell (vectorscope) and shown
// with a gamma so a few pixels still show and a heap doesn't burn out.

export const LEVELS = 256;

export interface ScopeData {
  cols: number;
  /** [channel][col × LEVELS + level] counts: the red, green and blue parade side by side */
  parade: Float32Array[];
  /** luma: [col × LEVELS + level] */
  wave: Float32Array;
  /** [0..3] = R G B and luma, LEVELS each */
  hist: Float32Array[];
  /** the vectorscope's grid (VEC × VEC): Cb → x, Cr → y (y up) */
  vec: Float32Array;
  vecSize: number;
  /** the biggest count of each (for scaling) */
  max: { parade: number; wave: number; hist: number; vec: number };
}

export const VEC = 160;

/** The scopes of a picture (RGBA 0–255, w × h): every pixel counted once. */
export function scopeData(px: ArrayLike<number>, w: number, h: number, cols = 192): ScopeData {
  const parade = [new Float32Array(cols * LEVELS), new Float32Array(cols * LEVELS), new Float32Array(cols * LEVELS)];
  const wave = new Float32Array(cols * LEVELS);
  const hist = [new Float32Array(LEVELS), new Float32Array(LEVELS), new Float32Array(LEVELS), new Float32Array(LEVELS)];
  const vec = new Float32Array(VEC * VEC);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = px[i],
        g = px[i + 1],
        b = px[i + 2];
      const c = Math.min(cols - 1, Math.floor((x / w) * cols));
      const l = Math.min(255, Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b));
      parade[0][c * LEVELS + r]++;
      parade[1][c * LEVELS + g]++;
      parade[2][c * LEVELS + b]++;
      wave[c * LEVELS + l]++;
      hist[0][r]++;
      hist[1][g]++;
      hist[2][b]++;
      hist[3][l]++;
      // BT.709 chroma, −0.5…0.5 → the grid
      const yy = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const cb = (b - yy) / 1.8556 / 255;
      const cr = (r - yy) / 1.5748 / 255;
      const vx = Math.min(VEC - 1, Math.max(0, Math.floor((cb + 0.5) * VEC)));
      const vy = Math.min(VEC - 1, Math.max(0, Math.floor((0.5 - cr) * VEC)));
      vec[vy * VEC + vx]++;
    }
  }
  const mx = (a: Float32Array[] | Float32Array) => (Array.isArray(a) ? Math.max(...a.map((x) => peak(x))) : peak(a));
  return { cols, parade, wave, hist, vec, vecSize: VEC, max: { parade: mx(parade), wave: peak(wave), hist: Math.max(...hist.map(peak)), vec: peak(vec) } };
}
function peak(a: Float32Array) {
  let m = 0;
  for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i];
  return m;
}

/** A count as a 0–1 brightness: a gamma on count/peak (a single pixel still shows). */
export const glow = (n: number, max: number, gamma = 0.35) => (n <= 0 || max <= 0 ? 0 : Math.min(1, Math.pow(n / max, gamma) * 1.15));

/** Where each primary and secondary sits on the vectorscope's grid (the little boxes), as [name, x, y] in 0–1. */
export function vectorTargets(): [string, number, number][] {
  const t = (name: string, r: number, g: number, b: number): [string, number, number] => {
    const yy = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return [name, (b - yy) / 1.8556 + 0.5, 0.5 - (r - yy) / 1.5748];
  };
  return [t("R", 1, 0, 0), t("MG", 1, 0, 1), t("B", 0, 0, 1), t("CY", 0, 1, 1), t("G", 0, 1, 0), t("YL", 1, 1, 0)];
}

/** The skin-tone line: from the centre toward where skin sits (about 123° on the scope, between R and YL). */
export function skinLine(): { x: number; y: number } {
  // a mid skin tone (240, 190, 160) → its chroma direction
  const [r, g, b] = [240, 190, 160];
  const yy = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const cb = (b - yy) / 1.8556 / 255;
  const cr = (r - yy) / 1.5748 / 255;
  const len = Math.hypot(cb, cr) || 1;
  return { x: cb / len, y: -cr / len };
}
