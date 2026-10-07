// «التلوين» — a clip's full colour grade, the way the big grading programs do it: the camera's log undone, the
// primaries (wheels, exposure, contrast, warmth…), curves (RGB and hue/sat), secondaries keyed by colour
// with their own masks, power windows (masks), 3D LUTs (.cube) and ready looks, then film: split toning, halation,
// grain, vignette. This file is the model, read/validated like the rest of the timeline, plus the maths that
// doesn't need the GPU (curves, log decoding constants, gamut matrices, .cube files, looks). The drawing is in
// components/jawad/editor/grade-gl.ts (WebGL2), the same in the preview and the export.

// ───────── the model ─────────

export type RGB = [number, number, number];

/** A colour wheel: an offset per channel (−1…1, 0 = nothing) and a master (luma) offset. */
export interface Wheel {
  rgb: RGB;
  y: number;
}

export interface Pt {
  x: number;
  y: number;
}

export interface Curves {
  /** 0…1 → 0…1, through (0,0) and (1,1) when untouched */
  master: Pt[];
  r: Pt[];
  g: Pt[];
  b: Pt[];
  /** x = hue 0…1 (red at 0), y = 0.5 means no shift; ±0.5 = ∓180° */
  hueHue: Pt[];
  /** x = hue, y = 0.5 means ×1 saturation (0 → ×0, 1 → ×2) */
  hueSat: Pt[];
  /** x = hue, y = 0.5 means no change of brightness */
  hueLum: Pt[];
  /** x = luma, y = 0.5 means ×1 saturation */
  lumSat: Pt[];
  /** x = saturation, y = 0.5 means ×1 */
  satSat: Pt[];
}

export type MaskKind = "ellipse" | "rect" | "linear" | "path";

/** A power window: where the grade (or a secondary) applies, in the picture's own 0…1 coordinates. */
export interface Mask {
  kind: MaskKind;
  /** centre (ellipse, rect), or the line's start (linear) */
  x: number;
  y: number;
  /** size (ellipse, rect), or the line's end as an offset (linear) */
  w: number;
  h: number;
  /** degrees */
  rotate: number;
  /** 0…1 of the size, the soft edge */
  feather: number;
  /** rect corners 0…1 */
  round: number;
  invert: boolean;
  /** the drawn shape's corners (path), 0…1 */
  points: Pt[];
  /** the centre moving with the clip's own time (ms from its start) */
  keys: { t: number; x: number; y: number }[];
  /**
   * «ماسك ذكي» (path): the subject's outline at moments of the clip (ms from its start), each with the same number of
   * corners, so the outline changes shape between them (the subject tracked). Empty: `points` as drawn.
   */
  shapes: { t: number; points: Pt[] }[];
}

export interface Qualifier {
  /** the hue picked, 0…1, and how wide around it (0…0.5) and how soft its edges (0…0.5) */
  hue: number;
  hueWidth: number;
  hueSoft: number;
  /** saturation and luma ranges 0…1 with a soft edge */
  satLo: number;
  satHi: number;
  lumLo: number;
  lumHi: number;
  soft: number;
  invert: boolean;
  /** key clean-up: shrink or grow (−1…1) and blur (0…1) */
  grow: number;
  blur: number;
}

/** A secondary: colours picked by the qualifier (and a window) changed on their own. */
export interface Secondary {
  on: boolean;
  name: string;
  key: Qualifier;
  mask: Mask | null;
  /** hue shift in degrees, saturation ×, brightness (stops), warmth (−1…1) */
  hue: number;
  sat: number;
  lum: number;
  temp: number;
  contrast: number;
  /** the key shown instead of the picture (to tune it) */
  show: boolean;
}

export interface Lut3D {
  name: string;
  /** cube edge */
  size: number;
  /** size³ × 3 bytes, base64 */
  data: string;
}

export interface Grade {
  v: 1;
  /** a layer can be switched off without losing it */
  on: boolean;
  /** the layer's name («أساسي»، «البشرة»…) */
  name: string;
  /** colours past what the screen can show (blue LED light, neon) pulled back softly, as ACES's gamut compression; 0…1 */
  compress: number;
  /** the camera's log curve, undone first ("none": the picture as it is) */
  log: LogId;
  /** the colours the camera recorded in: its own wide gamut, or Rec.709 / Rec.2020 (Canon, Sony, Panasonic let you pick) */
  logGamut: LogGamut;
  /** how the file stores its levels: video levels (almost every camera) or full */
  logRange: "video" | "full";
  /** strength of the whole grade 0…1 */
  amount: number;
  /** where the primary grade applies (null: everywhere) */
  mask: Mask | null;
  exposure: number;
  contrast: number;
  pivot: number;
  temp: number;
  tint: number;
  saturation: number;
  vibrance: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  lift: Wheel;
  gamma: Wheel;
  gain: Wheel;
  offset: Wheel;
  curves: Curves;
  secondaries: Secondary[];
  lut: Lut3D | null;
  lutAmount: number;
  /** a ready look's id (for the panel to show which one) */
  look: string | null;
  split: { shadowHue: number; shadowSat: number; highHue: number; highSat: number; balance: number };
  halation: { amount: number; threshold: number; size: number };
  grain: { amount: number; size: number };
  vignette: { amount: number; size: number; soft: number; round: number };
  sharpen: number;
}

export const LINE: Pt[] = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
];
export const FLAT: Pt[] = [
  { x: 0, y: 0.5 },
  { x: 1, y: 0.5 },
];
export const WHEEL0: Wheel = { rgb: [0, 0, 0], y: 0 };
export const NEUTRAL_CURVES: Curves = { master: LINE, r: LINE, g: LINE, b: LINE, hueHue: FLAT, hueSat: FLAT, hueLum: FLAT, lumSat: FLAT, satSat: FLAT };

export const NEUTRAL_GRADE: Grade = {
  v: 1,
  on: true,
  name: "",
  compress: 1,
  log: "none",
  logGamut: "camera",
  logRange: "video",
  amount: 1,
  mask: null,
  exposure: 0,
  contrast: 1,
  pivot: 0.435,
  temp: 0,
  tint: 0,
  saturation: 1,
  vibrance: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  lift: WHEEL0,
  gamma: WHEEL0,
  gain: WHEEL0,
  offset: WHEEL0,
  curves: NEUTRAL_CURVES,
  secondaries: [],
  lut: null,
  lutAmount: 1,
  look: null,
  split: { shadowHue: 0.6, shadowSat: 0, highHue: 0.1, highSat: 0, balance: 0 },
  halation: { amount: 0, threshold: 0.8, size: 0.5 },
  grain: { amount: 0, size: 0.5 },
  vignette: { amount: 0, size: 0.7, soft: 0.5, round: 0.5 },
  sharpen: 0,
};

