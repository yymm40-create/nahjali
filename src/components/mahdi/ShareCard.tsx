"use client";

import type { SharePayload } from "@/lib/mahdi/client/share";
import { t } from "@/lib/mahdi/i18n";

/** The card as HTML (shown in the community and as the preview). */
export function ShareCardView({ payload, name, closing, image }: { payload: SharePayload; name?: string; closing?: string; image?: string | null }) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-6 text-center" style={{ background: "#0d0c0b", color: "#f7f0e3", minHeight: 260 }}>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="absolute inset-0 size-full object-cover opacity-60" />
      )}
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(13,12,11,0.2), rgba(13,12,11,0.9) 70%)" }} />
      <div className="relative flex h-full flex-col items-center justify-end gap-1 pt-16">
        <p className="m-display text-2xl" style={{ color: "#efcd7e" }}>{t.brand}</p>
        {name && <p className="text-sm">{t.mawla(name)}</p>}
        <p className="mt-3 text-sm opacity-90">{payload.title}{payload.label ? ` · ${payload.label}` : ""}</p>
        <p className="m-num text-5xl font-semibold" style={{ color: "#f4da95" }}>{payload.value}</p>
        {payload.sub && <p className="text-sm opacity-90">{payload.sub}</p>}
        {closing && <p className="mt-2 text-sm" style={{ color: "#efcd7e" }}>{closing}</p>}
      </div>
    </div>
  );
}

// ───────────────────────────── the pictures (canvas) ─────────────────────────────
// Drawn in the browser so the Arabic text is shaped by it. Both pictures share one look: the chosen shrine behind,
// a thin gold frame, the person's achievement on a dark panel, and an invitation to «لأجل المهدي» with the logo of
// نهج علي and the site's address.

const GOLD = "#efcd7e";
const GOLD_BRIGHT = "#f4da95";
const INK = "#f7f0e3";
const SOFT = "#e8dfcf";
const NIGHT = "#0d0c0b";
const LOGO = "/brand/logo.png";

export interface PictureLook {
  fonts: { sans: string; display: string };
  /** The shrine picture behind. */
  image?: string | null;
  /** The site's address, written in the invitation (e.g. «nahjali.vercel.app/mahdi»). */
  site: string;
}

/**
 * The fonts must be loaded before drawing: a canvas never waits for them and silently uses a fallback. Each weight
 * is asked for with Arabic and Latin text (their files are split by script).
 */
async function ensureFonts(f: PictureLook["fonts"]) {
  const sample = "أبجد هوز ١٢٣ abc 123 @";
  const want = [`400 40px ${f.sans}`, `600 40px ${f.sans}`, `700 40px ${f.sans}`, `400 40px ${f.display}`, `700 40px ${f.display}`];
  await Promise.all(want.map((w) => document.fonts.load(w, sample).catch(() => null)));
}

async function loadImage(src: string) {
  const img = new Image();
  // Pictures from storage are served with open CORS: without this the canvas could not be saved
  img.crossOrigin = "anonymous";
  img.src = src;
  await img.decode().catch(() => {});
  return img.naturalWidth ? img : null;
}

function canvas(W: number, H: number) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.direction = "rtl";
  g.textAlign = "center";
  return { c, g };
}

