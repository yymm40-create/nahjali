import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { GENERATION_SETTINGS } from "@config/prompts";

let client: OpenAI | null = null;
function openai() {
  // Key is read on the server only; it is never sent to the browser.
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

/**
 * Generates an image from a reference image + prompt using the image edit endpoint.
 * gpt-image-2 always reads reference images at high fidelity, so `input_fidelity` is not sent.
 */
export async function generateFromReference(reference: Buffer, prompt: string, transparent: boolean): Promise<Buffer> {
  const res = await openai().images.edit({
    model: GENERATION_SETTINGS.model,
    image: await toFile(reference, "reference.png", { type: "image/png" }),
    prompt,
    size: GENERATION_SETTINGS.size,
    quality: GENERATION_SETTINGS.quality,
    background: transparent ? "transparent" : "opaque",
    output_format: "png",
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image");
  const image = Buffer.from(b64, "base64");
  return transparent ? ensureTransparent(image) : image;
}

/**
 * Transparent backgrounds are a preview feature for gpt-image-2. This guarantees a usable cut-out:
 * - if the model returned real transparency, near-opaque alpha (e.g. 253) is snapped to 255;
 * - otherwise the plain background is removed by flood-filling from the image edges.
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
    floodRemoveBackground(data, w, h, corners);
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

function floodRemoveBackground(data: Buffer, w: number, h: number, corners: number[]) {
  // Background colour = average of the four corners
  const bg = [0, 1, 2].map((c) => corners.reduce((s, i) => s + data[i + c], 0) / corners.length);
  const TOL = 42;
  const near = (i: number) => {
    const dr = data[i] - bg[0], dg = data[i + 1] - bg[1], db = data[i + 2] - bg[2];
    return dr * dr + dg * dg + db * db <= TOL * TOL;
  };

  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);

  while (stack.length) {
    const p = stack.pop()!;
    if (visited[p]) continue;
    visited[p] = 1;
    if (!near(p * 4)) continue;
    data[p * 4 + 3] = 0;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }

  // Soften the 1px edge so the cut-out doesn't look jagged when printed
  for (let p = 0; p < w * h; p++) {
    if (data[p * 4 + 3] === 0) continue;
    const x = p % w, y = (p / w) | 0;
    const touchesBg =
      (x > 0 && data[(p - 1) * 4 + 3] === 0) ||
      (x < w - 1 && data[(p + 1) * 4 + 3] === 0) ||
      (y > 0 && data[(p - w) * 4 + 3] === 0) ||
      (y < h - 1 && data[(p + w) * 4 + 3] === 0);
    if (touchesBg) data[p * 4 + 3] = 160;
  }
}
