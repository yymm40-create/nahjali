// JAWAD AI — OpenAI adapters: GPT Image 2 and GPT Image 2.6 (Images API) and GPT-4o mini TTS (speech). Server only.
// Retries are OFF: a repeated request could be generated (and billed) twice; a failure is reported instead.
import OpenAI, { APIConnectionError, APIConnectionTimeoutError, APIError, toFile } from "openai";
import { GPT_IMAGE_2_SIZES, GPT_IMAGE_26_GIF_SIZES, SVG_AUTHOR_MODEL, SVG_AUTHOR_PRICE } from "@config/jawad/generators";
import { ProviderError, rejectedMessage } from "./common";

let client: OpenAI | null = null;
const openai = () => (client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 280_000 }));

/** USD per 1M tokens for gpt-image-2 and gpt-image-2.6 (pricing page): text in 5 · image in 8 · image out 30. */
const PRICE = { textIn: 5, imageIn: 8, imageOut: 30 };

function wrap(e: unknown): never {
  if (e instanceof ProviderError) throw e;
  if (e instanceof APIConnectionTimeoutError || e instanceof APIConnectionError) {
    throw new ProviderError("unknown", "انقطع الاتصال بالمزوّد قبل وصول النتيجة. لم يُخصم منك شيء؛ جرّب مرة ثانية.", String(e.message));
  }
  if (e instanceof APIError) {
    throw new ProviderError("rejected", rejectedMessage(e.status ?? 500, `${e.code ?? ""} ${e.message}`), `${e.status} ${e.code ?? ""} ${e.message}`.slice(0, 900));
  }
  throw new ProviderError("unknown", "صار خطأ غير متوقع أثناء التوليد.", String(e instanceof Error ? e.message : e).slice(0, 900));
}

interface ImageUsage {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { text_tokens?: number; image_tokens?: number };
}

/** xhigh and max: GPT Image 2.6 only (the generator offers them to it alone). */
export type ImageQuality = "low" | "medium" | "high" | "xhigh" | "max";

export async function openaiImage(o: {
  model: string;
  prompt: string;
  aspect: string;
  resolution: "std" | "hi";
  quality: ImageQuality;
  /** GPT Image 2.6: how much the model plans before rendering (no fee; the model's default is high) */
  complexity?: "low" | "medium" | "high";
  count: number;
  references: { bytes: Buffer; mime: string }[];
  user: string;
  /** a shorter wait than the client's default (a caller that must answer within its own time limit) */
  timeoutMs?: number;
  /**
   * GPT Image 2.6: an animated GIF (`frames` 2–16 of `frameMs` each; the size is each frame's) or an SVG drawing
   * (generations only, one at a time). PNG when missing.
   */
  format?: "png" | "gif" | "svg";
  frames?: number;
  frameMs?: number;
}): Promise<{ images: Buffer[]; costUsd: number | null; usage: ImageUsage | null; size: [number, number]; authorUsage?: { input: number; output: number } | null }> {
  const format = o.format ?? "png";
  const size = format === "gif" ? GPT_IMAGE_26_GIF_SIZES[o.aspect] : GPT_IMAGE_2_SIZES[format === "svg" ? "std" : o.resolution][o.aspect];
  if (!size) throw new ProviderError("rejected", "مقاس غير مدعوم.", `no size for ${format}/${o.resolution}/${o.aspect}`);
  if (format === "svg" && o.references.length) throw new ProviderError("rejected", "SVG يُصنع من النص فقط، بلا صور مرجعية.", "svg with references");
  const common = {
    model: o.model,
    prompt: o.prompt,
    size: `${size[0]}x${size[1]}` as "1024x1024",
    quality: o.quality,
    n: format === "png" ? o.count : 1,
    output_format: format as "png",
    user: o.user,
    // not in this SDK's types yet: sent as is (Images API reference, `complexity`; image generation guide,
    // «Animated GIF output»: frame_count, frame_duration_ms)
    ...(o.complexity ? ({ complexity: o.complexity } as object) : {}),
    ...(format === "gif" ? ({ frame_count: o.frames ?? 9, frame_duration_ms: o.frameMs ?? 200 } as object) : {}),
    // SVG: the model that writes the drawing (required on this account: «SVG generation requires 'svg.model'»)
    ...(format === "svg" ? ({ svg: { model: SVG_AUTHOR_MODEL } } as object) : {}),
  };
  try {
    const opts = o.timeoutMs ? { timeout: o.timeoutMs } : undefined;
    const res = o.references.length
      ? await openai().images.edit(
          {
            ...common,
            image: await Promise.all(o.references.map((r, i) => toFile(r.bytes, `reference-${i + 1}.${r.mime.split("/")[1]}`, { type: r.mime }))),
          },
          opts,
        )
      : await openai().images.generate(common, opts);
    const images = (res.data ?? []).map((d) => d.b64_json).filter((b): b is string => Boolean(b)).map((b) => Buffer.from(b, "base64"));
    if (!images.length) throw new ProviderError("rejected", "لم يرجع المزوّد أي صورة.", "empty data");
    const u = (res as { usage?: ImageUsage }).usage ?? null;
    const text = u?.input_tokens_details?.text_tokens ?? 0;
    const image = u?.input_tokens_details?.image_tokens ?? Math.max(0, (u?.input_tokens ?? 0) - text);
    const author = format === "svg" ? svgAuthorUsage(res) : null;
    const costUsd = u ? (text * PRICE.textIn + image * PRICE.imageIn + (u.output_tokens ?? 0) * PRICE.imageOut) / 1e6 + (author ? (author.input * SVG_AUTHOR_PRICE.input + author.output * SVG_AUTHOR_PRICE.output) / 1e6 : 0) : null;
    return { images: format === "svg" ? images.map(cleanSvg) : images, costUsd, usage: u, size, authorUsage: author };
  } catch (e) {
    wrap(e);
  }
}

