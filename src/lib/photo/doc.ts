// «زهراء فوتو ماستر» — the project as the page and the server keep it: the canvas (a size and a colour), the BASE picture
// (full-bleed, with its crop, turn, flip and tilt), the sliders and the look that touch only the base, and the layers over
// it (real text in the site's Arabic fonts, shapes, pictures). Every change — by hand or by a command of «زهراء» — goes
// through applyOp here, so what she writes and what the buttons do are the same thing, and both are checked.
// Positions and sizes are percents of the canvas, so a project survives a change of pixel size. Pure (server and browser).

import {
  ADJUSTS, FILTERS, NO_ADJUST, PHOTO, SHAPES, isAdjustKey, isFilterId, isRatio, isShapeKind, sizePreset,
  type Adjust, type ShapeKind,
} from "@config/photo";
import { layerId, readImageLayer, readTextLayer, isHex, type ImageLayer, type TextLayer } from "@/lib/designer/layers";

export type { ImageLayer, TextLayer };

export interface ShapeLayer {
  id: string;
  kind: "shape";
  shape: ShapeKind;
  /** the centre, percent of the canvas */
  x: number;
  y: number;
  /** width in percent of the canvas width, height in percent of the canvas height */
  w: number;
  h: number;
  /** "" = no fill */
  fill: string;
  opacity: number;
  /** "" = no outline */
  stroke: string;
  /** the outline's thickness, percent of the canvas width */
  strokeW: number;
  /** the corners' roundness (rect), percent of the canvas width */
  radius: number;
  rotate: number;
}
export type PhotoLayer = TextLayer | ImageLayer | ShapeLayer;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Base {
  /** a photo_files row (null never: a doc without a base has base = null) */
  fileId: string;
  /** the picture's own pixels */
  w: number;
  h: number;
  /** the picture turned (clockwise) and flipped, in this order: flip, then turn */
  rotate: 0 | 90 | 180 | 270;
  flipX: boolean;
  flipY: boolean;
  /** a small tilt, degrees (-15..15), done by the renderer with a zoom that hides the corners */
  straighten: number;
  /** the part of the turned picture the canvas shows, as fractions (0..1) of it; its shape is the canvas's shape */
  crop: Rect;
}

export interface PhotoDoc {
  v: 1;
  width: number;
  height: number;
  /** the colour behind everything (shows where the canvas has no base) */
  bg: string;
  base: Base | null;
  filter: { id: string; strength: number };
  adjust: Adjust;
  layers: PhotoLayer[];
}

const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };
/** The longest a canvas may be compared with its shortest side. */
const MAX_STRIP = 16;
const clamp = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};
const round = (n: number, p = 100) => Math.round(n * p) / p;
const normAngle = (a: number) => {
  let r = ((a + 180) % 360 + 360) % 360 - 180;
  if (r === -180) r = 180;
  return round(r);
};

// ───────────────────────────── reading ─────────────────────────────

export function readShape(v: unknown): ShapeLayer | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!isShapeKind(o.shape)) return null;
  const color = (c: unknown, d: string) => (c === "" || c === null ? "" : isHex(c) ? String(c).toUpperCase() : d);
  return {
    id: typeof o.id === "string" && o.id ? o.id.slice(0, 40) : layerId(),
    kind: "shape",
    shape: o.shape,
    x: clamp(o.x, 0, 100, 50),
    y: clamp(o.y, 0, 100, 50),
    w: clamp(o.w, 0.2, 300, 40),
    h: clamp(o.h, 0, 300, o.shape === "line" ? 0 : 10),
    fill: color(o.fill, "#000000"),
    opacity: clamp(o.opacity, 0, 1, 1),
    stroke: color(o.stroke ?? "", ""),
    strokeW: clamp(o.strokeW ?? o.stroke_w, 0, 20, 0),
    radius: clamp(o.radius, 0, 50, 0),
    rotate: clamp(o.rotate, -180, 180, 0),
  };
}

export function readLayer(v: unknown): PhotoLayer | null {
  if (!v || typeof v !== "object") return null;
  const k = (v as { kind?: unknown }).kind;
  if (k === "text") return readTextLayer(v);
  if (k === "image") return readImageLayer(v);
  if (k === "shape") return readShape(v);
  return null;
}

