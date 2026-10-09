// «زهراء فوتو ماستر» — draws a project on a canvas: the colour behind, the base picture (turned, flipped, tilted, cropped to
// the canvas) with the sliders and the look on its pixels, then the layers over it (shapes, pictures, real text in the site's
// Arabic fonts). The preview and the export are the same drawing at different sizes, so what is seen is what is saved.
// Browser only.

import { adjustPixels, effectiveAdjust, isIdentity } from "@/lib/photo/pixels";
import { orientedSize, type PhotoDoc, type ShapeLayer } from "@/lib/photo/doc";
import { drawText, loadFont, wrapLines, type FontDef } from "@/components/jawad/designer/LayerEditor";

export interface RenderOpts {
  /** pixels per canvas pixel (1 = the canvas's own size) */
  scale?: number;
  images: Map<string, HTMLImageElement>;
  fonts: FontDef[];
  /** everything but the words (what goes back to «كاظم» as his artwork) */
  skipText?: boolean;
  /** draw only the base picture (with its sliders), no layers */
  baseOnly?: boolean;
}

/** Where a layer lies on the drawn canvas (pixels of the drawn size), for the page to put a handle on it. */
export interface Box {
  id: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotate: number;
}

export const loadImageUrl = (url: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("image"));
    im.src = url;
  });

/** The loaded font files of the fonts the project's text uses (the canvas needs them before drawing). */
export async function ensureFonts(doc: PhotoDoc, fonts: FontDef[]) {
  const used = new Set(doc.layers.flatMap((l) => (l.kind === "text" ? [l.font] : [])));
  await Promise.all(fonts.filter((f) => used.has(f.id)).map(loadFont));
  await document.fonts.ready;
}

function drawBase(ctx: CanvasRenderingContext2D, doc: PhotoDoc, img: HTMLImageElement, W: number, H: number) {
  const b = doc.base!;
  const o = orientedSize(b);
  const s = W / (b.crop.w * o.w);
  ctx.save();
  const th = (b.straighten * Math.PI) / 180;
  if (th) {
    // a small tilt about the middle, zoomed just enough that no corner shows empty
    const z = Math.cos(Math.abs(th)) + Math.sin(Math.abs(th)) * Math.max(W / H, H / W);
    ctx.translate(W / 2, H / 2);
    ctx.rotate(th);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
  }
  ctx.translate(-b.crop.x * o.w * s, -b.crop.y * o.h * s);
  ctx.scale(s, s);
  ctx.translate(o.w / 2, o.h / 2);
  ctx.rotate((b.rotate * Math.PI) / 180);
  ctx.scale(b.flipX ? -1 : 1, b.flipY ? -1 : 1);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, -b.w / 2, -b.h / 2, b.w, b.h);
  ctx.restore();
}

function drawShape(ctx: CanvasRenderingContext2D, l: ShapeLayer, W: number, H: number) {
  const w = (l.w / 100) * W;
  const h = (l.h / 100) * H;
  ctx.save();
  ctx.translate((l.x / 100) * W, (l.y / 100) * H);
  ctx.rotate((l.rotate * Math.PI) / 180);
  ctx.globalAlpha = l.opacity;
  const sw = (l.strokeW / 100) * W;
  if (l.shape === "line") {
    ctx.strokeStyle = l.stroke || l.fill || "#FFFFFF";
    ctx.lineWidth = Math.max(1, sw || W * 0.004);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(w / 2, 0);
    ctx.stroke();
  } else {
    ctx.beginPath();
    if (l.shape === "ellipse") ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    else ctx.roundRect(-w / 2, -h / 2, w, h, Math.min((l.radius / 100) * W, Math.min(w, h) / 2));
    if (l.fill) {
      ctx.fillStyle = l.fill;
      ctx.fill();
    }
    if (l.stroke && sw > 0) {
      ctx.strokeStyle = l.stroke;
      ctx.lineWidth = sw;
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Draws the project on `canvas` (resizing it) and returns where each layer lies. */
export function renderPhoto(canvas: HTMLCanvasElement, doc: PhotoDoc, o: RenderOpts): Box[] {
  const k = o.scale ?? 1;
  const W = Math.max(1, Math.round(doc.width * k));
  const H = Math.max(1, Math.round(doc.height * k));
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = doc.bg;
  ctx.fillRect(0, 0, W, H);

  const img = doc.base ? o.images.get(doc.base.fileId) : undefined;
  if (doc.base && img) {
    const adj = effectiveAdjust(doc.adjust, doc.filter);
    if (isIdentity(adj)) drawBase(ctx, doc, img, W, H);
    else {
      // the sliders touch only the base picture: draw it alone, change its pixels, then lay it down
      const tmp = document.createElement("canvas");
      tmp.width = W;
      tmp.height = H;
      const t = tmp.getContext("2d", { willReadFrequently: true })!;
      drawBase(t, doc, img, W, H);
      const data = t.getImageData(0, 0, W, H);
      adjustPixels(data.data, W, H, adj);
      t.putImageData(data, 0, 0);
      ctx.drawImage(tmp, 0, 0);
    }
  }
  const boxes: Box[] = [];
  if (o.baseOnly) return boxes;
  for (const l of doc.layers) {
    if (l.kind === "shape") {
      drawShape(ctx, l, W, H);
      boxes.push({ id: l.id, cx: (l.x / 100) * W, cy: (l.y / 100) * H, w: (l.w / 100) * W, h: Math.max(((l.h / 100) * H), 12), rotate: l.rotate });
    } else if (l.kind === "image") {
      const im = o.images.get(l.fileId);
      if (!im) continue;
      const w = (l.w / 100) * W;
      const h = w * (im.naturalHeight / im.naturalWidth);
      ctx.save();
      ctx.translate((l.x / 100) * W, (l.y / 100) * H);
      ctx.rotate((l.rotate * Math.PI) / 180);
      if (l.flip) ctx.scale(-1, 1);
      ctx.globalAlpha = l.opacity;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(im, -w / 2, -h / 2, w, h);
      ctx.restore();
      boxes.push({ id: l.id, cx: (l.x / 100) * W, cy: (l.y / 100) * H, w, h, rotate: l.rotate });
    } else {
      const family = o.fonts.find((f) => f.id === l.font)?.family ?? "sans-serif";
      const size = Math.max(4, (l.size / 100) * H);
      if (!o.skipText) drawText(ctx, l, W, H, family);
      // the box: the lines the text wraps into
      ctx.save();
      ctx.font = `${l.weight} ${size}px "${family}", sans-serif`;
      ctx.direction = "rtl";
      const lines = wrapLines(ctx, l.text, (l.w / 100) * W);
      ctx.restore();
      boxes.push({ id: l.id, cx: (l.x / 100) * W, cy: (l.y / 100) * H, w: (l.w / 100) * W, h: size * l.lineHeight * lines.length, rotate: l.rotate });
    }
  }
  return boxes;
}

/** The project as a picture file at its own pixel size. */
export async function exportBlob(doc: PhotoDoc, o: Omit<RenderOpts, "scale">, type: "image/png" | "image/jpeg" | "image/webp" = "image/png", quality = 0.93): Promise<Blob> {
  await ensureFonts(doc, o.fonts);
  const c = document.createElement("canvas");
  // a JPEG has no transparency: the colour behind shows
  renderPhoto(c, doc, { ...o, scale: 1 });
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), type, quality));
}
