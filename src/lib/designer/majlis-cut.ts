// «المصمم الذكي كاظم» — a design WITH a man: the person is cut out of his photo (transparent around him) before
// «حيدرا ماكس» puts him where the man stood. The cut-out is kept as one of the person's uploads. Server only.

import sharp from "sharp";
import { UserError } from "@/lib/api";
import { uploadLinks } from "@/lib/content/files";
import { deskReference } from "@/lib/content/jawad";
import { falFile, falReady, falRun, falUrl } from "@/lib/jawad/server/providers/fal";

const CUTOUT_MODEL = "fal-ai/birefnet/v2";

/** The person's photos (upload ids) cut out, in the same order (new upload ids). */
export async function cutPeople(userId: string, photos: string[]): Promise<string[]> {
  if (!falReady()) throw new UserError("قص الصورة غير مفعّل على الخادم حاليًا؛ اختر GPT Image 2.6 لهذا التصميم.", 503);
  const links = await uploadLinks(userId, photos);
  return Promise.all(
    photos.map(async (id, i) => {
      const url = links.get(id);
      if (!url) throw new UserError("ما قدرنا نفتح صورة الشخص؛ ارفعها مرة ثانية.", 409);
      try {
        const out = await falRun<Record<string, unknown>>(CUTOUT_MODEL, { image_url: url, model: "General Use (Heavy)", operating_resolution: "2048x2048", output_format: "png", refine_foreground: true });
        const cut = falUrl(out, "image");
        if (!cut) throw new Error("no cut-out");
        const png = await sharp(await falFile(cut)).trim().png().toBuffer();
        return await deskReference(userId, png, `majlis-person-${i + 1}`);
      } catch (e) {
        if (e instanceof UserError) throw e;
        console.error("majlis cut-out", e);
        throw new UserError("ما قدرنا نقص صورة الشخص الحين؛ جرّب مرة ثانية.", 502);
      }
    }),
  );
}
