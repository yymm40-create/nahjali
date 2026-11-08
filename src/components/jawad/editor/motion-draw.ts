// «حيدرة كت» · «مسار الموشن»: draws one motion element (src/lib/editor/motion-elements.ts) on the frame, live from its
// data — the preview and the export both come here through drawFrame, so what is edited is what is exported. Every
// size is in units of the frame's short side (1 u = 1/1080 of it) times the element's own size; entrances are short
// and smooth (no bounce), each line of a list comes in at its own moment, and the newest line wears the accent.

import { countedNumber, enterAt, faceAt, motionColors, presence, type MotionEl } from "@/lib/editor/motion-elements";

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
  if (m.kind === "ambient") {
    drawAmbient(ctx, m, c, W, H, u, b);
    ctx.restore();
    return;
  }
  if (m.kind === "facehud") {
    drawFaceHud(ctx, m, c, W, H, u, b, p);
    ctx.restore();
    return;
  }
  if (m.kind === "ribbon") {
    drawRibbon(ctx, m, c, W, H, u, b);
    ctx.restore();
    return;
  }
  if (m.kind === "doodle" || m.kind === "emojipop" || m.kind === "speedlines") {
    const f = faceAt(m.track, b.local) ?? { x: m.x, y: m.y, w: (300 * u) / W, h: (340 * u) / H };
    if (m.kind === "doodle") drawDoodle(ctx, m, c, W, H, u, b, f);
    else if (m.kind === "emojipop") drawEmojiPop(ctx, m, W, H, u, b, f, p);
    else drawSpeedLines(ctx, c, W, H, u, b, f);
    ctx.restore();
    return;
  }
  if (m.kind === "uicard") {
    entrance(ctx, m, p, u, cx, cy);
    drawUiCard(ctx, m, c, u, cx, cy, maxW, b);
    ctx.restore();
    return;
  }
  if (m.kind === "burst") {
    drawBurst(ctx, c, u, cx, cy, b);
    ctx.restore();
    return;
  }
  if (m.kind === "chip") {
    entrance(ctx, m, p, u, cx, cy);
    drawChip(ctx, m, c, u, cx, cy, maxW, b);
    ctx.restore();
    return;
  }
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

/**
 * «تتبّع الوجه»: thin corner brackets around the face (following it, from the samples read off the video under it) and
 * two small monospace lines beside them whose numbers change with the face's place, like a tracking screen.
 */