export const NEUTRAL_QUALIFIER: Qualifier = { hue: 0.08, hueWidth: 0.08, hueSoft: 0.06, satLo: 0.1, satHi: 1, lumLo: 0, lumHi: 1, soft: 0.1, invert: false, grow: 0, blur: 0.1 };
export const NEW_SECONDARY: Secondary = { on: true, name: "", key: NEUTRAL_QUALIFIER, mask: null, hue: 0, sat: 1, lum: 0, temp: 0, contrast: 1, show: false };
export const NEW_MASK: Mask = { kind: "ellipse", x: 0.5, y: 0.5, w: 0.6, h: 0.6, rotate: 0, feather: 0.3, round: 0.2, invert: false, points: [], keys: [], shapes: [] };
export const MAX_SECONDARIES = 4;
/** grading layers on one clip, run one after another (like nodes in series) */
export const MAX_LAYERS = 4;

/** A clip's layers read from a saved clip (the old single «grade» becomes layer 1). */
export function readGrades(grades: unknown, single?: unknown): Grade[] {
  const list = Array.isArray(grades) ? grades : single ? [single] : [];
  return list.slice(0, MAX_LAYERS).map(readGrade).filter((g): g is Grade => !!g);
}
export const MAX_LUT = 33;

/** Does this grade change anything (so a clip without one skips the GPU)? */
export function gradeIsNeutral(g: Grade | null | undefined): boolean {
  if (!g || !g.on) return true;
  if (g.amount <= 0) return true;
  const { v, amount, mask, look, name, on, compress, ...rest } = g;
  void [v, amount, mask, look, name, on, compress];
  const { v: _v, amount: _a, mask: _m, look: _l, name: _n, on: _o, compress: _c, ...base } = NEUTRAL_GRADE;
  void [_v, _a, _m, _l, _n, _o, _c];
  return JSON.stringify(rest) === JSON.stringify(base);
}

// ───────── reading (a saved timeline, a patch, a look) ─────────

const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

function readPts(v: unknown, d: Pt[], max = 16): Pt[] {
  if (!Array.isArray(v)) return d;
  const pts = v
    .map((p) => obj(p))
    .map((p) => ({ x: num(p.x, 0, 1, NaN), y: num(p.y, 0, 1, NaN) }))
    .filter((p) => !Number.isNaN(p.x) && !Number.isNaN(p.y))
    .sort((a, b) => a.x - b.x)
    .slice(0, max);
  return pts.length >= 2 ? pts : d;
}

function readWheel(v: unknown, d: Wheel): Wheel {
  const o = obj(v);
  const rgb = Array.isArray(o.rgb) ? o.rgb : [];
  return { rgb: [num(rgb[0], -1, 1, d.rgb[0]), num(rgb[1], -1, 1, d.rgb[1]), num(rgb[2], -1, 1, d.rgb[2])], y: num(o.y, -1, 1, d.y) };
}

export function readMask(v: unknown): Mask | null {
  if (!v || typeof v !== "object") return null;
  const o = obj(v);
  const kind: MaskKind = (["ellipse", "rect", "linear", "path"] as const).includes(o.kind as MaskKind) ? (o.kind as MaskKind) : "ellipse";
  const points = readPts(o.points, [], 64);
  return {
    kind,
    x: num(o.x, -1, 2, 0.5),
    y: num(o.y, -1, 2, 0.5),
    w: num(o.w, 0.01, 3, 0.6),
    h: num(o.h, 0.01, 3, 0.6),
    rotate: num(o.rotate, -180, 180, 0),
    feather: num(o.feather, 0, 1, 0.3),
    round: num(o.round, 0, 1, 0.2),
    invert: bool(o.invert, false),
    points: kind === "path" ? (Array.isArray(o.points) ? (o.points as unknown[]).map(obj).map((p) => ({ x: num(p.x, -1, 2, 0.5), y: num(p.y, -1, 2, 0.5) })).slice(0, 64) : points) : [],
    keys: Array.isArray(o.keys)
      ? (o.keys as unknown[])
          .map(obj)
          .map((k) => ({ t: num(k.t, 0, 1e8, NaN), x: num(k.x, -1, 2, 0.5), y: num(k.y, -1, 2, 0.5) }))
          .filter((k) => !Number.isNaN(k.t))
          .sort((a, b) => a.t - b.t)
          .slice(0, MAX_MASK_KEYS)
      : [],
    shapes: kind === "path" && Array.isArray(o.shapes) ? readShapes(o.shapes) : [],
  };
}

/** Points along a moving mask: a key every 0.1 s for a 3-minute clip. */
export const MAX_MASK_KEYS = 1800;
/** Outlines of a tracked subject, and the corners of each. */
export const MAX_SHAPES = 600;
export const SHAPE_POINTS = 48;

function readShapes(v: unknown[]): Mask["shapes"] {
  const out: Mask["shapes"] = [];
  for (const x of v.slice(0, MAX_SHAPES)) {
    const o = obj(x);
    const t = num(o.t, 0, 1e8, NaN);
    if (Number.isNaN(t) || !Array.isArray(o.points)) continue;
    const points = (o.points as unknown[]).slice(0, 64).map(obj).map((p) => ({ x: num(p.x, -1, 2, 0.5), y: num(p.y, -1, 2, 0.5) }));
    if (points.length >= 3) out.push({ t, points });
  }
  out.sort((a, b) => a.t - b.t);
  // every outline must have the same corners as the first (they are blended into each other)
  return out.filter((s) => s.points.length === out[0].points.length);
}

function readQualifier(v: unknown, d: Qualifier): Qualifier {
  const o = obj(v);
  return {
    hue: num(o.hue, 0, 1, d.hue),
    hueWidth: num(o.hueWidth, 0, 0.5, d.hueWidth),
    hueSoft: num(o.hueSoft, 0, 0.5, d.hueSoft),
    satLo: num(o.satLo, 0, 1, d.satLo),
    satHi: num(o.satHi, 0, 1, d.satHi),
    lumLo: num(o.lumLo, 0, 1, d.lumLo),
    lumHi: num(o.lumHi, 0, 1, d.lumHi),
    soft: num(o.soft, 0, 0.5, d.soft),
    invert: bool(o.invert, d.invert),
    grow: num(o.grow, -1, 1, d.grow),
    blur: num(o.blur, 0, 1, d.blur),
  };
}