function readRect(v: unknown): Rect {
  if (!v || typeof v !== "object") return { ...FULL };
  const o = v as Record<string, unknown>;
  const w = clamp(o.w, 0.01, 1, 1);
  const h = clamp(o.h, 0.01, 1, 1);
  return { x: clamp(o.x, 0, 1 - w, 0), y: clamp(o.y, 0, 1 - h, 0), w, h };
}

function readBase(v: unknown): Base | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.fileId !== "string" || !o.fileId) return null;
  const r = Number(o.rotate);
  return {
    fileId: o.fileId,
    w: clamp(o.w, 1, 100000, 1),
    h: clamp(o.h, 1, 100000, 1),
    rotate: (r === 90 || r === 180 || r === 270 ? r : 0) as Base["rotate"],
    flipX: o.flipX === true,
    flipY: o.flipY === true,
    straighten: round(clamp(o.straighten, -15, 15, 0)),
    crop: readRect(o.crop),
  };
}

export function readAdjust(v: unknown): Adjust {
  const out = { ...NO_ADJUST };
  if (v && typeof v === "object") for (const a of ADJUSTS) out[a.key] = round(clamp((v as Record<string, unknown>)[a.key], a.min, a.max, 0));
  return out;
}

/** A project from storage or from the page, checked and filled in. */
export function readDoc(v: unknown): PhotoDoc {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const f = o.filter && typeof o.filter === "object" ? (o.filter as Record<string, unknown>) : {};
  const layers: PhotoLayer[] = [];
  for (const l of Array.isArray(o.layers) ? o.layers : []) {
    const r = readLayer(l);
    if (r) layers.push(r);
    if (layers.length >= PHOTO.maxLayers) break;
  }
  return {
    v: 1,
    width: Math.round(clamp(o.width, PHOTO.minSide, PHOTO.maxSide, 1080)),
    height: Math.round(clamp(o.height, PHOTO.minSide, PHOTO.maxSide, 1350)),
    bg: isHex(o.bg) ? String(o.bg).toUpperCase() : "#FFFFFF",
    base: readBase(o.base),
    filter: { id: isFilterId(f.id) ? f.id : "none", strength: Math.round(clamp(f.strength, 0, 100, 100)) },
    adjust: readAdjust(o.adjust),
    layers,
  };
}

// ───────────────────────────── making ─────────────────────────────

/** A size that keeps the shape as far as the allowed range lets it (a very long strip gives up some of its length). */
export function fitSide(w: number, h: number): { width: number; height: number } {
  const big = Math.max(w, h);
  const small = Math.max(1, Math.min(w, h));
  let k = 1;
  if (small < PHOTO.minSide) k = PHOTO.minSide / small;
  if (big * k > PHOTO.maxSide) k = PHOTO.maxSide / big;
  const fit = (v: number) => Math.min(PHOTO.maxSide, Math.max(PHOTO.minSide, Math.round(v * k)));
  return { width: fit(w), height: fit(h) };
}

/** An empty project of this size. */
export function newDoc(width = 1080, height = 1350, bg = "#FFFFFF"): PhotoDoc {
  const s = fitSide(width, height);
  return { v: 1, ...s, bg, base: null, filter: { id: "none", strength: 100 }, adjust: { ...NO_ADJUST }, layers: [] };
}

/** A project around a picture: the canvas takes the picture's shape (at most the allowed size). */
export function docFromPicture(file: { id: string; w: number; h: number }, width?: number): PhotoDoc {
  const s = fitSide(width ?? file.w, width ? Math.round((width * file.h) / file.w) : file.h);
  return { ...newDoc(s.width, s.height), base: { fileId: file.id, w: file.w, h: file.h, rotate: 0, flipX: false, flipY: false, straighten: 0, crop: { ...FULL } } };
}

/** The picture's size after its turn (what the crop's fractions are fractions of). */
export const orientedSize = (b: Base) => (b.rotate === 90 || b.rotate === 270 ? { w: b.h, h: b.w } : { w: b.w, h: b.h });

