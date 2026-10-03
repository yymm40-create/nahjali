// GPT Image 2 for the film branch (style tests, master and reference sheets). Server only.
// Independent from the booklet's src/lib/openai.ts so the two branches never affect each other.
import OpenAI, { toFile } from "openai";

export const FILM_IMAGE_MODEL = "gpt-image-2";

/** USD per 1M tokens (developers.openai.com/api/docs/pricing, checked 2026-10-02). */
const PRICE = { textIn: 5, imageIn: 8, imageOut: 30 };

export const IMAGE_SIZES = {
  test: "1536x1024",
  sheet: "2048x1152",
} as const;

/** Reserved before a generation; the real cost from the response usage replaces it. */
export const IMAGE_ESTIMATE_USD = { test: 0.07, sheet: 0.4 } as const;

let client: OpenAI | null = null;
const openai = () => (client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

interface ImageUsage {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { text_tokens?: number; image_tokens?: number };
}

export function imageCost(u: ImageUsage | undefined) {
  if (!u) return null;
  const text = u.input_tokens_details?.text_tokens ?? 0;
  const image = u.input_tokens_details?.image_tokens ?? Math.max(0, (u.input_tokens ?? 0) - text);
  return (text * PRICE.textIn + image * PRICE.imageIn + (u.output_tokens ?? 0) * PRICE.imageOut) / 1_000_000;
}

/**
 * One image. With references the edit endpoint is used (the prompt says what each reference is for);
 * without, a plain generation.
 */
export async function generateFilmImage({
  prompt,
  references,
  size,
  quality,
}: {
  prompt: string;
  references: Buffer[];
  size: string;
  quality: "medium" | "high";
}): Promise<{ png: Buffer; costUsd: number | null; tokens: number }> {
  const common = { model: FILM_IMAGE_MODEL, prompt, size: size as "1536x1024", quality, output_format: "png" as const };
  const res = references.length
    ? await openai().images.edit({
        ...common,
        image: await Promise.all(references.map((b, i) => toFile(b, `reference-${i + 1}.png`, { type: "image/png" }))),
      })
    : await openai().images.generate(common);
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image");
  const usage = (res as { usage?: ImageUsage }).usage;
  return {
    png: Buffer.from(b64, "base64"),
    costUsd: imageCost(usage),
    tokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
  };
}