function readSecondary(v: unknown): Secondary {
  const o = obj(v);
  return {
    on: bool(o.on, true),
    name: typeof o.name === "string" ? o.name.slice(0, 40) : "",
    key: readQualifier(o.key, NEUTRAL_QUALIFIER),
    mask: readMask(o.mask),
    hue: num(o.hue, -180, 180, 0),
    sat: num(o.sat, 0, 3, 1),
    lum: num(o.lum, -3, 3, 0),
    temp: num(o.temp, -1, 1, 0),
    contrast: num(o.contrast, 0.2, 3, 1),
    show: bool(o.show, false),
  };
}

function readLut(v: unknown): Lut3D | null {
  const o = obj(v);
  const size = Math.round(num(o.size, 2, MAX_LUT, 0));
  if (!size || typeof o.data !== "string") return null;
  // the data must be exactly size³ × 3 bytes
  const bytes = Math.floor((o.data.length * 3) / 4) - (o.data.endsWith("==") ? 2 : o.data.endsWith("=") ? 1 : 0);
  if (bytes !== size * size * size * 3) return null;
  return { name: typeof o.name === "string" ? o.name.slice(0, 60) : "LUT", size, data: o.data };
}

/** A grade from anything (a saved one, a patch merged over the current one, a look): every value in its range. */
export function readGrade(v: unknown): Grade | null {
  if (!v || typeof v !== "object") return null;
  const o = obj(v);
  const c = obj(o.curves);
  const d = NEUTRAL_GRADE;
  const sp = obj(o.split);
  const ha = obj(o.halation);
  const gr = obj(o.grain);
  const vi = obj(o.vignette);
  return {
    v: 1,
    on: bool(o.on, true),
    name: typeof o.name === "string" ? o.name.slice(0, 30) : "",
    compress: num(o.compress, 0, 1, 1),
    log: (LOGS.some((l) => l.id === o.log) ? o.log : "none") as LogId,
    logGamut: (["camera", "rec709", "rec2020"] as const).includes(o.logGamut as LogGamut) ? (o.logGamut as LogGamut) : "camera",
    logRange: o.logRange === "full" ? "full" : "video",
    amount: num(o.amount, 0, 1, 1),
    mask: readMask(o.mask),
    exposure: num(o.exposure, -5, 5, 0),
    contrast: num(o.contrast, 0.2, 3, 1),
    pivot: num(o.pivot, 0, 1, d.pivot),
    temp: num(o.temp, -1, 1, 0),
    tint: num(o.tint, -1, 1, 0),
    saturation: num(o.saturation, 0, 3, 1),
    vibrance: num(o.vibrance, -1, 1, 0),
    highlights: num(o.highlights, -1, 1, 0),
    shadows: num(o.shadows, -1, 1, 0),
    whites: num(o.whites, -1, 1, 0),
    blacks: num(o.blacks, -1, 1, 0),
    lift: readWheel(o.lift, WHEEL0),
    gamma: readWheel(o.gamma, WHEEL0),
    gain: readWheel(o.gain, WHEEL0),
    offset: readWheel(o.offset, WHEEL0),
    curves: {
      master: readPts(c.master, LINE),
      r: readPts(c.r, LINE),
      g: readPts(c.g, LINE),
      b: readPts(c.b, LINE),
      hueHue: readPts(c.hueHue, FLAT),
      hueSat: readPts(c.hueSat, FLAT),
      hueLum: readPts(c.hueLum, FLAT),
      lumSat: readPts(c.lumSat, FLAT),
      satSat: readPts(c.satSat, FLAT),
    },
    secondaries: Array.isArray(o.secondaries) ? o.secondaries.slice(0, MAX_SECONDARIES).map(readSecondary) : [],
    lut: readLut(o.lut),
    lutAmount: num(o.lutAmount, 0, 1, 1),
    look: typeof o.look === "string" && LOOKS.some((l) => l.id === o.look) ? o.look : null,
    split: {
      shadowHue: num(sp.shadowHue, 0, 1, d.split.shadowHue),
      shadowSat: num(sp.shadowSat, 0, 1, 0),
      highHue: num(sp.highHue, 0, 1, d.split.highHue),
      highSat: num(sp.highSat, 0, 1, 0),
      balance: num(sp.balance, -1, 1, 0),
    },
    halation: { amount: num(ha.amount, 0, 1, 0), threshold: num(ha.threshold, 0.3, 1, d.halation.threshold), size: num(ha.size, 0, 1, d.halation.size) },
    grain: { amount: num(gr.amount, 0, 1, 0), size: num(gr.size, 0, 1, d.grain.size) },
    vignette: { amount: num(vi.amount, -1, 1, 0), size: num(vi.size, 0, 1.5, d.vignette.size), soft: num(vi.soft, 0, 1, d.vignette.soft), round: num(vi.round, 0, 1, d.vignette.round) },
    sharpen: num(o.sharpen, 0, 1, 0),
  };
}

// ───────── curves ─────────

/**
 * A curve's value at x: a monotone cubic (Fritsch–Carlson) through its points, flat beyond the ends. Monotone, so
 * a curve never overshoots between two points the way a plain spline does.
 */
export function curveAt(pts: Pt[], x: number): number {
  const n = pts.length;
  if (n === 0) return x;
  if (n === 1) return pts[0].y;
  if (x <= pts[0].x) return pts[0].y;
  if (x >= pts[n - 1].x) return pts[n - 1].y;
  // slopes
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    d.push(dx > 0 ? (pts[i + 1].y - pts[i].y) / dx : 0);
  }
  const m: number[] = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  let i = 0;
  while (i < n - 2 && x > pts[i + 1].x) i++;
  const h = pts[i + 1].x - pts[i].x;
  const t = (x - pts[i].x) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * pts[i].y + h10 * h * m[i] + h01 * pts[i + 1].y + h11 * h * m[i + 1];
}

/** A hue curve is periodic: its ends meet. Sampled with the first point repeated after the last. */
export function hueCurveAt(pts: Pt[], x: number): number {
  if (pts.length < 2) return 0.5;
  const wrapped = [{ x: pts[pts.length - 1].x - 1, y: pts[pts.length - 1].y }, ...pts, { x: pts[0].x + 1, y: pts[0].y }];
  return curveAt(wrapped, ((x % 1) + 1) % 1);
}

