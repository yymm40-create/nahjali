// «المصمم الذكي» — splitting a flat picture into layers («فكّك إلى طبقات»): the subject (a person, a product) is cut
// out with a transparent background (BiRefNet on fal.ai, the same account «حيدرة كت» uses), the original picture
// stays as the background, and the cut-out becomes a movable image layer the text layers go over. This is the useful
// part of what "Layers" tools do: the person can move the subject, put words behind or over it, and keep editing.
// Server only; needs FAL_KEY.

import sharp from "sharp";
import { UserError } from "@/lib/api";
import { falReady, falRun, falUrl, falFile } from "@/lib/jawad/server/providers/fal";
import { ProviderError } from "@/lib/jawad/server/providers/common";
import { storage } from "@/lib/storage";
import { JAWAD_BUCKET } from "@/lib/jawad/server/runtime";
import { isDesignAspect, type DesignAspect } from "@config/designer";
import { getChat, lastDesignAt, saveChat } from "./chats";
import { addFile, uploadBytes } from "./files";
import { layerId, type Design, type ImageLayer } from "./layers";

const MODEL = "fal-ai/birefnet/v2";

/**
 * Where the trimmed cut-out sits on the background, in the layer's terms (percent of the background): its centre and
 * its width, from the offsets the trim removed. `full` is the cut-out before the trim (it has the background's shape).
 */
export function cutPlace(full: { width?: number; height?: number }, trimmed: { data: Buffer; info: { width: number; height: number; trimOffsetLeft?: number; trimOffsetTop?: number } }, bg: { width: number; height: number }) {
  const fw = full.width || bg.width;
  const fh = full.height || bg.height;
  const { width: tw, height: th } = trimmed.info;
  const left = Math.abs(trimmed.info.trimOffsetLeft ?? 0);
  const top = Math.abs(trimmed.info.trimOffsetTop ?? 0);
  const pct = (n: number) => Math.round(n * 100) / 100;
  return { bytes: trimmed.data, width: tw, height: th, x: pct(((left + tw / 2) / fw) * 100), y: pct(((top + th / 2) / fh) * 100), w: pct((tw / fw) * 100) };
}

/** The nearest of the site's aspects to a picture's own shape. */
export function nearestAspect(w: number, h: number): DesignAspect {
  const r = w / h;
  const all: [DesignAspect, number][] = [["1:1", 1], ["2:3", 2 / 3], ["9:16", 9 / 16], ["16:9", 16 / 9], ["3:2", 3 / 2]];
  return all.sort((a, b) => Math.abs(a[1] - r) - Math.abs(b[1] - r))[0][0];
}

export const splitReady = () => falReady();

const LAYERED_MODEL = "fal-ai/qwen-image-layered";

/** The picture as transparent layers (the first is the background), each at the picture's size. */
async function layersOf(url: string): Promise<Buffer[]> {
  const out = await falRun<{ images?: { url?: string }[] }>(LAYERED_MODEL, { image_url: url, num_layers: 5, output_format: "png" }, 200_000);
  const links = (out.images ?? []).map((i) => i.url).filter((u): u is string => typeof u === "string");
  if (links.length < 2) throw new ProviderError("rejected", "ما رجع التفكيك بطبقات.", `layers ${links.length}`);
  return Promise.all(links.map((u) => falFile(u)));
}

/**
 * Splits the person's uploaded picture: stores it as the design's artwork (background) and its cut-out subject as an
 * image layer; the design is written into the last message that carries one.
 */