/** The part of `cur` (fractions) with this pixel shape, as large as it can be, centred on a point of `cur` (percent). */
export function fitRect(cur: Rect, size: { w: number; h: number }, aspect: number, focus = { x: 50, y: 50 }): Rect {
  const cw = cur.w * size.w;
  const ch = cur.h * size.h;
  const pw = cw / ch > aspect ? ch * aspect : cw;
  const ph = cw / ch > aspect ? ch : cw / aspect;
  const cx = cur.x * size.w + (clamp(focus.x, 0, 100, 50) / 100) * cw;
  const cy = cur.y * size.h + (clamp(focus.y, 0, 100, 50) / 100) * ch;
  const x = Math.max(cur.x * size.w, Math.min(cur.x * size.w + cw - pw, cx - pw / 2));
  const y = Math.max(cur.y * size.h, Math.min(cur.y * size.h + ch - ph, cy - ph / 2));
  return { x: x / size.w, y: y / size.h, w: pw / size.w, h: ph / size.h };
}

// ───────────────────────────── commands ─────────────────────────────

export type Op = { op: string } & Record<string, unknown>;

export interface FileInfo {
  w: number;
  h: number;
}

export interface OpContext {
  /** the project's picture files (id → size): add_image / use_as_base need one of these */
  files?: Map<string, FileInfo>;
  /** the fonts of the site (ids): a text layer takes one of these */
  fonts?: string[];
}

export interface OpError {
  index: number;
  op: string;
  message: string;
}

export interface OpsResult {
  doc: PhotoDoc;
  applied: number;
  error: OpError | null;
}

const OPS = [
  "adjust", "adjust_reset", "filter", "crop", "crop_ratio", "canvas", "rotate", "flip", "straighten", "bg", "add_text", "add_shape", "update",
  "move", "delete", "duplicate", "order", "align", "add_image", "use_as_base",
] as const;
export const isOpName = (v: unknown): boolean => typeof v === "string" && (OPS as readonly string[]).includes(v);

/** Commands as the model writes them (JSON strings or objects) → objects with a known name; the rest is reported. */
export function readOps(raw: unknown): { ops: Op[]; error: string | null } {
  const ops: Op[] = [];
  for (const [i, r] of (Array.isArray(raw) ? raw : []).entries()) {
    let o: unknown = r;
    if (typeof r === "string") {
      try {
        o = JSON.parse(r);
      } catch {
        return { ops, error: `الأمر ${i + 1} ليس JSON صحيحًا.` };
      }
    }
    if (!o || typeof o !== "object" || !isOpName((o as { op?: unknown }).op)) return { ops, error: `الأمر ${i + 1} غير معروف.` };
    ops.push(o as Op);
    if (ops.length >= PHOTO.maxOps) break;
  }
  return { ops, error: null };
}

const copy = (d: PhotoDoc): PhotoDoc => JSON.parse(JSON.stringify(d)) as PhotoDoc;
const nextId = (d: PhotoDoc, prefix: string) => {
  let n = d.layers.length + 1;
  while (d.layers.some((l) => l.id === `${prefix}${n}`)) n++;
  return `${prefix}${n}`;
};
const find = (d: PhotoDoc, id: unknown) => d.layers.find((l) => l.id === id);

/** A rectangle of the canvas (percent) kept: the canvas becomes that part, the layers and the base follow. */
export function cropDoc(doc: PhotoDoc, r: Rect): PhotoDoc {
  const d = copy(doc);
  const w = clamp(r.w, 1, 100, 100);
  const h = clamp(r.h, 1, 100, 100);
  const x = clamp(r.x, 0, 100 - w, 0);
  const y = clamp(r.y, 0, 100 - h, 0);
  const size = fitSide((doc.width * w) / 100, (doc.height * h) / 100);
  d.width = size.width;
  d.height = size.height;
  if (d.base) {
    const c = d.base.crop;
    d.base.crop = { x: c.x + (x / 100) * c.w, y: c.y + (y / 100) * c.h, w: (c.w * w) / 100, h: (c.h * h) / 100 };
  }
  const kx = 100 / w;
  const ky = 100 / h;
  d.layers = d.layers.map((l) => {
    const m = { ...l, x: clamp(((l.x - x) / w) * 100, 0, 100, 50), y: clamp(((l.y - y) / h) * 100, 0, 100, 50) };
    if (m.kind === "text") return { ...m, size: round(clamp(l.kind === "text" ? l.size * ky : 0, 1, 60, 5)), w: round(clamp(l.kind === "text" ? l.w * kx : 0, 5, 100, 80)) };
    if (m.kind === "image") return { ...m, w: round(clamp(l.kind === "image" ? l.w * kx : 0, 2, 400, 50)) };
    const s = l as ShapeLayer;
    return { ...m, w: round(clamp(s.w * kx, 0.2, 400, 40)), h: round(clamp(s.h * ky, 0, 400, 10)), strokeW: round(s.strokeW * kx), radius: round(clamp(s.radius * kx, 0, 50, 0)) } as ShapeLayer;
  });
  return d;
}