/** A curve as n samples 0…1 (for a texture). */
export function sampleCurve(pts: Pt[], n: number, periodic = false): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    out[i] = Math.min(1, Math.max(0, periodic ? hueCurveAt(pts, x) : curveAt(pts, x)));
  }
  return out;
}

// ───────── camera logs ─────────

export type LogId =
  | "none"
  | "slog3"
  | "slog2"
  | "clog3"
  | "clog2"
  | "clog"
  | "vlog"
  | "logc3"
  | "logc4"
  | "nlog"
  | "dlog"
  | "flog"
  | "flog2"
  | "bmd5"
  | "applelog"
  | "redlog3g10"
  | "hlg"
  | "generic";

export interface LogSpec {
  id: LogId;
  brand: string;
  label: string;
  hint: string;
  /** xy of the camera's red, green, blue primaries and white (its gamut), or null for Rec.709 */
  gamut: { r: [number, number]; g: [number, number]; b: [number, number]; w: [number, number] } | null;
}

const D65: [number, number] = [0.3127, 0.329];
export const LOGS: LogSpec[] = [
  { id: "none", brand: "", label: "بدون (الصورة عادية)", hint: "فيديو عادي Rec.709 أو جوال", gamut: null },
  { id: "slog3", brand: "Sony", label: "S-Log3 / S-Gamut3.Cine", hint: "A7S III، FX3، FX6، FX30، A7 IV، ZV-E1", gamut: { r: [0.766, 0.275], g: [0.225, 0.8], b: [0.089, -0.087], w: D65 } },
  { id: "slog2", brand: "Sony", label: "S-Log2 / S-Gamut", hint: "A7S II، A7 III والأقدم", gamut: { r: [0.73, 0.28], g: [0.14, 0.855], b: [0.1, -0.05], w: D65 } },
  { id: "clog3", brand: "Canon", label: "C-Log3", hint: "R5، R6 II، R7، R8، R5 C، C70، C300 III (اختر تحت Cinema Gamut أو BT.709 حسب إعداد الكاميرا)", gamut: { r: [0.74, 0.27], g: [0.17, 1.14], b: [0.08, -0.1], w: D65 } },
  { id: "clog2", brand: "Canon", label: "C-Log2", hint: "C70، C300 III، R5 C", gamut: { r: [0.74, 0.27], g: [0.17, 1.14], b: [0.08, -0.1], w: D65 } },
  { id: "clog", brand: "Canon", label: "C-Log (الأصلي)", hint: "C100، C200، C300 الأول", gamut: { r: [0.74, 0.27], g: [0.17, 1.14], b: [0.08, -0.1], w: D65 } },
  { id: "vlog", brand: "Panasonic", label: "V-Log / V-Gamut", hint: "GH5، GH6، S5 II، S1H، BGH1", gamut: { r: [0.73, 0.28], g: [0.165, 0.84], b: [0.1, -0.03], w: D65 } },
  { id: "logc3", brand: "ARRI", label: "LogC3 (EI 800) / AWG3", hint: "ALEXA Mini، Amira، ALEXA LF", gamut: { r: [0.684, 0.313], g: [0.221, 0.848], b: [0.0861, -0.102], w: D65 } },
  { id: "logc4", brand: "ARRI", label: "LogC4 / AWG4", hint: "ALEXA 35", gamut: { r: [0.7347, 0.2653], g: [0.1424, 0.8576], b: [0.0991, -0.0308], w: D65 } },
  { id: "nlog", brand: "Nikon", label: "N-Log / BT.2020", hint: "Z6، Z7، Z8، Z9", gamut: { r: [0.708, 0.292], g: [0.17, 0.797], b: [0.131, 0.046], w: D65 } },
  { id: "dlog", brand: "DJI", label: "D-Log / D-Gamut", hint: "Mavic 3، Air 3، Inspire 3، Osmo", gamut: { r: [0.71, 0.31], g: [0.21, 0.88], b: [0.09, -0.08], w: D65 } },
  { id: "flog", brand: "Fujifilm", label: "F-Log / F-Gamut", hint: "X-T4، X-T5، X-H2، X-S20", gamut: { r: [0.708, 0.292], g: [0.17, 0.797], b: [0.131, 0.046], w: D65 } },
  { id: "flog2", brand: "Fujifilm", label: "F-Log2 / F-Gamut", hint: "X-H2S، X-H2، X-T5، GFX100 II", gamut: { r: [0.708, 0.292], g: [0.17, 0.797], b: [0.131, 0.046], w: D65 } },
  { id: "bmd5", brand: "Blackmagic", label: "Film Gen 5 / Wide Gamut", hint: "Pocket 4K/6K، URSA 12K", gamut: { r: [0.7177, 0.3171], g: [0.228, 0.8616], b: [0.1006, -0.082], w: [0.312717, 0.329031] } },
  { id: "applelog", brand: "Apple", label: "Apple Log / BT.2020", hint: "iPhone 15 Pro وأحدث (ProRes Log)", gamut: { r: [0.708, 0.292], g: [0.17, 0.797], b: [0.131, 0.046], w: D65 } },
  { id: "redlog3g10", brand: "RED", label: "Log3G10 / REDWideGamutRGB", hint: "Komodo، V-Raptor، DSMC2", gamut: { r: [0.780308, 0.304253], g: [0.121595, 1.493994], b: [0.095612, -0.084589], w: D65 } },
  { id: "hlg", brand: "HDR", label: "HLG (آيفون وجوالات HDR)", hint: "فيديو HDR من الآيفون، سامسونج، سوني HLG", gamut: { r: [0.708, 0.292], g: [0.17, 0.797], b: [0.131, 0.046], w: D65 } },
  { id: "generic", brand: "", label: "لوج عام (كاميرا غير معروفة)", hint: "منحنى لوج متوسط لما ما تعرف الكاميرا", gamut: null },
];

export type LogGamut = "camera" | "rec709" | "rec2020";

/**
 * Which values a log's published formula takes: «legal» ones are written on video levels (IRE/100: Canon, Apple Log,
 * HLG), «code» ones on the 10-bit code value / 1023 (Sony, Panasonic, ARRI, Nikon, DJI, Fujifilm, Blackmagic, RED).
 */
const LEGAL_DOMAIN: LogId[] = ["clog", "clog2", "clog3", "applelog", "hlg", "generic", "none"];

/**
 * The browser's pixel value (0…1) → what the log's formula takes, as `x = v*scale + offset`. A video-levels file comes
 * out of the browser already stretched (64 → 0, 940 → 1); a full-range file comes out as its code value.
 */
