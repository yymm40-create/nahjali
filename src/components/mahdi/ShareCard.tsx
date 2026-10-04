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

/** Draws the card on a canvas (1080×1350) for saving or the share sheet. The browser shapes the Arabic text. */
export async function renderCardPng(payload: SharePayload, opts: { name?: string; closing?: string; image?: string | null; fonts: { sans: string; display: string } }): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0d0c0b";
  g.fillRect(0, 0, W, H);
  if (opts.image) {
    const img = new Image();
    img.src = opts.image;
    await img.decode().catch(() => {});
    if (img.naturalWidth) {
      const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      g.globalAlpha = 0.7;
      g.drawImage(img, (W - w) * 0.44, (H - h) / 2, w, h);
      g.globalAlpha = 1;
    }
  }
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "rgba(13,12,11,0.15)");
  grad.addColorStop(0.65, "rgba(13,12,11,0.9)");
  grad.addColorStop(1, "#0d0c0b");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  g.direction = "rtl";
  g.textAlign = "center";
  const line = (text: string, y: number, size: number, color: string, font = opts.fonts.sans, weight = 600) => {
    g.font = `${weight} ${size}px ${font}`;
    g.fillStyle = color;
    g.fillText(text, W / 2, y);
  };
  let y = 760;
  line(t.brand, y, 76, "#efcd7e", opts.fonts.display, 700);
  if (opts.name) line(t.mawla(opts.name), (y += 70), 40, "#f7f0e3");
  line(`${payload.title}${payload.label ? ` · ${payload.label}` : ""}`, (y += 100), 42, "#e8dfcf");
  line(payload.value, (y += 160), 150, "#f4da95", opts.fonts.sans, 700);
  if (payload.sub) line(payload.sub, (y += 80), 38, "#e8dfcf");
  if (opts.closing) line(opts.closing, (y += 80), 38, "#efcd7e");
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"));
}

async function loadImage(src: string) {
  const img = new Image();
  // Pictures from storage are served with open CORS: without this the canvas could not be saved
  img.crossOrigin = "anonymous";
  img.src = src;
  await img.decode().catch(() => {});
  return img.naturalWidth ? img : null;
}

/**
 * The achievement as an Instagram story (1080×1920): the person's picture, name and @username on top of the card,
 * so it is clearly theirs when shared.
 */
export async function renderStoryPng(
  payload: SharePayload,
  opts: { name: string; username: string | null; avatarUrl: string | null; closing?: string; image?: string | null; fonts: { sans: string; display: string } },
): Promise<Blob> {
  const W = 1080;
  const H = 1920;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0d0c0b";
  g.fillRect(0, 0, W, H);
  const bg = opts.image ? await loadImage(opts.image) : null;
  if (bg) {
    const s = Math.max(W / bg.naturalWidth, H / bg.naturalHeight);
    g.globalAlpha = 0.65;
    g.drawImage(bg, (W - bg.naturalWidth * s) * 0.44, (H - bg.naturalHeight * s) / 2, bg.naturalWidth * s, bg.naturalHeight * s);
    g.globalAlpha = 1;
  }
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "rgba(13,12,11,0.55)");
  grad.addColorStop(0.35, "rgba(13,12,11,0.25)");
  grad.addColorStop(0.7, "rgba(13,12,11,0.9)");
  grad.addColorStop(1, "#0d0c0b");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  g.direction = "rtl";
  g.textAlign = "center";
  const line = (text: string, y: number, size: number, color: string, font = opts.fonts.sans, weight = 600) => {
    g.font = `${weight} ${size}px ${font}`;
    g.fillStyle = color;
    g.fillText(text, W / 2, y);
  };

  // Who: the picture (or the first letter), the name and the @username
  const R = 110;
  const cx = W / 2;
  const cy = 300;
  g.save();
  g.beginPath();
  g.arc(cx, cy, R + 10, 0, Math.PI * 2);
  g.fillStyle = "#efcd7e";
  g.fill();
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.clip();
  const avatar = opts.avatarUrl ? await loadImage(opts.avatarUrl) : null;
  if (avatar) {
    const s = Math.max((2 * R) / avatar.naturalWidth, (2 * R) / avatar.naturalHeight);
    g.drawImage(avatar, cx - (avatar.naturalWidth * s) / 2, cy - (avatar.naturalHeight * s) / 2, avatar.naturalWidth * s, avatar.naturalHeight * s);
  } else {
    g.fillStyle = "#d7ad55";
    g.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    g.font = `700 110px ${opts.fonts.sans}`;
    g.fillStyle = "#2b2110";
    g.textBaseline = "middle";
    g.fillText([...opts.name.trim()][0] ?? "؟", cx, cy + 6);
    g.textBaseline = "alphabetic";
  }
  g.restore();
  line(t.mawla(opts.name), 500, 54, "#f7f0e3", opts.fonts.sans, 700);
  if (opts.username) {
    g.direction = "ltr";
    line(`@${opts.username}`, 570, 40, "#efcd7e");
    g.direction = "rtl";
  }

  // What: the achievement
  let y = 1180;
  line(`${payload.title}${payload.label ? ` · ${payload.label}` : ""}`, y, 48, "#e8dfcf");
  line(payload.value, (y += 190), 180, "#f4da95", opts.fonts.sans, 700);
  if (payload.sub) line(payload.sub, (y += 100), 44, "#e8dfcf");
  if (opts.closing) line(opts.closing, (y += 90), 44, "#efcd7e");
  line(t.brand, H - 150, 80, "#efcd7e", opts.fonts.display, 700);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"));
}
