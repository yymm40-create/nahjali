// Writes the greeting over the top of a finished picture: real Arabic letters in a joyful font on a canvas (never drawn by
// the image model, which gets Arabic wrong), gold with a dark outline on a soft shade, with a few sparkles. The picture
// the person downloads is this one. Browser only.

const GOLD = ["#fff3b0", "#ffd54a", "#ffae1a"];

function words(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    const next = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(next).width > max) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#fffbe0";
  ctx.shadowColor = "#ffd54a";
  ctx.shadowBlur = r * 1.2;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const rr = i % 2 ? r * 0.28 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

const load = (src: string) =>
  new Promise<HTMLImageElement>((ok, fail) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error("image"));
    img.src = src;
  });

/** The picture with the greeting written over its top, as a PNG. `family`: the CSS font-family of the joyful font. */
export async function greet(src: string, lines: readonly string[], family: string): Promise<Blob> {
  const [img] = await Promise.all([load(src), document.fonts.load(`700 40px ${family}`, lines.join(" ")).catch(() => [])]);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, W, H);
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";

  // sizes follow the picture's width; the first line is the long one, the second the occasion. A line is made smaller
  // (down to three quarters) until it fits in at most two rows with no single word left alone on the last one.
  const sizes = [Math.round(W * 0.046), Math.round(W * 0.052)];
  const laid: { text: string; size: number }[] = [];
  lines.forEach((line, i) => {
    let size = sizes[i] ?? sizes[1];
    let rows: string[] = [];
    for (let k = 0; k < 4; k++) {
      ctx.font = `700 ${size}px ${family}`;
      rows = words(ctx, line, W * 0.84);
      if (rows.length === 1 || (rows.length === 2 && rows[1].includes(" "))) break;
      size = Math.round(size * 0.92);
    }
    for (const t of rows) laid.push({ text: t, size });
  });
  const gap = W * 0.012;
  const total = laid.reduce((s, l) => s + l.size * 1.25, 0) + gap * (laid.length - 1);
  const top = H * 0.035;

  // a soft shade behind the words so they read on any sky
  const shade = ctx.createLinearGradient(0, 0, 0, top + total + H * 0.07);
  shade.addColorStop(0, "rgba(6,14,32,.62)");
  shade.addColorStop(0.7, "rgba(6,14,32,.34)");
  shade.addColorStop(1, "rgba(6,14,32,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, top + total + H * 0.07);

  let y = top;
  laid.forEach((l, i) => {
    const h = l.size * 1.25;
    const cy = y + h / 2;
    ctx.font = `700 ${l.size}px ${family}`;
    ctx.lineWidth = Math.max(4, l.size * 0.16);
    ctx.strokeStyle = "rgba(58,28,0,.85)";
    ctx.strokeText(l.text, W / 2, cy);
    const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
    GOLD.forEach((c, k) => g.addColorStop(k / (GOLD.length - 1), c));
    const last = i >= laid.length - 1;
    if (last) {
      // the occasion: white with a deep rose outline
      ctx.strokeStyle = "rgba(120,20,70,.85)";
      ctx.strokeText(l.text, W / 2, cy);
    }
    ctx.fillStyle = last ? "#fff7fb" : g;
    ctx.fillText(l.text, W / 2, cy);
    y += h + gap;
  });

  const r = W * 0.018;
  sparkle(ctx, W * 0.05, top + total * 0.3, r * 1.3);
  sparkle(ctx, W * 0.95, top + total * 0.25, r);
  sparkle(ctx, W * 0.07, top + total * 0.85, r * 0.8);
  sparkle(ctx, W * 0.93, top + total * 0.8, r * 1.2);
  sparkle(ctx, W * 0.5, top * 0.45, r * 0.7);

  return new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("png"))), "image/png"));
}
