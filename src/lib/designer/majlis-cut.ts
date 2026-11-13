// «المصمم الذكي كاظم» — «فرّغ الخلفية»: each person is cut out of his photo (transparent around him) before
// «حيدرا ماكس» puts him in the design. The same professional cut the site already trusts («فكّك إلى طبقات», split.ts):
// BiRefNet on fal.ai, the heavy model with its foreground refined — the photo first turned upright and brought to the
// working size, a second model tried when the first fails. The cut-out is kept as one of the person's uploads.
// Server only; needs FAL_KEY.

import sharp from "sharp";
import { UserError } from "@/lib/api";
import { uploadLinks } from "@/lib/content/files";
import { deskReference } from "@/lib/content/jawad";
import { falFile, falReady, falRun, falUrl } from "@/lib/jawad/server/providers/fal";
import { ProviderError } from "@/lib/jawad/server/providers/common";
import { uploadBytes } from "./files";

const CUTOUT_MODEL = "fal-ai/birefnet/v2";
/** The cuts tried, in order: the heavy general model (what the site's other cut-outs use), then the portrait one. */
export const CUT_TRIES = [
  { model: "General Use (Heavy)", operating_resolution: "1024x1024" },
  { model: "Portrait", operating_resolution: "1024x1024" },
] as const;

const why = (e: unknown) => (e instanceof ProviderError ? `${e.userMessage} — ${e.detail}` : e instanceof Error ? e.message : String(e));

/**
 * The person's photos (upload ids) cut out, in the same order (new upload ids). `owner`: the site's owner sees the
 * technical reason of a failure (the step and the provider's own words) with the message.
 */
export async function cutPeople(userId: string, photos: string[], owner = false): Promise<string[]> {
  if (!falReady()) throw new UserError("قص الصورة غير مفعّل على الخادم حاليًا؛ اختر «خلّ الصورة بخلفيتها» أو GPT Image 2.6.", 503);
  return Promise.all(
    photos.map(async (id, i) => {
      let step = "read";
      const tried: string[] = [];
      try {
        const up = await uploadBytes(userId, id);
        if (!up) throw new UserError("ما قدرنا نفتح صورة الشخص؛ ارفعها مرة ثانية.", 409);
        // upright (a phone's photo carries its turn in EXIF) and at the working size, as PNG: what the cutter reads
        step = "prepare";
        const ready = await sharp(up.bytes, { failOn: "none" }).rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).png().toBuffer();
        const readyId = await deskReference(userId, ready, `majlis-photo-${i + 1}`);
        const url = (await uploadLinks(userId, [readyId])).get(readyId);
        if (!url) throw new Error("no link for the prepared photo");
        step = "cut";
        let cut: Buffer | null = null;
        for (const t of CUT_TRIES) {
          try {
            const out = await falRun<Record<string, unknown>>(CUTOUT_MODEL, { image_url: url, ...t, output_format: "png", refine_foreground: true }, 150_000);
            const link = falUrl(out, "image");
            if (!link) throw new Error(`no image in ${Object.keys(out).join(",")}`);
            cut = await falFile(link);
            break;
          } catch (e) {
            tried.push(`${t.model}: ${why(e)}`);
          }
        }
        if (!cut) throw new Error(tried.join(" | "));
        // trimmed to the person's own box (kept whole when the trim can't be made)
        step = "trim";
        const png = await sharp(cut).trim().png().toBuffer().catch(() => cut!);
        step = "save";
        return await deskReference(userId, png, `majlis-person-${i + 1}`);
      } catch (e) {
        if (e instanceof UserError && e.status === 409) throw e;
        const detail = why(e);
        console.error("majlis cut-out", step, detail);
        throw new UserError(`ما قدرنا نقص صورة الشخص الحين؛ جرّب مرة ثانية.${owner ? ` (للرئيس: ${step} · ${detail.slice(0, 400)})` : ""}`, 502);
      }
    }),
  );
}
