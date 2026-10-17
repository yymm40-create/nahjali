// «مختبر الموشن» — the LIVE SAMPLES of the gallery: one tiny deterministic drawing per option of config/editor/lab-options,
// looping in a small canvas so the person sees what each choice means (a look, a structure, how shots connect, the feel,
// the pace, the camera, the type, the finish, the ending). Drawn here, in code — never generated pictures (the owner's
// rule). Every drawer is a pure function of the loop time t (0 → 1 over LOOP seconds).

export const LOOP = 2.8;
export interface Swatch {
  bg: string;
  ink: string;
  accent: string;
}
export const STUDIO: Swatch = { bg: "#14171d", ink: "#f2f0eb", accent: "#c6ff1a" };
export type Drawer = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, s: Swatch) => void;

const AR = '"Noto Kufi Arabic", "IBM Plex Sans Arabic", "Segoe UI", system-ui, sans-serif';
const NASKH = '"Amiri", "Noto Naskh Arabic", "Scheherazade New", serif';
const MONO = '"IBM Plex Mono", ui-monospace, "SF Mono", monospace';
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const seg = (t: number, a: number, d: number) => clamp((t - a) / d);
const outExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const inCubic = (x: number) => x * x * x;
const outCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const inOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const back = (x: number, s = 1.7) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const alpha = (hex: string, a: number) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const isLight = (hex: string) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) > 140;
};

