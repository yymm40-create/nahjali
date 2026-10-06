// «المؤثرات» — drawing the 100 clip effects (src/lib/editor/effects.ts) with Canvas 2D only, the same in the preview
// and the export. Every effect is a function of the clip's own time, so a frame always looks the same however it is
// reached (playing, seeking, exporting). An effect adds some of: a motion, a colour filter, a way of drawing the
// picture (mirror, slices, colour split…), and things drawn over it (light, rain, a frame…). All in the clip's own
// box, centred on the origin.

import { FX_BY_ID, type FxParams } from "@/lib/editor/effects";

export interface ClipFxIn {
  id: string;
  amount: number;
}

export interface Source {
  img: CanvasImageSource;
  sw: number;
  sh: number;
}

type Draw = (ctx: CanvasRenderingContext2D, s: Source, w: number, h: number) => void;
type Over = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export interface FxPlan {
  dx: number;
  dy: number;
  scale: number;
  sx: number;
  sy: number;
  rotate: number;
  filter: string;
  /** how strongly the colour filter shows (it is laid over the plain picture) */
  filterAmount: number;
  draw: Draw | null;
  over: Over[];
}

// ───────── small tools ─────────

/** A repeatable random number 0–1 from integers. */
export function hash(a: number, b = 0, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const TAU = Math.PI * 2;
/** Smooth wandering −1…1 (three sines). */
const wander = (t: number, k = 0) => 0.5 * Math.sin(t * 1.3 + k) + 0.3 * Math.sin(t * 2.9 + k * 1.7) + 0.2 * Math.sin(t * 5.3 + k * 2.3);
const num = (p: FxParams, k: string, d: number) => (typeof p[k] === "number" ? (p[k] as number) : d);
const str = (p: FxParams, k: string, d: string) => (typeof p[k] === "string" ? (p[k] as string) : d);

const canvases: HTMLCanvasElement[] = [];
/** A scratch canvas (kept and reused), at most 960 px on its long side. */
function buf(i: number, w: number, h: number) {
  const k = Math.min(1, 960 / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * k));
  const ch = Math.max(1, Math.round(h * k));
  const c = (canvases[i] ??= document.createElement("canvas"));
  if (c.width !== cw || c.height !== ch) {
    c.width = cw;
    c.height = ch;
  }
  const g = c.getContext("2d")!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  g.filter = "none";
  g.clearRect(0, 0, cw, ch);
  return { c, g, w: cw, h: ch };
}

let noiseTiles: HTMLCanvasElement[] | null = null;
/** Four tiles of grey noise (made once). */
function noise(i: number) {
  if (!noiseTiles) {
    noiseTiles = [0, 1, 2, 3].map((k) => {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const g = c.getContext("2d")!;
      const d = g.createImageData(256, 256);
      for (let p = 0; p < d.data.length; p += 4) {
        const v = Math.floor(hash(p, k) * 255);
        d.data[p] = d.data[p + 1] = d.data[p + 2] = v;
        d.data[p + 3] = 255;
      }
      g.putImageData(d, 0, 0);
      return c;
    });
  }
  return noiseTiles[i % 4];
}

let lines: HTMLCanvasElement | null = null;
let lattice: HTMLCanvasElement | null = null;
/** A mashrabiya-like star lattice tile (made once): dark bars, open stars. */
function latticeTile() {
  if (lattice) return lattice;
  const c = document.createElement("canvas");
  c.width = c.height = 120;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, 120, 120);
  g.globalCompositeOperation = "destination-out";
  const star = (x: number, y: number, r: number) => {
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const rr = i % 2 ? r * 0.62 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  };
  star(60, 60, 34);
  for (const [x, y] of [[0, 0], [120, 0], [0, 120], [120, 120]]) star(x, y, 22);
  lattice = c;
  return c;
}

const plain: Draw = (ctx, s, w, h) => ctx.drawImage(s.img, -w / 2, -h / 2, w, h);

/** The picture split into its red, green and blue, moved apart by `px` (of the box's width). */
function rgbSplit(px: number): Draw {
  return (ctx, s, w, h) => {
    const out = buf(0, w, h);
    const k = out.w / w;
    out.g.fillStyle = "#000";
    out.g.fillRect(0, 0, out.w, out.h);
    out.g.globalCompositeOperation = "lighter";
    ["#ff0000", "#00ff00", "#0000ff"].forEach((col, i) => {
      const ch = buf(1 + i, w, h);
      ch.g.drawImage(s.img, 0, 0, ch.w, ch.h);
      ch.g.globalCompositeOperation = "multiply";
      ch.g.fillStyle = col;
      ch.g.fillRect(0, 0, ch.w, ch.h);
      out.g.drawImage(ch.c, (i - 1) * px * k, 0);
    });
    ctx.drawImage(out.c, -w / 2, -h / 2, w, h);
  };
}

