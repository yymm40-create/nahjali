// «حيدرة كت» — draws one frame of a timeline. The preview and the export both call this, so what people see while
// editing is what they get in the file.

import { familyOf } from "./fontload";
import { drawWithFx, fxPlan } from "./fx";
import { transitionLook, type TrLook, type TrMask } from "@/lib/editor/transitions";
import { gradeLayers } from "./grade-gl";

/** set while the export draws: the grade always shows (no before/after view) */
let exporting = false;
export const setExporting = (on: boolean) => {
  exporting = on;
};
import { animAt, clipEnd, clipLength, colorFilter, kashida, transformAt, transitionAt, wordAt, type AnimLook, type Clip, type TextStyle, type Timeline, type Track, type Transform, type ClipFx } from "@/lib/editor/model";

export interface Frame {
  img: CanvasImageSource;
  width: number;
  height: number;
  /** where the person is (white), for a clip whose background is changed */
  mask?: CanvasImageSource | null;
}

/** CSS font families for the page's own text styles (set once from the page's loaded fonts). */
export const FONTS: Record<string, string> = {
  readex: "'Readex Pro', system-ui, sans-serif",
  naskh: "'Noto Naskh Arabic', serif",
  kufi: "'Noto Kufi Arabic', sans-serif",
};
export function setFonts(f: Partial<Record<string, string>>) {
  for (const [k, v] of Object.entries(f)) if (v) FONTS[k] = v;
}
/** A text's CSS family: the page's own, or a catalogue font (fontload.ts) with the page's font for what it lacks. */
export const familyFor = (font: string) => FONTS[font] ?? `"${familyOf(font)}", ${FONTS.readex}`;

/** What a transition does to a clip on top of its own look (transitions.ts): moved, scaled, turned, squashed, blurred,
 * shown through a shape, with a passing effect. Shifts are fractions of the frame. */
interface Look {
  alpha: number;
  dx: number;
  dy: number;
  scale: number;
  sx: number;
  sy: number;
  rotate: number;
  blur: number;
  /** wipe (old saved projects): the share of the frame (from the right) where the clip shows */
  reveal: number | null;
  mask: TrMask | null;
  fx: ClipFx[];
}
const PLAIN: Look = { alpha: 1, dx: 0, dy: 0, scale: 1, sx: 1, sy: 1, rotate: 0, blur: 0, reveal: null, mask: null, fx: [] };
const lookOf = (t: TrLook): Look => ({ ...PLAIN, ...t, mask: t.mask ?? null, fx: t.fx ?? [] });

/** Everything that decides how one clip is drawn now: its transition and its entrance or exit. */
type Drawn = AnimLook & { reveal: number | null; mask: TrMask | null; squashX: number; tfx: ClipFx[] };

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
      const f = transitionLook(tr.kind, p);
      const A: Layer = { track, clip: a, ms: at(a), look: lookOf(f.a) };
      const B: Layer = { track, clip: b, ms: at(b), look: lookOf(f.b) };
      out.push(...(f.bUnder ? [B, A] : [A, B]));
      if (f.solid && f.solid.alpha > 0) out.push({ solid: f.solid.color, alpha: f.solid.alpha });
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
    // the clip's own entrance or exit on top of the transition's look
    const m = animAt(l.clip, l.ms);
    const L = l.look;
    const look: Drawn = {
      ...m,
      alpha: L.alpha * m.alpha,
      dx: L.dx + m.dx,
      dy: L.dy + m.dy,
      scale: L.scale * m.scale,
      rotate: L.rotate + m.rotate,
      squash: L.sy * m.squash,
      squashX: L.sx,
      blur: L.blur + m.blur,
      reveal: L.reveal,
      mask: L.mask,
      tfx: L.fx,
    };
    if (look.alpha <= 0.001 || look.show === 0 || look.words === 0) continue;
    if (l.clip.text) drawText(ctx, l.clip, t, look, W, H, l.ms);
    else {
      const f = frameOf(l.clip, l.ms);
      if (f && f.width && f.height) drawMedia(ctx, f, l.clip, t, look, W, H, l.ms);
    }
  }
}

