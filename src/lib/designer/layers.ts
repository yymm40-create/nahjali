// «المصمم الذكي» — a design as the site keeps it: the artwork (a picture drawn WITHOUT text), an optional cut-out
// (the subject of a picture with a transparent background), and the TEXT LAYERS: every word as real text in one of
// the site's Arabic fonts, with its size, colour, effect and place, so the person edits it on the page and the final
// PNG is drawn by the browser. Positions are in percent of the design's width and height, so a design survives a
// change of pixel size. Pure (server and browser).

import { DESIGNER, DESIGN_ASPECTS, LAYER_EFFECTS, LAYER_ROLES, type DesignAspect, type LayerEffect, type LayerRole } from "@config/designer";
import { FONTS } from "@config/jawad/student";

export interface TextLayer {
  id: string;
  kind: "text";
  role: LayerRole;
  text: string;
  /** a font id of config/jawad/student.ts FONTS */
  font: string;
  /** the letter height as a percent of the design's height */
  size: number;
  color: string;
  weight: 400 | 700;
  /** the centre of the text box, percent of the width and height */
  x: number;
  y: number;
  /** the text box's width, percent of the width (lines wrap inside it) */
  w: number;
  align: "center" | "right" | "left";
  effect: LayerEffect;
  effectColor: string;
  /** line height as a multiple of the letter size */
  lineHeight: number;
  /** letter spacing in percent of the letter size (0 = normal) */
  spacing: number;
  rotate: number;
  opacity: number;
}

export interface ImageLayer {
  id: string;
  kind: "image";
  /** a designer_files row (the cut-out) */
  fileId: string;
  x: number;
  y: number;
  /** width in percent of the design's width (the height follows the picture's own ratio) */
  w: number;
  rotate: number;
  opacity: number;
  flip: boolean;
  /**
   * «داخل الطبقة اللي تحتها» (Photoshop's clipping mask): this layer is shown ONLY where the layer directly under it
   * has pixels, so a person's picture sits inside a designed frame, a shape or a letter and never spills past its
   * edges. It can be moved and scaled freely inside it; what leaves the shape simply does not show.
   */
  clip: boolean;
}

export type Layer = TextLayer | ImageLayer;

export interface Design {
  id: string;
  aspect: DesignAspect;
  width: number;
  height: number;
  /** the artwork drawn by جواد (a designer_files row), once it exists */
  artwork: string | null;
  layers: Layer[];
  state: "drawing" | "ready" | "failed";
  error?: string;
  /** the technical reason (only the owner sees it) */
  detail?: string;
  /** what the check after drawing found (text that slipped in) */
  flag?: string;
  /** the final PNG the person saved (a designer_files row) */
  final?: string;
}

export const DESIGN_FONT_IDS = FONTS.map((f) => f.id);
export const isFontId = (v: unknown): v is string => typeof v === "string" && DESIGN_FONT_IDS.includes(v);
const HEX = /^#[0-9a-fA-F]{6}$/;
export const isHex = (v: unknown): v is string => typeof v === "string" && HEX.test(v);
const clamp = (v: unknown, lo: number, hi: number, dflt: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
};
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** The default size (percent of the height) of a layer by its role. */
export const ROLE_SIZE: Record<LayerRole, number> = { title: 8, subtitle: 4.5, body: 3, names: 5, date: 3, place: 3, badge: 3.5, caption: 2.5 };

/** The design's pixel size for an aspect (the artwork's own size). */
export const sizeOf = (aspect: DesignAspect) => ({ width: DESIGN_ASPECTS[aspect].px[0], height: DESIGN_ASPECTS[aspect].px[1] });

