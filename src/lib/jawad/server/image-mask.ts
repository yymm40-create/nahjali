// «الجواد الذكي!» | JAWAD AI — the mask of «امسح بالفرشاة» on the server: the page's painting made the picture's own
// (its exact size, pure black and white) and grown a little for what the model may have touched around it. Server only
// (sharp); kept apart from the provider calls so the tests can run it.

import sharp from "sharp";

/**
 * The page's mask as the picture's own: stretched to exactly `W` × `H`, one grey channel, 255 where something is to
 * change and 0 elsewhere (nothing in between). `painted` is how many pixels are 255.
 */
export async function normalizeMask(bytes: Buffer, W: number, H: number): Promise<{ png: Buffer; painted: number }> {
  const { data, info } = await sharp(bytes)
    .flatten({ background: "#000" })
    .greyscale()
    // stretched smoothly, then cut at half: round edges instead of the small mask's steps
    .resize(W, H, { fit: "fill" })
    .threshold(128)
    .raw()
    .toBuffer({ resolveWithObject: true });
  let painted = 0;
  // threshold leaves one channel of 0/255; a grey input may still come back with its channels, so read the first
  const ch = info.channels;
  const one = Buffer.alloc(W * H);
  for (let i = 0; i < W * H; i++) {
    const v = data[i * ch] >= 128 ? 255 : 0;
    one[i] = v;
    if (v) painted++;
  }
  const png = await sharp(one, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
  return { png, painted };
}

/** The mask grown by about `px` pixels on every side (what the model may have touched around it). */
export async function growMask(mask: Buffer, W: number, H: number, px: number): Promise<Buffer> {
  if (px <= 0) return mask;
  // a blur spreads the white out; anything a little lit becomes part of the mask (two passes: sharp would otherwise
  // threshold before it blurs)
  const spread = await sharp(mask).resize(W, H, { fit: "fill" }).greyscale().blur(Math.max(0.3, px / 2)).png().toBuffer();
  return sharp(spread).threshold(6).png().toBuffer();
}