function bg(ctx: CanvasRenderingContext2D, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(0, 0, w, h);
}
function word(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, weight = 900, font = AR, align: CanvasTextAlign = "center") {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  ctx.fillText(text, x, y);
}
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, seed: number) {
  ctx.save();
  ctx.globalAlpha = amount;
  for (let i = 0; i < 160; i++) {
    const x = hash(i + seed * 7) * w, y = hash(i * 3 + seed) * h;
    ctx.fillStyle = hash(i * 5) > 0.5 ? "#fff" : "#000";
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.restore();
}
function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, a: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
function beat(t: number, n: number) {
  const b = t * n;
  return { i: Math.floor(b) % n, f: b - Math.floor(b) };
}
/** a frame of the "scene" every connect/camera demo uses: a ground, a word and a chip */
function scene(ctx: CanvasRenderingContext2D, w: number, h: number, s: Swatch, which: 0 | 1, k = 1) {
  bg(ctx, w, h, which ? s.accent : s.bg);
  const ink = which ? (isLight(s.accent) ? "#111" : "#fff") : s.ink;
  word(ctx, which ? "بعد" : "قبل", w / 2, h / 2, h * 0.34 * k, ink);
  ctx.fillStyle = alpha(ink, 0.35);
  rrect(ctx, w * 0.36, h * 0.74, w * 0.28, h * 0.08, h * 0.04);
  ctx.fill();
}
function cursor(ctx: CanvasRenderingContext2D, x: number, y: number, press: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 - press * 0.15, 1 - press * 0.15);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 16);
  ctx.lineTo(4.5, 12);
  ctx.lineTo(8, 18);
  ctx.lineTo(10.5, 16.5);
  ctx.lineTo(7, 11);
  ctx.lineTo(12, 11);
  ctx.closePath();
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}
/** a ball moving left→right then back, with a given ease and overshoot (the «feel» demos) */
function ball(ctx: CanvasRenderingContext2D, w: number, h: number, s: Swatch, t: number, ease: (x: number) => number, trail: boolean, twos = false) {
  bg(ctx, w, h, s.bg);
  let p = t < 0.5 ? ease(seg(t, 0.05, 0.4)) : 1 - ease(seg(t, 0.55, 0.4));
  if (twos) p = Math.round(p * 7) / 7;
  const x = w * 0.2 + p * w * 0.6, y = h * 0.5;
  if (trail) for (let i = 1; i <= 5; i++) {
    const pp = t < 0.5 ? ease(seg(t - i * 0.012, 0.05, 0.4)) : 1 - ease(seg(t - i * 0.012, 0.55, 0.4));
    ctx.fillStyle = alpha(s.accent, 0.18 - i * 0.03);
    ctx.beginPath();
    ctx.arc(w * 0.2 + pp * w * 0.6, y, h * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = s.accent;
  ctx.beginPath();
  ctx.arc(x, y, h * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alpha(s.ink, 0.25);
  ctx.fillRect(w * 0.15, h * 0.72, w * 0.7, 1);
}
function metronome(ctx: CanvasRenderingContext2D, w: number, h: number, s: Swatch, t: number, bpm: number, label: string) {
  bg(ctx, w, h, s.bg);
  const beats = (LOOP * bpm) / 60;
  const b = t * beats, i = Math.floor(b), f = b - i;
  const n = Math.min(8, Math.ceil(beats));
  for (let k = 0; k < n; k++) {
    const on = k === i % n;
    ctx.fillStyle = on ? s.accent : alpha(s.ink, 0.2);
    ctx.beginPath();
    ctx.arc(w * 0.12 + (k / (n - 1 || 1)) * w * 0.76, h * 0.62, on ? h * 0.07 * (1.4 - f * 0.4) : h * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
  word(ctx, label, w / 2, h * 0.3, h * 0.2, s.ink, 800);
}

export const DEMOS: Record<string, Drawer> = {
  // ── looks ──
  "look-editorial": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    ctx.fillStyle = s.accent;
    ctx.fillRect(w * 0.08, h * 0.22, w * 0.84 * outExpo(seg(t, 0, 0.4)), 3);
    word(ctx, "01", w * 0.1, h * 0.62, h * 0.5, alpha(s.ink, 0.12), 800, MONO, "left");
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, h * 0.3, w, h * 0.5);
    ctx.clip();
    word(ctx, "تقرير", w * 0.9, h * 0.58 + (1 - outExpo(seg(t, 0.15, 0.5))) * h * 0.3, h * 0.3, s.ink, 900, AR, "right");
    ctx.restore();
  },
  "look-luxury": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const k = 1 + 0.03 * t;
    word(ctx, "فخامة", w / 2, h * 0.5, h * 0.3 * k, s.ink, 400, NASKH);
    const x = (t * 1.6 - 0.3) * w;
    const g = ctx.createLinearGradient(x - 40, 0, x + 40, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, alpha(s.accent, 0.5));
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.3, w, h * 0.4);
    ctx.fillStyle = s.accent;
    ctx.fillRect(w * 0.42, h * 0.76, w * 0.16, 1);
  },
  "look-pop": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    for (let i = 0; i < 3; i++) {
      const b = back(seg(t, 0.1 + i * 0.12, 0.5));
      ctx.fillStyle = i === 1 ? s.accent : alpha(s.ink, 0.85);
      ctx.beginPath();
      ctx.arc(w * (0.25 + i * 0.25), h * 0.5, Math.max(0, h * 0.16 * b), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = alpha(s.ink, 0.15);
    for (let y = 0; y < h; y += 6) for (let x = 0; x < w; x += 6) if ((x / 6 + y / 6) % 2 === 0) ctx.fillRect(x, y, 1.6, 1.6);
  },
  "look-noir": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const g = ctx.createRadialGradient(w * 0.7, h * 0.3, 0, w * 0.7, h * 0.3, w * 0.7);
    g.addColorStop(0, alpha(s.accent, 0.35));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    word(ctx, "ليل", w / 2, h * 0.52, h * 0.42, s.ink, 700, '"Sofia Sans Extra Condensed", ' + AR);
    grain(ctx, w, h, 0.25, Math.floor(t * 30));
    vignette(ctx, w, h, 0.7);
  },
  "look-pastel": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const y = h * 0.3 + Math.sin(t * Math.PI * 2) * 4;
    ctx.shadowColor = alpha(s.accent, 0.35);
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    rrect(ctx, w * 0.2, y, w * 0.6, h * 0.42, 14);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = s.accent;
    rrect(ctx, w * 0.28, y + h * 0.1, w * 0.2, h * 0.08, 8);
    ctx.fill();
    ctx.fillStyle = alpha(s.ink, 0.5);
    rrect(ctx, w * 0.28, y + h * 0.24, w * 0.44 * outExpo(seg(t, 0.2, 0.6)), h * 0.05, 4);
    ctx.fill();
  },
  "look-terminal": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const text = "> build --film";
    const n = Math.floor(seg(t, 0.05, 0.6) * text.length);
    ctx.font = `500 ${h * 0.13}px ${MONO}`;
    ctx.fillStyle = s.accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.direction = "ltr";
    ctx.fillText(text.slice(0, n), w * 0.08, h * 0.45);
    if (Math.floor(t * 6) % 2 === 0) ctx.fillRect(w * 0.08 + ctx.measureText(text.slice(0, n)).width + 3, h * 0.38, h * 0.07, h * 0.14);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  },
  "look-brutal": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const { i } = beat(t, 4);
    ctx.fillStyle = s.accent;
    ctx.fillRect(i % 2 ? 0 : w * 0.5, i < 2 ? 0 : h * 0.5, w * 0.5, h * 0.5);
    word(ctx, "خام", w / 2, h / 2, h * 0.5, i % 2 ? s.ink : s.bg, 900);
  },
  "look-paper": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    grain(ctx, w, h, 0.12, 3);
    word(ctx, "حكاية", w / 2, h * 0.5 + Math.sin(t * Math.PI * 2) * 2, h * 0.3, s.ink, 700, NASKH);
    ctx.strokeStyle = s.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.3, h * 0.72);
    ctx.lineTo(w * 0.3 + w * 0.4 * outCubic(seg(t, 0.2, 0.6)), h * 0.72);
    ctx.stroke();
  },
  "look-chrome": (ctx, w, h, t, s) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#1b1e3a");
    g.addColorStop(0.5, "#3a1f5c");
    g.addColorStop(1, "#0b2a3a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const px = w * 0.2 + Math.sin(t * Math.PI * 2) * w * 0.05;
    const c = ctx.createLinearGradient(0, h * 0.35, 0, h * 0.65);
    c.addColorStop(0, "#f8fbff");
    c.addColorStop(0.5, s.accent);
    c.addColorStop(1, "#6a7a9a");
    ctx.fillStyle = c;
    rrect(ctx, px, h * 0.35, w * 0.6, h * 0.3, h * 0.15);
    ctx.fill();
    word(ctx, "Y2K", w / 2, h * 0.5, h * 0.16, "#0b0f1a", 800, '"Unbounded", ' + AR);
  },
  "look-kinetic": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const ws = ["سريع", "واضح", "ناري", "الآن"];
    const { i, f } = beat(t, 4);
    const k = 1 + 0.08 * (1 - outExpo(f));
    word(ctx, ws[i], w / 2, h / 2, h * 0.42 * k, i === 2 ? s.accent : s.ink, 900);
  },
  "look-dots": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const cols = 14, rows = 9;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const cx = (x + 0.5) * (w / cols), cy = (y + 0.5) * (h / rows);
      const inShape = Math.abs(cx - w / 2) < w * 0.3 && Math.abs(cy - h / 2) < h * 0.22 && (y === 2 || y === 6 || x === 4 || x === 9);
      const on = inShape && hash(x * 31 + y) < seg(t, 0.1, 0.7);
      ctx.fillStyle = on ? s.ink : alpha(s.ink, 0.1);
      ctx.beginPath();
      ctx.arc(cx, cy, on ? 3 : 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  "look-collage": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const pieces = [[0.1, 0.15, 0.35, 0.5], [0.5, 0.25, 0.4, 0.55], [0.3, 0.6, 0.3, 0.25]];
    pieces.forEach((p, i) => {
      const q = Math.round(outCubic(seg(t, 0.1 + i * 0.2, 0.4)) * 6) / 6;
      const x = p[0] * w + (1 - q) * (i % 2 ? w : -w) * 0.5;
      ctx.save();
      ctx.translate(x, p[1] * h);
      ctx.rotate((i - 1) * 0.08);
      ctx.fillStyle = i === 2 ? s.accent : "#f4efe4";
      ctx.fillRect(0, 0, p[2] * w, p[3] * h);
      if (i !== 2) {
        ctx.fillStyle = "#222";
        for (let yy = 4; yy < p[3] * h; yy += 7) for (let xx = 4; xx < p[2] * w; xx += 7) {
          ctx.beginPath();
          ctx.arc(xx, yy, 1 + hash(xx * yy) * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    });
  },
  "look-hud": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    ctx.strokeStyle = alpha(s.accent, 0.5);
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * 0.5 + Math.sin(x * 0.03 + t * Math.PI * 2 + i) * h * 0.12 + (i - 4) * 6);
      ctx.stroke();
    }
    const v = Math.round(outExpo(seg(t, 0.1, 0.7)) * 4820);
    ctx.font = `600 ${h * 0.22}px ${MONO}`;
    ctx.fillStyle = s.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = "ltr";
    ctx.fillText(v.toLocaleString("en-US"), w / 2, h / 2);
    ctx.strokeStyle = alpha(s.ink, 0.5);
    ctx.strokeRect(w * 0.2, h * 0.3, w * 0.6, h * 0.4);
  },
  "look-keynote": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const push = outExpo(seg(t, 0.1, 0.6));
    ctx.fillStyle = "#0a0a0a";
    rrect(ctx, w * 0.1 + (1 - push) * w * 0.9, h * 0.2, w * 0.8, h * 0.6, 10);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, h * 0.35, w, h * 0.3);
    ctx.clip();
    word(ctx, "ببساطة", w / 2, h * 0.5 + (1 - outExpo(seg(t, 0.4, 0.5))) * h * 0.3, h * 0.2, "#f7f4ee", 700);
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(w * 0.1, h * 0.35, w * 0.8, 1);
  },
  "look-gulf": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    ctx.strokeStyle = s.accent;
    ctx.lineWidth = 1.2;
    const cx = w / 2, cy = h / 2, r = h * 0.36, p = seg(t, 0.05, 0.8);
    for (let i = 0; i < 8; i++) {
      const a1 = (i / 8) * Math.PI * 2, a2 = ((i + 3) / 8) * Math.PI * 2;
      const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r, x2 = cx + Math.cos(a2) * r, y2 = cy + Math.sin(a2) * r;
      const q = clamp(p * 8 - i);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + (x2 - x1) * q, y1 + (y2 - y1) * q);
      ctx.stroke();
    }
    word(ctx, "تهانينا", cx, cy, h * 0.14, s.ink, 700, AR);
  },
  "look-sketch": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    ctx.strokeStyle = s.ink;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    const p = seg(t, 0.05, 0.7), n = 40;
    ctx.beginPath();
    for (let i = 0; i <= n * p; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = h * 0.28 + Math.sin(a * 5) * 2 + hash(i) * 2;
      const x = w / 2 + Math.cos(a) * rr * 1.3, y = h / 2 + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (t > 0.75) {
      ctx.strokeStyle = s.accent;
      ctx.beginPath();
      ctx.moveTo(w * 0.35, h * 0.5);
      ctx.lineTo(w * 0.35 + w * 0.3 * seg(t, 0.75, 0.2), h * 0.5);
      ctx.stroke();
    }
  },

  // ── structures ──
  "struct-one-take": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const k = inOut(t < 0.5 ? t * 2 : 2 - t * 2);
    const bw = w * (0.3 + 0.5 * k), bh = h * (0.14 + 0.5 * k), r = h * 0.07 + (1 - k) * h * 0.07;
    ctx.fillStyle = s.accent;
    rrect(ctx, w / 2 - bw / 2, h / 2 - bh / 2, bw, bh, r);
    ctx.fill();
    ctx.fillStyle = alpha(s.bg, 0.6);
    for (let i = 0; i < 3; i++) ctx.fillRect(w / 2 - bw * 0.35, h / 2 - bh * 0.3 + i * bh * 0.3, bw * 0.7 * k, 2);
  },
  "struct-type": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const { i, f } = beat(t, 3);
    const lines = [["كل", "ضربة"], ["كلمة", "واحدة"], ["تملأ", "الكادر"]];
    word(ctx, lines[i][0], w / 2, h * 0.36, h * 0.14, alpha(s.ink, 0.6), 300);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, h * 0.45, w, h * 0.45);
    ctx.clip();
    word(ctx, lines[i][1], w / 2, h * 0.66 + (1 - outExpo(f * 2)) * h * 0.3, h * 0.34, s.accent, 900);
    ctx.restore();
  },
  "struct-problem": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const n = Math.floor(seg(t, 0, 0.5) * 12);
    const sweep = inCubic(seg(t, 0.55, 0.3));
    for (let i = 0; i < n; i++) {
      const x = hash(i) * w * 0.8, y = hash(i * 7) * h * 0.7;
      if (x < sweep * w * 1.2) continue;
      ctx.fillStyle = alpha(s.ink, 0.5);
      ctx.fillRect(x, y, 14, 9);
    }
    if (t > 0.55) {
      ctx.fillStyle = s.accent;
      ctx.fillRect(sweep * w * 1.2 - 6, 0, 6, h);
    }
    if (t > 0.88) word(ctx, "✓", w / 2, h / 2, h * 0.4, s.accent, 900);
  },
  "struct-before-after": (ctx, w, h, t, s) => {
    scene(ctx, w, h, s, 0);
    const x = w - inOut(seg(t, 0.15, 0.6)) * w;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, 0, w, h);
    ctx.clip();
    scene(ctx, w, h, s, 1);
    ctx.restore();
  },
  "struct-ui": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const z = 1 + outExpo(seg(t, 0.45, 0.4)) * 1.6;
    ctx.save();
    ctx.translate(w * 0.5, h * 0.55);
    ctx.scale(z, z);
    ctx.translate(-w * 0.5, -h * 0.55);
    ctx.fillStyle = alpha(s.ink, 0.1);
    rrect(ctx, w * 0.15, h * 0.2, w * 0.7, h * 0.6, 6);
    ctx.fill();
    ctx.fillStyle = t > 0.42 ? s.accent : alpha(s.ink, 0.4);
    rrect(ctx, w * 0.38, h * 0.45, w * 0.24, h * 0.14, 5);
    ctx.fill();
    ctx.restore();
    const p = outCubic(seg(t, 0.05, 0.35));
    cursor(ctx, w * 0.8 - p * w * 0.3, h * 0.85 - p * h * 0.3, seg(t, 0.4, 0.1));
  },
  "struct-macro": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const g = ctx.createRadialGradient(w / 2, h * 0.9, 0, w / 2, h * 0.9, w * 0.5);
    g.addColorStop(0, alpha(s.accent, 0.3));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(Math.sin(t * Math.PI * 2) * 0.06);
    ctx.fillStyle = s.ink;
    rrect(ctx, -w * 0.18, -h * 0.3, w * 0.36, h * 0.6, 10);
    ctx.fill();
    const x = (t * 2 - 0.5) * w * 0.5;
    const sw = ctx.createLinearGradient(x - 20, 0, x + 20, 0);
    sw.addColorStop(0, "rgba(255,255,255,0)");
    sw.addColorStop(0.5, "rgba(255,255,255,0.6)");
    sw.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sw;
    rrect(ctx, -w * 0.18, -h * 0.3, w * 0.36, h * 0.6, 10);
    ctx.fill();
    ctx.restore();
  },
  "struct-metaphor": (ctx, w, h, t, s) => {
    const { i, f } = beat(t, 3);
    bg(ctx, w, h, [s.bg, alpha(s.ink, 0.12), s.bg][i]);
    const y = h * 0.5 - Math.abs(Math.sin(f * Math.PI)) * h * 0.3;
    ctx.fillStyle = s.accent;
    ctx.beginPath();
    ctx.arc(w * (0.25 + i * 0.25), y, h * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alpha(s.ink, 0.3);
    ctx.fillRect(0, h * 0.62, w, 1);
  },
  "struct-number": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const v = Math.round(outExpo(seg(t, 0.05, 0.75)) * 12400);
    const k = 1 + (t > 0.8 ? 0.06 * (1 - seg(t, 0.8, 0.2)) : 0);
    ctx.font = `800 ${h * 0.34 * k}px ${AR}`;
    ctx.fillStyle = s.accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = "ltr";
    ctx.fillText(v.toLocaleString("en-US"), w / 2, h * 0.48);
    word(ctx, "عميل", w / 2, h * 0.78, h * 0.12, alpha(s.ink, 0.7), 400);
  },
  "struct-logo": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    ctx.fillStyle = alpha(s.ink, 0.9);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, h * 0.3, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const a = t * Math.PI * 2 + (i * Math.PI * 2) / 3;
      ctx.fillStyle = s.accent;
      ctx.beginPath();
      ctx.arc(w / 2 + Math.cos(a) * h * 0.3, h / 2 + Math.sin(a) * h * 0.3, h * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
    word(ctx, "لوقو", w / 2, h / 2, h * 0.14, s.bg, 900);
  },
  "struct-relay": (ctx, w, h, t, s) => {
    const sw = seg(t, 0.4, 0.3);
    bg(ctx, w, h, s.bg);
    ctx.fillStyle = alpha(s.ink, 0.12);
    ctx.fillRect(0, 0, w * (1 - sw), h);
    ctx.fillStyle = alpha(s.accent, 0.15);
    ctx.fillRect(w * (1 - sw), 0, w * sw, h);
    const p = inOut(seg(t, 0.3, 0.5));
    ctx.fillStyle = s.accent;
    rrect(ctx, w * 0.15 + p * w * 0.55, h * 0.4, w * 0.15, h * 0.2, 6);
    ctx.fill();
  },
  "struct-acts": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const labels = ["ادّعاء", "كيف", "نتيجة"];
    for (let i = 0; i < 3; i++) {
      const p = outExpo(seg(t, 0.05 + i * 0.28, 0.25));
      ctx.fillStyle = i === 2 ? s.accent : alpha(s.ink, 0.15);
      rrect(ctx, w * (0.06 + i * 0.31), h * 0.3 + (1 - p) * 20, w * 0.26, h * 0.4 * p, 6);
      ctx.fill();
      if (p > 0.6) word(ctx, labels[i], w * (0.19 + i * 0.31), h * 0.5, h * 0.11, i === 2 ? s.bg : s.ink, 700);
    }
  },
  "struct-zoom": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const z = Math.pow(3, t);
    for (let i = -1; i < 5; i++) {
      const k = Math.pow(3, -i) * z;
      const bw = w * 0.9 * k, bh = h * 0.6 * k;
      if (bw > w * 4 || bw < 4) continue;
      ctx.strokeStyle = i % 2 ? s.accent : s.ink;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(w / 2 - bw / 2, h / 2 - bh / 2, bw, bh);
    }
  },
  "struct-dust": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const p = outExpo(seg(t, 0.05, 0.6)), out = inCubic(seg(t, 0.75, 0.25));
    for (let i = 0; i < 140; i++) {
      const tx = w * 0.2 + hash(i) * w * 0.6, ty = h * 0.35 + hash(i * 3) * h * 0.3;
      const sx = hash(i * 5) * w, sy = hash(i * 9) * h;
      const x = sx + (tx - sx) * p + (hash(i * 11) - 0.5) * out * w, y = sy + (ty - sy) * p + (hash(i * 13) - 0.5) * out * h;
      ctx.fillStyle = alpha(s.accent, 0.9 - out);
      ctx.fillRect(x, y, 2, 2);
    }
    if (p > 0.95 && out < 0.3) word(ctx, "جواد", w / 2, h / 2, h * 0.3, alpha(s.ink, 1 - out * 3), 900);
  },
  "struct-data": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const vals = [0.3, 0.5, 0.45, 0.7, 1];
    vals.forEach((v, i) => {
      const p = outExpo(seg(t, 0.05 + i * 0.1, 0.5));
      ctx.fillStyle = i === 4 ? s.accent : alpha(s.ink, 0.5);
      const bh = h * 0.6 * v * p;
      ctx.fillRect(w * (0.1 + i * 0.17), h * 0.8 - bh, w * 0.12, bh);
    });
    ctx.fillStyle = alpha(s.ink, 0.3);
    ctx.fillRect(w * 0.08, h * 0.8, w * 0.84, 1);
  },
  "struct-reel": (ctx, w, h, t, s) => {
    const { i, f } = beat(t, 4);
    const cols = [s.bg, s.accent, alpha(s.ink, 0.15), s.bg];
    bg(ctx, w, h, cols[i]);
    const ink = i === 1 ? (isLight(s.accent) ? "#111" : "#fff") : s.ink;
    const k = 1 + (1 - outExpo(f)) * 0.3;
    if (i === 0) word(ctx, "١", w / 2, h / 2, h * 0.45 * k, ink);
    if (i === 1) {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, h * 0.2 * k, 0, Math.PI * 2);
      ctx.fill();
    }
    if (i === 2) word(ctx, "٣", w / 2, h / 2, h * 0.45 * k, ink, 300);
    if (i === 3) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w * 0.2, h * 0.7);
      ctx.lineTo(w * 0.2 + f * w * 0.6, h * 0.7 - f * h * 0.4);
      ctx.stroke();
    }
  },

  // ── connections ──
  "con-needle": (ctx, w, h, t, s) => {
    const cut = 0.5, d = Math.abs(t - cut);
    bg(ctx, w, h, t < cut ? s.bg : alpha(s.ink, 0.15));
    const k = 1 + 0.25 * Math.max(0, 1 - d / 0.15);
    ctx.fillStyle = s.accent;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(k, k);
    rrect(ctx, -w * 0.18, -h * 0.12, w * 0.36, h * 0.24, 8);
    ctx.fill();
    ctx.restore();
  },
  "con-fly": (ctx, w, h, t, s) => {
    if (t < 0.5) {
      bg(ctx, w, h, s.bg);
      const z = Math.exp(Math.log(12) * inCubic(seg(t, 0.15, 0.35)));
      ctx.fillStyle = s.accent;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, h * 0.08 * z, 0, Math.PI * 2);
      ctx.fill();
    } else {
      bg(ctx, w, h, s.accent);
      const z = 0.3 + 0.7 * outCubic(seg(t, 0.5, 0.4));
      word(ctx, "داخل", w / 2, h / 2, h * 0.3 * z, isLight(s.accent) ? "#111" : "#fff", 900);
    }
  },
  "con-carry": (ctx, w, h, t, s) => {
    const sw = inCubic(seg(t, 0.45, 0.2));
    bg(ctx, w, h, s.bg);
    ctx.fillStyle = alpha(s.ink, 0.15);
    ctx.fillRect(0, 0, w, h * (1 - sw));
    const p = inOut(seg(t, 0.35, 0.45));
    const lift = Math.sin(p * Math.PI) * 0.12;
    ctx.save();
    ctx.translate(w * 0.25 + p * w * 0.5, h * 0.6 - p * h * 0.2);
    ctx.scale(1 + lift, 1 + lift);
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = lift * 60;
    ctx.fillStyle = s.accent;
    rrect(ctx, -w * 0.09, -h * 0.07, w * 0.18, h * 0.14, 6);
    ctx.fill();
    ctx.restore();
  },
  "con-grow": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    ctx.fillStyle = alpha(s.ink, 0.5);
    rrect(ctx, w * 0.4, h * 0.78, w * 0.2, h * 0.1, 5);
    ctx.fill();
    [0, -1, 1].forEach((d, i) => {
      const p = outCubic(seg(t, 0.2 + i * 0.06, 0.5));
      const x = w / 2 + d * w * 0.3 * p, y = h * 0.83 - p * h * 0.5 - Math.sin(p * Math.PI) * h * 0.1;
      const k = 0.06 + 0.94 * (1 - Math.pow(1 - p, 2));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(d * 0.1 * (1 - p));
      ctx.fillStyle = s.accent;
      rrect(ctx, -w * 0.11 * k, -h * 0.13 * k, w * 0.22 * k, h * 0.26 * k, 5);
      ctx.fill();
      ctx.restore();
    });
  },
  "con-whip": (ctx, w, h, t, s) => {
    const p = t < 0.5 ? -inCubic(seg(t, 0.2, 0.3)) : 1 - outCubic(seg(t, 0.5, 0.3));
    scene(ctx, w, h, s, t < 0.5 ? 0 : 1);
    ctx.save();
    const v = Math.abs(t < 0.5 ? 3 * Math.pow(seg(t, 0.2, 0.3), 2) : 3 * Math.pow(1 - seg(t, 0.5, 0.3), 2));
    for (let i = 0; i < 6; i++) {
      ctx.globalAlpha = 0.8 - i * 0.12;
      ctx.fillStyle = s.accent;
      rrect(ctx, w * 0.3 + p * w * 1.2 - i * v * 8, h * 0.4, w * 0.4, h * 0.2, 8);
      ctx.fill();
    }
    ctx.restore();
  },
  "con-morph": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const p = inOut(t < 0.5 ? t * 2 : 2 - t * 2);
    const bw = w * (0.3 + 0.5 * p), bh = h * (0.16 + 0.4 * p);
    ctx.fillStyle = s.accent;
    rrect(ctx, w / 2 - bw / 2, h / 2 - bh / 2, bw, bh, 10);
    ctx.fill();
    word(ctx, p < 0.5 ? "زر" : "كرت", w / 2, h / 2, h * 0.12, isLight(s.accent) ? "#111" : "#fff", 800);
  },
  "con-handoff": (ctx, w, h, t, s) => {
    const after = t > 0.5;
    bg(ctx, w, h, after ? s.ink : s.bg);
    const tilt = after ? outCubic(seg(t, 0.5, 0.4)) * 0.5 : 0;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.transform(1, 0, -tilt * 0.6, 1 - tilt * 0.3, 0, 0);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i === 1 ? s.accent : after ? s.bg : s.ink;
      ctx.globalAlpha = 0.9 - i * 0.2;
      rrect(ctx, -w * 0.2 - i * tilt * 20, -h * 0.25 - i * tilt * 18, w * 0.4, h * 0.5, 8);
      ctx.fill();
    }
    ctx.restore();
  },
  "con-flood": (ctx, w, h, t, s) => {
    scene(ctx, w, h, s, 0, 0.8);
    const p = inOut(seg(t, 0.3, 0.5));
    const r = p * Math.hypot(w, h);
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 3; i++) ctx.arc(w * 0.72 + Math.cos(i * 2.1) * r * 0.1, h * 0.78 + Math.sin(i * 2.1) * r * 0.1, r, 0, Math.PI * 2);
    ctx.clip();
    scene(ctx, w, h, s, 1, 0.8);
    ctx.restore();
    ctx.fillStyle = alpha(s.ink, 0.5);
    rrect(ctx, w * 0.62, h * 0.72, w * 0.2, h * 0.12, 6);
    if (t < 0.32) ctx.fill();
  },
  "con-pour": (ctx, w, h, t, s) => {
    scene(ctx, w, h, s, 0, 0.8);
    const n = 12;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(i - n / 2 + 0.5) / n;
      const p = outCubic(seg(t, 0.25 + d * 0.5 + hash(i) * 0.1, 0.3));
      ctx.fillStyle = s.accent;
      ctx.fillRect((i / n) * w, 0, w / n + 1, h * p);
    }
    if (t > 0.9) word(ctx, "بعد", w / 2, h / 2, h * 0.27, isLight(s.accent) ? "#111" : "#fff");
  },
  "con-band": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const y0 = h * 0.35, bh = h * 0.3;
    ctx.fillStyle = alpha(s.ink, 0.2);
    ctx.fillRect(0, y0, w, bh);
    const cols = [s.accent, alpha(s.ink, 0.6), s.ink];
    cols.forEach((c, i) => {
      const p = inCubic(seg(t, 0.2 + i * 0.1, 0.4));
      ctx.fillStyle = c;
      ctx.fillRect(w - p * w * 1.4, y0, w * 0.5, bh);
    });
    const open = outCubic(seg(t, 0.7, 0.3));
    ctx.fillStyle = s.ink;
    ctx.fillRect(0, y0 - open * y0, w, bh + open * (h - bh));
    word(ctx, "شريط", w / 2 - (t - 0.5) * w * 0.3, h / 2, h * 0.14, t > 0.75 ? s.bg : s.ink, 800);
  },
  "con-geo": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const p = inOut(seg(t, 0.2, 0.6));
    const r = h * 0.2 + p * h * 0.08;
    ctx.lineWidth = h * 0.09 * (1 - p) + 1;
    ctx.strokeStyle = s.ink;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = alpha(s.accent, p);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1, 0.3);
    ctx.strokeStyle = alpha(s.ink, p);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },
  "con-state": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const on = t > 0.5;
    const p = outCubic(seg(t, 0.5, 0.3));
    ctx.fillStyle = on ? s.accent : alpha(s.ink, 0.25);
    rrect(ctx, w * 0.3, h * 0.38, w * 0.4, h * 0.24, h * 0.12);
    ctx.fill();
    ctx.fillStyle = "#fff";
    const kx = w * 0.3 + h * 0.12 + p * (w * 0.4 - h * 0.24);
    const stretch = 1 + Math.sin(p * Math.PI) * 0.4;
    ctx.beginPath();
    ctx.ellipse(kx, h * 0.5, h * 0.1 * stretch, h * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    word(ctx, "لا تلاشي", w / 2, h * 0.82, h * 0.1, alpha(s.ink, 0.6), 500);
  },
  "con-iris": (ctx, w, h, t, s) => {
    scene(ctx, w, h, s, 0, 0.8);
    const r = (1 - inCubic(seg(t, 0.3, 0.45))) * Math.hypot(w, h) * 0.6;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.arc(w / 2, h / 2, Math.max(0.1, r), 0, Math.PI * 2, true);
    ctx.clip();
    bg(ctx, w, h, s.ink);
    ctx.restore();
    if (t > 0.78) word(ctx, "جواد", w / 2, h / 2, h * 0.24 * outCubic(seg(t, 0.78, 0.2)), s.bg, 900);
  },
  "con-cut": (ctx, w, h, t, s) => {
    const { i, f } = beat(t, 4);
    scene(ctx, w, h, s, (i % 2) as 0 | 1, 0.9 + f * 0.1);
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = k === i ? s.accent : alpha(s.ink, 0.3);
      ctx.fillRect(w * (0.3 + k * 0.12), h * 0.9, w * 0.06, 3);
    }
  },
  "con-dust": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const out = inCubic(seg(t, 0.25, 0.5));
    if (out < 0.5) word(ctx, "كلمة", w / 2, h / 2, h * 0.3, alpha(s.ink, 1 - out * 2), 900);
    for (let i = 0; i < 160; i++) {
      const tx = w * 0.25 + hash(i) * w * 0.5, ty = h * 0.38 + hash(i * 3) * h * 0.24;
      const x = tx + (hash(i * 7) - 0.5) * out * w * 1.4, y = ty + (hash(i * 11) - 0.5) * out * h * 1.4 - out * out * h * 0.3;
      ctx.fillStyle = alpha(s.accent, Math.min(1, out * 3) * (1 - out * 0.7));
      ctx.fillRect(x, y, 2, 2);
    }
  },

  // ── feel ──
  "feel-house": (ctx, w, h, t, s) => ball(ctx, w, h, s, t, outExpo, false),
  "feel-luxury": (ctx, w, h, t, s) => ball(ctx, w, h, s, t, (x) => 1 - Math.pow(1 - x, 5), false),
  "feel-kinetic": (ctx, w, h, t, s) => ball(ctx, w, h, s, t, (x) => (x < 0.5 ? 16 * Math.pow(x, 5) : 1 - Math.pow(-2 * x + 2, 5) / 2), true),
  "feel-bounce": (ctx, w, h, t, s) => ball(ctx, w, h, s, t, (x) => back(x, 2.2), false),
  "feel-cinema": (ctx, w, h, t, s) => {
    ball(ctx, w, h, s, t, inOut, true);
    grain(ctx, w, h, 0.15, Math.floor(t * 30));
    vignette(ctx, w, h, 0.5);
  },
  "feel-twos": (ctx, w, h, t, s) => ball(ctx, w, h, s, t, outCubic, false, true),

  // ── pace ──
  "pace-60": (ctx, w, h, t, s) => metronome(ctx, w, h, s, t, 70, "٧٠"),
  "pace-100": (ctx, w, h, t, s) => metronome(ctx, w, h, s, t, 100, "١٠٠"),
  "pace-120": (ctx, w, h, t, s) => metronome(ctx, w, h, s, t, 120, "١٢٠"),
  "pace-128": (ctx, w, h, t, s) => metronome(ctx, w, h, s, t, 128, "١٢٨"),

  // ── camera ──
  "cam-drift": (ctx, w, h, t, s) => {
    const k = 1 + 0.04 * t;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(k, k);
    ctx.translate(-w / 2, -h / 2);
    scene(ctx, w, h, s, 0);
    ctx.restore();
  },
  "cam-push": (ctx, w, h, t, s) => {
    const k = 1 + 0.6 * inOut(t < 0.5 ? t * 2 : 2 - t * 2);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(k, k);
    ctx.translate(-w / 2, -h / 2);
    scene(ctx, w, h, s, 0);
    ctx.restore();
  },
  "cam-parallax": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const x = Math.sin(t * Math.PI * 2) * w * 0.08;
    ctx.fillStyle = alpha(s.ink, 0.12);
    for (let i = 0; i < 6; i++) ctx.fillRect(w * 0.1 * i * 1.8 + x * 0.3, h * 0.2 + hash(i) * h * 0.5, 10, 10);
    word(ctx, "عمق", w / 2 + x, h / 2, h * 0.32, s.ink, 900);
    ctx.fillStyle = s.accent;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(w * 0.15 * (i + 0.5) + x * 1.6, h * 0.3 + hash(i * 3) * h * 0.5, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  "cam-fly": (ctx, w, h, t, s) => DEMOS["con-fly"](ctx, w, h, t, s),
  "cam-orbit": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    for (let i = 0; i < 7; i++) {
      const a = t * Math.PI * 2 * 0.5 + (i / 7) * Math.PI * 2;
      const z = (Math.sin(a) + 1) / 2;
      const x = w / 2 + Math.cos(a) * w * 0.38, y = h * 0.55;
      const k = 0.4 + z * 0.6;
      ctx.fillStyle = i === 0 ? s.accent : alpha(s.ink, 0.3 + z * 0.6);
      rrect(ctx, x - w * 0.08 * k, y - h * 0.18 * k, w * 0.16 * k, h * 0.36 * k, 5);
      ctx.fill();
    }
  },

  // ── type ──
  "type-heavy": (ctx, w, h, _t, s) => {
    bg(ctx, w, h, s.bg);
    word(ctx, "ثقيل", w / 2, h * 0.45, h * 0.44, s.ink, 900);
    word(ctx, "وخفيف تحته", w / 2, h * 0.8, h * 0.1, alpha(s.ink, 0.6), 300);
  },
  "type-naskh": (ctx, w, h, _t, s) => {
    bg(ctx, w, h, s.bg);
    word(ctx, "نسخٌ رفيع", w / 2, h * 0.45, h * 0.3, s.ink, 400, NASKH);
    word(ctx, "سانس للنص", w / 2, h * 0.8, h * 0.1, alpha(s.ink, 0.6), 400);
  },
  "type-kufi": (ctx, w, h, _t, s) => {
    bg(ctx, w, h, s.bg);
    ctx.strokeStyle = alpha(s.ink, 0.12);
    for (let x = 0; x < w; x += w / 8) ctx.strokeRect(x, 0, w / 8, h);
    word(ctx, "كوفي", w / 2, h * 0.45, h * 0.34, s.ink, 700, '"Reem Kufi", "Kufam", ' + AR);
    word(ctx, "02", w * 0.9, h * 0.82, h * 0.12, s.accent, 700, MONO, "right");
  },
  "type-round": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const k = Math.max(0.01, back(seg(t, 0.1, 0.5), 1.4));
    word(ctx, "مرحى", w / 2, h * 0.48, h * 0.34 * k, s.accent, 700, '"Baloo Bhaijaan 2", "Marhey", ' + AR);
  },

  // ── finish ──
  "fin-grain": (ctx, w, h, t, s) => {
    scene(ctx, w, h, s, 0);
    grain(ctx, w, h, 0.3, Math.floor(t * 30));
    vignette(ctx, w, h, 0.6);
  },
  "fin-flat": (ctx, w, h, _t, s) => scene(ctx, w, h, s, 0),
  "fin-bloom": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    ctx.save();
    ctx.shadowColor = s.accent;
    ctx.shadowBlur = 18 + Math.sin(t * Math.PI * 2) * 6;
    word(ctx, "توهّج", w / 2, h / 2, h * 0.3, s.accent, 900);
    ctx.restore();
    word(ctx, "توهّج", w / 2, h / 2, h * 0.3, s.ink, 900);
  },
  "fin-halftone": (ctx, w, h, _t, s) => {
    bg(ctx, w, h, "#f3eee2");
    for (let y = 0; y < h; y += 5) for (let x = 0; x < w; x += 5) {
      const d = Math.hypot(x - w / 2, y - h / 2) / (h * 0.5);
      const r = clamp(1.6 - d * 1.4, 0, 1.8);
      if (r > 0.1) {
        ctx.fillStyle = s.accent;
        ctx.beginPath();
        ctx.arc(x + 1.5, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1b1b1b";
        ctx.beginPath();
        ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
  "fin-lens": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    ctx.save();
    ctx.filter = "blur(2px)";
    ctx.fillStyle = alpha(s.ink, 0.15);
    for (let i = 0; i < 5; i++) ctx.fillRect(hash(i) * w, hash(i * 3) * h, 12, 12);
    ctx.restore();
    word(ctx, "عدسة", w / 2, h / 2, h * 0.3, s.ink, 800);
    const g = ctx.createLinearGradient(0, h * 0.5, w, h * 0.5);
    g.addColorStop(0, "rgba(120,180,255,0)");
    g.addColorStop(0.5 + Math.sin(t * Math.PI * 2) * 0.1, "rgba(120,180,255,0.55)");
    g.addColorStop(1, "rgba(120,180,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.49, w, 2);
  },

  // ── ending ──
  "end-packshot": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const k = 1 + 0.03 * t;
    const p1 = outExpo(seg(t, 0.05, 0.4)), p2 = outExpo(seg(t, 0.3, 0.4)), p3 = outExpo(seg(t, 0.5, 0.4));
    word(ctx, "جواد", w / 2, h * 0.4 + (1 - p1) * 10, h * 0.3 * k, alpha(s.ink, p1), 900);
    ctx.fillStyle = alpha(s.accent, p2);
    rrect(ctx, w / 2 - w * 0.15, h * 0.62, w * 0.3, h * 0.1, h * 0.05);
    ctx.fill();
    word(ctx, "جرّبه الآن", w / 2, h * 0.84, h * 0.09 * k, alpha(s.ink, p3 * 0.8), 500);
  },
  "end-loop": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const a = t * Math.PI * 2;
    ctx.strokeStyle = alpha(s.ink, 0.25);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, h * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = s.accent;
    ctx.beginPath();
    ctx.arc(w / 2 + Math.cos(a) * h * 0.3, h / 2 + Math.sin(a) * h * 0.3, h * 0.07, 0, Math.PI * 2);
    ctx.fill();
    word(ctx, "∞", w / 2, h / 2, h * 0.3, s.ink, 400);
  },
  "end-cta": (ctx, w, h, t, s) => {
    bg(ctx, w, h, s.bg);
    const text = "aljawadai.app";
    const n = Math.floor(seg(t, 0.1, 0.6) * text.length);
    ctx.fillStyle = s.accent;
    rrect(ctx, w * 0.15, h * 0.36, w * 0.7, h * 0.28, 10);
    ctx.fill();
    ctx.font = `600 ${h * 0.12}px ${MONO}`;
    ctx.fillStyle = isLight(s.accent) ? "#111" : "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = "ltr";
    ctx.fillText(text.slice(0, n) + (Math.floor(t * 6) % 2 === 0 && n < text.length ? "|" : ""), w / 2, h / 2);
  },
};

export const DEMO_KINDS = Object.keys(DEMOS);
export function drawDemo(kind: string, ctx: CanvasRenderingContext2D, w: number, h: number, t: number, s: Swatch) {
  const d = DEMOS[kind];
  if (!d) return;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  d(ctx, w, h, ((t % LOOP) + LOOP) % LOOP / LOOP, s);
  ctx.restore();
}