/** The picture's size on the frame before its own scale (cover fills, contain shows it all). */
export function baseSize(fit: Clip["fit"], fw: number, fh: number, W: number, H: number) {
  const k = fit === "contain" ? Math.min(W / fw, H / fh) : Math.max(W / fw, H / fh);
  return { w: fw * k, h: fh * k };
}

function place(ctx: CanvasRenderingContext2D, t: Transform, look: Drawn, W: number, H: number) {
  ctx.globalAlpha = Math.max(0, Math.min(1, t.opacity * look.alpha));
  if (look.reveal != null) {
    ctx.beginPath();
    ctx.rect(W * (1 - look.reveal), 0, W * look.reveal, H);
    ctx.clip();
  }
  // a transition's shape: the clip shows only inside it
  if (look.mask) {
    maskPath(ctx, look.mask, W, H);
    ctx.clip();
  }
  ctx.translate(t.x * W + look.dx * W, t.y * H + look.dy * H);
  const turn = t.rotate + look.rotate;
  if (turn) ctx.rotate((turn * Math.PI) / 180);
  if (look.squash !== 1 || look.squashX !== 1) ctx.scale(look.squashX, look.squash);
}

/** A transition's shape on the frame (it grows with m.p from nothing to all of the frame). */
function maskPath(ctx: CanvasRenderingContext2D, m: TrMask, W: number, H: number) {
  const p = Math.min(1, Math.max(0, m.p));
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.hypot(W, H) / 2;
  const n = Math.max(1, Math.round(m.n ?? 8));
  ctx.beginPath();
  const poly = (k: number, r: number, rot: number, inner = 0) => {
    for (let i = 0; i < k * (inner ? 2 : 1); i++) {
      const a = rot + (i / (k * (inner ? 2 : 1))) * Math.PI * 2;
      const rr = inner && i % 2 ? r * inner : r;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
  };
  switch (m.shape) {
    case "linear": {
      const a = m.angle ?? 0;
      const ext = (W * Math.abs(Math.cos(a)) + H * Math.abs(Math.sin(a))) / 2;
      const s = ext - 2 * ext * p;
      const big = W + H;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.rect(s, -big, big, 2 * big);
      ctx.restore();
      break;
    }
    case "circle":
      ctx.arc(cx, cy, Math.max(0.01, p * R), 0, Math.PI * 2);
      break;
    case "ellipse":
      ctx.ellipse(cx, cy, Math.max(0.01, p * W * 0.75), Math.max(0.01, p * H * 0.75), 0, 0, Math.PI * 2);
      break;
    case "diamond":
      poly(4, p * (W + H) * 0.55, -Math.PI / 2);
      break;
    case "square": {
      const h = (p * Math.max(W, H)) / 2;
      ctx.rect(cx - h, cy - h, 2 * h, 2 * h);
      break;
    }
    case "hexagon":
      poly(6, p * R * 1.16, 0);
      break;
    case "triangle":
      poly(3, p * R * 2.1, -Math.PI / 2);
      break;
    case "star":
      poly(5, p * R * 2.2, -Math.PI / 2, 0.45);
      break;
    case "heart": {
      const r = p * R * 1.5;
      ctx.moveTo(cx, cy + r * 0.9);
      ctx.bezierCurveTo(cx - r * 1.6, cy - r * 0.2, cx - r * 0.6, cy - r * 1.3, cx, cy - r * 0.4);
      ctx.bezierCurveTo(cx + r * 0.6, cy - r * 1.3, cx + r * 1.6, cy - r * 0.2, cx, cy + r * 0.9);
      break;
    }
    case "cross":
      ctx.rect(0, cy - (p * H) / 2, W, p * H);
      ctx.rect(cx - (p * W) / 2, 0, p * W, H);
      break;
    case "clock": {
      const start = -Math.PI / 2;
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R * 1.1, start, start + (m.rev ? -1 : 1) * p * Math.PI * 2, !!m.rev);
      ctx.closePath();
      break;
    }
    case "barn": {
      const vertical = Math.abs(Math.sin(m.angle ?? 0)) > 0.5;
      if (!m.rev) {
        if (vertical) ctx.rect(0, cy - (p * H) / 2, W, p * H);
        else ctx.rect(cx - (p * W) / 2, 0, p * W, H);
      } else if (vertical) {
        ctx.rect(0, 0, W, (p * H) / 2);
        ctx.rect(0, H - (p * H) / 2, W, (p * H) / 2);
      } else {
        ctx.rect(0, 0, (p * W) / 2, H);
        ctx.rect(W - (p * W) / 2, 0, (p * W) / 2, H);
      }
      break;
    }
    case "blinds":
      for (let i = 0; i < n; i++) {
        if (m.v) ctx.rect(W - ((i + 1) * W) / n, 0, (W / n) * p, H);
        else ctx.rect(0, (i * H) / n, W, (H / n) * p);
      }
      break;
    case "stagger":
      for (let i = 0; i < n; i++) {
        const q = Math.min(1, Math.max(0, p * 1.6 - (i / n) * 0.6));
        if (m.v) ctx.rect((i * W) / n, 0, W / n, H * q);
        else ctx.rect(W - W * q, (i * H) / n, W * q, H / n);
      }
      break;
    case "checker":
    case "dots":
    case "mosaic": {
      const cols = n;
      const rows = Math.max(1, Math.round((n * H) / W));
      const cw = W / cols;
      const ch = H / rows;
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < rows; j++) {
          const x = i * cw;
          const y = j * ch;
          if (m.shape === "dots") {
            ctx.moveTo(x + cw / 2, y + ch / 2);
            ctx.arc(x + cw / 2, y + ch / 2, Math.max(0.01, p * Math.hypot(cw, ch) * 0.72), 0, Math.PI * 2);
          } else if (m.shape === "mosaic") {
            const th = (((i * 7919 + j * 104729) % 1000) / 1000) * 0.9;
            if (p > th) ctx.rect(x, y, cw + 1, ch + 1);
          } else {
            const q = Math.min(1, Math.max(0, (i + j) % 2 ? p * 2 - 1 : p * 2));
            ctx.rect(x + (cw * (1 - q)) / 2, y + (ch * (1 - q)) / 2, cw * q + 1, ch * q + 1);
          }
        }
      break;
    }
  }
}