export function logInput(id: LogId, range: "video" | "full"): { scale: number; offset: number } {
  const legal = LEGAL_DOMAIN.includes(id);
  if (range === "video") return legal ? { scale: 1, offset: 0 } : { scale: 876 / 1023, offset: 64 / 1023 };
  return legal ? { scale: 1023 / 876, offset: -64 / 876 } : { scale: 1, offset: 0 };
}

/** A browser pixel value of a log file as scene light (what the shader does per channel). */
export const decodeLog = (id: LogId, v: number, range: "video" | "full" = "video") => {
  const k = logInput(id, range);
  return logToLinear(id, v * k.scale + k.offset);
};

/** Scene light pushed before the tone map: 18% grey lands at ~41% on screen, where DaVinci's CST puts it. */
export const FILMIC_GAIN = 1.2;
/** The ACES RRT+ODT fit (Stephen Hill), per channel, for grey (no gamut matrices): scene → display light. */
export function filmic(x: number): number {
  const v = Math.max(0, x * FILMIC_GAIN);
  return Math.min(1, Math.max(0, (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081)));
}
/** Display light → the sRGB value the screen shows. */
export const srgbEncode = (l: number) => (l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(Math.max(0, l), 1 / 2.4) - 0.055);

/** The log's value (0…1) as linear light (scene), the published formulas. The shader does the same. */
export function logToLinear(id: LogId, x: number): number {
  switch (id) {
    case "slog3": {
      const cut = 171.2102946929 / 1023;
      return x >= cut ? Math.pow(10, (x * 1023 - 420) / 261.5) * (0.18 + 0.01) - 0.01 : ((x * 1023 - 95) * 0.01125) / (171.2102946929 - 95);
    }
    case "slog2": {
      const y = (x * 1023 - 64) / 876;
      const cut = 0.030001222851889303;
      const k = (0.9 * 219) / 155;
      return y >= cut ? k * (Math.pow(10, (y - 0.616596 - 0.03) / 0.432699) - 0.037584) : (k * (y - cut)) / 3.53881278538813;
    }
    // Canon (white paper 2018, v1.2): on video levels (IRE/100), 18% grey → 0.2 before the 0.9
    case "clog": {
      return 0.9 * (x >= 0.12512248 ? (Math.pow(10, (x - 0.12512248) / 0.45310179) - 1) / 10.1596 : -(Math.pow(10, (0.12512248 - x) / 0.45310179) - 1) / 10.1596);
    }
    case "clog2": {
      return 0.9 * (x >= 0.092864125 ? (Math.pow(10, (x - 0.092864125) / 0.24136077) - 1) / 87.09937546 : -(Math.pow(10, (0.092864125 - x) / 0.24136077) - 1) / 87.09937546);
    }
    case "clog3": {
      if (x > 0.15277891) return (0.9 * (Math.pow(10, (x - 0.12240537) / 0.36726845) - 1)) / 14.98325;
      if (x < 0.097465473) return (-0.9 * (Math.pow(10, (0.12783901 - x) / 0.36726845) - 1)) / 14.98325;
      return (0.9 * (x - 0.12512219)) / 1.9754798;
    }
    case "vlog": {
      return x < 0.181 ? (x - 0.125) / 5.6 : Math.pow(10, (x - 0.598206) / 0.241514) - 0.00873;
    }
    case "logc3": {
      const cut = 0.010591,
        a = 5.555556,
        b = 0.052272,
        c = 0.24719,
        d = 0.385537,
        e = 5.367655,
        f = 0.092809;
      return x > e * cut + f ? (Math.pow(10, (x - d) / c) - b) / a : (x - f) / e;
    }
    case "logc4": {
      const a = (Math.pow(2, 18) - 16) / 117.45;
      const b = (1023 - 95) / 1023;
      const c = 95 / 1023;
      const s = (7 * Math.log(2) * Math.pow(2, 7 - (14 * c) / b)) / (a * b);
      const t = (Math.pow(2, 14 * (-c / b) + 6) - 64) / a;
      return x < 0 ? x * s + t : (Math.pow(2, 14 * ((x - c) / b) + 6) - 64) / a;
    }
    case "nlog": {
      return x < 452 / 1023 ? Math.pow((x * 1023) / 650, 3) - 0.0075 : Math.exp((x * 1023 - 619) / 150);
    }
    case "dlog": {
      return x <= 0.14 ? (x - 0.0929) / 6.025 : (Math.pow(10, (x - 0.584555) / 0.256663) - 0.0108) / 0.9892;
    }
    case "flog": {
      const cut = 0.100537775223865,
        a = 0.555556,
        b = 0.009468,
        c = 0.344676,
        d = 0.790453,
        e = 8.735631,
        f = 0.092864;
      return x < cut ? (x - f) / e : (Math.pow(10, (x - d) / c) - b) / a;
    }
    case "flog2": {
      const cut = 0.100686685370811,
        a = 5.555556,
        b = 0.064829,
        c = 0.245281,
        d = 0.384316,
        e = 8.799461,
        f = 0.092864;
      return x < cut ? (x - f) / e : (Math.pow(10, (x - d) / c) - b) / a;
    }
    case "bmd5": {
      const A = 0.08692876065491224,
        B = 0.005494072432257808,
        C = 0.5300133392291939,
        D = 8.283605932402494,
        E = 0.09246575342465753;
      const cut = D * 0.005 + E;
      return x < cut ? (x - E) / D : Math.exp((x - C) / A) - B;
    }
    case "applelog": {
      const R0 = -0.05641,
        Rt = 0.01,
        c = 47.28711236,
        beta = 0.00964052,
        gamma = 0.08550479,
        delta = 0.69336945;
      const Pt = c * (Rt - R0) * (Rt - R0);
      if (x < 0) return R0;
      return x < Pt ? Math.sqrt(x / c) + R0 : Math.pow(2, (x - delta) / gamma) - beta;
    }
    case "redlog3g10": {
      const a = 0.224282,
        b = 155.975327,
        c = 0.01,
        g = 15.1927;
      return x < 0 ? x / g - c : (Math.pow(10, x / a) - 1) / b - c;
    }
    case "hlg": {
      // the HLG inverse OETF, scene light, scaled so its white (12) lands near 1
      const l = x <= 0.5 ? (x * x) / 3 : (Math.exp((x - 0.55991073) / 0.17883277) + 0.28466892) / 12;
      return l;
    }
    case "generic": {
      // a middle-of-the-road log: 18% grey at 0.40, ~13 stops
      return 0.18 * Math.pow(2, (x - 0.4) * 13) - 0.18 * Math.pow(2, -0.4 * 13);
    }
    default:
      return x;
  }
}

