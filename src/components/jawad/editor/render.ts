// «الممنتج الذكي» — draws one frame of a timeline. The preview and the export both call this, so what people see while
// editing is what they get in the file.

import { clipsAt, type Clip, type TextStyle, type Timeline } from "@/lib/editor/model";

export interface Frame {
  img: CanvasImageSource;
  width: number;
  height: number;
}

/** CSS font families for the text styles (set once from the page's loaded fonts). */
export const FONTS: Record<TextStyle["font"], string> = {
  readex: "'Readex Pro', system-ui, sans-serif",
  naskh: "'Noto Naskh Arabic', serif",
  kufi: "'Noto Kufi Arabic', sans-serif",
};
export function setFonts(f: Partial<Record<TextStyle["font"], string>>) {
  for (const [k, v] of Object.entries(f)) if (v) FONTS[k as TextStyle["font"]] = v;
}

/** Draws in the timeline's own units (tl.width × tl.height); the caller's transform maps them to its canvas. */
export function drawFrame(ctx: CanvasRenderingContext2D, tl: Timeline, ms: number, frameOf: (clip: Clip) => Frame | null) {
  const W = tl.width;
  const H = tl.height;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = tl.background;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  for (const { track, clip } of clipsAt(tl, ms)) {
    if (track.kind === "audio" || track.hidden) continue;
    if (clip.text) drawText(ctx, clip, W, H);
    else {
      const f = frameOf(clip);
      if (f && f.width && f.height) drawMedia(ctx, f, clip, W, H);
    }
  }
}

function drawMedia(ctx: CanvasRenderingContext2D, f: Frame, clip: Clip, W: number, H: number) {
  const t = clip.transform;
  const base = clip.fit === "contain" ? Math.min(W / f.width, H / f.height) : Math.max(W / f.width, H / f.height);
  const w = f.width * base * t.scale;
  const h = f.height * base * t.scale;
  ctx.save();
  ctx.globalAlpha = t.opacity;
  ctx.translate(t.x * W, t.y * H);
  if (t.rotate) ctx.rotate((t.rotate * Math.PI) / 180);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(f.img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

/** Splits a text into lines that fit `max` pixels (words kept whole; a very long word gets its own line). */
function wrap(ctx: CanvasRenderingContext2D, body: string, max: number) {
  const lines: string[] = [];
  for (const para of body.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > max) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

function drawText(ctx: CanvasRenderingContext2D, clip: Clip, W: number, H: number) {
  const s = clip.text!;
  if (!s.body.trim()) return;
  const t = clip.transform;
  const size = Math.max(8, s.size * H * t.scale);
  ctx.save();
  ctx.globalAlpha = t.opacity;
  ctx.translate(t.x * W, t.y * H);
  if (t.rotate) ctx.rotate((t.rotate * Math.PI) / 180);
  ctx.font = `${s.weight} ${size}px ${FONTS[s.font]}`;
  ctx.direction = "rtl";
  ctx.textBaseline = "middle";
  const lines = wrap(ctx, s.body, W * 0.9);
  const lh = size * 1.35;
  const widths = lines.map((l) => ctx.measureText(l).width);
  const blockW = Math.max(...widths);
  const top = -((lines.length - 1) * lh) / 2;
  // "right" and "left" are the block's sides; each line lines up on that side
  const xOf = (w: number) => (s.align === "center" ? 0 : s.align === "right" ? blockW / 2 - w / 2 : -blockW / 2 + w / 2);
  ctx.textAlign = "center";
  if (s.box) {
    ctx.fillStyle = s.box;
    const pad = size * 0.3;
    lines.forEach((l, i) => {
      if (!l) return;
      const x = xOf(widths[i]);
      roundRect(ctx, x - widths[i] / 2 - pad, top + i * lh - lh / 2, widths[i] + pad * 2, lh, size * 0.2);
    });
  }
  ctx.fillStyle = s.color;
  ctx.lineJoin = "round";
  // a soft dark edge keeps light words readable on any picture (only without a box)
  if (!s.box) {
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = Math.max(2, size * 0.08);
  }
  lines.forEach((l, i) => {
    const x = xOf(widths[i]);
    if (!s.box) ctx.strokeText(l, x, top + i * lh);
    ctx.fillText(l, x, top + i * lh);
  });
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

/** The output size for a timeline at a quality ("720" or "1080" on the short side), even numbers. */
export function exportSize(tl: Pick<Timeline, "width" | "height">, quality: 720 | 1080) {
  const short = Math.min(tl.width, tl.height);
  const k = quality / short;
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return { width: even(tl.width * k), height: even(tl.height * k) };
}