/** «كتابة»: only the clip's right part shows (`w` × `h` around the origin). */
function showFromRight(ctx: CanvasRenderingContext2D, look: Drawn, w: number, h: number) {
  if (look.show == null) return;
  ctx.beginPath();
  ctx.rect(w / 2 - w * look.show, -h / 2, w * look.show, h);
  ctx.clip();
}

/** A tiny repeatable random per frame and slice («قلتش»). */
const jitter = (seed: number, i: number) => (((seed * 7919 + i * 104729) % 1000) / 1000) - 0.5;

function drawMedia(ctx: CanvasRenderingContext2D, f: Frame, clip: Clip, t: Transform, look: Drawn, W: number, H: number, ms: number) {
  // «التلوين»: the frame graded on the GPU first (the picture then goes through everything else as usual)
  if (clip.grades.length) {
    const g = gradeLayers(f.img, f.width, f.height, clip.grades, Math.max(0, ms - clip.start), exporting);
    if (g) f = { ...f, img: g.img };
  }
  const b = baseSize(clip.fit, f.width, f.height, W, H);
  const w = b.w * t.scale * look.scale;
  const h = b.h * t.scale * look.scale;
  ctx.save();
  place(ctx, t, look, W, H);
  showFromRight(ctx, look, w, h);
  if (clip.shape !== "rect") {
    ctx.beginPath();
    if (clip.shape === "circle") ctx.arc(0, 0, Math.min(w, h) / 2, 0, Math.PI * 2);
    else if (typeof ctx.roundRect === "function") ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.08);
    else ctx.rect(-w / 2, -h / 2, w, h);
    ctx.clip();
  }
  const blur = look.blur > 0 ? `blur(${(look.blur * H).toFixed(1)}px)` : "";
  const filter = [colorFilter(clip.color), blur].filter(Boolean).join(" ");
  ctx.imageSmoothingQuality = "high";
  const base = ctx.globalAlpha;
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
  } else if (clip.fx.length || look.tfx.length) {
    // «المؤثرات»: the clip's own effects (and a transition's passing one), on its own time
    const plan = fxPlan(look.tfx.length ? [...clip.fx, ...look.tfx] : clip.fx, Math.max(0, ms - clip.start) / 1000, clipLength(clip) / 1000);
    drawWithFx(ctx, { img: f.img, sw: f.width, sh: f.height }, w, h, plan, filter);
  } else {
    if (filter) ctx.filter = filter;
    // «سحبة»: fading copies trail behind the move
    if (look.smear > 0) {
      for (let k = 4; k >= 1; k--) {
        ctx.globalAlpha = base * 0.22 * look.smear;
        ctx.drawImage(f.img, -w / 2 + k * 0.05 * W * look.smear, -h / 2, w, h);
      }
      ctx.globalAlpha = base;
    }
    if (look.tear > 0) {
      // «قلتش»: the picture torn into slices pushed sideways
      const n = 8;
      for (let i = 0; i < n; i++) ctx.drawImage(f.img, 0, (i * f.height) / n, f.width, f.height / n, -w / 2 + jitter(look.seed, i) * 0.12 * w * look.tear, -h / 2 + (i * h) / n, w, h / n + 1);
    } else ctx.drawImage(f.img, -w / 2, -h / 2, w, h);
  }
  if (look.flash > 0) {
    ctx.filter = "none";
    ctx.globalAlpha = base * Math.min(1, look.flash) * 0.85;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-w / 2, -h / 2, w, h);
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
  ctx.font = `${s.weight} ${size}px ${familyFor(s.font)}`;
  ctx.direction = "rtl";
  const lines = wrap(ctx, s.body, W * 0.9);
  const widths = lines.map((l) => ctx.measureText(l).width);
  const lh = size * 1.35;
  return { size, lines, widths, lh, w: Math.max(0, ...widths) + size * 0.6, h: lines.length * lh };
}

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** «كلمة كلمة»: how far word `i` of `n` has come in (0–1) when the whole text is at `p`. */
const wordIn = (p: number, i: number, n: number) => Math.min(1, Math.max(0, p * (n + 1.5) - i));
const popScale = (a: number) => 0.55 + 0.45 * (1 + 2.70158 * (a - 1) ** 3 + 1.70158 * (a - 1) ** 2);

