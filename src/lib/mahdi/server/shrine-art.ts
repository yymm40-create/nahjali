// SERVER ONLY. The shrines' pictures: GPT Image 2 makes a draft from the researched description (config/mahdi-shrines),
// the owner looks at it in /admin/mahdi, and only an approved picture is shown to users.
import sharp from "sharp";
import { SHRINE_ART, SHRINE_STYLE } from "@config/mahdi-shrines";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { openaiImage } from "@/lib/jawad/server/providers/openai";
import { ProviderError } from "@/lib/jawad/server/providers/common";

import { storage } from "@/lib/storage";
export const SHRINE_BUCKET = "mahdi-shrines";
const MODEL = "gpt-image-2-2026-04-21";
const db = () => createAdminClient();
const publicUrl = (path: string) => storage.from(SHRINE_BUCKET).getPublicUrl(path).data.publicUrl;

/** Makes a draft picture (3:2, high quality) and returns its link for the owner to look at. */
export async function generateShrineDraft(id: string, description: string) {
  const { data: shrine } = await db().from("mahdi_shrines").select("id").eq("id", id).maybeSingle();
  if (!shrine) throw new UserError("ما لقينا هذا المكان.", 404);
  if (!process.env.OPENAI_API_KEY) throw new UserError("مفتاح OpenAI غير مضبوط على الخادم.", 503);
  try {
    const r = await openaiImage({ model: MODEL, prompt: `${SHRINE_STYLE}\n\n${description}`, aspect: "3:2", resolution: "hi", quality: "high", count: 1, references: [], user: "owner-shrines" });
    // The same size and format as the other pictures of the app
    const webp = await sharp(r.images[0]).resize(1600, 1067, { fit: "cover" }).webp({ quality: 86 }).toBuffer();
    const path = `drafts/${id}-${Date.now()}.webp`;
    const up = await storage.from(SHRINE_BUCKET).upload(path, webp, { contentType: "image/webp", upsert: false });
    if (up.error) throw new UserError("تعذّر حفظ الصورة؛ تأكد من تشغيل ملف قاعدة البيانات 0022.", 503);
    return { path, url: publicUrl(path), costUsd: r.costUsd };
  } catch (e) {
    if (e instanceof UserError) throw e;
    throw new UserError(e instanceof ProviderError ? e.userMessage : "تعذّر توليد الصورة الآن؛ جرّب مرة ثانية.", 502);
  }
}

/** Shows an approved draft: it becomes the shrine's picture and the shrine can be chosen. */
export async function approveShrine(id: string, path: string) {
  if (!new RegExp(`^drafts/${id.replace(/[^a-z0-9-]/g, "")}-\\d+\\.webp$`).test(path)) throw new UserError("صورة غير صحيحة.", 400);
  const final = `${id}-${Date.now()}.webp`;
  const copy = await storage.from(SHRINE_BUCKET).copy(path, final);
  if (copy.error) throw new UserError("تعذّر اعتماد الصورة.", 502);
  const art = SHRINE_ART[id];
  const { error } = await db()
    .from("mahdi_shrines")
    .update({
      image_url: publicUrl(final),
      image_alt: art?.alt ?? "",
      image_position: art?.position ?? "50% 55%",
      image_credit: "صورة فنية مولّدة بالذكاء الاصطناعي (GPT Image 2) واعتمدها صاحب الموقع",
      is_artwork: true,
      active: true,
    })
    .eq("id", id);
  if (error) throw error;
}