// ───────── gamuts ─────────

type M3 = [number, number, number, number, number, number, number, number, number];

function xyToXYZ(x: number, y: number): RGB {
  return [x / y, 1, (1 - x - y) / y];
}
function mul(m: M3, v: RGB): RGB {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}
function mulM(a: M3, b: M3): M3 {
  const o: number[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o.push(a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]);
  return o as M3;
}
function inv(m: M3): M3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h,
    B = -(d * i - f * g),
    C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}

/** RGB (of these primaries and white) → XYZ. */
function rgbToXyz(g: NonNullable<LogSpec["gamut"]>): M3 {
  const R = xyToXYZ(...g.r),
    G = xyToXYZ(...g.g),
    B = xyToXYZ(...g.b),
    W = xyToXYZ(...g.w);
  const P: M3 = [R[0], G[0], B[0], R[1], G[1], B[1], R[2], G[2], B[2]];
  const S = mul(inv(P), W);
  return [P[0] * S[0], P[1] * S[1], P[2] * S[2], P[3] * S[0], P[4] * S[1], P[5] * S[2], P[6] * S[0], P[7] * S[1], P[8] * S[2]];
}

const REC709 = { r: [0.64, 0.33] as [number, number], g: [0.3, 0.6] as [number, number], b: [0.15, 0.06] as [number, number], w: D65 };

const REC2020 = { r: [0.708, 0.292] as [number, number], g: [0.17, 0.797] as [number, number], b: [0.131, 0.046] as [number, number], w: D65 };

/**
 * The recorded gamut → Rec.709 matrix (row-major, 9 numbers). «camera»: the log's own wide gamut; a camera set to
 * record Rec.709 needs none (applying the wide one again is what makes the colours glow); Rec.2020 its own.
 */
export function gamutToRec709(id: LogId, gamut: LogGamut = "camera"): M3 {
  if (id === "none" || gamut === "rec709") return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const g = gamut === "rec2020" ? REC2020 : LOGS.find((l) => l.id === id)?.gamut;
  if (!g) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  return mulM(inv(rgbToXyz(REC709)), rgbToXyz(g));
}

// ───────── .cube files ─────────

const b64 = {
  enc: (u: Uint8Array) => (typeof btoa === "function" ? btoa(String.fromCharCode(...u)) : Buffer.from(u).toString("base64")),
  dec: (s: string) => (typeof atob === "function" ? Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) : new Uint8Array(Buffer.from(s, "base64"))),
};

/** A .cube file (3D, or 1D which becomes a 3D of 17) as our LUT, resampled to at most MAX_LUT. */
export function parseCube(text: string, name = "LUT"): Lut3D {
  let size3 = 0;
  let size1 = 0;
  let min: RGB = [0, 0, 0];
  let max: RGB = [1, 1, 1];
  const rows: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const up = line.toUpperCase();
    if (up.startsWith("TITLE")) {
      const m = /"(.*)"/.exec(line);
      if (m) name = m[1].slice(0, 60);
    } else if (up.startsWith("LUT_3D_SIZE")) size3 = Number(line.split(/\s+/)[1]);
    else if (up.startsWith("LUT_1D_SIZE")) size1 = Number(line.split(/\s+/)[1]);
    else if (up.startsWith("DOMAIN_MIN")) min = line.split(/\s+/).slice(1, 4).map(Number) as RGB;
    else if (up.startsWith("DOMAIN_MAX")) max = line.split(/\s+/).slice(1, 4).map(Number) as RGB;
    else if (/^[-+\d.eE\s]+$/.test(line)) {
      const v = line.split(/\s+/).map(Number);
      if (v.length >= 3) rows.push(v[0], v[1], v[2]);
    }
  }
  const norm = (v: number, c: number) => Math.min(1, Math.max(0, (v - min[c]) / (max[c] - min[c] || 1)));
  if (size3 >= 2 && rows.length >= size3 ** 3 * 3) {
    const look = (r: number, g: number, b: number): RGB => {
      // .cube order: red fastest, then green, then blue
      const i = (r + g * size3 + b * size3 * size3) * 3;
      return [rows[i], rows[i + 1], rows[i + 2]];
    };
    const n = Math.min(size3, MAX_LUT);
    const out = new Uint8Array(n * n * n * 3);
    let o = 0;
    for (let b = 0; b < n; b++)
      for (let g = 0; g < n; g++)
        for (let r = 0; r < n; r++) {
          const c = n === size3 ? look(r, g, b) : trilinear(look, size3, r / (n - 1), g / (n - 1), b / (n - 1));
          out[o++] = Math.round(norm(c[0], 0) * 255);
          out[o++] = Math.round(norm(c[1], 1) * 255);
          out[o++] = Math.round(norm(c[2], 2) * 255);
        }
    return { name, size: n, data: b64.enc(out) };
  }
  if (size1 >= 2 && rows.length >= size1 * 3) {
    const n = 17;
    const out = new Uint8Array(n * n * n * 3);
    const at = (c: number, x: number) => {
      const p = x * (size1 - 1);
      const i = Math.floor(p);
      const j = Math.min(size1 - 1, i + 1);
      const t = p - i;
      return rows[i * 3 + c] * (1 - t) + rows[j * 3 + c] * t;
    };
    let o = 0;
    for (let b = 0; b < n; b++)
      for (let g = 0; g < n; g++)
        for (let r = 0; r < n; r++) {
          out[o++] = Math.round(norm(at(0, r / (n - 1)), 0) * 255);
          out[o++] = Math.round(norm(at(1, g / (n - 1)), 1) * 255);
          out[o++] = Math.round(norm(at(2, b / (n - 1)), 2) * 255);
        }
    return { name, size: n, data: b64.enc(out) };
  }
  throw new Error("هذا مو ملف LUT صحيح (.cube).");
}

function trilinear(look: (r: number, g: number, b: number) => RGB, n: number, r: number, g: number, b: number): RGB {
  const p = [r, g, b].map((v) => v * (n - 1));
  const i = p.map((v) => Math.min(n - 2, Math.floor(v)));
  const t = p.map((v, k) => v - i[k]);
  const out: RGB = [0, 0, 0];
  for (let dz = 0; dz < 2; dz++)
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++) {
        const w = (dx ? t[0] : 1 - t[0]) * (dy ? t[1] : 1 - t[1]) * (dz ? t[2] : 1 - t[2]);
        const c = look(i[0] + dx, i[1] + dy, i[2] + dz);
        out[0] += c[0] * w;
        out[1] += c[1] * w;
        out[2] += c[2] * w;
      }
  return out;
}