function drawText(ctx: CanvasRenderingContext2D, clip: Clip, t: Transform, look: Drawn, W: number, H: number, ms: number) {
  const s0 = clip.text!;
  if (!s0.body.trim()) return;
  // «مطّ»: the words stretched with the kashida, settling back
  const s = look.kashida > 0 ? { ...s0, body: kashida(s0.body, Math.round(look.kashida * 5)) } : s0;
  const tokens = s.body.split(/\s+/).filter(Boolean);
  const timed = !!s.highlight && clip.words.length > 0 && clip.words.length === tokens.length;
  // a caption with timed words lights the word being said; «كلمة كلمة» brings the words in one by one
  if (timed || look.words != null) return drawCaption(ctx, { ...clip, text: s }, tokens, timed ? wordAt(clip, ms) : -1, t, look, W, H);
  ctx.save();
  place(ctx, t, look, W, H);
  const { size, lines, widths, lh } = textLayout(ctx, s, t.scale * look.scale, W, H);
  ctx.textBaseline = "middle";
  const blockW = Math.max(...widths);
  const top = -((lines.length - 1) * lh) / 2;
  const pad = size * 0.3;
  showFromRight(ctx, look, blockW + pad * 2, lines.length * lh + pad * 2);
  if (look.blur > 0) ctx.filter = `blur(${(look.blur * H).toFixed(1)}px)`;
  // "right" and "left" are the block's sides; each line lines up on that side
  const xOf = (w: number) => (s.align === "center" ? 0 : s.align === "right" ? blockW / 2 - w / 2 : -blockW / 2 + w / 2);
  ctx.textAlign = "center";
  if (s.box) {
    ctx.fillStyle = s.box;
    lines.forEach((l, i) => {
      if (!l) return;
      const x = xOf(widths[i]);
      roundRect(ctx, x - widths[i] / 2 - pad, top + i * lh - lh / 2, widths[i] + pad * 2, lh, size * 0.2);
    });
  }
  ctx.lineJoin = "round";
  const base = ctx.globalAlpha;
  const write = (dx: number, alpha: number, color: string, edge: boolean) => {
    ctx.globalAlpha = base * alpha;
    ctx.fillStyle = color;
    // a soft dark edge keeps light words readable on any picture (only without a box)
    if (edge && !s.box) {
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = Math.max(2, size * 0.08);
    }
    lines.forEach((l, i) => {
      const x = xOf(widths[i]) + dx;
      if (edge && !s.box) ctx.strokeText(l, x, top + i * lh);
      ctx.fillText(l, x, top + i * lh);
    });
  };
  if (look.smear > 0) for (let k = 4; k >= 1; k--) write(k * 0.05 * W * look.smear, 0.2 * look.smear, s.color, false);
  write(0, 1, s.color, true);
  if (look.flash > 0) write(0, Math.min(1, look.flash), "#ffffff", false);
  ctx.restore();
}

