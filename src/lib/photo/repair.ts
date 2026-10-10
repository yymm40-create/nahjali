// «يتوقّع الجزء الناقص» — when a piece is lifted out of a picture, the place it left is not patched with a smear: GPT
// Image 2 is asked what was BEHIND it and draws it, and only the hole's own pixels are taken from that answer, so
// nothing outside the hole can change (the rest of the file stays the original's bytes). The same tool retypes a word
// that is part of the picture: the new words are drawn in the SAME typeface, weight, colour and effects as the
// original (a crop of it goes along as the reference), on a transparent background, and land in the same place.
// Server only; needs OPENAI_API_KEY. Everything here falls back honestly: when the prediction cannot run, the caller
// is told and the soft patch is used instead.

import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { ensureTransparent } from "@/lib/openai";

let client: OpenAI | null = null;
const openai = () => (client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

export const repairReady = () => !!process.env.OPENAI_API_KEY;

/** What GPT Image 2 costs us for one reconstruction of a hole, and for one word redrawn (the person pays with the site's margin). */
export const FILL_USD = 0.08;
export const RETEXT_USD = 0.06;

/** The sizes the edit endpoint accepts. */
export const SIZES = ["1024x1024", "1024x1536", "1536x1024"] as const;
export type EditSize = (typeof SIZES)[number];

/** The accepted size nearest the picture's own shape (so nothing is stretched on the way out). */
export function bestSize(w: number, h: number): EditSize {
  if (!(w > 0) || !(h > 0)) return "1024x1024";
  const r = w / h;
  const best = SIZES.map((s) => {
    const [sw, sh] = s.split("x").map(Number);
    return { s, d: Math.abs(sw / sh - r) };
  }).sort((a, b) => a.d - b.d)[0];
  return best.s;
}

const dims = (s: EditSize) => {
  const [w, h] = s.split("x").map(Number);
  return { w, h };
};

/**
 * The mask the edit endpoint wants: the picture's shape, OPAQUE where nothing may change and TRANSPARENT over the
 * hole. `holes` is white-on-black (what was lifted out).
 */
export async function editMask(holes: Buffer, W: number, H: number, grow = 0): Promise<Buffer> {
  let m = sharp(holes).resize(W, H, { fit: "fill" }).greyscale();
  if (grow > 0) m = sharp(await m.blur(grow).toBuffer()).greyscale().linear(3, 0);
  const grey = await m.toBuffer();
  // alpha = 255 - hole, so the hole is the transparent part the model is allowed to paint
  const alpha = await sharp(grey).negate().toBuffer();
  return sharp({ create: { width: W, height: H, channels: 3, background: "#000" } }).png().toBuffer().then((flat) =>
    sharp(flat).ensureAlpha().joinChannel(alpha).png().toBuffer(),
  );
}

/** Only the hole's pixels taken from `painted`; everything else is the original, byte for byte. */
export async function compositeInside(base: Buffer, painted: Buffer, holes: Buffer, W: number, H: number, feather = 2): Promise<Buffer> {
  const soft = await sharp(holes).resize(W, H, { fit: "fill" }).greyscale().blur(Math.max(0.3, feather)).toBuffer();
  const patch = await sharp(painted).resize(W, H, { fit: "fill" }).ensureAlpha().joinChannel(soft).png().toBuffer();
  return sharp(base).composite([{ input: patch }]).png().toBuffer();
}

const FILL_PROMPT = `The attached picture has a TRANSPARENT HOLE in it. Paint ONLY inside that hole: continue what was behind the removed object — the same surface, the same pattern, the same lighting, the same grain and the same perspective as the pixels touching the hole — so the result looks like the object was never there.
Hard rules: do NOT add any new object, person, animal, logo, letter, word or writing of any kind. Do NOT change anything outside the hole. Do NOT change the picture's colours, crop or style. If the hole crosses an edge, a line or a pattern, continue it through.`;

/**
 * STEP: what was behind the lifted pieces. Returns the base with the holes filled by the prediction (and only there),
 * or null when the prediction could not run — the caller then falls back to the soft patch and says so.
 */
export async function predictFill(base: Buffer, holes: Buffer, W: number, H: number): Promise<Buffer | null> {
  if (!repairReady()) return null;
  const size = bestSize(W, H);
  const { w, h } = dims(size);
  try {
    const picture = await sharp(base).resize(w, h, { fit: "fill" }).png().toBuffer();
    const mask = await editMask(holes, w, h, Math.max(1, Math.round(Math.min(w, h) * 0.004)));
    // the hole is handed over as a hole: the picture itself carries the transparency, as the endpoint expects
    const holed = await sharp(picture).ensureAlpha().joinChannel(await sharp(mask).extractChannel(3).toBuffer()).png().toBuffer();
    const res = await openai().images.edit({
      model: "gpt-image-2",
      image: [await toFile(holed, "picture.png", { type: "image/png" })],
      mask: await toFile(mask, "mask.png", { type: "image/png" }),
      prompt: FILL_PROMPT,
      size,
      quality: "high",
      output_format: "png",
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) return null;
    return await compositeInside(base, Buffer.from(b64, "base64"), holes, W, H, Math.max(1, Math.round(Math.min(W, H) * 0.003)));
  } catch (e) {
    console.error("photo predictFill", e);
    return null;
  }
}

/** The words of a text piece, redrawn in the picture's own typeface on a transparent background. */
export async function renderWords(crop: Buffer, words: string): Promise<Buffer | null> {
  if (!repairReady()) return null;
  const meta = await sharp(crop).metadata().catch(() => null);
  const size = bestSize(meta?.width ?? 1024, meta?.height ?? 512);
  const { w, h } = dims(size);
  const prompt = `The attached crop shows WORDS taken out of a finished design. Draw the following words INSTEAD of them, keeping EXACTLY the same typeface, weight, slant, letter spacing, colour, gradient, outline, shadow and any other effect the attached words have, at the same optical size and on the same baseline:

«${words}»

Hard rules: draw ONLY these words — no background, no box, no frame, no decoration, no watermark, no extra letters and no translation. Keep the words' own language and spelling exactly as given, with every diacritic. Put the words on a PURE FLAT GREEN (#00B140) background that touches every edge, so the background can be removed afterwards. Centre them the way they sit in the crop.`;
  try {
    const ref = await sharp(crop).resize(w, h, { fit: "contain", background: "#00B140" }).png().toBuffer();
    const res = await openai().images.edit({
      model: "gpt-image-2",
      image: [await toFile(ref, "words.png", { type: "image/png" })],
      prompt,
      size,
      quality: "high",
      output_format: "png",
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) return null;
    // the green goes away, and what is left is trimmed to the words themselves
    const clear = await ensureTransparent(Buffer.from(b64, "base64"));
    return await sharp(clear).trim({ threshold: 6 }).png().toBuffer();
  } catch (e) {
    console.error("photo renderWords", e);
    return null;
  }
}
