// «الممنتج الذكي» — draws one frame of a timeline. The preview and the export both call this, so what people see while
// editing is what they get in the file.

import { clipEnd, colorFilter, transformAt, transitionAt, wordAt, type Clip, type TextStyle, type Timeline, type Track, type Transform } from "@/lib/editor/model";

export interface Frame {
  img: CanvasImageSource;
  width: number;
  height: number;
  /** where the person is (white), for a clip whose background is changed */
  mask?: CanvasImageSource | null;
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

/** What a transition does to a clip on top of its own look: fade, shift (fractions of the frame), zoom, reveal. */
interface Look {
  alpha: number;
  dx: number;
  scale: number;
  /** wipe: the share of the frame (from the right) where the clip shows */
  reveal: number | null;
}
const PLAIN: Look = { alpha: 1, dx: 0, scale: 1, reveal: null };

export type Layer =
  | { track: Track; clip: Clip; /** the clip's own moment (held at its edge during a transition) */ ms: number; look: Look }
  | { solid: string; alpha: number };

/**
 * Everything drawn at `ms`, bottom to top. A transition shows both clips around the cut: the outgoing one holding its
 * last frame after the cut, the incoming one its first frame before it.
 */
export function layersAt(tl: Timeline, ms: number): Layer[] {
  const out: Layer[] = [];
  for (const track of tl.tracks) {
    if (track.kind === "audio" || track.hidden) continue;
    const tr = transitionAt(track, ms);
    if (tr) {
      const { a, b, p } = tr;
      const at = (c: Clip) => Math.min(Math.max(ms, c.start), clipEnd(c) - 1);
      const A = (look: Partial<Look>): Layer => ({ track, clip: a, ms: at(a), look: { ...PLAIN, ...look } });
      const B = (look: Partial<Look>): Layer => ({ track, clip: b, ms: at(b), look: { ...PLAIN, ...look } });
      switch (tr.kind) {
        case "fade":
          out.push(A({}), B({ alpha: p }));
          break;
        case "black":
        case "white":
          out.push(p < 0.5 ? A({}) : B({}), { solid: tr.kind === "black" ? "#000000" : "#ffffff", alpha: 1 - Math.abs(2 * p - 1) });
          break;
        case "slide": {
          const e = p * p * (3 - 2 * p);
          out.push(A({ dx: -e }), B({ dx: 1 - e }));
          break;
        }
        case "zoom":
          out.push(A({ scale: 1 + 0.6 * p, alpha: 1 - p }), B({ scale: 0.85 + 0.15 * p, alpha: p }));
          break;
        case "wipe":
          out.push(A({}), B({ reveal: p }));
          break;
      }
      continue;
    }
    for (const clip of track.clips) {
      if (ms >= clip.start && ms < clipEnd(clip)) {
        out.push({ track, clip, ms, look: PLAIN });
        break;
      }
      if (clip.start > ms) break;
    }
  }
  return out;
}

/** Draws in the timeline's own units (tl.width × tl.height); the caller's transform maps them to its canvas. */
export function drawFrame(ctx: CanvasRenderingContext2D, tl: Timeline, ms: number, frameOf: (clip: Clip, ms: number) => Frame | null) {
  const W = tl.width;
  const H = tl.height;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = tl.background;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  for (const l of layersAt(tl, ms)) {
    if ("solid" in l) {
      if (l.alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = l.alpha;
      ctx.fillStyle = l.solid;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      continue;
    }
    if (l.look.alpha <= 0) continue;
    const t = transformAt(l.clip, l.ms);
    if (l.clip.text) drawText(ctx, l.clip, t, l.look, W, H, l.ms);
    else {
      const f = frameOf(l.clip, l.ms);
      if (f && f.width && f.height) drawMedia(ctx, f, l.clip, t, l.look, W, H);
    }
  }
}

/** The picture's size on the frame before its own scale (cover fills, contain shows it all). */
export function baseSize(fit: Clip["fit"], fw: number, fh: number, W: number, H: number) {
  const k = fit === "contain" ? Math.min(W / fw, H / fh) : Math.max(W / fw, H / fh);
  return { w: fw * k, h: fh * k };
}

function place(ctx: CanvasRenderingContext2D, t: Transform, look: Look, W: number, H: number) {
  ctx.globalAlpha = Math.max(0, Math.min(1, t.opacity * look.alpha));
  if (look.reveal != null) {
    ctx.beginPath();
    ctx.rect(W * (1 - look.reveal), 0, W * look.reveal, H);
    ctx.clip();
  }
  ctx.translate(t.x * W + look.dx * W, t.y * H);
  if (t.rotate) ctx.rotate((t.rotate * Math.PI) / 180);
}

function drawMedia(ctx: CanvasRenderingContext2D, f: Frame, clip: Clip, t: Transform, look: Look, W: number, H: number) {
  const b = baseSize(clip.fit, f.width, f.height, W, H);
  const w = b.w * t.scale * look.scale;
  const h = b.h * t.scale * look.scale;
  ctx.save();
  place(ctx, t, look, W, H);
  if (clip.shape !== "rect") {
    ctx.beginPath();
    if (clip.shape === "circle") ctx.arc(0, 0, Math.min(w, h) / 2, 0, Math.PI * 2);
    else if (typeof ctx.roundRect === "function") ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.08);
    else ctx.rect(-w / 2, -h / 2, w, h);
    ctx.clip();
  }
  const filter = colorFilter(clip.color);
  ctx.imageSmoothingQuality = "high";
  if (clip.bg && f.mask) {
    // the background first (blurred, a colour, or nothing), then the person cut out on top
    if (clip.bg.mode === "blur") {
      ctx.filter = `${filter} blur(${((clip.bg.blur / 100) * Math.max(w, h) * 0.03).toFixed(1)}px)`;
      ctx.drawImage(f.img, -w / 2, -h / 2, w, h);
    } else if (clip.bg.mode === "color") {
      ctx.fillStyle = clip.bg.color;
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    ctx.filter = filter || "none";
    ctx.drawImage(cutout(f, f.mask), -w / 2, -h / 2, w, h);
  } else {
    if (filter) ctx.filter = filter;
    ctx.drawImage(f.img, -w / 2, -h / 2, w, h);
  }
  ctx.restore();
}

let scratch: HTMLCanvasElement | null = null;
/** The picture with everything but the person made transparent (at up to 1280 px; drawn back at the clip's size). */
function cutout(f: Frame, mask: CanvasImageSource) {
  scratch ??= document.createElement("canvas");
  const k = Math.min(1, 1280 / Math.max(f.width, f.height));
  const w = Math.max(1, Math.round(f.width * k));
  const h = Math.max(1, Math.round(f.height * k));
  if (scratch.width !== w || scratch.height !== h) {
    scratch.width = w;
    scratch.height = h;
  }
  const c = scratch.getContext("2d")!;
  c.globalCompositeOperation = "source-over";
  c.clearRect(0, 0, w, h);
  c.drawImage(f.img, 0, 0, w, h);
  c.globalCompositeOperation = "destination-in";
  c.imageSmoothingQuality = "high";
  c.drawImage(mask, 0, 0, w, h);
  c.globalCompositeOperation = "source-over";
  return scratch;
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

/** A text's lines and block size at a given scale (for drawing it and for its box on the preview). */
function textLayout(ctx: CanvasRenderingContext2D, s: TextStyle, scale: number, W: number, H: number) {
  const size = Math.max(8, s.size * H * scale);
  ctx.font = `${s.weight} ${size}px ${FONTS[s.font]}`;
  ctx.direction = "rtl";
  const lines = wrap(ctx, s.body, W * 0.9);
  const widths = lines.map((l) => ctx.measureText(l).width);
  const lh = size * 1.35;
  return { size, lines, widths, lh, w: Math.max(0, ...widths) + size * 0.6, h: lines.length * lh };
}

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

function drawText(ctx: CanvasRenderingContext2D, clip: Clip, t: Transform, look: Look, W: number, H: number, ms: number) {
  const s = clip.text!;
  if (!s.body.trim()) return;
  const tokens = s.body.split(/\s+/).filter(Boolean);
  // a caption with timed words lights the word being said
  if (s.highlight && clip.words.length && clip.words.length === tokens.length) return drawCaption(ctx, clip, tokens, wordAt(clip, ms), t, look, W, H);
  ctx.save();
  place(ctx, t, look, W, H);
  const { size, lines, widths, lh } = textLayout(ctx, s, t.scale * look.scale, W, H);
  ctx.textBaseline = "middle";
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

/** Word by word (right to left for Arabic), the word being said in the highlight colour and a touch bigger. */
function drawCaption(ctx: CanvasRenderingContext2D, clip: Clip, tokens: string[], active: number, t: Transform, look: Look, W: number, H: number) {
  const s = clip.text!;
  ctx.save();
  place(ctx, t, look, W, H);
  const size = Math.max(8, s.size * H * t.scale * look.scale);
  const font = (k: number) => `${s.weight} ${size * k}px ${FONTS[s.font]}`;
  ctx.font = font(1);
  ctx.direction = "rtl";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const space = ctx.measureText(" ").width;
  const widths = tokens.map((w) => ctx.measureText(w).width);
  // lines of whole words that fit 90 % of the frame
  const lines: number[][] = [[]];
  let lw = 0;
  tokens.forEach((_, i) => {
    const add = widths[i] + (lines[lines.length - 1].length ? space : 0);
    if (lines[lines.length - 1].length && lw + add > W * 0.9) {
      lines.push([i]);
      lw = widths[i];
    } else {
      lines[lines.length - 1].push(i);
      lw += add;
    }
  });
  const lh = size * 1.35;
  const top = -((lines.length - 1) * lh) / 2;
  const rtl = ARABIC.test(s.body);
  ctx.lineJoin = "round";
  lines.forEach((line, li) => {
    const total = line.reduce((m, i) => m + widths[i], 0) + space * (line.length - 1);
    const y = top + li * lh;
    if (s.box) {
      ctx.fillStyle = s.box;
      const pad = size * 0.3;
      roundRect(ctx, -total / 2 - pad, y - lh / 2, total + pad * 2, lh, size * 0.2);
    }
    let x = rtl ? total / 2 : -total / 2;
    for (const i of line) {
      const w = widths[i];
      const cx = rtl ? x - w / 2 : x + w / 2;
      const on = i === active;
      ctx.font = font(on ? 1.08 : 1);
      if (!s.box) {
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = Math.max(2, size * 0.09);
        ctx.strokeText(tokens[i], cx, y);
      }
      ctx.fillStyle = on ? s.highlight! : s.color;
      ctx.fillText(tokens[i], cx, y);
      x += rtl ? -(w + space) : w + space;
    }
  });
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

let measurer: CanvasRenderingContext2D | null = null;

/**
 * Where a clip sits on the frame at `ms` (centre, size and turn, in the timeline's units): the box people drag,
 * resize and turn on the preview. `media` is the picture's own size (null for text).
 */
export function clipBox(tl: Timeline, clip: Clip, ms: number, media: { width: number; height: number } | null) {
  const t = transformAt(clip, ms);
  let w: number;
  let h: number;
  if (clip.text) {
    measurer ??= document.createElement("canvas").getContext("2d");
    if (!measurer) return null;
    const l = textLayout(measurer, clip.text, t.scale, tl.width, tl.height);
    w = l.w;
    h = l.h;
  } else {
    if (!media?.width || !media.height) return null;
    const b = baseSize(clip.fit, media.width, media.height, tl.width, tl.height);
    w = b.w * t.scale;
    h = b.h * t.scale;
    if (clip.shape === "circle") w = h = Math.min(w, h);
  }
  return { cx: t.x * tl.width, cy: t.y * tl.height, w, h, rotate: t.rotate, t };
}

/** The output size for a timeline at a quality ("720" or "1080" on the short side), even numbers. */
export function exportSize(tl: Pick<Timeline, "width" | "height">, quality: 720 | 1080) {
  const short = Math.min(tl.width, tl.height);
  const k = quality / short;
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return { width: even(tl.width * k), height: even(tl.height * k) };
}