let seq = 0;
export const layerId = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`;

/** One text layer from the model or from storage, checked and filled in. */
export function readTextLayer(v: unknown, fallbackFont = "readex"): TextLayer | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const text = str(o.text, 600).replace(/\\n/g, "\n").trim();
  if (!text) return null;
  const role = (LAYER_ROLES as readonly string[]).includes(String(o.role)) ? (o.role as LayerRole) : "body";
  const effect = LAYER_EFFECTS.some((e) => e.id === o.effect) ? (o.effect as LayerEffect) : "none";
  return {
    id: str(o.id, 40) || layerId(),
    kind: "text",
    role,
    text,
    font: isFontId(o.font) ? o.font : fallbackFont,
    size: clamp(o.size, 1, 30, ROLE_SIZE[role]),
    color: isHex(o.color) ? o.color.toUpperCase() : "#FFFFFF",
    weight: Number(o.weight) === 400 ? 400 : 700,
    x: clamp(o.x, 0, 100, 50),
    y: clamp(o.y, 0, 100, 50),
    w: clamp(o.w, 10, 100, 80),
    align: o.align === "right" || o.align === "left" ? o.align : "center",
    effect,
    effectColor: isHex(o.effectColor ?? o.effect_color) ? String(o.effectColor ?? o.effect_color).toUpperCase() : "#000000",
    lineHeight: clamp(o.lineHeight, 0.8, 2.2, 1.25),
    spacing: clamp(o.spacing, -10, 40, 0),
    rotate: clamp(o.rotate, -180, 180, 0),
    opacity: clamp(o.opacity, 0, 1, 1),
  };
}

export function readImageLayer(v: unknown): ImageLayer | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o.kind !== "image" || typeof o.fileId !== "string") return null;
  return { id: str(o.id, 40) || layerId(), kind: "image", fileId: o.fileId, x: clamp(o.x, 0, 100, 50), y: clamp(o.y, 0, 100, 50), w: clamp(o.w, 5, 200, 50), rotate: clamp(o.rotate, -180, 180, 0), opacity: clamp(o.opacity, 0, 1, 1), flip: o.flip === true, clip: o.clip === true };
}

/** The layers from the model or from storage, checked, at most DESIGNER.maxLayers (image layers first: they lie under the text). */
export function readLayers(v: unknown, fallbackFont = "readex"): Layer[] {
  const list = Array.isArray(v) ? v : [];
  const out: Layer[] = [];
  for (const x of list) {
    const l = (x && typeof x === "object" && (x as { kind?: unknown }).kind === "image" ? readImageLayer(x) : readTextLayer(x, fallbackFont)) as Layer | null;
    if (l) out.push(l);
    if (out.length >= DESIGNER.maxLayers) break;
  }
  return [...out.filter((l) => l.kind === "image"), ...out.filter((l) => l.kind === "text")];
}

export function readDesign(v: unknown): Design | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const aspect = (typeof o.aspect === "string" && o.aspect in DESIGN_ASPECTS ? o.aspect : "1:1") as DesignAspect;
  const size = sizeOf(aspect);
  const d: Design = {
    id: str(o.id, 60) || "d",
    aspect,
    width: clamp(o.width, 256, 4096, size.width),
    height: clamp(o.height, 256, 4096, size.height),
    artwork: typeof o.artwork === "string" && o.artwork ? o.artwork : null,
    layers: readLayers(o.layers),
    state: o.state === "ready" || o.state === "failed" ? o.state : "drawing",
  };
  if (typeof o.error === "string" && o.error) d.error = o.error.slice(0, 300);
  if (typeof o.detail === "string" && o.detail) d.detail = o.detail.slice(0, 400);
  if (typeof o.flag === "string" && o.flag) d.flag = o.flag.slice(0, 300);
  if (typeof o.final === "string" && o.final) d.final = o.final;
  return d;
}

/** The CSS font-family of a layer's font (the page loads the file from /api/jawad/student/fonts/<id>). */
export const fontFamily = (id: string) => FONTS.find((f) => f.id === id)?.family ?? FONTS[0].family;

/** The layers as «كاظم» reads them back (what is on the design now, after the person's edits). */
export function layersNote(d: Design): string {
  const t = d.layers.filter((l): l is TextLayer => l.kind === "text");
  return t.length ? t.map((l, i) => `${i + 1}) [${l.role}] «${l.text.replace(/\n/g, " / ")}» — ${l.font} ${l.size}% ${l.color} عند (${Math.round(l.x)}%, ${Math.round(l.y)}%)`).join("؛ ") : "بلا نصوص";
}