/**
 * An SVG kept as drawing only: OpenAI's SVG has no scripts or external files (image generation guide), and this makes
 * sure of it before it is stored (no <script>/<foreignObject>, no on…= handlers, no javascript: links).
 */
/**
 * The SVG author's own token use: the reference says it comes back «separate from image rendering usage» but does not
 * name the field, so any object in the response whose key mentions svg and that counts input/output tokens is read.
 */
function svgAuthorUsage(res: unknown): { input: number; output: number } | null {
  const seen: { input: number; output: number }[] = [];
  const walk = (v: unknown, key: string, depth: number) => {
    if (!v || typeof v !== "object" || depth > 3 || key === "data") return;
    const o = v as Record<string, unknown>;
    if (/svg/i.test(key) && (typeof o.input_tokens === "number" || typeof o.output_tokens === "number")) {
      seen.push({ input: Number(o.input_tokens) || 0, output: Number(o.output_tokens) || 0 });
      return;
    }
    for (const [k, x] of Object.entries(o)) walk(x, /svg/i.test(key) ? `${key}.${k}` : k, depth + 1);
  };
  walk(res, "", 0);
  return seen[0] ?? null;
}

export function cleanSvg(buf: Buffer): Buffer {
  const text = buf.toString("utf8");
  if (!/<svg[\s>]/i.test(text)) throw new ProviderError("rejected", "ما رجع رسم SVG صالح.", "svg output without <svg>");
  const clean = text
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script[^>]*\/>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href\s*=\s*["']?)\s*javascript:[^"'\s>]*/gi, "$1#");
  return Buffer.from(clean, "utf8");
}

export const TTS_MIME: Record<string, string> = { mp3: "audio/mpeg", wav: "audio/wav", opus: "audio/ogg", aac: "audio/aac", flac: "audio/flac" };

export async function openaiSpeech(o: { model: string; input: string; instructions: string; voice: string; format: string }): Promise<Buffer> {
  try {
    const res = await openai().audio.speech.create({
      model: o.model,
      input: o.input,
      voice: o.voice as "marin",
      response_format: o.format as "mp3",
      ...(o.instructions.trim() ? { instructions: o.instructions } : {}),
    });
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) throw new ProviderError("rejected", "لم يرجع المزوّد أي صوت.", "empty audio");
    return buf;
  } catch (e) {
    wrap(e);
  }
}