export async function splitUpload(userId: string, chatId: string, uploadId: string): Promise<Design> {
  if (!falReady()) throw new UserError("تفكيك الصور إلى طبقات غير مفعّل على الخادم حاليًا (FAL_KEY).", 503);
  const chat = await getChat(userId, chatId);
  if (!chat) throw new Error("chat not found");
  const where = lastDesignAt(chat.messages);
  if (where < 0) throw new UserError("ما فيه تصميم نضع فيه الطبقات.", 409);
  const up = await uploadBytes(userId, uploadId);
  if (!up) throw new UserError("ما لقينا هذي الصورة بين مرفقاتك.", 404);

  // the original, as PNG at the site's working size, is the background
  const meta = await sharp(up.bytes, { failOn: "none" }).metadata();
  const w = meta.width ?? 1024;
  const h = meta.height ?? 1024;
  const bg = await sharp(up.bytes, { failOn: "none" }).rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).png().toBuffer();
  const bgMeta = await sharp(bg).metadata();
  const width = bgMeta.width ?? w;
  const height = bgMeta.height ?? h;
  const art = await addFile({ userId, chatId, bytes: bg, name: `background-${uploadId.slice(0, 8)}`, role: "artwork", width, height, meta: { from: uploadId, split: true } });

  // the subject, cut out on a transparent background (a short-lived link of the stored background is what fal reads)
  const { data: signed } = await storage.from(JAWAD_BUCKET).createSignedUrl(art.path, 1800);
  if (!signed?.signedUrl) throw new UserError("ما قدرنا نجهّز الصورة للتفكيك.", 500);
  // first, the open layering model (Qwen-Image-Layered): the picture split into up to five transparent layers — the
  // background, then each part (a person, a title, an ornament) on its own, all at the picture's size and place
  const layered = await layersOf(signed.signedUrl).catch((e) => (console.error("designer split layers", e instanceof ProviderError ? e.detail : e), null));
  if (layered && layered.length >= 2) {
    const [bgLayer, ...parts] = layered;
    const bgFile = await addFile({ userId, chatId, bytes: await sharp(bgLayer).png().toBuffer(), name: `background-${uploadId.slice(0, 8)}`, role: "artwork", width, height, meta: { from: uploadId, split: true, layered: true } });
    const layersOut: ImageLayer[] = [];
    for (const [i, part] of parts.entries()) {
      const full = await sharp(part).metadata();
      const trimmed = await sharp(part).trim().png().toBuffer({ resolveWithObject: true }).catch(() => null);
      if (!trimmed || trimmed.info.width < 8 || trimmed.info.height < 8) continue;
      const at = cutPlace(full, trimmed, { width: full.width ?? width, height: full.height ?? height });
      const f = await addFile({ userId, chatId, bytes: at.bytes, name: `layer-${i + 1}-${uploadId.slice(0, 8)}`, role: "cutout", width: at.width, height: at.height, meta: { from: uploadId, layer: i + 1 } });
      layersOut.push({ id: layerId(), kind: "image", fileId: f.id, x: at.x, y: at.y, w: at.w, rotate: 0, opacity: 1, flip: false, clip: false });
    }
    if (layersOut.length) {
      const old = chat.messages[where].design!;
      const aspect = isDesignAspect(old.aspect) && old.layers.length ? old.aspect : nearestAspect(width, height);
      const design: Design = { ...old, aspect, width, height, artwork: bgFile.id, layers: [...layersOut, ...old.layers.filter((l) => l.kind === "text")], state: "ready", error: undefined, detail: undefined, splitOf: uploadId };
      const messages = [...chat.messages];
      messages[where] = { ...messages[where], design };
      await saveChat(userId, chatId, { messages });
      return design;
    }
  }
  // else the subject alone (BiRefNet), over the picture itself
  let cut: Buffer;
  try {
    const out = await falRun<Record<string, unknown>>(MODEL, { image_url: signed.signedUrl, model: "General Use (Heavy)", operating_resolution: "1024x1024", output_format: "png", refine_foreground: true }, 150_000);
    const url = falUrl(out, "image");
    if (!url) throw new ProviderError("rejected", "ما رجع التفكيك بنتيجة.", `keys ${Object.keys(out).join(",")}`);
    cut = await falFile(url);
  } catch (e) {
    throw new UserError(e instanceof ProviderError ? e.userMessage : "تعذّر تفكيك الصورة الحين؛ جرّب مرة ثانية.", 502);
  }
  // trimmed to the subject's own box, so the layer's size and place mean the subject — and it stays exactly where the
  // subject stands in the picture (not moved to the middle, where it would show twice: over the background's own)
  const at = cutPlace(await sharp(cut).metadata(), await sharp(cut).trim().png().toBuffer({ resolveWithObject: true }), { width, height });
  const file = await addFile({ userId, chatId, bytes: at.bytes, name: `cutout-${uploadId.slice(0, 8)}`, role: "cutout", width: at.width, height: at.height, meta: { from: uploadId } });

  const layer: ImageLayer = { id: layerId(), kind: "image", fileId: file.id, x: at.x, y: at.y, w: at.w, rotate: 0, opacity: 1, flip: false, clip: false };
  const old = chat.messages[where].design!;
  const aspect = isDesignAspect(old.aspect) && old.layers.length ? old.aspect : nearestAspect(width, height);
  const design: Design = { ...old, aspect, width, height, artwork: art.id, layers: [layer, ...old.layers.filter((l) => l.kind === "text")], state: "ready", error: undefined, detail: undefined, splitOf: uploadId };
  const messages = [...chat.messages];
  messages[where] = { ...messages[where], design };
  await saveChat(userId, chatId, { messages });
  return design;
}