/** The largest part of the canvas with this shape (pixel ratio), centred on a point (percent). */
export function ratioRect(doc: PhotoDoc, aspect: number, focus = { x: 50, y: 50 }): Rect {
  const a0 = doc.width / doc.height;
  const w = a0 > aspect ? (100 * aspect) / a0 : 100;
  const h = a0 > aspect ? 100 : (100 * a0) / aspect;
  return {
    x: clamp(clamp(focus.x, 0, 100, 50) - w / 2, 0, 100 - w, 0),
    y: clamp(clamp(focus.y, 0, 100, 50) - h / 2, 0, 100 - h, 0),
    w,
    h,
  };
}

/** The whole project turned a quarter clockwise: the canvas swaps its sides, the base and every layer follow. */
function turnOnce(doc: PhotoDoc): PhotoDoc {
  const d = copy(doc);
  const W = doc.width;
  const H = doc.height;
  d.width = H;
  d.height = W;
  if (d.base) {
    const c = d.base.crop;
    d.base.rotate = ((d.base.rotate + 90) % 360) as Base["rotate"];
    d.base.crop = { x: 1 - (c.y + c.h), y: c.x, w: c.h, h: c.w };
  }
  d.layers = d.layers.map((l) => {
    const m = { ...l, x: clamp(100 - l.y, 0, 100, 50), y: clamp(l.x, 0, 100, 50), rotate: normAngle(l.rotate + 90) };
    if (l.kind === "text") return { ...m, size: round(clamp(l.size * (H / W), 1, 60, 5)), w: round(clamp(l.w * (W / H), 5, 100, 80)) } as TextLayer;
    if (l.kind === "image") return { ...m, w: round(clamp(l.w * (W / H), 2, 400, 50)) } as ImageLayer;
    return { ...m, w: round(clamp(l.w * (W / H), 0.2, 400, 40)), h: round(clamp(l.h * (H / W), 0, 400, 10)), strokeW: round(l.strokeW * (W / H)), radius: round(clamp(l.radius * (W / H), 0, 50, 0)) } as ShapeLayer;
  });
  return d;
}

function flipDoc(doc: PhotoDoc, axis: "h" | "v"): PhotoDoc {
  const d = copy(doc);
  if (d.base) {
    const c = d.base.crop;
    const quarter = d.base.rotate === 90 || d.base.rotate === 270;
    if (axis === "h") {
      d.base.crop = { ...c, x: 1 - (c.x + c.w) };
      if (quarter) d.base.flipY = !d.base.flipY;
      else d.base.flipX = !d.base.flipX;
    } else {
      d.base.crop = { ...c, y: 1 - (c.y + c.h) };
      if (quarter) d.base.flipX = !d.base.flipX;
      else d.base.flipY = !d.base.flipY;
    }
    d.base.straighten = -d.base.straighten;
  }
  d.layers = d.layers.map((l) => {
    if (axis === "h") {
      const m = { ...l, x: round(100 - l.x), rotate: normAngle(-l.rotate) };
      return l.kind === "image" ? ({ ...m, flip: !l.flip } as ImageLayer) : (m as PhotoLayer);
    }
    const m = { ...l, y: round(100 - l.y) };
    return l.kind === "image" ? ({ ...m, flip: !l.flip, rotate: normAngle(180 - l.rotate) } as ImageLayer) : ({ ...m, rotate: normAngle(-l.rotate) } as PhotoLayer);
  });
  return d;
}