function drawFaceHud(ctx: CanvasRenderingContext2D, m: MotionEl, c: C, W: number, H: number, u: number, b: Box, p: number) {
  const f = faceAt(m.track, b.local) ?? { x: m.x, y: m.y, w: (170 * u) / W, h: (200 * u) / H };
  const cx = f.x * W;
  const cy = f.y * H;
  const bw = f.w * W * 1.45;
  const bh = f.h * H * 1.35;
  const x0 = cx - bw / 2;
  const y0 = cy - bh / 2;
  // the brackets grow out to their length as it comes in
  const L = Math.max(14 * u, Math.min(bw, bh) * 0.22) * (0.6 + 0.4 * p);
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = Math.max(2, 4 * u);
  ctx.lineCap = "square";
  ctx.beginPath();
  for (const [x, y, sx, sy] of [
    [x0, y0, 1, 1],
    [x0 + bw, y0, -1, 1],
    [x0, y0 + bh, 1, -1],
    [x0 + bw, y0 + bh, -1, -1],
  ]) {
    ctx.moveTo(x, y + sy * L);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * L, y);
  }
  ctx.stroke();
  // two little crosses inside, like the reference's aim marks
  ctx.lineWidth = Math.max(1, 2 * u);
  ctx.beginPath();
  for (const k of [-0.22, 0.22]) {
    const x = cx + k * bw;
    const y = cy - bh * 0.12;
    ctx.moveTo(x - 5 * u, y);
    ctx.lineTo(x + 5 * u, y);
    ctx.moveTo(x, y - 5 * u);
    ctx.lineTo(x, y + 5 * u);
  }
  ctx.stroke();
  // the numbers: a confidence that flickers a little, and the face's place in pixels of the frame
  const size = 22 * u;
  ctx.font = `500 ${Math.max(1, Math.round(size))}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
  ctx.direction = "ltr";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillStyle = c.text;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 6 * u;
  const tick = Math.floor(b.local / 80);
  const conf = (0.9 + 0.08 * Math.abs(Math.sin(tick * 0.37))).toFixed(3);
  const pad4 = (v: number) => String(Math.max(0, Math.round(v))).padStart(4, "0");
  const label = (m.title || "FACE").slice(0, 12);
  ctx.fillText(`${label} ${conf}`, x0 - 14 * u, y0 + 4 * u);
  ctx.fillText(`X ${pad4(cx)}  Y ${pad4(cy)}`, x0 - 14 * u, y0 + 4 * u + size * 1.35);
}

/** Points along a cubic curve (for drawing it on bit by bit). */
function cubic(p0: number[], p1: number[], p2: number[], p3: number[], n = 48) {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = (1 - t) ** 3, bb = 3 * (1 - t) ** 2 * t, cc = 3 * (1 - t) * t * t, d = t ** 3;
    out.push([a * p0[0] + bb * p1[0] + cc * p2[0] + d * p3[0], a * p0[1] + bb * p1[1] + cc * p2[1] + d * p3[1]]);
  }
  return out;
}
/** The first `share` (0–1) of a line of points. */
function partial(ctx: CanvasRenderingContext2D, pts: [number, number][], share: number) {
  const k = Math.max(0, Math.min(1, share));
  if (k <= 0) return;
  const last = (pts.length - 1) * k;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i <= Math.floor(last); i++) ctx.lineTo(pts[i][0], pts[i][1]);
  const f = last - Math.floor(last);
  const i = Math.floor(last);
  if (f > 0 && i + 1 < pts.length) ctx.lineTo(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f);
  ctx.stroke();
}

/**
 * «شريط يلف»: a thick ribbon drawn on around a point in a loop. The far half arches behind (the top of the loop), the
 * near half sweeps in front (the bottom); «ورا» / «قدّام» draw only one half, so the far half goes under the person's
 * cut-out and the near half over it, and the ribbon wraps around them.
 */
function drawRibbon(ctx: CanvasRenderingContext2D, m: MotionEl, c: C, W: number, H: number, u: number, b: Box) {
  const cx = m.x * W;
  const cy = m.y * H;
  const rx = 340 * u;
  const ry = 80 * u;
  const back = cubic([cx - rx, cy], [cx - rx * 0.6, cy - ry * 1.3], [cx + rx * 0.6, cy - ry * 1.3], [cx + rx, cy]);
  const front = cubic([cx + rx, cy], [cx + rx * 0.6, cy + ry * 1.4], [cx - rx * 0.6, cy + ry * 1.4], [cx - rx, cy + ry * 0.2]);
  // drawn on over its first 0.9 s (the far half first, then the near one)
  const prog = Math.min(1, b.local / 900);
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 46 * u;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (m.part === "back") partial(ctx, back, prog);
  else if (m.part === "front") partial(ctx, front, prog);
  else {
    partial(ctx, back, prog * 2);
    partial(ctx, front, prog * 2 - 1);
  }
}

/** «عناصر تتحرك»: the whole frame, the same at every moment (seeded, driven by the clock), never drawing the eye from the words. */
function drawAmbient(ctx: CanvasRenderingContext2D, m: MotionEl, c: C, W: number, H: number, u: number, b: Box) {
  if (m.panel) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, c.bg);
    g.addColorStop(1, c.panel);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  const base = ctx.globalAlpha;
  const t = (b.local / 1000) * m.speed;
  const n = m.shape === "orbs" ? 9 : m.shape === "khatim" ? 12 : 26;
  let seed = 12345;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < n; i++) {
    const x0 = rnd();
    const y0 = rnd();
    const phase = rnd() * Math.PI * 2;
    const k = 0.45 + rnd() * 0.55;
    const r = (m.shape === "orbs" ? 150 + 190 * k : m.shape === "khatim" ? 34 + 62 * k : 6 + 15 * k) * u;
    const x = (x0 + Math.sin(t * 0.22 * k + phase) * 0.05) * W;
    // they rise slowly and come back in from below
    const y = ((((y0 - t * 0.012 * (0.5 + k)) % 1) + 1) % 1) * (H + r * 2) - r;
    const twinkle = 0.7 + 0.3 * Math.sin(t * 0.9 + phase);
    ctx.globalAlpha = base * (m.shape === "orbs" ? 0.2 : m.shape === "khatim" ? 0.26 : 0.55) * twinkle;
    const color = i % 3 ? c.accent : c.second;
    if (m.shape === "orbs") {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, alphaHex(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    } else if (m.shape === "khatim") {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 0.07 * (i % 2 ? 1 : -1) + phase);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3 * u;
      for (const a of [0, Math.PI / 4]) {
        ctx.save();
        ctx.rotate(a);
        ctx.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
        ctx.restore();
      }
      ctx.restore();
    } else {
      // a four-pointed star («نجوم» bigger and fewer points of light, «لمعات» small dots)
      ctx.fillStyle = color;
      ctx.beginPath();
      if (m.shape === "sparks") ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
      else {
        ctx.moveTo(x, y - r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.quadraticCurveTo(x, y, x, y + r);
        ctx.quadraticCurveTo(x, y, x - r, y);
        ctx.quadraticCurveTo(x, y, x, y - r);
      }
      ctx.fill();
    }
  }
  ctx.globalAlpha = base;
}

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

type FaceNow = { x: number; y: number; w: number; h: number };

/**
 * «شخبطة حول الوجه»: a hand-drawn mark that draws itself on around the face (following it), in white with a soft
 * shadow so it reads on any picture: a loose circle, an arrow coming in at the head, question marks, stars, a cross.
 */
function drawDoodle(ctx: CanvasRenderingContext2D, m: MotionEl, c: C, W: number, H: number, u: number, b: Box, f: FaceNow) {
  const fx = f.x * W, fy = f.y * H, R = Math.max(f.w * W, f.h * H * 0.8) * 0.72;
  const k = Math.min(1, b.local / 650);
  ctx.strokeStyle = c.text;
  ctx.fillStyle = c.text;
  ctx.lineWidth = Math.max(3, 9 * u);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 8 * u;
  const pts = (n: number, at: (i: number) => [number, number]) => Array.from({ length: n }, (_, i) => at(i));
  if (m.mark === "circle") partial(ctx, pts(64, (i) => { const a = -Math.PI / 2 + (i / 63) * Math.PI * 2.12; return [fx + Math.cos(a) * R * (1 + 0.04 * Math.sin(i * 1.3)), fy + Math.sin(a) * R * 1.18]; }), k);
  else if (m.mark === "arrow") {
    const tx = Math.min(W - 40 * u, fx + R * 1.05), ty = fy - R * 0.9;
    partial(ctx, cubic([tx + 190 * u, ty - 200 * u], [tx + 150 * u, ty - 60 * u], [tx + 60 * u, ty - 30 * u], [tx, ty]), k * 1.4);
    partial(ctx, [[tx + 12 * u, ty - 80 * u], [tx, ty], [tx + 80 * u, ty - 14 * u]], k * 1.4 - 0.6);
  } else if (m.mark === "cross") {
    const x = Math.min(W - 90 * u, fx + R * 1.1), y = fy - R * 0.5, s = 64 * u;
    partial(ctx, [[x - s, y - s], [x + s, y + s]], k * 2);
    partial(ctx, [[x + s, y - s], [x - s, y + s]], k * 2 - 1);
  } else if (m.mark === "question") {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = "rtl";
    for (const [i, ox, oy, sz] of [[0, -1.15, -0.85, 150], [1, 1.1, -1.05, 110]] as const) {
      const q = enterAt(b.local - i * 160);
      if (q <= 0) continue;
      ctx.save();
      ctx.globalAlpha *= q;
      ctx.font = font(900, sz * u, b.family);
      ctx.fillText("؟", Math.min(W - 60 * u, Math.max(60 * u, fx + R * ox)), fy + R * oy + (1 - q) * 30 * u);
      ctx.restore();
    }
  } else {
    // stars: three, drawn one after another
    [[-1.2, -0.9], [1.15, -1.0], [1.25, 0.3]].forEach(([ox, oy], i) => {
      const x = Math.min(W - 50 * u, Math.max(50 * u, fx + R * ox)), y = fy + R * oy, r = 38 * u;
      partial(ctx, pts(11, (j) => { const a = -Math.PI / 2 + (j / 10) * Math.PI * 2; const rr = j % 2 ? r * 0.45 : r; return [x + Math.cos(a) * rr, y + Math.sin(a) * rr]; }), Math.min(1, (b.local - i * 260) / 420));
    });
  }
}

/** «إيموجي جنب الراس»: the emoji on a soft white disc beside the head, floating a little (no bounce). */
function drawEmojiPop(ctx: CanvasRenderingContext2D, m: MotionEl, W: number, H: number, u: number, b: Box, f: FaceNow, p: number) {
  const side = f.x > 0.5 ? -1 : 1;
  const r = 96 * u;
  const x = Math.min(W - r - 20 * u, Math.max(r + 20 * u, (f.x + side * f.w * 0.78) * W));
  const y = Math.max(r + 20 * u, (f.y - f.h * 0.62) * H) + Math.sin(b.local / 420) * 6 * u + (1 - p) * 30 * u;
  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = 26 * u;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(r * 1.15)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.fillText((m.title || "⭐").slice(0, 8), x, y + r * 0.06);
}

/** «خطوط سرعة»: white strokes rushing out from around the face, redrawn every few frames (like anime action lines). */
function drawSpeedLines(ctx: CanvasRenderingContext2D, c: C, W: number, H: number, u: number, b: Box, f: FaceNow) {
  const fx = f.x * W, fy = f.y * H;
  let seed = Math.floor(b.local / 90) * 7919 + 17;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const r0 = Math.max(f.w * W, f.h * H) * 0.95;
  ctx.strokeStyle = alphaHex(c.text, 0.7);
  ctx.lineCap = "round";
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2, s = r0 * (1 + rnd() * 0.5), l = (220 + rnd() * 420) * u;
    ctx.lineWidth = (2 + rnd() * 5) * u;
    ctx.beginPath();
    ctx.moveTo(fx + Math.cos(a) * s, fy + Math.sin(a) * s);
    ctx.lineTo(fx + Math.cos(a) * (s + l), fy + Math.sin(a) * (s + l));
    ctx.stroke();
  }
}

/** «كرت تطبيق»: a card like a phone notification — a round badge, a small heading, the words under it. */
function drawUiCard(ctx: CanvasRenderingContext2D, m: MotionEl, c: C, u: number, cx: number, cy: number, maxW: number, b: Box) {
  const w = Math.min(maxW, 900 * u);
  const head = 30 * u, body = 48 * u;
  ctx.font = font(700, body, b.family);
  const ls = lines(ctx, m.sub || m.title, w - 110 * u).slice(0, 3);
  const h = 110 * u + ls.length * body * 1.35;
  const x = cx - w / 2, y = cy - h / 2;
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 40 * u;
  ctx.shadowOffsetY = 12 * u;
  ctx.fillStyle = alphaHex(c.panel, 0.94);
  rounded(ctx, x, y, w, h, 34 * u);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = c.accent;
  ctx.beginPath();
  ctx.arc(x + w - 64 * u, y + 62 * u, 30 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.direction = "rtl";
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.fillStyle = c.accent;
  ctx.font = font(700, head, b.family);
  ctx.fillText((m.sub ? m.title : "") || "إشعار", x + w - 110 * u, y + 62 * u);
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillStyle = alphaHex(c.text, 0.5);
  ctx.font = font(600, head * 0.85, b.family);
  ctx.fillText("الآن", x + 34 * u, y + 62 * u);
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillStyle = c.text;
  ctx.font = font(700, body, b.family);
  ls.forEach((l, i) => ctx.fillText(l, x + w - 40 * u, y + 110 * u + (i + 0.5) * body * 1.35));
}

/**
 * «ملصق بإطار»: a rounded pill on the dark panel with a border in the accent colour: a small ✦, the stressed word
 * (`title`) in the accent, a thin divider, then the second part (`sub`, e.g. «بيض ← خبز») coming in a moment later.
 */
function drawChip(ctx: CanvasRenderingContext2D, m: MotionEl, c: C, u: number, cx: number, cy: number, maxW: number, b: Box) {
  const big = 46 * u, small = 38 * u, pad = 40 * u, h = 104 * u;
  ctx.direction = "rtl";
  ctx.textBaseline = "middle";
  ctx.font = font(700, small, b.family);
  const wT = ctx.measureText(m.title).width;
  ctx.font = font(600, big, b.family);
  const wS = m.sub ? ctx.measureText(m.sub).width : 0;
  const icon = 30 * u, gap = 26 * u;
  const w = Math.min(maxW, pad * 2 + icon + 18 * u + wT + (m.sub ? gap * 2 + 3 * u + wS : 0));
  const x = cx - w / 2;
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 30 * u;
  ctx.shadowOffsetY = 8 * u;
  ctx.fillStyle = alphaHex(c.bg, 0.82);
  rounded(ctx, x, cy - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 2.5 * u;
  ctx.strokeStyle = alphaHex(c.accent, 0.9);
  ctx.stroke();
  let r = x + w - pad;
  ctx.textAlign = "center";
  ctx.fillStyle = c.second;
  ctx.font = font(700, small, b.family);
  ctx.fillText("✦", r - icon / 2, cy + 2 * u);
  r -= icon + 18 * u;
  ctx.textAlign = "right";
  ctx.fillStyle = c.accent;
  ctx.fillText(m.title, r, cy);
  if (!m.sub) return;
  r -= wT + gap;
  ctx.fillStyle = alphaHex(c.text, 0.35);
  ctx.fillRect(r - 3 * u, cy - 26 * u, 3 * u, 52 * u);
  r -= 3 * u + gap;
  // the second part comes in 350 ms after the chip, sliding in from the side it reads towards
  const q = enterAt(Math.max(0, b.local - 350));
  ctx.globalAlpha *= q;
  ctx.fillStyle = c.text;
  ctx.font = font(600, big, b.family);
  ctx.fillText(m.sub, r - (1 - q) * 20 * u, cy);
}

/**
 * «انفجار ذهبي»: two thin rings racing out of the point with ten short rays and a soft flare, fading as they go
 * (about half a second from the element's start: put it on the moment of a snap, a hit or a reveal).
 */
function drawBurst(ctx: CanvasRenderingContext2D, c: C, u: number, cx: number, cy: number, b: Box) {
  const k = Math.min(1, Math.max(0, b.local / 550));
  if (k >= 1) return;
  const e = k >= 1 ? 1 : 1 - Math.pow(2, -10 * k);
  const a = 1 - k;
  const R = 280 * u;
  ctx.translate(cx, cy);
  ctx.lineCap = "round";
  for (const [scale, wid] of [[1, 9], [0.62, 5]] as const) {
    ctx.beginPath();
    ctx.arc(0, 0, 20 * u + R * scale * e, 0, Math.PI * 2);
    ctx.lineWidth = (wid * a + 0.5) * u;
    ctx.strokeStyle = alphaHex(c.second, 0.85 * a);
    ctx.stroke();
  }
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2 + 0.3;
    const r0 = 40 * u + R * 0.55 * e;
    const r1 = r0 + 70 * u * a;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0);
    ctx.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
    ctx.lineWidth = 5 * u * a;
    ctx.strokeStyle = alphaHex(c.text, a);
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 160 * u);
  g.addColorStop(0, alphaHex(c.second, 0.55 * a * a));
  g.addColorStop(1, alphaHex(c.second, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-160 * u, -160 * u, 320 * u, 320 * u);
}
