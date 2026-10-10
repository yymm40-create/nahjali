// «صانع الألعاب الذكي» — a game's pictures made ready for the page: a sprite is drawn on flat chroma-key green (the picture
// model draws no see-through background), so the green is cut away, the green fringe on its edges taken off and the empty
// border trimmed; a background and the cover are sized down. `keyBackdrop` is pure (tested); the rest uses sharp. Server only.

import sharp from "sharp";

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Cuts a flat backdrop out of RGBA pixels, in place, and returns the subject's box (null when the picture has no flat
 * backdrop to cut: it is then left as it is). Green (the asked one) is keyed by how green each pixel is, everywhere; any
 * other flat colour (the model ignored the ask) by its distance to the border's colour, flooding in from the edges only.
 */
export function keyBackdrop(px: Uint8Array, w: number, h: number): Box | null {
  const at = (x: number, y: number) => (y * w + x) * 4;
  // the backdrop's colour: the median of the border
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const edge = (x: number, y: number) => {
    const i = at(x, y);
    rs.push(px[i]);
    gs.push(px[i + 1]);
    bs.push(px[i + 2]);
  };
  for (let x = 0; x < w; x++) {
    edge(x, 0);
    edge(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    edge(0, y);
    edge(w - 1, y);
  }
  const median = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1];
  const kr = median([...rs]);
  const kg = median([...gs]);
  const kb = median([...bs]);
  const near = rs.filter((_, i) => Math.abs(rs[i] - kr) + Math.abs(gs[i] - kg) + Math.abs(bs[i] - kb) < 90).length;
  if (near < rs.length * 0.6) return null;

  const green = kg > kr + 60 && kg > kb + 60;
  if (green) {
    // how green a pixel is, against the backdrop's own green: at 55% of it the pixel is gone, under 10% it stays whole
    // (an edge half subject, half green lands in between: half see-through)
    const keyS = kg - Math.max(kr, kb);
    const hi = keyS * 0.55;
    const lo = keyS * 0.1;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const s = g - Math.max(r, b);
      if (s <= lo) continue;
      const a = s >= hi ? 0 : Math.round(255 * (1 - (s - lo) / (hi - lo)));
      px[i + 3] = Math.min(px[i + 3], a);
      // the green spill on what is left: the green comes down to the other two
      px[i + 1] = Math.max(r, b);
    }
  } else {
    // another flat colour: flood in from the border over what is close to it
    const T0 = 38;
    const T1 = 85;
    const dist = (i: number) => Math.sqrt((px[i] - kr) ** 2 + (px[i + 1] - kg) ** 2 + (px[i + 2] - kb) ** 2);
    const seen = new Uint8Array(w * h);
    const stack: number[] = [];
    const push = (x: number, y: number) => {
      const k = y * w + x;
      if (seen[k]) return;
      seen[k] = 1;
      if (dist(k * 4) < T1) stack.push(k);
    };
    for (let x = 0; x < w; x++) {
      push(x, 0);
      push(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      push(0, y);
      push(w - 1, y);
    }
    while (stack.length) {
      const k = stack.pop()!;
      const i = k * 4;
      const d = dist(i);
      px[i + 3] = Math.min(px[i + 3], d <= T0 ? 0 : Math.round((255 * (d - T0)) / (T1 - T0)));
      // only the fully gone pixels carry the flood on (a soft edge pixel is the subject's border)
      if (d > T0) continue;
      const x = k % w;
      const y = (k - x) / w;
      if (x > 0) push(x - 1, y);
      if (x < w - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1);
      if (y < h - 1) push(x, y + 1);
    }
  }

  // the subject's box (what is left visible), with a little room
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[at(x, y) + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const pad = 2;
  const left = Math.max(0, x0 - pad);
  const top = Math.max(0, y0 - pad);
  return { left, top, width: Math.min(w, x1 + pad + 1) - left, height: Math.min(h, y1 + pad + 1) - top };
}

/** A sprite ready for the game: the backdrop cut away, trimmed, at most `max` px on its long side (WebP with its see-through). */
export async function spriteFile(bytes: Buffer, max = 512): Promise<Buffer> {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = new Uint8Array(data.buffer, data.byteOffset, data.length);
  const box = keyBackdrop(px, info.width, info.height);
  let img = sharp(Buffer.from(px.buffer, px.byteOffset, px.length), { raw: { width: info.width, height: info.height, channels: 4 } });
  if (box && box.width > 4 && box.height > 4) img = img.extract(box);
  return img.resize({ width: max, height: max, fit: "inside", withoutEnlargement: true }).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
}

/** A background: at most 1280 px on its long side. */
export const backgroundFile = (bytes: Buffer) => sharp(bytes).resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();

/** The cover: 1200×675 JPEG (what the apps show for a shared link). */
export const coverFile = (bytes: Buffer) => sharp(bytes).resize(1200, 675, { fit: "cover" }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