function setBase(doc: PhotoDoc, id: string, f: FileInfo): PhotoDoc {
  let d = copy(doc);
  const blank = !d.base && d.layers.length === 0;
  d.base = { fileId: id, w: f.w, h: f.h, rotate: 0, flipX: false, flipY: false, straighten: 0, crop: { ...FULL } };
  if (blank) {
    const s = fitSide(f.w, f.h);
    d.width = s.width;
    d.height = s.height;
  } else {
    d.base.crop = fitRect(FULL, { w: f.w, h: f.h }, d.width / d.height);
  }
  d = { ...d };
  return d;
}

const POS_KEYS = ["x", "y", "w", "h", "rotate", "opacity"] as const;

/** Mirrors the model's snake_case into the layers' own names. */
function camel(o: Record<string, unknown>): Record<string, unknown> {
  const m: Record<string, unknown> = { ...o };
  if ("effect_color" in m) m.effectColor = m.effect_color;
  if ("line_height" in m) m.lineHeight = m.line_height;
  if ("stroke_w" in m) m.strokeW = m.stroke_w;
  return m;
}

/** One command. Returns the new project, or the reason it can't be done. */
export function applyOp(doc: PhotoDoc, op: Op, ctx: OpContext = {}): { doc: PhotoDoc } | { error: string } {
  const name = String(op.op);
  const full = doc.layers.length >= PHOTO.maxLayers;
  switch (name) {
    case "adjust": {
      const vals = op.values && typeof op.values === "object" ? (op.values as Record<string, unknown>) : null;
      if (!vals) return { error: "حدّد values للشرائح." };
      const d = copy(doc);
      let any = false;
      for (const [k, v] of Object.entries(vals)) {
        if (!isAdjustKey(k)) return { error: `شريحة غير معروفة: ${k}` };
        const def = ADJUSTS.find((a) => a.key === k)!;
        d.adjust[k] = round(clamp(v, def.min, def.max, 0));
        any = true;
      }
      return any ? { doc: d } : { error: "ما فيه شرائح في values." };
    }
    case "adjust_reset": {
      const d = copy(doc);
      d.adjust = { ...NO_ADJUST };
      d.filter = { id: "none", strength: 100 };
      return { doc: d };
    }
    case "filter": {
      if (!isFilterId(op.id)) return { error: `فلتر غير معروف: ${String(op.id)}` };
      const d = copy(doc);
      d.filter = { id: op.id, strength: Math.round(clamp(op.strength, 0, 100, 100)) };
      return { doc: d };
    }
    case "crop": {
      const w = Number(op.w);
      const h = Number(op.h);
      if (!(w >= 1 && w <= 100 && h >= 1 && h <= 100)) return { error: "قياس القص خارج المدى (1–100٪)." };
      const px = { w: (doc.width * w) / 100, h: (doc.height * h) / 100 };
      if (px.w < PHOTO.minSide || px.h < PHOTO.minSide) return { error: `القص صغير جدًا (أقل من ${PHOTO.minSide} بكسل)؛ كبّر المنطقة.` };
      if (Math.max(px.w, px.h) / Math.min(px.w, px.h) > MAX_STRIP) return { error: "القص شريط ضيق جدًا؛ اختر منطقة أقرب للمربع." };
      return { doc: cropDoc(doc, { x: Number(op.x) || 0, y: Number(op.y) || 0, w, h }) };
    }
    case "crop_ratio": {
      if (!isRatio(op.ratio)) return { error: `نسبة غير معروفة: ${String(op.ratio)}` };
      const [a, b] = op.ratio.split(":").map(Number);
      const f = op.focus && typeof op.focus === "object" ? (op.focus as { x?: unknown; y?: unknown }) : {};
      return { doc: cropDoc(doc, ratioRect(doc, a / b, { x: clamp(f.x, 0, 100, 50), y: clamp(f.y, 0, 100, 50) })) };
    }
    case "canvas": {
      const p = op.preset !== undefined ? sizePreset(op.preset) : null;
      if (op.preset !== undefined && !p) return { error: `مقاس غير معروف: ${String(op.preset)}` };
      const w = p ? p.w : Number(op.width);
      const h = p ? p.h : Number(op.height);
      if (!(w >= PHOTO.minSide && h >= PHOTO.minSide && w <= 20000 && h <= 20000)) return { error: "مقاس اللوحة خارج المدى." };
      if (Math.max(w, h) / Math.min(w, h) > MAX_STRIP) return { error: "نسبة اللوحة متطرفة (أكثر من 16:1)." };
      const f = op.focus && typeof op.focus === "object" ? (op.focus as { x?: unknown; y?: unknown }) : {};
      const cropped = cropDoc(doc, ratioRect(doc, w / h, { x: clamp(f.x, 0, 100, 50), y: clamp(f.y, 0, 100, 50) }));
      const s = fitSide(w, h);
      return { doc: { ...cropped, width: s.width, height: s.height } };
    }
    case "rotate": {
      const deg = Number(op.deg);
      const turns = deg === 90 ? 1 : deg === 180 ? 2 : deg === -90 || deg === 270 ? 3 : 0;
      if (!turns) return { error: "التدوير 90 أو -90 أو 180 فقط." };
      let d = doc;
      for (let i = 0; i < turns; i++) d = turnOnce(d);
      return { doc: d };
    }
    case "flip":
      return op.axis === "h" || op.axis === "v" ? { doc: flipDoc(doc, op.axis) } : { error: "المحور h أو v." };
    case "straighten": {
      if (!doc.base) return { error: "ما فيه صورة أساسية لتقويمها." };
      const d = copy(doc);
      d.base!.straighten = round(clamp(op.deg, -15, 15, 0));
      return { doc: d };
    }
    case "bg": {
      if (!isHex(op.color)) return { error: "اللون #RRGGBB." };
      const d = copy(doc);
      d.bg = String(op.color).toUpperCase();
      return { doc: d };
    }
    case "add_text": {
      if (full) return { error: `بلغت حد الطبقات (${PHOTO.maxLayers}).` };
      const t = readTextLayer({ ...camel(op), id: nextId(doc, "t"), kind: "text", role: op.role ?? "body" }, ctx.fonts?.[0] ?? "readex");
      if (!t) return { error: "النص فارغ." };
      if (ctx.fonts && typeof op.font === "string" && !ctx.fonts.includes(op.font)) return { error: `خط غير معروف: ${op.font}` };
      const d = copy(doc);
      d.layers.push(t);
      return { doc: d };
    }
    case "add_shape": {
      if (full) return { error: `بلغت حد الطبقات (${PHOTO.maxLayers}).` };
      const s = readShape({ ...camel(op), id: nextId(doc, "s"), kind: "shape" });
      if (!s) return { error: `شكل غير معروف: ${String(op.shape)} (${SHAPES.map((x) => x.id).join(" | ")})` };
      const d = copy(doc);
      d.layers.push(s);
      return { doc: d };
    }
    case "add_image": {
      if (full) return { error: `بلغت حد الطبقات (${PHOTO.maxLayers}).` };
      if (typeof op.file !== "string" || (ctx.files && !ctx.files.has(op.file))) return { error: "ملف غير موجود في المشروع." };
      const l = readImageLayer({ ...camel(op), id: nextId(doc, "i"), kind: "image", fileId: op.file });
      if (!l) return { error: "صورة غير صالحة." };
      const d = copy(doc);
      d.layers.push(l);
      return { doc: d };
    }
    case "use_as_base": {
      const f = typeof op.file === "string" ? ctx.files?.get(op.file) : undefined;
      if (typeof op.file !== "string" || !f) return { error: "ملف غير موجود في المشروع." };
      return { doc: setBase(doc, op.file, f) };
    }
    case "update": {
      const l = find(doc, op.id);
      if (!l) return { error: `طبقة غير موجودة: ${String(op.id)}` };
      const patch = op.patch && typeof op.patch === "object" ? camel(op.patch as Record<string, unknown>) : null;
      if (!patch) return { error: "حدّد patch." };
      if (l.kind === "text" && ctx.fonts && typeof patch.font === "string" && !ctx.fonts.includes(patch.font)) return { error: `خط غير معروف: ${patch.font}` };
      const merged = { ...l, ...patch, id: l.id, kind: l.kind };
      const next = l.kind === "text" ? readTextLayer(merged) : l.kind === "image" ? readImageLayer({ ...merged, fileId: (l as ImageLayer).fileId }) : readShape(merged);
      if (!next) return { error: "تعديل غير صالح." };
      const d = copy(doc);
      d.layers = d.layers.map((x) => (x.id === l.id ? next : x));
      return { doc: d };
    }
    case "move": {
      const l = find(doc, op.id);
      if (!l) return { error: `طبقة غير موجودة: ${String(op.id)}` };
      const d = copy(doc);
      d.layers = d.layers.map((x) => (x.id === l.id ? { ...x, x: clamp(op.x, 0, 100, x.x), y: clamp(op.y, 0, 100, x.y) } : x));
      return { doc: d };
    }
    case "delete": {
      if (!find(doc, op.id)) return { error: `طبقة غير موجودة: ${String(op.id)}` };
      const d = copy(doc);
      d.layers = d.layers.filter((x) => x.id !== op.id);
      return { doc: d };
    }
    case "duplicate": {
      const l = find(doc, op.id);
      if (!l) return { error: `طبقة غير موجودة: ${String(op.id)}` };
      if (full) return { error: `بلغت حد الطبقات (${PHOTO.maxLayers}).` };
      const d = copy(doc);
      const prefix = l.kind === "text" ? "t" : l.kind === "image" ? "i" : "s";
      const clone = { ...JSON.parse(JSON.stringify(l)), id: nextId(doc, prefix), x: clamp(l.x + 3, 0, 100, l.x), y: clamp(l.y + 3, 0, 100, l.y) } as PhotoLayer;
      d.layers.splice(d.layers.findIndex((x) => x.id === l.id) + 1, 0, clone);
      return { doc: d };
    }
    case "order": {
      const i = doc.layers.findIndex((x) => x.id === op.id);
      if (i < 0) return { error: `طبقة غير موجودة: ${String(op.id)}` };
      const to = op.to;
      if (to !== "front" && to !== "back" && to !== "up" && to !== "down") return { error: "الترتيب front أو back أو up أو down." };
      const d = copy(doc);
      const [l] = d.layers.splice(i, 1);
      const at = to === "front" ? d.layers.length : to === "back" ? 0 : to === "up" ? Math.min(d.layers.length, i + 1) : Math.max(0, i - 1);
      d.layers.splice(at, 0, l);
      return { doc: d };
    }
    case "align": {
      const l = find(doc, op.id);
      if (!l) return { error: `طبقة غير موجودة: ${String(op.id)}` };
      const to = String(op.to);
      const d = copy(doc);
      d.layers = d.layers.map((x) => {
        if (x.id !== l.id) return x;
        const halfW = x.kind === "text" || x.kind === "shape" ? x.w / 2 : x.kind === "image" ? x.w / 2 : 0;
        if (to === "center") return { ...x, x: 50 };
        if (to === "middle") return { ...x, y: 50 };
        if (to === "left") return { ...x, x: round(clamp(halfW + 6, 0, 100, 50)) };
        if (to === "right") return { ...x, x: round(clamp(100 - halfW - 6, 0, 100, 50)) };
        if (to === "top") return { ...x, y: 8 };
        if (to === "bottom") return { ...x, y: 92 };
        return x;
      });
      if (!["center", "middle", "left", "right", "top", "bottom"].includes(to)) return { error: "المحاذاة center|middle|left|right|top|bottom." };
      return { doc: d };
    }
    default:
      return { error: `أمر غير معروف: ${name}` };
  }
}

