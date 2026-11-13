"use client";

// «المصمم الذكي» — drawing a design in the browser: its artwork at the back, a cut-out as a picture layer, every text
// layer in one of the site's Arabic fonts (outline, shadow, glow, pill), and the final PNG at the design's own pixel
// size. Fonts are loaded from the site's own files, so what is seen is what is saved. Shared with «زهراء فوتو ماستر»
// (render.ts, PhotoEditor). The old drag-and-drop layers editor that lived here is gone: a design is changed by
// telling «كاظم», or by hand at زهراء.

import type { Layer, TextLayer } from "@/lib/designer/layers";

export interface FontDef { id: string; family: string; label: string; role: string; files: { url: string; weight: string }[] }
export interface DesignView {
  id: string;
  /** a ready majlis design («دعوة مجلس»): its template id */
  majlis?: string;
  aspect: string;
  width: number;
  height: number;
  artwork: string | null;
  artworkUrl?: string | null;
  layers: (Layer & { url?: string | null })[];
  state: "drawing" | "ready" | "failed";
  error?: string;
  detail?: string;
  flag?: string;
  final?: string;
  finalUrl?: string | null;
  splitOf?: string;
}

const loaded = new Set<string>();

/** Loads a font's files into the page once (the preview and the canvas both use the family name). */
export async function loadFont(f: FontDef) {
  if (loaded.has(f.id) || typeof document === "undefined") return;
  loaded.add(f.id);
  await Promise.all(
    f.files.map(async (file) => {
      try {
        const face = new FontFace(f.family, `url(${file.url})`, { weight: file.weight });
        await face.load();
        document.fonts.add(face);
      } catch { /* the browser falls back to a system font */ }
    }),
  );
}

/** The text of a layer wrapped into lines that fit its box (the same for the preview and the canvas). */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(""); continue; }
    let line = "";
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

const px = (l: TextLayer, H: number) => Math.max(4, (l.size / 100) * H);

/** Draws one text layer on a canvas at the design's full size. */
export function drawText(ctx: CanvasRenderingContext2D, l: TextLayer, W: number, H: number, family: string) {
  const size = px(l, H);
  ctx.save();
  ctx.translate((l.x / 100) * W, (l.y / 100) * H);
  ctx.rotate((l.rotate * Math.PI) / 180);
  ctx.globalAlpha = l.opacity;
  ctx.font = `${l.weight} ${size}px "${family}", sans-serif`;
  ctx.direction = "rtl";
  ctx.textBaseline = "middle";
  ctx.textAlign = l.align;
  try { (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(l.spacing / 100) * size}px`; } catch { /* older browsers */ }
  const boxW = (l.w / 100) * W;
  const lines = wrapLines(ctx, l.text, boxW);
  const lh = size * l.lineHeight;
  const total = lh * lines.length;
  const x0 = l.align === "center" ? 0 : l.align === "right" ? boxW / 2 : -boxW / 2;
  if (l.effect === "pill") {
    const pad = size * 0.35;
    const widest = Math.max(...lines.map((s) => ctx.measureText(s).width));
    const bw = Math.min(boxW, widest) + pad * 2;
    const bx = l.align === "center" ? -bw / 2 : l.align === "right" ? boxW / 2 - bw + pad : -boxW / 2 - pad;
    ctx.fillStyle = l.effectColor;
    const r = size * 0.3;
    const by = -total / 2 - pad * 0.4;
    const bh = total + pad * 0.8;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, r);
    ctx.fill();
  }
  lines.forEach((s, i) => {
    const y = -total / 2 + lh * i + lh / 2;
    if (l.effect === "shadow") { ctx.shadowColor = l.effectColor; ctx.shadowBlur = size * 0.25; ctx.shadowOffsetX = size * 0.05; ctx.shadowOffsetY = size * 0.08; }
    if (l.effect === "glow") { ctx.shadowColor = l.effectColor; ctx.shadowBlur = size * 0.6; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }
    if (l.effect === "outline") {
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.lineWidth = Math.max(1, size * 0.12);
      ctx.strokeStyle = l.effectColor;
      ctx.strokeText(s, x0, y);
    }
    ctx.fillStyle = l.color;
    ctx.fillText(s, x0, y);
    if (l.effect === "glow") { ctx.fillText(s, x0, y); }
    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  });
  ctx.restore();
}

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("image"));
    im.src = url;
  });

/** The whole design as a PNG blob at its own pixel size. */
export async function renderDesign(d: DesignView, fonts: FontDef[]): Promise<Blob> {
  await Promise.all(fonts.filter((f) => d.layers.some((l) => l.kind === "text" && l.font === f.id)).map(loadFont));
  await document.fonts.ready;
  const c = document.createElement("canvas");
  c.width = d.width;
  c.height = d.height;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, d.width, d.height);
  if (d.artworkUrl) {
    const im = await loadImage(d.artworkUrl);
    ctx.drawImage(im, 0, 0, d.width, d.height);
  }
  /** One layer alone, on the context given. */
  const drawOne = async (t: CanvasRenderingContext2D, l: DesignView["layers"][number]) => {
    if (l.kind === "image") {
      if (!l.url) return;
      const im = await loadImage(l.url);
      const w = (l.w / 100) * d.width;
      const h = w * (im.naturalHeight / im.naturalWidth);
      t.save();
      t.translate((l.x / 100) * d.width, (l.y / 100) * d.height);
      t.rotate((l.rotate * Math.PI) / 180);
      if (l.flip) t.scale(-1, 1);
      t.globalAlpha = l.opacity;
      t.drawImage(im, -w / 2, -h / 2, w, h);
      t.restore();
      return;
    }
    drawText(t, l, d.width, d.height, fonts.find((f) => f.id === l.font)?.family ?? "sans-serif");
  };
  const spare = () => {
    const el = document.createElement("canvas");
    el.width = d.width;
    el.height = d.height;
    return { el, ctx: el.getContext("2d")! };
  };

  for (const [i, l] of d.layers.entries()) {
    const under = i > 0 ? d.layers[i - 1] : null;
    // «داخل الطبقة اللي تحتها»: kept only where the layer under it has pixels — the person inside the frame
    if (l.kind === "image" && l.clip && under) {
      const cut = spare();
      await drawOne(cut.ctx, l);
      const mask = spare();
      await drawOne(mask.ctx, under);
      cut.ctx.globalCompositeOperation = "destination-in";
      cut.ctx.drawImage(mask.el, 0, 0);
      ctx.drawImage(cut.el, 0, 0);
      continue;
    }
    await drawOne(ctx, l);
  }
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/png"));
}
