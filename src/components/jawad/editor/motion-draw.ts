// «حيدرة كت» · «مسار الموشن»: draws one motion element (src/lib/editor/motion-elements.ts) on the frame, live from its
// data — the preview and the export both come here through drawFrame, so what is edited is what is exported. Every
// size is in units of the frame's short side (1 u = 1/1080 of it) times the element's own size; entrances are short
// and smooth (no bounce), each line of a list comes in at its own moment, and the newest line wears the accent.

import { countedNumber, enterAt, motionColors, presence, type MotionEl } from "@/lib/editor/motion-elements";

interface Box {
  /** the element's own clock (ms from its start, its trimmed head included) */
  local: number;
  /** how long it shows on the timeline */
  length: number;
  /** the transition's / opacity's share */
  alpha: number;
  family: string;
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/** Words broken into lines no wider than `max` (whole words: Arabic letters stay joined). */
function lines(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(next).width > max) {
      out.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out.length ? out : [""];
}

const font = (weight: number, px: number, family: string) => `${weight} ${Math.max(1, Math.round(px))}px ${family}`;
const alphaHex = (hex: string, a: number) => `${hex}${Math.round(Math.min(1, Math.max(0, a)) * 255).toString(16).padStart(2, "0")}`;

/** How the element as a whole comes in, applied around its centre. */
function entrance(ctx: CanvasRenderingContext2D, m: MotionEl, p: number, u: number, cx: number, cy: number) {
  if (m.enter === "rise") ctx.translate(0, (1 - p) * 46 * u);
  else if (m.enter === "side") ctx.translate(-(1 - p) * 70 * u, 0);
  else if (m.enter === "pop") {
    const s = 0.92 + 0.08 * p;
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
  }
}

/** A soft drop shadow for words straight on the video (no panel behind them). */
function shadow(ctx: CanvasRenderingContext2D, u: number, on: boolean) {
  ctx.shadowColor = on ? "rgba(0,0,0,0.55)" : "transparent";
  ctx.shadowBlur = on ? 18 * u : 0;
  ctx.shadowOffsetY = on ? 4 * u : 0;
}

export function drawMotion(ctx: CanvasRenderingContext2D, m: MotionEl, W: number, H: number, b: Box) {
  const p = presence(b.local, b.length);
  if (p <= 0.001 || b.alpha <= 0.001) return;
  const c = motionColors(m);
  const u = (Math.min(W, H) / 1080) * m.size;
  const cx = m.x * W;
  const cy = m.y * H;
  const maxW = W * 0.84;
  ctx.save();
  ctx.globalAlpha = b.alpha * p;
  ctx.direction = "rtl";
  ctx.textBaseline = "middle";
  entrance(ctx, m, p, u, cx, cy);
  if (m.kind === "title") drawTitle(ctx, m, c, u, cx, cy, maxW, b);
  else if (m.kind === "list") drawList(ctx, m, c, u, cx, cy, maxW, b);
  else if (m.kind === "phrase") drawPhrase(ctx, m, c, u, cx, cy, maxW, b);
  else drawBig(ctx, m, c, u, cx, cy, maxW, b);
  ctx.restore();
}

type C = ReturnType<typeof motionColors>;

function panelBehind(ctx: CanvasRenderingContext2D, m: MotionEl, c: C, x: number, y: number, w: number, h: number, u: number) {
  if (!m.panel) return;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 30 * u;
  ctx.shadowOffsetY = 10 * u;
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, alphaHex(c.panel, 0.96));
  g.addColorStop(1, alphaHex(c.bg, 0.96));
  ctx.fillStyle = g;
  rounded(ctx, x, y, w, h, 34 * u);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = alphaHex(c.accent, 0.35);
  ctx.lineWidth = 2 * u;
  ctx.stroke();
  ctx.restore();
}