function vignette(alpha: number, color = "0,0,0"): Over {
  return (ctx, w, h) => {
    const g = ctx.createRadialGradient(0, 0, Math.min(w, h) * 0.3, 0, 0, Math.hypot(w, h) / 2);
    g.addColorStop(0, `rgba(${color},0)`);
    g.addColorStop(1, `rgba(${color},${alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, -h / 2, w, h);
  };
}
function fill(color: string, op: GlobalCompositeOperation, alpha = 1): Over {
  return (ctx, w, h) => {
    ctx.save();
    ctx.globalCompositeOperation = op;
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = color;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  };
}
function grain(alpha: number, frame: number): Over {
  return (ctx, w, h) => {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.globalCompositeOperation = "overlay";
    const tile = noise(frame);
    const pat = ctx.createPattern(tile, "repeat");
    if (pat) {
      ctx.translate(-w / 2 - hash(frame, 1) * 256, -h / 2 - hash(frame, 2) * 256);
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, w + 256, h + 256);
    }
    ctx.restore();
  };
}
function scanlines(alpha: number, gap: number): Over {
  return (ctx, w, h) => {
    if (!lines || lines.height !== gap) {
      lines = document.createElement("canvas");
      lines.width = 2;
      lines.height = gap;
      const g = lines.getContext("2d")!;
      g.fillStyle = "#000";
      g.fillRect(0, 0, 2, 1);
    }
    const pat = ctx.createPattern(lines, "repeat");
    if (!pat) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    // the lines keep about the same size whatever the clip's size (≈ every 3 px of a 1080 frame)
    const k = Math.max(1, h / 1080);
    ctx.translate(-w / 2, -h / 2);
    ctx.scale(k, k);
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w / k, h / k);
    ctx.restore();
  };
}
function letterbox(ratio: number): Over {
  return (ctx, w, h) => {
    const bar = Math.max(0, (h - w / ratio) / 2);
    if (!bar) return;
    ctx.fillStyle = "#000";
    ctx.fillRect(-w / 2, -h / 2, w, bar);
    ctx.fillRect(-w / 2, h / 2 - bar, w, bar);
  };
}
const tealOrange: Over[] = [fill("#0a6b7a", "soft-light", 0.3), fill("#ff9a3c", "overlay", 0.15)];

/** A soft glow from the bright parts: a small blurred copy, laid over with «screen». */
function glow(blur: number, alpha: number, extra = ""): Draw {
  return (ctx, s, w, h) => {
    plain(ctx, s, w, h);
    const b = buf(4, w / 4, h / 4);
    b.g.filter = `brightness(1.4) ${extra} blur(${Math.max(1, blur * b.h).toFixed(1)}px)`;
    b.g.drawImage(s.img, 0, 0, b.w, b.h);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha *= alpha;
    ctx.drawImage(b.c, -w / 2, -h / 2, w, h);
    ctx.restore();
  };
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const rr = i % 2 ? r * 0.28 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}
function heart(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.3, x, y - r * 0.4);
  ctx.bezierCurveTo(x + r * 0.6, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
  ctx.fill();
}
function softDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ───────── the effects ─────────

/** What all a clip's effects do at `t` seconds into it (`len` its length in seconds). */
export function fxPlan(list: ClipFxIn[], t: number, len: number): FxPlan {
  const plan: FxPlan = { dx: 0, dy: 0, scale: 1, sx: 1, sy: 1, rotate: 0, filter: "", filterAmount: 0, draw: null, over: [] };
  const frame = Math.floor(t * 30);
  const filters: string[] = [];
  const addFilter = (f: string, a: number) => {
    filters.push(f);
    plan.filterAmount = Math.max(plan.filterAmount, a);
  };
  for (const item of list) {
    const fx = FX_BY_ID.get(item.id);
    if (!fx) continue;
    const a = Math.min(1, Math.max(0, item.amount));
    if (a <= 0) continue;
    const p = fx.p;
    switch (fx.base) {
      // ── motion
      case "shake": {
        const amp = num(p, "amp", 0.01) * a;
        const f = num(p, "freq", 10);
        plan.dx += amp * wander(t * f, 1);
        plan.dy += amp * wander(t * f, 7);
        plan.rotate += amp * 40 * wander(t * f, 13);
        plan.scale *= 1 + amp * 2.2;
        if (p.blur) addFilter(`blur(${(num(p, "blur", 1) * a).toFixed(1)}px)`, 1);
        break;
      }
      case "handheld": {
        const amp = num(p, "amp", 0.01) * a;
        plan.dx += amp * (0.6 * Math.sin(TAU * 0.3 * t) + 0.4 * Math.sin(TAU * 0.7 * t + 1));
        plan.dy += amp * (0.6 * Math.sin(TAU * 0.4 * t + 2) + 0.4 * Math.sin(TAU * 1.1 * t));
        plan.rotate += amp * 30 * Math.sin(TAU * 0.25 * t + 3);
        plan.scale *= 1 + amp * 2.5;
        break;
      }
      case "pulse": {
        const per = num(p, "period", 0.5);
        const ph = (t % per) / per;
        let env = Math.exp(-8 * ph);
        if (p.double) env = Math.max(env, Math.exp(-8 * Math.abs(ph - 0.22)) * 0.8);
        plan.scale *= 1 + num(p, "amp", 0.06) * a * env;
        break;
      }
      case "zoomDrift": {
        const k = len > 0 ? Math.min(1, t / len) : 0;
        plan.scale *= 1 + (num(p, "to", 1.2) - 1) * a * k;
        break;
      }
      case "wobble":
        plan.rotate += num(p, "deg", 3) * a * Math.sin(TAU * num(p, "freq", 0.8) * t);
        plan.scale *= 1 + num(p, "deg", 3) * a * 0.012;
        break;
      case "float":
        plan.dy += num(p, "amp", 0.02) * a * Math.sin(TAU * num(p, "freq", 0.4) * t);
        plan.scale *= 1 + num(p, "amp", 0.02) * a * 2;
        break;
      case "bounce": {
        const per = num(p, "period", 0.6);
        const hop = Math.abs(Math.sin((Math.PI * t) / per));
        plan.dy -= num(p, "amp", 0.04) * a * hop;
        const squash = 1 - 0.08 * a * (1 - hop) ** 4;
        plan.sy *= squash;
        plan.sx *= 2 - squash;
        break;
      }
      case "spin":
        plan.rotate += num(p, "speed", 20) * a * t;
        plan.scale *= 1 + 0.42 * a;
        break;
      case "sway":
        plan.dx += num(p, "amp", 0.03) * a * Math.sin(TAU * num(p, "freq", 0.5) * t);
        plan.scale *= 1 + num(p, "amp", 0.03) * a * 2;
        break;

      // ── retro and TV
      case "vhs": {
        const jump = p.jump && hash(Math.floor(t * 2), 9) < 0.25 * a ? 0.04 : 0;
        plan.dy += jump * Math.sin(t * 40);
        addFilter("saturate(1.25) contrast(1.05)", a);
        plan.draw = rgbSplit(num(p, "split", 4) * a);
        plan.over.push(scanlines(num(p, "lines", 0.15) * a * 1.5, 3), grain(num(p, "noise", 0.2) * a, frame), (ctx, w, h) => {
          // the tracking band rolling down
          const y = ((t * 0.3) % 1.2) * h - h / 2 - h * 0.1;
          ctx.save();
          ctx.globalCompositeOperation = "overlay";
          ctx.globalAlpha *= 0.35 * a;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(-w / 2, y, w, h * 0.03);
          ctx.restore();
        });
        break;
      }
      case "crt":
        addFilter(`contrast(1.15) brightness(${(1 + 0.04 * Math.sin(TAU * 8 * t)).toFixed(3)})`, a);
        plan.over.push(scanlines(num(p, "lines", 0.35) * a, 3), vignette(0.6 * a));
        break;
      case "oldFilm": {
        const flick = 1 + (hash(frame, 3) - 0.5) * 0.12 * a;
        addFilter(`${p.gray ? "grayscale(1)" : `sepia(${num(p, "sepia", 0.8)})`} contrast(1.1) brightness(${flick.toFixed(3)})`, a);
        plan.dx += (hash(frame, 4) - 0.5) * 0.004 * a;
        plan.dy += Math.sin(TAU * 0.7 * t + 1) * 0.003 * a;
        plan.scale *= 1.01;
        if (p.warm) plan.over.push(fill("#ff9a3c", "soft-light", 0.3 * a));
        plan.over.push(grain(0.25 * a, frame), vignette(0.55 * a), (ctx, w, h) => {
          ctx.save();
          ctx.globalAlpha *= 0.5 * a;
          ctx.fillStyle = "#f5ecd8";
          const n = Math.round(num(p, "scratches", 4) * hash(Math.floor(t * 6), 5));
          for (let i = 0; i < n; i++) ctx.fillRect(-w / 2 + hash(Math.floor(t * 6), i, 6) * w, -h / 2, Math.max(1, w / 900), h);
          for (let i = 0; i < 8; i++) ctx.fillRect(-w / 2 + hash(frame, i, 7) * w, -h / 2 + hash(frame, i, 8) * h, w / 400, w / 400);
          ctx.restore();
        });
        break;
      }
      case "scanlines":
        plan.over.push(scanlines(num(p, "alpha", 0.3) * a, num(p, "gap", 3)));
        break;
      case "grain":
        plan.over.push(grain(num(p, "alpha", 0.2) * a, frame));
        break;
      case "static":
        plan.over.push(grain(num(p, "alpha", 0.45) * a * (0.7 + 0.3 * hash(frame, 11)), frame), (ctx, w, h) => {
          ctx.save();
          ctx.globalAlpha *= 0.25 * a;
          ctx.globalCompositeOperation = "screen";
          ctx.drawImage(noise(frame + 1), -w / 2, -h / 2, w, h);
          ctx.restore();
        });
        break;
      case "camcorder":
        addFilter("saturate(0.85) contrast(1.12)", a);
        plan.over.push((ctx, w, h) => {
          const u = Math.min(w, h) / 20;
          ctx.save();
          ctx.globalAlpha *= a;
          ctx.strokeStyle = "rgba(255,255,255,0.85)";
          ctx.lineWidth = u / 6;
          for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            const x = sx * (w / 2 - u);
            const y = sy * (h / 2 - u);
            ctx.beginPath();
            ctx.moveTo(x, y - sy * -u * 1.5);
            ctx.lineTo(x, y);
            ctx.lineTo(x - sx * u * 1.5, y);
            ctx.stroke();
          }
          ctx.font = `700 ${u}px monospace`;
          ctx.fillStyle = "#fff";
          ctx.textBaseline = "top";
          ctx.direction = "ltr";
          ctx.textAlign = "left";
          ctx.fillText("PLAY ▶", -w / 2 + u * 1.6, -h / 2 + u * 1.4);
          if (Math.floor(t * 2) % 2 === 0) {
            ctx.fillStyle = "#ff3030";
            ctx.beginPath();
            ctx.arc(w / 2 - u * 4.2, -h / 2 + u * 1.9, u * 0.4, 0, TAU);
            ctx.fill();
          }
          ctx.fillStyle = "#fff";
          ctx.fillText("REC", w / 2 - u * 3.6, -h / 2 + u * 1.4);
          const s = Math.floor(t);
          ctx.textBaseline = "bottom";
          ctx.fillText(`00:${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`, -w / 2 + u * 1.6, h / 2 - u * 1.4);
          ctx.restore();
        });
        break;
      case "frame":
        addFilter("sepia(0.15) saturate(1.1) contrast(1.05)", a);
        plan.over.push((ctx, w, h) => {
          const m = Math.min(w, h) * 0.05 * a;
          ctx.fillStyle = "#fbfaf6";
          ctx.fillRect(-w / 2, -h / 2, w, m);
          ctx.fillRect(-w / 2, -h / 2, m, h);
          ctx.fillRect(w / 2 - m, -h / 2, m, h);
          ctx.fillRect(-w / 2, h / 2 - m * 3.2, w, m * 3.2);
        });
        break;
      case "tone": {
        const f = str(p, "filter", "");
        if (f) addFilter(f, a);
        if (p.tint) plan.over.push(fill(str(p, "tint", ""), "overlay", a));
        if (p.tint2) plan.over.push(...tealOrange.map((o) => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
          ctx.save();
          ctx.globalAlpha *= a;
          o(ctx, w, h);
          ctx.restore();
        }));
        if (p.bloom) plan.draw = glow(0.02, 0.35 * a);
        if (p.grain) plan.over.push(grain(num(p, "grain", 0.15) * a, frame));
        if (p.vignette) plan.over.push(vignette(num(p, "vignette", 0.5) * a));
        if (p.letterbox) plan.over.push(letterbox(num(p, "letterbox", 2.39)));
        break;
      }

      // ── glitch
      case "glitch": {
        const on = hash(Math.floor(t * 12), 21) < num(p, "rate", 0.3) * a;
        if (!on) break;
        const amp = num(p, "amp", 0.04) * a;
        const seed = Math.floor(t * 12);
        const split = num(p, "split", 0);
        plan.draw = (ctx, s, w, h) => {
          (split ? rgbSplit(split * a) : plain)(ctx, s, w, h);
          for (let i = 0; i < 7; i++) {
            const y0 = hash(seed, i, 22);
            const hh = 0.02 + hash(seed, i, 23) * 0.08;
            const dx = (hash(seed, i, 24) - 0.5) * 2 * amp * w;
            ctx.drawImage(s.img, 0, y0 * s.sh, s.sw, hh * s.sh, -w / 2 + dx, -h / 2 + y0 * h, w, hh * h);
          }
        };
        break;
      }
      case "rgb": {
        const pulse = num(p, "pulse", 0);
        const px = num(p, "px", 6) * a * (pulse ? 0.4 + 0.6 * Math.abs(Math.sin(TAU * pulse * t)) : 1);
        plan.draw = rgbSplit(px);
        if (p.shake) {
          plan.dx += num(p, "shake", 0.01) * a * wander(t * 14, 3);
          plan.scale *= 1 + num(p, "shake", 0.01) * 2;
        }
        break;
      }
      case "blocks": {
        const seed = Math.floor(t * 8);
        if (hash(seed, 31) > 0.5 * a + 0.2) break;
        plan.draw = (ctx, s, w, h) => {
          plain(ctx, s, w, h);
          for (let i = 0; i < num(p, "n", 10); i++) {
            const bw = 0.05 + hash(seed, i, 32) * 0.15;
            const bh = 0.03 + hash(seed, i, 33) * 0.1;
            const x = hash(seed, i, 34) * (1 - bw);
            const y = hash(seed, i, 35) * (1 - bh);
            const ox = (hash(seed, i, 36) - 0.5) * 0.1;
            ctx.drawImage(s.img, x * s.sw, y * s.sh, bw * s.sw, bh * s.sh, -w / 2 + (x + ox) * w, -h / 2 + y * h, bw * w, bh * h);
          }
        };
        break;
      }
      case "signal": {
        const seed = Math.floor(t * 10);
        const r = hash(seed, 41);
        if (r < num(p, "rate", 0.3) * a * 0.5) plan.over.push(fill("#000", "source-over", 1));
        else if (r < num(p, "rate", 0.3) * a) plan.over.push(grain(1, frame), fill("#888", "multiply", 0.4));
        break;
      }
      case "flicker": {
        const seed = Math.floor(t * 15);
        if (hash(seed, 51) < num(p, "rate", 0.3) * a) {
          plan.over.push(fill("#000", "source-over", 0.6));
          if (p.glitch) plan.dx += (hash(seed, 52) - 0.5) * 0.06;
        }
        break;
      }
      case "pixelate": {
        const pulse = num(p, "pulse", 0);
        const k = pulse ? Math.max(0, Math.sin(TAU * pulse * t)) : 1;
        const cells = Math.max(6, Math.round(num(p, "size", 40) / Math.max(0.05, a * k)));
        if (a * k < 0.05) break;
        plan.draw = (ctx, s, w, h) => {
          const cw = Math.max(2, Math.round(cells));
          const ch = Math.max(2, Math.round((cells * h) / w));
          const b = buf(5, cw, ch);
          b.g.drawImage(s.img, 0, 0, b.w, b.h);
          const smooth = ctx.imageSmoothingEnabled;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(b.c, -w / 2, -h / 2, w, h);
          ctx.imageSmoothingEnabled = smooth;
        };
        break;
      }

      // ── light
      case "leak": {
        const cols = [str(p, "c1", "#ff8a3d"), str(p, "c2", "#ffd36e"), str(p, "c3", "")].filter(Boolean);
        plan.over.push((ctx, w, h) => {
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          cols.forEach((c, i) => {
            const x = Math.sin(TAU * (0.13 + i * 0.05) * t + i * 2) * w * 0.45;
            const y = Math.cos(TAU * (0.21 + i * 0.04) * t + i) * h * 0.35;
            softDot(ctx, x, y, Math.max(w, h) * 0.55, c, 0.55 * a);
          });
          ctx.restore();
        });
        break;
      }
      case "flare":
        plan.over.push((ctx, w, h) => {
          const lx = -w * 0.3 + Math.sin(t * 0.6) * w * 0.15;
          const ly = -h * 0.3 + Math.cos(t * 0.5) * h * 0.08;
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          softDot(ctx, lx, ly, Math.min(w, h) * 0.35, "rgba(255,240,210,1)", 0.9 * a);
          [0.25, 0.45, 0.6, 0.8, 1.1, 1.35].forEach((k, i) => softDot(ctx, lx - lx * k * 2, ly - ly * k * 2, Math.min(w, h) * (0.03 + 0.05 * hash(i, 61)), ["#7fd0ff", "#ffb36b", "#b38bff"][i % 3], 0.35 * a));
          ctx.globalAlpha = 0.25 * a;
          ctx.fillStyle = "#9fd6ff";
          ctx.fillRect(-w / 2, ly - h * 0.004, w, h * 0.008);
          ctx.restore();
        });
        break;
      case "bloom":
        plan.draw = glow(num(p, "blur", 0.012), num(p, "alpha", 0.45) * a, p.sat ? `saturate(${num(p, "sat", 1.4)})` : "");
        break;
      case "rays":
        plan.over.push((ctx, w, h) => {
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          ctx.translate(-w * 0.4, -h * 0.55);
          ctx.rotate(Math.sin(t * 0.3) * 0.08);
          const n = num(p, "n", 12);
          const R = Math.hypot(w, h) * 1.2;
          for (let i = 0; i < n; i++) {
            const a0 = 0.15 + (i / n) * 1.3;
            const g = ctx.createLinearGradient(0, 0, Math.cos(a0) * R, Math.sin(a0) * R);
            g.addColorStop(0, `rgba(255,236,190,${0.35 * a})`);
            g.addColorStop(1, "rgba(255,236,190,0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a0 - 0.03) * R, Math.sin(a0 - 0.03) * R);
            ctx.lineTo(Math.cos(a0 + 0.03) * R, Math.sin(a0 + 0.03) * R);
            ctx.fill();
          }
          ctx.restore();
        });
        break;
      case "strobe": {
        const ph = (t * num(p, "rate", 2)) % 1;
        const alpha = p.soft ? Math.exp(-ph * 6) : ph < 0.5 ? 1 : 0;
        if (alpha > 0.01) plan.over.push(fill(str(p, "color", "#ffffff"), "source-over", num(p, "alpha", 0.8) * a * alpha));
        break;
      }
      case "spotlight":
        plan.over.push((ctx, w, h) => {
          const x = Math.sin(t * 0.7) * w * 0.25;
          const y = Math.cos(t * 0.5) * h * 0.15;
          const g = ctx.createRadialGradient(x, y, Math.min(w, h) * num(p, "r", 0.35) * 0.6, x, y, Math.min(w, h) * num(p, "r", 0.35) * 1.4);
          g.addColorStop(0, "rgba(0,0,0,0)");
          g.addColorStop(1, `rgba(0,0,0,${0.75 * a})`);
          ctx.fillStyle = g;
          ctx.fillRect(-w / 2, -h / 2, w, h);
        });
        break;

      // ── colour
      case "hue":
        addFilter(`hue-rotate(${Math.round(num(p, "speed", 90) * t) % 360}deg) saturate(1.2)`, a);
        break;
      case "duotone": {
        const dark = str(p, "dark", "#000");
        const light = str(p, "light", "#fff");
        plan.draw = (ctx, s, w, h) => {
          if (a < 1) plain(ctx, s, w, h);
          const b = buf(6, w, h);
          b.g.filter = "grayscale(1) contrast(1.15)";
          b.g.drawImage(s.img, 0, 0, b.w, b.h);
          b.g.filter = "none";
          b.g.globalCompositeOperation = "screen";
          b.g.fillStyle = dark;
          b.g.fillRect(0, 0, b.w, b.h);
          b.g.globalCompositeOperation = "multiply";
          b.g.fillStyle = light;
          b.g.fillRect(0, 0, b.w, b.h);
          ctx.save();
          ctx.globalAlpha *= a;
          ctx.drawImage(b.c, -w / 2, -h / 2, w, h);
          ctx.restore();
        };
        break;
      }

      // ── weather
      case "rain": {
        const n = Math.round(num(p, "n", 140) * a);
        const speed = num(p, "speed", 1.4);
        plan.over.push((ctx, w, h) => {
          ctx.save();
          ctx.strokeStyle = "rgba(220,235,255,0.55)";
          ctx.lineWidth = Math.max(1, w / 700);
          ctx.beginPath();
          for (let i = 0; i < n; i++) {
            const x = (hash(i, 71) * 1.2 - 0.6) * w;
            const y = ((hash(i, 72) + t * speed * (0.8 + hash(i, 73) * 0.4)) % 1) * h * 1.1 - h * 0.55;
            ctx.moveTo(x, y);
            ctx.lineTo(x - h * 0.012, y + h * 0.05);
          }
          ctx.stroke();
          ctx.restore();
        });
        addFilter("brightness(0.88) saturate(0.85)", a);
        if (p.lightning && hash(Math.floor(t * 2), 74) < 0.15) plan.over.push(fill("#ffffff", "screen", 0.6 * a * Math.exp(-((t * 2) % 1) * 8)));
        break;
      }
      case "snow": {
        const n = Math.round(num(p, "n", 90) * a);
        const wind = num(p, "wind", 0);
        plan.over.push((ctx, w, h) => {
          ctx.save();
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          for (let i = 0; i < n; i++) {
            const sp = 0.08 + hash(i, 81) * 0.1;
            const y = ((hash(i, 82) + t * sp * (1 + wind)) % 1) * h * 1.05 - h * 0.52;
            const x = (((hash(i, 83) + t * wind * 0.15) % 1) - 0.5) * w + Math.sin(t * 1.3 + i) * w * 0.02;
            const r = Math.min(w, h) * (0.002 + hash(i, 84) * 0.005);
            ctx.beginPath();
            ctx.arc(x, y, r, 0, TAU);
            ctx.fill();
          }
          ctx.restore();
        });
        break;
      }
      case "particles": {
        const n = Math.round(num(p, "n", 60) * a);
        const color = str(p, "color", "#fff");
        const size = num(p, "size", 0.004);
        plan.over.push((ctx, w, h) => {
          ctx.save();
          if (p.glow) ctx.globalCompositeOperation = "screen";
          for (let i = 0; i < n; i++) {
            const x = (((hash(i, 91) + wander(t * 0.2, i) * 0.05) % 1) - 0.5) * w;
            const y = (((hash(i, 92) - t * 0.02 * hash(i, 93) + 10) % 1) - 0.5) * h;
            const tw = p.glow ? 0.4 + 0.6 * Math.max(0, Math.sin(t * 2 + i * 1.7)) : 0.7;
            softDot(ctx, x, y, Math.min(w, h) * size * (p.glow ? 4 : 1.5), color, tw);
          }
          ctx.restore();
        });
        break;
      }
      case "bubbles": {
        const n = Math.round(num(p, "n", 30) * a);
        plan.over.push((ctx, w, h) => {
          ctx.save();
          ctx.strokeStyle = "rgba(255,255,255,0.7)";
          ctx.lineWidth = Math.max(1, w / 500);
          for (let i = 0; i < n; i++) {
            const r = Math.min(w, h) * (0.01 + hash(i, 101) * 0.03);
            const y = h / 2 - ((hash(i, 102) + t * (0.05 + hash(i, 103) * 0.08)) % 1) * h * 1.1;
            const x = (hash(i, 104) - 0.5) * w + Math.sin(t * 1.5 + i) * r;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, TAU);
            ctx.stroke();
          }
          ctx.restore();
        });
        break;
      }
      case "fog":
        plan.over.push((ctx, w, h) => {
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          for (let i = 0; i < 4; i++) {
            const x = (((hash(i, 111) + t * 0.02 * (i + 1)) % 1.4) - 0.7) * w;
            const y = (hash(i, 112) - 0.5) * h * 0.8;
            softDot(ctx, x, y, Math.max(w, h) * 0.5, p.warm ? "rgba(255,225,190,1)" : "rgba(235,240,250,1)", num(p, "alpha", 0.45) * a * 0.7);
          }
          ctx.restore();
        });
        addFilter("contrast(0.88) brightness(1.04)", a);
        break;

      // ── split and mirror
      case "mirror":
        plan.draw = (ctx, s, w, h) => {
          const x = str(p, "axis", "x") === "x";
          if (x) {
            ctx.drawImage(s.img, 0, 0, s.sw / 2, s.sh, -w / 2, -h / 2, w / 2, h);
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(s.img, 0, 0, s.sw / 2, s.sh, -w / 2, -h / 2, w / 2, h);
            ctx.restore();
          } else {
            ctx.drawImage(s.img, 0, 0, s.sw, s.sh / 2, -w / 2, -h / 2, w, h / 2);
            ctx.save();
            ctx.scale(1, -1);
            ctx.drawImage(s.img, 0, 0, s.sw, s.sh / 2, -w / 2, -h / 2, w, h / 2);
            ctx.restore();
          }
        };
        break;
      case "kaleido":
        plan.rotate += 10 * a * t;
        plan.scale *= 1.42;
        plan.draw = (ctx, s, w, h) => {
          for (const [fx, fy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            ctx.save();
            ctx.scale(fx, fy);
            ctx.drawImage(s.img, s.sw / 4, s.sh / 4, s.sw / 4, s.sh / 4, -w / 2, -h / 2, w / 2, h / 2);
            ctx.restore();
          }
        };
        break;
      case "grid": {
        const n = num(p, "n", 2);
        plan.draw = (ctx, s, w, h) => {
          for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) ctx.drawImage(s.img, -w / 2 + (i * w) / n, -h / 2 + (j * h) / n, w / n, h / n);
        };
        break;
      }
      case "tunnel": {
        const n = num(p, "n", 6);
        plan.draw = (ctx, s, w, h) => {
          plain(ctx, s, w, h);
          for (let i = 1; i < n; i++) {
            const k = Math.pow(0.78, i) * (1 + 0.04 * Math.sin(t * 2 + i));
            ctx.save();
            ctx.globalAlpha *= 0.85 * a;
            ctx.rotate(i * 0.04 * Math.sin(t));
            ctx.drawImage(s.img, (-w * k) / 2, (-h * k) / 2, w * k, h * k);
            ctx.restore();
          }
        };
        break;
      }
      case "zoomBlur": {
        const n = num(p, "n", 6);
        const k = num(p, "k", 0.06) * a * (0.6 + 0.4 * Math.abs(Math.sin(TAU * 0.5 * t)));
        plan.draw = (ctx, s, w, h) => {
          plain(ctx, s, w, h);
          for (let i = 1; i <= n; i++) {
            const z = 1 + (k * i) / n;
            ctx.save();
            ctx.globalAlpha *= 0.5 / n * 2;
            ctx.drawImage(s.img, (-w * z) / 2, (-h * z) / 2, w * z, h * z);
            ctx.restore();
          }
        };
        break;
      }
      case "trail": {
        const n = num(p, "n", 5);
        const at = (u: number) => Math.sin(TAU * 0.6 * u) * 0.08 * a;
        plan.dx += at(t);
        plan.scale *= 1.18;
        plan.draw = (ctx, s, w, h) => {
          for (let i = n; i >= 1; i--) {
            ctx.save();
            ctx.globalAlpha *= 0.18;
            ctx.translate((at(t - i * 0.06) - at(t)) * w, 0);
            plain(ctx, s, w, h);
            ctx.restore();
          }
          plain(ctx, s, w, h);
        };
        break;
      }
      case "splitSlide": {
        const d = num(p, "amp", 0.08) * a * Math.sin(TAU * 0.5 * t);
        plan.scale *= 1 + Math.abs(num(p, "amp", 0.08)) * 2;
        plan.draw = (ctx, s, w, h) => {
          ctx.drawImage(s.img, 0, 0, s.sw, s.sh / 2, -w / 2 + d * w, -h / 2, w, h / 2);
          ctx.drawImage(s.img, 0, s.sh / 2, s.sw, s.sh / 2, -w / 2 - d * w, 0, w, h / 2);
        };
        break;
      }

      // ── dreamy
      case "dream":
        addFilter(`saturate(1.15) brightness(${num(p, "bright", 1.03)})`, a);
        plan.draw = glow(num(p, "blur", 0.012), num(p, "alpha", 0.55) * a);
        break;
      case "wave": {
        const amp = num(p, "amp", 0.01) * a;
        const freq = num(p, "freq", 8);
        const speed = num(p, "speed", 1.5);
        plan.scale *= 1 + amp * 2.5;
        plan.draw = (ctx, s, w, h) => {
          const rows = 90;
          for (let i = 0; i < rows; i++) {
            const y = i / rows;
            const dx = amp * w * Math.sin(TAU * (y * freq * 0.25 + t * speed));
            ctx.drawImage(s.img, 0, y * s.sh, s.sw, s.sh / rows, -w / 2 + dx, -h / 2 + y * h, w, h / rows + 1);
          }
        };
        if (p.tint) plan.over.push(fill(str(p, "tint", ""), "overlay", a));
        break;
      }

      // ── cinematic
      case "letterbox":
        plan.over.push((ctx, w, h) => {
          ctx.save();
          ctx.globalAlpha *= Math.min(1, a * 1.5);
          letterbox(num(p, "ratio", 2.39))(ctx, w, h);
          ctx.restore();
        });
        break;
      case "vignette":
        plan.over.push(vignette(num(p, "alpha", 0.55) * a));
        break;

      // ── occasions
      case "sparkle": {
        const n = Math.round(num(p, "n", 60) * a);
        const color = str(p, "color", "#ffd65c");
        if (p.night) plan.over.push(fill("#0b1a3a", "multiply", 0.45 * a));
        plan.over.push((ctx, w, h) => {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = color;
          for (let i = 0; i < n; i++) {
            const tw = Math.pow(Math.max(0, Math.sin(TAU * (t * (0.6 + hash(i, 121)) + hash(i, 122)))), 3);
            if (tw < 0.05) continue;
            const x = (hash(i, 123) - 0.5) * w;
            const y = (p.night ? hash(i, 124) * 0.6 - 0.5 : hash(i, 124) - 0.5) * h;
            ctx.globalAlpha = tw;
            star(ctx, x, y, Math.min(w, h) * (p.small ? 0.008 : 0.018) * (0.5 + hash(i, 125)));
          }
          ctx.restore();
        });
        if (!p.small) plan.over.push(fill("#c9a24a", "soft-light", 0.2 * a));
        break;
      }
      case "bokeh": {
        const n = Math.round(num(p, "n", 24) * a);
        const color = str(p, "color", "#ffc35c");
        if (p.leak) plan.over.push(fill(str(p, "leak", "#ff9a3d"), "soft-light", 0.3 * a));
        plan.over.push((ctx, w, h) => {
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          for (let i = 0; i < n; i++) {
            const x = (hash(i, 131) - 0.5) * w + Math.sin(t * 0.4 + i) * w * 0.02;
            const y = h / 2 - ((hash(i, 132) + t * 0.03) % 1) * h * 1.1;
            softDot(ctx, x, y, Math.min(w, h) * (0.03 + hash(i, 133) * 0.06), color, 0.45);
          }
          ctx.restore();
        });
        break;
      }
      case "crescent":
        plan.over.push((ctx, w, h) => {
          const r = Math.min(w, h) * 0.08;
          const x = w / 2 - r * 2.2;
          const y = -h / 2 + r * 2.2;
          const pulse = 0.85 + 0.15 * Math.sin(TAU * 0.5 * t);
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          softDot(ctx, x, y, r * 3 * pulse, "rgba(255,214,120,1)", 0.5 * a);
          ctx.globalCompositeOperation = "source-over";
          const b = buf(7, r * 3, r * 3);
          const k = b.w / (r * 3);
          b.g.fillStyle = "#ffe08a";
          b.g.beginPath();
          b.g.arc(b.w / 2, b.h / 2, r * k, 0, TAU);
          b.g.fill();
          b.g.globalCompositeOperation = "destination-out";
          b.g.beginPath();
          b.g.arc(b.w / 2 + r * k * 0.45, b.h / 2 - r * k * 0.15, r * k * 0.85, 0, TAU);
          b.g.fill();
          ctx.globalAlpha = a;
          ctx.drawImage(b.c, x - r * 1.5, y - r * 1.5, r * 3, r * 3);
          ctx.restore();
        });
        break;
      case "fireworks": {
        const n = num(p, "n", 4);
        plan.over.push((ctx, w, h) => {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          for (let b = 0; b < n; b++) {
            const cycle = 2.4;
            const u = (t + b * (cycle / n)) / cycle;
            const k = Math.floor(u);
            const age = (u - k) * cycle;
            if (age > 1.6) continue;
            const cx = (hash(b, k, 141) - 0.5) * w * 0.7;
            const cy = -h * (0.15 + hash(b, k, 142) * 0.25);
            const col = ["#ffd65c", "#3dff9a", "#ff6b9a", "#7fd0ff"][(b + k) % 4];
            ctx.fillStyle = col;
            for (let i = 0; i < 48; i++) {
              const ang = (i / 48) * TAU + hash(b, i) * 0.2;
              const v = Math.min(w, h) * 0.22 * (0.6 + hash(b, i, k) * 0.4);
              const x = cx + Math.cos(ang) * v * age * 0.9;
              const y = cy + Math.sin(ang) * v * age * 0.9 + 0.25 * h * age * age * 0.5;
              ctx.globalAlpha = a * Math.max(0, 1 - age / 1.6);
              ctx.beginPath();
              ctx.arc(x, y, Math.min(w, h) * 0.004, 0, TAU);
              ctx.fill();
            }
          }
          ctx.restore();
        });
        break;
      }
      case "goldFrame":
        plan.over.push((ctx, w, h) => {
          const m = Math.min(w, h) * 0.035;
          ctx.save();
          ctx.globalAlpha *= a;
          const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
          g.addColorStop(0, "#8a6418");
          g.addColorStop(0.5, "#ffe9a3");
          g.addColorStop(1, "#a87a1f");
          ctx.strokeStyle = g;
          ctx.lineWidth = m;
          ctx.strokeRect(-w / 2 + m, -h / 2 + m, w - 2 * m, h - 2 * m);
          ctx.lineWidth = m / 5;
          ctx.strokeRect(-w / 2 + m * 2, -h / 2 + m * 2, w - 4 * m, h - 4 * m);
          // the shine sweeping round
          const sx = ((t * 0.4) % 1.4 - 0.7) * w * 1.4;
          const sh = ctx.createLinearGradient(sx - w * 0.1, 0, sx + w * 0.1, 0);
          sh.addColorStop(0, "rgba(255,255,255,0)");
          sh.addColorStop(0.5, "rgba(255,255,255,0.8)");
          sh.addColorStop(1, "rgba(255,255,255,0)");
          ctx.strokeStyle = sh;
          ctx.lineWidth = m;
          ctx.globalCompositeOperation = "screen";
          ctx.strokeRect(-w / 2 + m, -h / 2 + m, w - 2 * m, h - 2 * m);
          ctx.restore();
        });
        break;
      case "mashrabiya":
        plan.over.push((ctx, w, h) => {
          const pat = ctx.createPattern(latticeTile(), "repeat");
          if (!pat) return;
          ctx.save();
          ctx.globalCompositeOperation = "multiply";
          ctx.globalAlpha *= num(p, "alpha", 0.35) * a;
          const k = Math.min(w, h) / 600;
          ctx.translate(-w / 2 + ((t * 5) % 120) * k, -h / 2);
          ctx.scale(k, k);
          ctx.rotate(0.12);
          ctx.fillStyle = pat;
          ctx.fillRect(-240, -240, w / k + 480, h / k + 480);
          ctx.restore();
        });
        break;
      case "sand": {
        const n = Math.round(num(p, "n", 200) * a);
        addFilter("sepia(0.4) contrast(0.9) brightness(1.03)", a);
        plan.over.push(fill("#c8a46a", "multiply", 0.35 * a), (ctx, w, h) => {
          ctx.save();
          ctx.strokeStyle = "rgba(236,206,150,0.5)";
          ctx.lineWidth = Math.max(1, w / 900);
          ctx.beginPath();
          for (let i = 0; i < n; i++) {
            const x = (((hash(i, 151) + t * (0.5 + hash(i, 152))) % 1) - 0.5) * w * 1.1;
            const y = (hash(i, 153) - 0.5) * h;
            ctx.moveTo(x, y);
            ctx.lineTo(x - w * 0.04, y + h * 0.004);
          }
          ctx.stroke();
          ctx.restore();
        });
        break;
      }
      case "smoke": {
        const n = num(p, "n", 6);
        plan.over.push((ctx, w, h) => {
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          for (let i = 0; i < n; i++) {
            const u = (hash(i, 161) + t * 0.05) % 1;
            const x = (hash(i, 162) - 0.5) * w * 0.8 + Math.sin(t * 0.6 + i * 2) * w * 0.08;
            const y = h / 2 - u * h * 1.2;
            softDot(ctx, x, y, Math.min(w, h) * (0.15 + u * 0.25), "rgba(240,236,230,1)", 0.28 * a * Math.sin(Math.PI * u));
          }
          ctx.restore();
        });
        break;
      }
      case "confetti": {
        const n = Math.round(num(p, "n", 90) * a);
        plan.over.push((ctx, w, h) => {
          ctx.save();
          const s = Math.min(w, h) * 0.012;
          for (let i = 0; i < n; i++) {
            const fall = 0.12 + hash(i, 171) * 0.15;
            const y = ((hash(i, 172) + t * fall) % 1) * h * 1.1 - h * 0.55;
            const x = (hash(i, 173) - 0.5) * w + Math.sin(t * 2 + i) * s * 3;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(t * 4 * (hash(i, 174) - 0.5) + i);
            ctx.scale(1, Math.cos(t * 6 + i));
            ctx.fillStyle = ["#ffd65c", "#2fbf71", "#ff5c8a", "#5cc8ff", "#ffffff"][i % 5];
            ctx.fillRect(-s / 2, -s, s, s * 2);
            ctx.restore();
          }
          ctx.restore();
        });
        break;
      }
      case "hearts": {
        const n = Math.round(num(p, "n", 18) * a);
        plan.over.push((ctx, w, h) => {
          ctx.save();
          for (let i = 0; i < n; i++) {
            const u = (hash(i, 181) + t * (0.08 + hash(i, 182) * 0.06)) % 1;
            const x = (hash(i, 183) - 0.5) * w + Math.sin(t * 2 + i) * w * 0.03;
            const y = h / 2 - u * h * 1.1;
            ctx.globalAlpha = Math.sin(Math.PI * u) * 0.9;
            ctx.fillStyle = ["#ff4d7a", "#ff8fb1", "#ff2d55"][i % 3];
            heart(ctx, x, y, Math.min(w, h) * (0.015 + hash(i, 184) * 0.02));
          }
          ctx.restore();
        });
        break;
      }
    }
  }
  plan.filter = filters.join(" ");
  return plan;
}

/**
 * Draws a picture with its effects in its box (the caller has placed the canvas at the box's centre and set any
 * clipping). `base` is the clip's own colour filter («ألوان»), if any.
 */
export function drawWithFx(ctx: CanvasRenderingContext2D, s: Source, w: number, h: number, plan: FxPlan, base: string) {
  ctx.save();
  ctx.translate(plan.dx * w, plan.dy * h);
  if (plan.rotate) ctx.rotate((plan.rotate * Math.PI) / 180);
  if (plan.scale !== 1 || plan.sx !== 1 || plan.sy !== 1) ctx.scale(plan.scale * plan.sx, plan.scale * plan.sy);
  const draw = plan.draw ?? plain;
  const alpha = ctx.globalAlpha;
  if (plan.filter && plan.filterAmount < 1) {
    // the plain picture, then the filtered one over it as strong as the effect
    if (base) ctx.filter = base;
    draw(ctx, s, w, h);
    ctx.globalAlpha = alpha * plan.filterAmount;
  }
  ctx.filter = [base, plan.filter].filter(Boolean).join(" ") || "none";
  draw(ctx, s, w, h);
  ctx.filter = "none";
  ctx.globalAlpha = alpha;
  ctx.restore();
  for (const o of plan.over) {
    ctx.save();
    o(ctx, w, h);
    ctx.restore();
  }
}