/** The LUT's bytes (size³ × 3). */
export const lutBytes = (l: Lut3D) => b64.dec(l.data);

/** A .cube file's text from RGB bytes (size³ × 3, red fastest). */
export function toCube(title: string, size: number, bytes: Uint8Array | Float32Array, float = false): string {
  const lines = [`TITLE "${title.replace(/"/g, "'")}"`, `LUT_3D_SIZE ${size}`, "DOMAIN_MIN 0 0 0", "DOMAIN_MAX 1 1 1", ""];
  const k = float ? 1 : 1 / 255;
  for (let i = 0; i < size * size * size; i++) lines.push(`${(bytes[i * 3] * k).toFixed(6)} ${(bytes[i * 3 + 1] * k).toFixed(6)} ${(bytes[i * 3 + 2] * k).toFixed(6)}`);
  return lines.join("\n") + "\n";
}

// ───────── ready looks ─────────

export interface Look {
  id: string;
  label: string;
  group: "سينما" | "فيلم" | "مزاج" | "أبيض وأسود";
  hint: string;
  grade: Partial<Grade>;
}

const W = (r: number, g: number, b: number, y = 0): Wheel => ({ rgb: [r, g, b], y });
const C = (...pts: [number, number][]): Pt[] => pts.map(([x, y]) => ({ x, y }));

export const LOOKS: Look[] = [
  { id: "teal-orange", label: "تيل وأورنج", group: "سينما", hint: "أفلام الأكشن: ظلال زرقاء مخضرة وبشرة برتقالية", grade: { contrast: 1.12, saturation: 1.05, lift: W(-0.06, 0.0, 0.08), gain: W(0.08, 0.02, -0.08), curves: { ...NEUTRAL_CURVES, hueSat: C([0, 0.6], [0.08, 0.7], [0.14, 0.45], [0.33, 0.35], [0.5, 0.7], [0.58, 0.6], [0.75, 0.45], [1, 0.6]) }, split: { shadowHue: 0.53, shadowSat: 0.25, highHue: 0.08, highSat: 0.2, balance: 0 } } },
  { id: "kodak-2383", label: "طبعة كوداك 2383", group: "فيلم", hint: "طبعة السينما الكلاسيكية: تباين غني وبشرة دافئة", grade: { contrast: 1.18, pivot: 0.4, saturation: 0.95, curves: { ...NEUTRAL_CURVES, master: C([0, 0.02], [0.2, 0.14], [0.5, 0.5], [0.8, 0.86], [1, 0.97]), b: C([0, 0.03], [0.5, 0.49], [1, 0.96]) }, split: { shadowHue: 0.58, shadowSat: 0.12, highHue: 0.11, highSat: 0.14, balance: 0.1 }, halation: { amount: 0.25, threshold: 0.8, size: 0.5 }, grain: { amount: 0.15, size: 0.45 } } },
  { id: "fuji-3513", label: "طبعة فوجي 3513", group: "فيلم", hint: "أنعم وأبرد شوي من كوداك، خضار جميل", grade: { contrast: 1.12, pivot: 0.42, saturation: 0.92, curves: { ...NEUTRAL_CURVES, master: C([0, 0.03], [0.25, 0.2], [0.5, 0.5], [0.75, 0.8], [1, 0.97]), hueSat: C([0, 0.5], [0.33, 0.6], [0.5, 0.55], [0.66, 0.5], [1, 0.5]) }, split: { shadowHue: 0.55, shadowSat: 0.15, highHue: 0.15, highSat: 0.08, balance: 0 }, grain: { amount: 0.12, size: 0.4 } } },
  { id: "vision3-500t", label: "كوداك Vision3 500T", group: "فيلم", hint: "نيجاتيف الليل: ظلال دافئة، هالة حول الأضواء", grade: { contrast: 1.05, saturation: 0.9, lift: W(0.05, 0.02, -0.02, 0.03), gain: W(-0.02, 0, 0.04), halation: { amount: 0.45, threshold: 0.75, size: 0.6 }, grain: { amount: 0.3, size: 0.55 }, split: { shadowHue: 0.09, shadowSat: 0.12, highHue: 0.6, highSat: 0.06, balance: -0.1 } } },
  { id: "vision3-250d", label: "كوداك Vision3 250D", group: "فيلم", hint: "نيجاتيف النهار: ألوان طبيعية وحبيبات ناعمة", grade: { contrast: 1.06, saturation: 1.02, lift: W(0, 0, 0, 0.02), halation: { amount: 0.2, threshold: 0.85, size: 0.4 }, grain: { amount: 0.18, size: 0.4 } } },
  { id: "bleach", label: "بليتش بايباس", group: "سينما", hint: "تباين قاسي وألوان باهتة (المنقذ، جندي رايان)", grade: { contrast: 1.35, pivot: 0.45, saturation: 0.55, blacks: -0.15, whites: 0.1, grain: { amount: 0.25, size: 0.5 } } },
  { id: "cross", label: "كروس بروسس", group: "مزاج", hint: "ظلال خضراء مزرقة وإضاءة صفراء، ألوان مجنونة", grade: { contrast: 1.15, saturation: 1.2, curves: { ...NEUTRAL_CURVES, r: C([0, 0], [0.3, 0.22], [0.7, 0.8], [1, 1]), g: C([0, 0.05], [0.5, 0.5], [1, 0.95]), b: C([0, 0.15], [0.5, 0.45], [1, 0.85]) } } },
  { id: "pastel", label: "باستيل (ويس أندرسون)", group: "مزاج", hint: "ألوان ناعمة فاتحة، أسود مرفوع، وردي ودافئ", grade: { contrast: 0.92, saturation: 0.9, vibrance: 0.2, blacks: 0.18, lift: W(0.06, 0.02, 0.03, 0.08), gain: W(0.03, 0.01, -0.03), split: { shadowHue: 0.9, shadowSat: 0.1, highHue: 0.12, highSat: 0.12, balance: 0 } } },
  { id: "matrix", label: "ماتريكس (أخضر)", group: "مزاج", hint: "كل شي يميل للأخضر، تباين عالي", grade: { contrast: 1.15, saturation: 0.85, gamma: W(-0.05, 0.08, -0.06), lift: W(-0.03, 0.04, -0.02), split: { shadowHue: 0.33, shadowSat: 0.25, highHue: 0.25, highSat: 0.12, balance: 0 } } },
  { id: "fincher", label: "فينشر (بارد)", group: "سينما", hint: "أخضر مصفر خافت، ظلال باردة، بدون زهو", grade: { contrast: 1.1, pivot: 0.4, saturation: 0.78, lift: W(-0.04, 0.0, 0.03), gamma: W(-0.02, 0.03, -0.02), gain: W(0.03, 0.03, -0.04), curves: { ...NEUTRAL_CURVES, master: C([0, 0.02], [0.5, 0.48], [1, 0.95]) } } },
  { id: "mexico", label: "مكسيكو (سيبيا حار)", group: "مزاج", hint: "أصفر برتقالي على كل شي، كأنها تحت شمس الصحراء", grade: { contrast: 1.08, saturation: 0.85, temp: 0.55, tint: 0.1, gain: W(0.1, 0.04, -0.14), lift: W(0.03, 0.01, -0.05) } },
  { id: "cyberpunk", label: "سايبربانك (نيون)", group: "مزاج", hint: "ظلال بنفسجية وإضاءات سماوية، تشبع عالي", grade: { contrast: 1.15, saturation: 1.25, vibrance: 0.2, lift: W(0.06, -0.04, 0.12), gain: W(-0.06, 0.04, 0.08), split: { shadowHue: 0.8, shadowSat: 0.35, highHue: 0.5, highSat: 0.3, balance: 0 } } },
  { id: "vintage", label: "قديم باهت", group: "مزاج", hint: "أسود مرفوع، دفا، حبيبات، زوايا داكنة", grade: { contrast: 0.9, saturation: 0.8, temp: 0.3, blacks: 0.22, whites: -0.1, lift: W(0.05, 0.03, -0.02, 0.1), grain: { amount: 0.35, size: 0.6 }, vignette: { amount: 0.35, size: 0.6, soft: 0.6, round: 0.5 } } },
  { id: "golden", label: "الساعة الذهبية", group: "مزاج", hint: "شمس المغرب على كل شي: ذهبي دافئ وظلال ناعمة", grade: { contrast: 1.05, saturation: 1.08, temp: 0.35, shadows: 0.1, gain: W(0.08, 0.03, -0.06), split: { shadowHue: 0.62, shadowSat: 0.1, highHue: 0.1, highSat: 0.25, balance: 0.2 }, halation: { amount: 0.2, threshold: 0.8, size: 0.6 } } },
  { id: "hussaini", label: "ليالي حسينية", group: "مزاج", hint: "ظلال عميقة وأضواء دافئة مع هالة، للمجالس والمواكب", grade: { contrast: 1.14, pivot: 0.38, saturation: 0.95, blacks: -0.08, lift: W(-0.02, -0.02, 0.03), gain: W(0.06, 0.02, -0.05), split: { shadowHue: 0.65, shadowSat: 0.15, highHue: 0.08, highSat: 0.2, balance: 0 }, halation: { amount: 0.35, threshold: 0.75, size: 0.6 }, vignette: { amount: 0.25, size: 0.75, soft: 0.6, round: 0.5 } } },
  { id: "clean", label: "نظيف زاهي", group: "سينما", hint: "تباين خفيف وألوان حيّة بدون ميل", grade: { contrast: 1.08, vibrance: 0.25, saturation: 1.05, blacks: -0.05, whites: 0.05 } },
  { id: "bw-hp5", label: "أبيض وأسود HP5", group: "أبيض وأسود", hint: "فيلم إلفورد: حبيبات واضحة وتباين متوسط", grade: { saturation: 0, contrast: 1.12, curves: { ...NEUTRAL_CURVES, master: C([0, 0.03], [0.25, 0.22], [0.75, 0.78], [1, 0.97]) }, grain: { amount: 0.4, size: 0.55 } } },
  { id: "bw-trix", label: "أبيض وأسود Tri-X", group: "أبيض وأسود", hint: "كوداك: أسود عميق وتباين قوي", grade: { saturation: 0, contrast: 1.3, pivot: 0.42, blacks: -0.1, grain: { amount: 0.45, size: 0.5 }, vignette: { amount: 0.2, size: 0.7, soft: 0.6, round: 0.5 } } },
  { id: "bw-soft", label: "أبيض وأسود ناعم", group: "أبيض وأسود", hint: "رمادي هادئ، للبورتريه", grade: { saturation: 0, contrast: 0.95, blacks: 0.1, whites: -0.05, grain: { amount: 0.1, size: 0.4 } } },
];