function drawTitle(ctx: CanvasRenderingContext2D, m: MotionEl, c: C, u: number, cx: number, cy: number, maxW: number, b: Box) {
  const tPx = 128 * u;
  const sPx = 60 * u;
  ctx.font = font(800, tPx, b.family);
  const tl = lines(ctx, m.title, maxW - 80 * u);
  const tw = Math.max(...tl.map((l) => ctx.measureText(l).width));
  ctx.font = font(500, sPx, b.family);
  const sw = m.sub ? ctx.measureText(m.sub).width : 0;
  const w = Math.min(maxW, Math.max(tw, sw, 520 * u) + 120 * u);
  // top padding · the title's lines · the accent bar · the line under it · bottom padding
  const pad = 44 * u;
  const barGap = 30 * u;
  const h = pad + tl.length * tPx * 1.2 + barGap + (m.sub ? sPx * 1.3 : 0) + pad;
  const top = cy - h / 2;
  panelBehind(ctx, m, c, cx - w / 2, top, w, h, u);
  ctx.textAlign = "center";
  shadow(ctx, u, !m.panel);
  ctx.fillStyle = c.text;
  ctx.font = font(800, tPx, b.family);
  tl.forEach((l, i) => ctx.fillText(l, cx, top + pad + tPx * 0.6 + i * tPx * 1.2));
  const after = top + pad + tl.length * tPx * 1.2;
  // the accent bar draws itself under the title
  const bar = enterAt(b.local - 120) * Math.min(tw, w - 100 * u) * 0.5;
  shadow(ctx, u, false);
  ctx.fillStyle = c.accent;
  rounded(ctx, cx - bar / 2, after + barGap / 2 - 4 * u, bar, 8 * u, 4 * u);
  ctx.fill();
  if (m.sub) {
    ctx.globalAlpha *= enterAt(b.local - 200);
    shadow(ctx, u, !m.panel);
    ctx.fillStyle = c.second;
    ctx.font = font(500, sPx, b.family);
    ctx.fillText(m.sub, cx, after + barGap + sPx * 0.65);
  }
}

function drawList(ctx: CanvasRenderingContext2D, m: MotionEl, c: C, u: number, cx: number, cy: number, maxW: number, b: Box) {
  const hPx = 76 * u;
  const iPx = 56 * u;
  const rowH = iPx * 2;
  const gap = 22 * u;
  const pad = 40 * u;
  ctx.font = font(500, iPx, b.family);
  const iw = m.items.reduce((mx, it) => Math.max(mx, ctx.measureText(it.text).width), 0);
  ctx.font = font(800, hPx, b.family);
  const hw = m.title ? ctx.measureText(m.title).width : 0;
  const w = Math.min(maxW, Math.max(hw + pad * 2, iw + rowH + pad * 3, 760 * u));
  const head = m.title ? hPx * 1.6 : 0;
  const h = head + m.items.length * (rowH + gap) - (m.items.length ? gap : 0) + pad * 2;
  const left = cx - w / 2;
  const top = cy - h / 2;
  panelBehind(ctx, m, c, left, top, w, h, u);
  ctx.textAlign = "center";
  if (m.title) {
    shadow(ctx, u, !m.panel);
    ctx.fillStyle = c.text;
    ctx.font = font(800, hPx, b.family);
    ctx.fillText(m.title, cx, top + pad + hPx * 0.6);
  }
  // the newest line already in wears the accent; the ones before it stay quiet
  const shown = m.items.filter((it) => b.local >= it.at);
  const newest = shown.length - 1;
  m.items.forEach((it, i) => {
    const q = enterAt(b.local - it.at);
    if (q <= 0) return;
    const y = top + pad + head + i * (rowH + gap);
    ctx.save();
    ctx.globalAlpha *= q;
    ctx.translate((1 - q) * -40 * u, 0);
    const on = i === newest;
    shadow(ctx, u, false);
    ctx.fillStyle = on ? c.accent : alphaHex(c.text, 0.08);
    rounded(ctx, left + pad, y, w - pad * 2, rowH, rowH / 2);
    ctx.fill();
    // the round mark at the line's start (the right, in Arabic)
    const r = rowH * 0.32;
    const mx = left + w - pad - rowH / 2;
    ctx.fillStyle = on ? c.text : c.accent;
    ctx.beginPath();
    ctx.arc(mx, y + rowH / 2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = on ? c.accent : c.bg;
    ctx.font = font(800, r * 1.1, b.family);
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), mx, y + rowH / 2 + r * 0.05);
    ctx.fillStyle = on ? "#ffffff" : c.text;
    ctx.font = font(on ? 700 : 500, iPx, b.family);
    ctx.textAlign = "right";
    ctx.fillText(it.text, mx - r - 22 * u, y + rowH / 2);
    ctx.restore();
  });
}

