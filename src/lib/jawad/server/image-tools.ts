// «الجواد الذكي!» | JAWAD AI — «أدوات الصورة» on the server: «امسح بالفرشاة» / «عدّل هالجزء» (inpainting),
// «وسّع الصورة» (outpainting) and «ارفع الدقة» (upscaling), each run as a job of its generator (config/jawad/generators.ts)
// so the price, the hold, the refund and «أعمالي» are the same as any generation. Server only; needs FAL_KEY.
//
// The inpainting keeps the original: the picture is sent at most 4 MP, and only what is inside the (slightly grown)
// mask is taken from the answer and laid on the original at its full size, so nothing outside it changes (the same
// way «زهراء فوتو ماستر» filled a lifted piece — compositeInside of src/lib/photo/repair.ts).

import sharp from "sharp";
import { callClaudeJson } from "@/lib/film/anthropic";
import { withClaude } from "@/lib/film/claude-model";
import { compositeInside } from "@/lib/photo/repair";
import { storage } from "@/lib/storage";
import {
  fitMegapixels,
  IMAGE_TOOL_MODELS,
  IMAGE_TOOL_USD,
  IMG_INPAINT_ID,
  IMG_OUTPAINT_ID,
  IMG_UPSCALE_ID,
  INPAINT_MAX_MP,
  needsEnglish,
  OUTPAINT_SHAPES,
  outpaintPlan,
  upscaleUsd,
  type OutpaintShape,
} from "@config/jawad/image-tools";
import type { Settings } from "@config/jawad/types";
import { falFile, falReady, falRun, falUrl } from "./providers/fal";
import { ProviderError } from "./providers/common";
import { JAWAD_BUCKET } from "./runtime";
import type { UploadRow } from "./uploads";
import { growMask, normalizeMask } from "./image-mask";

/** How far the object remover grows the mask on its own (fal's default, in pixels of what is sent). */
const ERASE_EXPANSION = 15;

export interface ToolImage {
  bytes: Buffer;
  mime: string;
  ext: string;
  width: number | null;
  height: number | null;
}

// ───────────────────────────── helpers ─────────────────────────────

/** The picture the person chose, upright (a phone photo's turn applied), with its size. */
async function upright(bytes: Buffer) {
  const before = await sharp(bytes).metadata().catch(() => null);
  const turned = (before?.orientation ?? 1) > 1;
  const out = turned ? await sharp(bytes).rotate().toBuffer() : bytes;
  const m = turned ? await sharp(out).metadata() : before;
  if (!m?.width || !m.height) throw new ProviderError("rejected", "تعذّر قراءة الصورة.", "image tool: no size");
  return { bytes: out, width: m.width, height: m.height, turned };
}

/** A file put up for the provider for a while (the provider fetches it by link); `drop` removes them all after. */
function links(userId: string, jobId: string) {
  const paths: string[] = [];
  return {
    async put(name: string, bytes: Buffer, mime = "image/png") {
      const path = `${userId}/tmp/${jobId}/${name}`;
      const up = await storage.from(JAWAD_BUCKET).upload(path, bytes, { contentType: mime, upsert: true });
      if (up.error) throw new ProviderError("rejected", "تعذّر تجهيز الصورة للإرسال.", `tool upload ${name}: ${up.error.message}`);
      paths.push(path);
      return sign(path);
    },
    async drop() {
      if (paths.length) await storage.from(JAWAD_BUCKET).remove(paths).catch(() => {});
    },
  };
}

async function sign(path: string) {
  const { data, error } = await storage.from(JAWAD_BUCKET).createSignedUrl(path, 3600);
  if (error || !data) throw new ProviderError("rejected", "تعذّر تجهيز الصورة للإرسال.", `tool sign: ${error?.message ?? "no url"}`);
  return data.signedUrl;
}