/** A look laid over a grade (the look's values replace the grade's; the log, masks and secondaries stay). */
export function applyLook(g: Grade, look: Look): Grade {
  const base = readGrade({ ...NEUTRAL_GRADE, ...look.grade })!;
  return { ...base, on: g.on, name: g.name, compress: g.compress, log: g.log, logGamut: g.logGamut, logRange: g.logRange, amount: g.amount, mask: g.mask, secondaries: g.secondaries, lut: g.lut, lutAmount: g.lutAmount, look: look.id };
}

// ───────── masks over time ─────────

/** A tracked outline at the clip's own time: blended between the two outlines around it. */
export function shapeAt(m: Mask, t: number): Pt[] {
  const k = m.shapes;
  if (!k.length) return m.points;
  if (t <= k[0].t) return k[0].points;
  if (t >= k[k.length - 1].t) return k[k.length - 1].points;
  let i = 0;
  while (k[i + 1].t < t) i++;
  const a = k[i],
    b = k[i + 1];
  const f = (t - a.t) / Math.max(1, b.t - a.t);
  return a.points.map((p, j) => ({ x: p.x + (b.points[j].x - p.x) * f, y: p.y + (b.points[j].y - p.y) * f }));
}

/** The mask's centre at the clip's own time (its points moving between keys). */
export function maskAt(m: Mask, t: number): { x: number; y: number } {
  if (!m.keys.length) return { x: m.x, y: m.y };
  const k = m.keys;
  if (t <= k[0].t) return { x: k[0].x, y: k[0].y };
  if (t >= k[k.length - 1].t) return { x: k[k.length - 1].x, y: k[k.length - 1].y };
  let i = 0;
  while (k[i + 1].t < t) i++;
  const a = k[i],
    b = k[i + 1];
  const f = (t - a.t) / Math.max(1, b.t - a.t);
  const s = f * f * (3 - 2 * f);
  return { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s };
}
