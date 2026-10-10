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

/** The nearest of the site's aspects to a picture's own shape. */
export function nearestAspect(w: number, h: number): DesignAspect {
  const r = w / h;
  const all: [DesignAspect, number][] = [["1:1", 1], ["2:3", 2 / 3], ["9:16", 9 / 16], ["16:9", 16 / 9], ["3:2", 3 / 2]];
  return all.sort((a, b) => Math.abs(a[1] - r) - Math.abs(b[1] - r))[0][0];
}

export const splitReady = () => falReady();

/**
 * Splits the person's uploaded picture: stores it as the design's artwork (background) and its cut-out subject as an
 * image layer; the design is written into the last message that carries one.
 */
export async function splitUpload(userId: string, chatId: string, uploadId: string): Promise<Design> {
  if (!falReady()) throw new UserError("تفكيك الصور إلى طبقات غير مفعّل على الخادم حاليًا (FAL_KEY).", 503);
  const chat = await getChat(userId, chatId);
  if (!chat) throw new Error("chat not found");
  const at = lastDesignAt(chat.messages);
  if (at < 0) throw new UserError("ما فيه تصميم نضع فيه الطبقات.", 409);
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
  let cut: Buffer;
  try {
    const out = await falRun<Record<string, unknown>>(MODEL, { image_url: signed.signedUrl, model: "General Use (Heavy)", operating_resolution: "1024x1024", output_format: "png", refine_foreground: true }, 150_000);
    const url = falUrl(out, "image");
    if (!url) throw new ProviderError("rejected", "ما رجع التفكيك بنتيجة.", `keys ${Object.keys(out).join(",")}`);
    cut = await falFile(url);
  } catch (e) {
    throw new UserError(e instanceof ProviderError ? e.userMessage : "تعذّر تفكيك الصورة الحين؛ جرّب مرة ثانية.", 502);
  }
  // trimmed to the subject's own box, so the layer's size and place mean the subject
  const trimmed = await sharp(cut).trim().png().toBuffer();
  const tm = await sharp(trimmed).metadata();
  const file = await addFile({ userId, chatId, bytes: trimmed, name: `cutout-${uploadId.slice(0, 8)}`, role: "cutout", width: tm.width ?? width, height: tm.height ?? height, meta: { from: uploadId } });

  const layer: ImageLayer = { id: layerId(), kind: "image", fileId: file.id, x: 50, y: 50, w: Math.round(((tm.width ?? width) / width) * 100), rotate: 0, opacity: 1, flip: false, clip: false };
  const old = chat.messages[at].design!;
  const aspect = isDesignAspect(old.aspect) && old.layers.length ? old.aspect : nearestAspect(width, height);
  const design: Design = { ...old, aspect, width, height, artwork: art.id, layers: [layer, ...old.layers.filter((l) => l.kind === "text")], state: "ready" };
  const messages = [...chat.messages];
  messages[at] = { ...messages[at], design };
  await saveChat(userId, chatId, { messages });
  return design;
}