/** One call to a fal picture model; its answer's first picture, downloaded. */
async function falPicture(model: string, input: Record<string, unknown>) {
  if (!falReady()) throw new ProviderError("rejected", "أدوات الصورة غير مفعّلة على الخادم.", "FAL_KEY missing");
  const out = await falRun<Record<string, unknown>>(model, input, 240_000).catch((e) => {
    // falRun's own words speak of «الفصل» (it was written for the editor's sound separation)
    if (e instanceof ProviderError && /الفصل/.test(e.userMessage)) throw new ProviderError(e.outcome, e.outcome === "unknown" ? "أخذ وقت أطول من المتوقع؛ جرّب مرة ثانية." : "تعذّر تعديل الصورة عند المزوّد؛ جرّب مرة ثانية.", e.detail);
    throw e;
  });
  const url = falUrl(out, "images") ?? falUrl(out, "image");
  if (!url) throw new ProviderError("rejected", "ما رجع المزوّد بصورة؛ جرّب مرة ثانية.", `${model}: no image in ${Object.keys(out).join(",")}`);
  return falFile(url);
}

const TRANSLATE_SCHEMA = { type: "object", additionalProperties: false, required: ["english"], properties: { english: { type: "string" } } };

/** The person's description in plain English for the model (as written when it already is). */
export async function inEnglish(text: string, what: "fill" | "expand" | "select"): Promise<string> {
  const t = text.trim();
  if (!t || !needsEnglish(t)) return t;
  const system =
    what === "select"
      ? "Turn the user's words naming something in a picture into a short English noun phrase for an open-vocabulary segmentation model (SAM 3), e.g. «الكوب» → \"cup\", «الشخص اللي يمين» → \"person on the right\". Only the phrase."
      : what === "fill"
        ? "Translate the user's description of what to paint inside a masked area of a picture into one short, concrete English image prompt (the object or surface, its look, colour and material). Keep any quoted words exactly as written. Only the prompt."
        : "Translate the user's description of what should appear around a picture when it is expanded into one short, concrete English image prompt (the scenery, surfaces and light). Only the prompt.";
  const r = await withClaude("claude-haiku-5-5", () => callClaudeJson<{ english: string }>({ system, turns: [{ role: "user", content: t.slice(0, 1000) }], schema: TRANSLATE_SCHEMA, maxTokens: 1000, effort: "low", fallback: true })).catch((e) => {
    throw new ProviderError("rejected", "تعذّر فهم الوصف الحين؛ جرّب مرة ثانية.", `image tool translate: ${String(e instanceof Error ? e.message : e).slice(0, 300)}`);
  });
  return r.data.english.trim().slice(0, 1000) || t;
}

const asOutput = async (bytes: Buffer): Promise<ToolImage> => {
  const m = await sharp(bytes).metadata().catch(() => null);
  const ext = m?.format === "jpeg" ? "jpg" : m?.format === "webp" ? "webp" : "png";
  return { bytes, mime: ext === "jpg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png", ext, width: m?.width ?? null, height: m?.height ?? null };
};

// ───────────────────────────── the three tools ─────────────────────────────

export interface ToolJob {
  id: string;
  userId: string;
  generatorId: string;
  settings: Settings;
  prompt: string;
}

/** Runs one job of «أدوات الصورة»: the result picture, what it really cost, and what was sent. */
export async function runImageTool(job: ToolJob, refs: UploadRow[], download: (path: string) => Promise<Buffer>): Promise<{ images: ToolImage[]; costUsd: number; units: Record<string, unknown> }> {
  const pics = refs.filter((r) => r.kind === "image");
  if (!pics[0]) throw new ProviderError("rejected", "الصورة غير موجودة.", "image tool: no picture");
  const temp = links(job.userId, job.id);
  try {
    if (job.generatorId === IMG_INPAINT_ID) return await inpaint(job, pics, download, temp);
    if (job.generatorId === IMG_OUTPAINT_ID) return await outpaint(job, pics[0], download, temp);
    if (job.generatorId === IMG_UPSCALE_ID) return await upscale(job, pics[0], download, temp);
    throw new ProviderError("rejected", "أداة غير معروفة.", `image tool ${job.generatorId}`);
  } finally {
    await temp.drop();
  }
}

type Temp = ReturnType<typeof links>;