function rounded(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** The shrine behind, darkened where the text sits, and the thin double gold frame. */
async function backdrop(g: CanvasRenderingContext2D, W: number, H: number, image: string | null | undefined, stops: [number, string][]) {
  g.fillStyle = NIGHT;
  g.fillRect(0, 0, W, H);
  const bg = image ? await loadImage(image) : null;
  if (bg) {
    const s = Math.max(W / bg.naturalWidth, H / bg.naturalHeight);
    g.globalAlpha = 0.7;
    g.drawImage(bg, (W - bg.naturalWidth * s) * 0.44, (H - bg.naturalHeight * s) / 2, bg.naturalWidth * s, bg.naturalHeight * s);
    g.globalAlpha = 1;
  }
  const grad = g.createLinearGradient(0, 0, 0, H);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(239,205,126,0.55)";
  g.lineWidth = 3;
  rounded(g, 36, 36, W - 72, H - 72, 44);
  g.stroke();
  g.strokeStyle = "rgba(239,205,126,0.22)";
  g.lineWidth = 1.5;
  rounded(g, 50, 50, W - 100, H - 100, 34);
  g.stroke();
}

function write(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, font: string, weight = 600, align: CanvasTextAlign = "center") {
  g.font = `${weight} ${size}px ${font}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.fillText(text, x, y);
}

/** The largest size (≤ `size`) at which `text` fits in `max` pixels. */
function fit(g: CanvasRenderingContext2D, text: string, size: number, min: number, max: number, font: string, weight: number) {
  for (let s = size; s > min; s -= 4) {
    g.font = `${weight} ${s}px ${font}`;
    if (g.measureText(text).width <= max) return s;
  }
  return min;
}

/** Splits text into lines no wider than `max` (at the given font). */
function wrap(g: CanvasRenderingContext2D, text: string, max: number, size: number, font: string, weight: number) {
  g.font = `${weight} ${size}px ${font}`;
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > max && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** The achievement on a dark panel: title, the big value, the line under it, and the closing words. */
function achievement(g: CanvasRenderingContext2D, payload: SharePayload, closing: string | undefined, f: PictureLook["fonts"], W: number, top: number, scale = 1) {
  const x = 90;
  const w = W - 180;
  const title = `${payload.title}${payload.label ? ` · ${payload.label}` : ""}`;
  const valueSize = fit(g, payload.value, Math.round(170 * scale), 60, w - 80, f.sans, 700);
  const rows: { text: string; size: number; color: string; font: string; weight: number; gap: number }[] = [
    { text: title, size: fit(g, title, Math.round(46 * scale), 28, w - 80, f.sans, 600), color: SOFT, font: f.sans, weight: 600, gap: 0 },
    { text: payload.value, size: valueSize, color: GOLD_BRIGHT, font: f.sans, weight: 700, gap: Math.round(valueSize * 0.95) },
  ];
  if (payload.sub) rows.push({ text: payload.sub, size: fit(g, payload.sub, Math.round(40 * scale), 26, w - 80, f.sans, 500), color: SOFT, font: f.sans, weight: 500, gap: Math.round(70 * scale) });
  if (closing) rows.push({ text: closing, size: Math.round(48 * scale), color: GOLD, font: f.display, weight: 700, gap: Math.round(80 * scale) });
  const pad = Math.round(70 * scale);
  const height = pad + 40 * scale + rows.reduce((t, r) => t + r.gap, 0) + pad * 0.7;
  g.fillStyle = "rgba(13,12,11,0.58)";
  rounded(g, x, top, w, height, 36);
  g.fill();
  g.strokeStyle = "rgba(239,205,126,0.45)";
  g.lineWidth = 2;
  g.stroke();
  let y = top + pad + 20 * scale;
  for (const r of rows) {
    y += r.gap;
    write(g, r.text, W / 2, y, r.size, r.color, r.font, r.weight);
  }
  return top + height;
}

/** «انضم إلى لأجل المهدي»: the logo of نهج علي beside a short line about the app and the site's address. */
async function invitation(g: CanvasRenderingContext2D, look: PictureLook, W: number, top: number, height: number) {
  const x = 90;
  const w = W - 180;
  g.fillStyle = "rgba(13,12,11,0.78)";
  rounded(g, x, top, w, height, 32);
  g.fill();
  g.strokeStyle = "rgba(239,205,126,0.5)";
  g.lineWidth = 2;
  g.stroke();
  const logo = await loadImage(LOGO);
  const lh = height - 50;
  const lw = logo ? (logo.naturalWidth / logo.naturalHeight) * lh : 0;
  const right = x + w - 34;
  if (logo) g.drawImage(logo, right - lw, top + 25, lw, lh);
  const textRight = right - lw - (logo ? 28 : 0);
  const textW = textRight - (x + 34);
  // Three lines on the logo's side: the call, two lines about the app, and the site's address on its own line
  const I = t.social.instagram;
  write(g, I.join, textRight, top + 74, fit(g, I.join, 50, 30, textW, look.fonts.display, 700), GOLD, look.fonts.display, 700, "right");
  const lines = wrap(g, I.blurb, textW, 29, look.fonts.sans, 500).slice(0, 2);
  lines.forEach((l, i) => write(g, l, textRight, top + 132 + i * 40, 29, SOFT, look.fonts.sans, 500, "right"));
  g.direction = "ltr";
  write(g, look.site, textRight, top + height - 26, 30, GOLD, look.fonts.sans, 600, "right");
  g.direction = "rtl";
}

async function avatar(g: CanvasRenderingContext2D, name: string, url: string | null, cx: number, cy: number, R: number, sans: string) {
  g.save();
  g.beginPath();
  g.arc(cx, cy, R + 10, 0, Math.PI * 2);
  g.fillStyle = GOLD;
  g.fill();
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.clip();
  const img = url ? await loadImage(url) : null;
  if (img) {
    const s = Math.max((2 * R) / img.naturalWidth, (2 * R) / img.naturalHeight);
    g.drawImage(img, cx - (img.naturalWidth * s) / 2, cy - (img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
  } else {
    g.fillStyle = "#d7ad55";
    g.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    g.font = `700 ${Math.round(R)}px ${sans}`;
    g.fillStyle = "#2b2110";
    g.textBaseline = "middle";
    g.textAlign = "center";
    g.fillText([...name.trim()][0] ?? "؟", cx, cy + 6);
    g.textBaseline = "alphabetic";
  }
  g.restore();
}

const png = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"));

/** The card (1080×1350) for saving or the share sheet: the achievement, the name if shown, and the invitation. */
export async function renderCardPng(payload: SharePayload, opts: { name?: string; closing?: string } & PictureLook): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  await ensureFonts(opts.fonts);
  const { c, g } = canvas(W, H);
  await backdrop(g, W, H, opts.image, [[0, "rgba(13,12,11,0.35)"], [0.45, "rgba(13,12,11,0.55)"], [1, "rgba(13,12,11,0.92)"]]);
  write(g, t.brand, W / 2, 210, 92, GOLD, opts.fonts.display, 700);
  if (opts.name) write(g, t.mawla(opts.name), W / 2, 285, 42, INK, opts.fonts.sans, 600);
  achievement(g, payload, opts.closing, opts.fonts, W, 360, 0.9);
  await invitation(g, opts, W, H - 90 - 250, 250);
  return png(c);
}

/**
 * The achievement as an Instagram story (1080×1920): the person's picture, name and @username, the achievement, the
 * line «اضغط على الرابط لمتابعتي» with room under it for Instagram's link sticker (the person adds the link to their
 * page there), and the invitation. Everything sits inside the area Instagram leaves free of its own buttons.
 */
export async function renderStoryPng(payload: SharePayload, opts: { name: string; username: string | null; avatarUrl: string | null; closing?: string } & PictureLook): Promise<Blob> {
  const W = 1080;
  const H = 1920;
  await ensureFonts(opts.fonts);
  const { c, g } = canvas(W, H);
  await backdrop(g, W, H, opts.image, [[0, "rgba(13,12,11,0.6)"], [0.3, "rgba(13,12,11,0.3)"], [0.62, "rgba(13,12,11,0.82)"], [1, "rgba(13,12,11,0.96)"]]);

  // Who
  await avatar(g, opts.name, opts.avatarUrl, W / 2, 400, 125, opts.fonts.sans);
  const who = t.mawla(opts.name);
  write(g, who, W / 2, 625, fit(g, who, 62, 36, W - 220, opts.fonts.sans, 700), INK, opts.fonts.sans, 700);
  if (opts.username) {
    g.direction = "ltr";
    write(g, `@${opts.username}`, W / 2, 690, 42, GOLD, opts.fonts.sans, 600);
    g.direction = "rtl";
  }

  // What
  const bottom = achievement(g, payload, opts.closing, opts.fonts, W, 760);

  // «اضغط على الرابط لمتابعتي» and the room under it for the link sticker
  if (opts.username) {
    const y = Math.min(Math.max(bottom + 120, 1180), 1290);
    write(g, t.social.instagram.tapLink, W / 2, y, 50, INK, opts.fonts.sans, 700);
    g.strokeStyle = GOLD;
    g.lineWidth = 6;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(W / 2 - 26, y + 34);
    g.lineTo(W / 2, y + 60);
    g.lineTo(W / 2 + 26, y + 34);
    g.stroke();
  }

  // Above Instagram's own reply bar at the bottom of a story
  await invitation(g, opts, W, 1430, 250);
  return png(c);
}