function drawPhrase(ctx: CanvasRenderingContext2D, m: MotionEl, c: C, u: number, cx: number, cy: number, maxW: number, b: Box) {
  const px = 88 * u;
  ctx.font = font(800, px, b.family);
  const rows = lines(ctx, m.title, maxW - 60 * u);
  const rowH = px * 1.35;
  const h = rows.length * rowH + 50 * u;
  const tw = Math.max(...rows.map((r) => ctx.measureText(r).width));
  const w = tw + 90 * u;
  const top = cy - h / 2;
  panelBehind(ctx, m, c, cx - w / 2, top, w, h, u);
  const stress = m.sub.trim();
  rows.forEach((row, ri) => {
    const y = top + 25 * u + rowH * (ri + 0.5);
    // the words from right to left, the stressed one on its accent pill (it grows in after the phrase lands)
    const words = row.split(" ");
    const space = ctx.measureText(" ").width;
    const plain = (w2: string) => w2.replace(/[^\p{L}\p{N}]/gu, "");
    const isHit = (w2: string) => !!stress && plain(w2) === plain(stress);
    // the stressed word gets room for its pill on both sides
    const extra = 22 * u;
    const widths = words.map((w2) => ctx.measureText(w2).width);
    const total = widths.reduce((a, v, k) => a + v + (isHit(words[k]) ? extra * 2 : 0), 0) + space * (words.length - 1);
    let x = cx + total / 2;
    words.forEach((word, wi) => {
      const ww = widths[wi];
      const hit = isHit(word);
      if (hit) x -= extra;
      if (hit) {
        const g = enterAt(b.local - 260);
        shadow(ctx, u, false);
        ctx.fillStyle = c.accent;
        const bw = (ww + extra * 1.6) * g;
        rounded(ctx, x - ww / 2 - bw / 2, y - px * 0.62, bw, px * 1.24, 16 * u);
        ctx.fill();
      }
      shadow(ctx, u, !m.panel && !hit);
      ctx.fillStyle = hit ? "#ffffff" : c.text;
      ctx.textAlign = "right";
      ctx.fillText(word, x, y);
      x -= ww + space + (hit ? extra : 0);
    });
  });
}

function drawBig(ctx: CanvasRenderingContext2D, m: MotionEl, c: C, u: number, cx: number, cy: number, maxW: number, b: Box) {
  const nPx = 280 * u;
  const tPx = 66 * u;
  const shownNum = countedNumber(m.sub || "0", b.local);
  ctx.font = font(900, nPx, b.family);
  ctx.direction = "ltr";
  const numText = `${shownNum}${m.unit}`;
  const finalW = ctx.measureText(`${m.sub || "0"}${m.unit}`).width;
  ctx.direction = "rtl";
  ctx.font = font(600, tPx, b.family);
  const tw = m.title ? ctx.measureText(m.title).width : 0;
  const w = Math.min(maxW, Math.max(finalW, tw) + 110 * u);
  const h = nPx * 1.1 + (m.title ? tPx * 1.6 : 0) + 60 * u;
  const top = cy - h / 2;
  panelBehind(ctx, m, c, cx - w / 2, top, w, h, u);
  ctx.textAlign = "center";
  shadow(ctx, u, !m.panel);
  ctx.fillStyle = c.accent;
  ctx.font = font(900, nPx, b.family);
  ctx.direction = "ltr";
  ctx.fillText(numText, cx, top + 30 * u + nPx * 0.55);
  ctx.direction = "rtl";
  if (m.title) {
    ctx.globalAlpha *= enterAt(b.local - 250);
    ctx.fillStyle = c.text;
    ctx.font = font(600, tPx, b.family);
    ctx.fillText(m.title, cx, top + 30 * u + nPx * 1.1 + tPx * 0.7);
  }
}