async function inpaint(job: ToolJob, pics: UploadRow[], download: (path: string) => Promise<Buffer>, temp: Temp) {
  if (!pics[1]) throw new ProviderError("rejected", "حدّد الجزء اللي تبي تعدّله أولًا.", "inpaint: no mask");
  const base = await upright(await download(pics[0].storage_path));
  const { width: W, height: H } = base;
  const holes = await normalizeMask(await download(pics[1].storage_path), W, H);
  if (!holes.painted) throw new ProviderError("rejected", "ما حددت أي جزء؛ لوّن على الجزء اللي تبي تعدّله.", "inpaint: empty mask");
  if (holes.painted === W * H && job.settings.action !== "replace") throw new ProviderError("rejected", "حددت الصورة كلها؛ حدّد الجزء اللي تبي تمسحه بس.", "inpaint: full mask");

  // what is sent: at most INPAINT_MAX_MP, the mask stretched the very same way
  const send = fitMegapixels(W, H, INPAINT_MAX_MP);
  const sentPic = await sharp(base.bytes).resize(send.width, send.height, { fit: "fill" }).png().toBuffer();
  const sentMask = await sharp(holes.png).resize(send.width, send.height, { fit: "fill", kernel: "nearest" }).threshold(128).png().toBuffer();
  const [imageUrl, maskUrl] = await Promise.all([temp.put("picture.png", sentPic), temp.put("mask.png", sentMask)]);

  const replace = job.settings.action === "replace";
  let painted: Buffer;
  let costUsd: number;
  let prompt = "";
  if (replace) {
    prompt = await inEnglish(job.prompt, "fill");
    painted = await falPicture(IMAGE_TOOL_MODELS.fill, { prompt, image_url: imageUrl, mask_url: maskUrl, num_images: 1, output_format: "png", safety_tolerance: "2" });
    const mp = Math.max(1, Math.ceil((send.width * send.height) / 1e6 - 1e-9));
    costUsd = mp * IMAGE_TOOL_USD.fillPerMp + (needsEnglish(job.prompt) ? IMAGE_TOOL_USD.translate : 0);
  } else {
    painted = await falPicture(IMAGE_TOOL_MODELS.erase, { image_url: imageUrl, mask_url: maskUrl, model: "best_quality", mask_expansion: ERASE_EXPANSION });
    costUsd = IMAGE_TOOL_USD.erase;
  }

  // only the (grown) mask's pixels come back into the original, at its full size
  const scale = W / send.width;
  const grow = Math.round((replace ? 3 : ERASE_EXPANSION) * scale);
  const area = await growMask(holes.png, W, H, grow);
  const feather = Math.max(1, Math.round(Math.min(W, H) * 0.003));
  // (the answer without any alpha of its own: the mask becomes its alpha)
  const flat = await sharp(painted).flatten({ background: "#000" }).removeAlpha().png().toBuffer();
  const result = await compositeInside(base.bytes, flat, area, W, H, feather);
  return {
    images: [await asOutput(result)],
    costUsd,
    units: { action: replace ? "replace" : "remove", sent: `${send.width}x${send.height}`, painted: Number((holes.painted / (W * H)).toFixed(4)), ...(prompt ? { englishPrompt: prompt.slice(0, 300) } : {}) },
  };
}

async function outpaint(job: ToolJob, pic: UploadRow, download: (path: string) => Promise<Buffer>, temp: Temp) {
  const shape = (OUTPAINT_SHAPES as readonly string[]).includes(String(job.settings.shape)) ? (String(job.settings.shape) as OutpaintShape) : "9:16";
  const base = await upright(await download(pic.storage_path));
  const plan = outpaintPlan(base.width, base.height, shape);
  if (!plan) throw new ProviderError("rejected", "الصورة أصلًا بهالشكل؛ اختر شكل ثاني.", `outpaint: already ${shape}`);
  const sent = plan.imgW === base.width && plan.imgH === base.height ? await sharp(base.bytes).png().toBuffer() : await sharp(base.bytes).resize(plan.imgW, plan.imgH, { fit: "fill" }).png().toBuffer();
  const imageUrl = await temp.put("picture.png", sent);
  const prompt = await inEnglish(job.prompt, "expand");
  const bytes = await falPicture(IMAGE_TOOL_MODELS.expand, {
    image_url: imageUrl,
    canvas_size: [plan.canvasW, plan.canvasH],
    original_image_size: [plan.imgW, plan.imgH],
    original_image_location: [plan.x, plan.y],
    ...(prompt ? { prompt } : {}),
    negative_prompt: "text, letters, watermark, logo, frame, border",
  });
  return {
    images: [await asOutput(bytes)],
    costUsd: IMAGE_TOOL_USD.expand + (needsEnglish(job.prompt) ? IMAGE_TOOL_USD.translate : 0),
    units: { shape, canvas: `${plan.canvasW}x${plan.canvasH}`, placed: `${plan.imgW}x${plan.imgH}@${plan.x},${plan.y}`, ...(prompt ? { englishPrompt: prompt.slice(0, 300) } : {}) },
  };
}