/** Commands in order; the first one that can't be done stops the rest (what was done before it stays). */
export function applyOps(doc: PhotoDoc, ops: Op[], ctx: OpContext = {}): OpsResult {
  let cur = doc;
  for (const [index, op] of ops.entries()) {
    const r = applyOp(cur, op, ctx);
    if ("error" in r) return { doc: cur, applied: index, error: { index, op: String(op.op), message: r.error } };
    cur = r.doc;
  }
  return { doc: cur, applied: ops.length, error: null };
}

// ───────────────────────────── telling Claude ─────────────────────────────

/** The project as «زهراء» reads it: every number she may need to change. */
export function describeDoc(doc: PhotoDoc, files: { id: string; name: string; w: number; h: number; role?: string }[] = []): string {
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const d = g(doc.width, doc.height) || 1;
  const lines = [`اللوحة: ${doc.width}×${doc.height} (نسبتها ${doc.width / d}:${doc.height / d})، لون الخلف ${doc.bg}`];
  if (doc.base) {
    const b = doc.base;
    lines.push(
      `الصورة الأساسية: ملف ${b.fileId} (${b.w}×${b.h})، تدوير ${b.rotate}°${b.flipX ? "، مقلوبة أفقيًا" : ""}${b.flipY ? "، مقلوبة رأسيًا" : ""}، تقويم ${b.straighten}°، الجزء الظاهر x${round(b.crop.x * 100, 10)}% y${round(b.crop.y * 100, 10)}% عرض ${round(b.crop.w * 100, 10)}% ارتفاع ${round(b.crop.h * 100, 10)}%`,
    );
  } else lines.push("الصورة الأساسية: لا شيء (لوحة بلون)");
  const adj = ADJUSTS.filter((a) => doc.adjust[a.key] !== 0).map((a) => `${a.key}=${doc.adjust[a.key]}`);
  lines.push(`الشرائح: ${adj.length ? adj.join("، ") : "كلها صفر"}؛ الفلتر: ${doc.filter.id}${doc.filter.id !== "none" ? ` بقوة ${doc.filter.strength}` : ""} (${FILTERS.find((f) => f.id === doc.filter.id)?.name ?? ""})`);
  lines.push(doc.layers.length ? "الطبقات من الأسفل إلى الأعلى:" : "الطبقات: لا شيء");
  for (const l of doc.layers) {
    if (l.kind === "text") lines.push(`- ${l.id} نص «${l.text.replace(/\n/g, " / ").slice(0, 120)}» خط ${l.font} حجم ${round(l.size, 10)}% لون ${l.color} عند (${round(l.x, 10)}, ${round(l.y, 10)}) عرض ${round(l.w, 10)}% محاذاة ${l.align} تأثير ${l.effect}${l.effect !== "none" ? ` ${l.effectColor}` : ""} وزن ${l.weight} دوران ${l.rotate} شفافية ${l.opacity}`);
    else if (l.kind === "shape") lines.push(`- ${l.id} شكل ${l.shape} عند (${round(l.x, 10)}, ${round(l.y, 10)}) ${round(l.w, 10)}×${round(l.h, 10)}% تعبئة ${l.fill || "بلا"} شفافية ${l.opacity} حد ${l.stroke || "بلا"} ${l.strokeW} زاوية ${l.radius} دوران ${l.rotate}`);
    else lines.push(`- ${l.id} صورة ملف ${l.fileId} عند (${round(l.x, 10)}, ${round(l.y, 10)}) عرض ${round(l.w, 10)}% دوران ${l.rotate} شفافية ${l.opacity}`);
  }
  if (files.length) lines.push(`ملفات المشروع التي تقدر تستخدمها: ${files.map((f) => `${f.id} («${f.name}» ${f.w}×${f.h}${f.role ? `، ${f.role}` : ""})`).join("؛ ")}`);
  return lines.join("\n");
}

/** Which parts of the project differ (for the history line the page shows after a command). */
export function docChanges(a: PhotoDoc, b: PhotoDoc): string[] {
  const out: string[] = [];
  if (a.width !== b.width || a.height !== b.height) out.push(`المقاس ${b.width}×${b.height}`);
  if (JSON.stringify(a.base) !== JSON.stringify(b.base)) out.push("الصورة الأساسية");
  if (JSON.stringify(a.adjust) !== JSON.stringify(b.adjust)) out.push("الشرائح");
  if (a.filter.id !== b.filter.id || a.filter.strength !== b.filter.strength) out.push("الفلتر");
  if (a.bg !== b.bg) out.push("لون الخلف");
  if (JSON.stringify(a.layers) !== JSON.stringify(b.layers)) out.push("الطبقات");
  return out;
}

export { POS_KEYS };