/**
 * Word by word (right to left for Arabic): the word being said in the highlight colour and a touch bigger, or, for
 * «كلمة كلمة», each word popping in after the one before.
 */
function drawCaption(ctx: CanvasRenderingContext2D, clip: Clip, tokens: string[], active: number, t: Transform, look: Drawn, W: number, H: number) {
  const s = clip.text!;
  ctx.save();
  place(ctx, t, look, W, H);
  const size = Math.max(8, s.size * H * t.scale * look.scale);
  const font = (k: number) => `${s.weight} ${size * k}px ${familyFor(s.font)}`;
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
  const blockW = Math.max(...lines.map((line) => line.reduce((m, i) => m + widths[i], 0) + space * (line.length - 1)));
  showFromRight(ctx, look, blockW + size * 0.6, lines.length * lh + size * 0.6);
  if (look.blur > 0) ctx.filter = `blur(${(look.blur * H).toFixed(1)}px)`;
  ctx.lineJoin = "round";
  const base = ctx.globalAlpha;
  lines.forEach((line, li) => {
    const total = line.reduce((m, i) => m + widths[i], 0) + space * (line.length - 1);
    const y = top + li * lh;
    if (s.box) {
      ctx.globalAlpha = base;
      ctx.fillStyle = s.box;
      const pad = size * 0.3;
      roundRect(ctx, -total / 2 - pad, y - lh / 2, total + pad * 2, lh, size * 0.2);
    }
    let x = rtl ? total / 2 : -total / 2;
    for (const i of line) {
      const w = widths[i];
      const cx = rtl ? x - w / 2 : x + w / 2;
      x += rtl ? -(w + space) : w + space;
      const a = look.words == null ? 1 : wordIn(look.words, i, tokens.length);
      if (a <= 0) continue;
      const on = i === active;
      ctx.save();
      ctx.globalAlpha = base * Math.min(1, a * 2);
      ctx.translate(cx, y);
      const k = (on ? 1.08 : 1) * (a < 1 ? popScale(a) : 1);
      ctx.scale(k, k);
      ctx.font = font(1);
      if (!s.box) {
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = Math.max(2, size * 0.09);
        ctx.strokeText(tokens[i], 0, 0);
      }
      ctx.fillStyle = on ? s.highlight! : s.color;
      ctx.fillText(tokens[i], 0, 0);
      if (look.flash > 0) {
        ctx.globalAlpha = base * Math.min(1, look.flash);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(tokens[i], 0, 0);
      }
      ctx.restore();
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