async function upscale(job: ToolJob, pic: UploadRow, download: (path: string) => Promise<Buffer>, temp: Temp) {
  const factor = job.settings.factor === "4" ? 4 : 2;
  const engine = job.settings.engine === "topaz" ? "topaz" : "seedvr";
  // the stored file itself, unless a phone's turn has to be applied first
  let imageUrl: string;
  let W = pic.width ?? 0;
  let H = pic.height ?? 0;
  if (!W || !H || /jpe?g/.test(pic.mime ?? "")) {
    const base = await upright(await download(pic.storage_path));
    W = base.width;
    H = base.height;
    imageUrl = base.turned ? await temp.put("picture.png", await sharp(base.bytes).png().toBuffer()) : await sign(pic.storage_path);
  } else imageUrl = await sign(pic.storage_path);
  const usd = upscaleUsd(W, H, factor, engine);
  if (usd == null) throw new ProviderError("rejected", "الناتج أكبر من الحد؛ اختر ×2.", `upscale too big ${W}x${H}x${factor}`);
  const bytes =
    engine === "topaz"
      ? await falPicture(IMAGE_TOOL_MODELS.topaz, { image_url: imageUrl, model: "Standard V2", upscale_factor: factor, output_format: "png" })
      : await falPicture(IMAGE_TOOL_MODELS.seedvr, { image_url: imageUrl, upscale_mode: "factor", upscale_factor: factor, output_format: "png" });
  const out = await asOutput(bytes);
  return { images: [out], costUsd: usd, units: { engine, factor, from: `${W}x${H}`, to: out.width && out.height ? `${out.width}x${out.height}` : null } };
}

// ───────────────────────────── «✨ تحديد ذكي» ─────────────────────────────

/** The mask's long side sent back to the page (it draws it into its own mask layer). */
const SELECT_SIDE = 1024;

/**
 * SAM 3's outline of what the person named, on their picture: a white-on-black PNG of the picture's shape (its long
 * side SELECT_SIDE), every match together. Null when it found nothing.
 */
export async function smartSelect(pictureBytes: Buffer, words: string): Promise<{ png: Buffer; concept: string } | null> {
  if (!falReady()) throw new ProviderError("rejected", "التحديد الذكي غير مفعّل على الخادم.", "FAL_KEY missing");
  const base = await upright(pictureBytes);
  const k = Math.min(1, SELECT_SIDE / Math.max(base.width, base.height));
  const w = Math.max(1, Math.round(base.width * k));
  const h = Math.max(1, Math.round(base.height * k));
  const jpeg = await sharp(base.bytes).resize(w, h, { fit: "fill" }).jpeg({ quality: 88 }).toBuffer();
  const concept = await inEnglish(words, "select");
  const out = await falRun<{ masks?: { url?: string }[] }>(IMAGE_TOOL_MODELS.sam, { image_url: `data:image/jpeg;base64,${jpeg.toString("base64")}`, prompt: concept, apply_mask: false, return_multiple_masks: true, max_masks: 4, output_format: "png" }, 90_000);
  const urls = (out.masks ?? []).flatMap((m) => (m.url ? [m.url] : []));
  if (!urls.length) return null;
  let union: Buffer | null = null;
  for (const u of urls) {
    const m = await sharp(await falFile(u)).flatten({ background: "#000" }).resize(w, h, { fit: "fill" }).greyscale().threshold(128).png().toBuffer();
    union = union ? await sharp(union).composite([{ input: m, blend: "lighten" }]).greyscale().png().toBuffer() : m;
  }
  return union ? { png: union, concept } : null;
}
