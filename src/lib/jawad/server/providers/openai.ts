// JAWAD AI — OpenAI adapters: GPT Image 2 (Images API) and GPT-4o mini TTS (speech). Server only.
// Retries are OFF: a repeated request could be generated (and billed) twice; a failure is reported instead.
import OpenAI, { APIConnectionError, APIConnectionTimeoutError, APIError, toFile } from "openai";
import { GPT_IMAGE_2_SIZES } from "@config/jawad/generators";
import { ProviderError, rejectedMessage } from "./common";

let client: OpenAI | null = null;
const openai = () => (client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 280_000 }));

/** USD per 1M tokens for gpt-image-2 (pricing page): text in 5 · image in 8 · image out 30. */
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

export async function openaiImage(o: {
  model: string;
  prompt: string;
  aspect: string;
  resolution: "std" | "hi";
  quality: "low" | "medium" | "high";
  count: number;
  references: { bytes: Buffer; mime: string }[];
  user: string;
  /** a shorter wait than the client's default (a caller that must answer within its own time limit) */
  timeoutMs?: number;
}): Promise<{ images: Buffer[]; costUsd: number | null; usage: ImageUsage | null }> {
  const size = GPT_IMAGE_2_SIZES[o.resolution][o.aspect];
  if (!size) throw new ProviderError("rejected", "مقاس غير مدعوم.", `no size for ${o.resolution}/${o.aspect}`);
  const common = {
    model: o.model,
    prompt: o.prompt,
    size: `${size[0]}x${size[1]}` as "1024x1024",
    quality: o.quality,
    n: o.count,
    output_format: "png" as const,
    user: o.user,
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
    const costUsd = u ? (text * PRICE.textIn + image * PRICE.imageIn + (u.output_tokens ?? 0) * PRICE.imageOut) / 1e6 : null;
    return { images, costUsd, usage: u };
  } catch (e) {
    wrap(e);
  }
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
