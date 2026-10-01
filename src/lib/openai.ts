import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { GENERATION_SETTINGS } from "@config/prompts";
import type { QualityKey } from "@config/pricing";

let client: OpenAI | null = null;
function openai() {
  // Key is read on the server only; it is never sent to the browser.
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

/**
 * Generates an image from a reference image + prompt using the image edit endpoint.
 * gpt-image-2 always reads reference images at high fidelity, so `input_fidelity` is not sent.
 * With `cutout`, the result always comes back with a transparent background (see ensureTransparent).
 */
export async function generateFromReference(
  reference: Buffer,
  prompt: string,
  quality: QualityKey,
  cutout: boolean,
): Promise<Buffer> {
  const res = await openai().images.edit({
    model: GENERATION_SETTINGS.model,
    image: await toFile(reference, "reference.png", { type: "image/png" }),
    prompt,
    size: GENERATION_SETTINGS.size,
    quality,
    background: cutout && GENERATION_SETTINGS.transparentBackground ? "transparent" : "opaque",
    output_format: "png",
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image");
  const image = Buffer.from(b64, "base64");
  return cutout ? ensureTransparent(image) : image;
}

/**
 * Guarantees a clean cut-out for the booklet:
 * - real transparency from the model: near-opaque alpha (e.g. 253) is snapped to 255;
 * - otherwise the flat background (normally a green screen) is keyed out.
 */
export async function ensureTransparent(png: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = (x: number, y: number) => (y * w + x) * 4;

  const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)];
  const hasTransparency = corners.filter((i) => data[i + 3] < 16).length >= 3;

  if (hasTransparency) {
    for (let i = 3; i < data.length; i += 4) if (data[i] > 245) data[i] = 255;
  } else {
    removeBackground(data, w, h, corners);
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

function removeBackground(data: Buffer, w: number, h: number, corners: number[]) {
  // Background colour = average of the four corners
  const bg = [0, 1, 2].map((c) => corners.reduce((s, i) => s + data[i + c], 0) / corners.length);
  const isGreenScreen = bg[1] > bg[0] + 80 && bg[1] > bg[2] + 80;
  const dist2 = (i: number) => {
    const dr = data[i] - bg[0], dg = data[i + 1] - bg[1], db = data[i + 2] - bg[2];
    return dr * dr + dg * dg + db * db;
  };

  // 1) Flood fill from the edges: removes the background connected to the frame
  const TOL = isGreenScreen ? 90 : 42;
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop()!;
    if (visited[p]) continue;
    visited[p] = 1;
    if (dist2(p * 4) > TOL * TOL) continue;
    data[p * 4 + 3] = 0;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }

  // 2) Green screen only: also clear enclosed pockets (e.g. between an arm and the body).
  //    A strict tolerance keeps green clothing/props, which are never this exact flat key colour.
  if (isGreenScreen) {
    const STRICT = 45;
    for (let p = 0; p < w * h; p++) if (dist2(p * 4) <= STRICT * STRICT) data[p * 4 + 3] = 0;
  }

  // 3) Soften the 1px edge and remove green spill so the outline looks clean in print
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (data[i + 3] === 0) continue;
    const x = p % w, y = (p / w) | 0;
    const touchesBg =
      (x > 0 && data[i - 4 + 3] === 0) ||
      (x < w - 1 && data[i + 4 + 3] === 0) ||
      (y > 0 && data[i - w * 4 + 3] === 0) ||
      (y < h - 1 && data[i + w * 4 + 3] === 0);
    if (!touchesBg) continue;
    data[i + 3] = 160;
    if (isGreenScreen) data[i + 1] = Math.min(data[i + 1], Math.max(data[i], data[i + 2]));
  }
}
