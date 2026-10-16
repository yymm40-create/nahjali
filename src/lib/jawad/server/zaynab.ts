// «في حضرة السيدة زينب (ع)» — the server's part: the owner's photograph of the shrine (kept once, sent with every
// generation as the first reference), and the price of a request. Server only.

import sharp from "sharp";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import { generatorById } from "@config/jawad/generators";
import { ZAYNAB_HARAM_PATH, ZAYNAB_IMAGE, zaynabPrompt, type ZaynabInput } from "@config/jawad/zaynab";
import type { RefMeta } from "@config/jawad/types";
import { evaluate } from "../engine";
import { JAWAD_BUCKET, JAWAD_PUBLIC_BUCKET, loadRuntime, publicUrl } from "./runtime";
import { isUuid } from "./uploads";

let cache: { at: number; url: string | null } | null = null;

/** The shrine photograph's public address (with its version), or null while the owner has not put one. */
export async function haramUrl(): Promise<string | null> {
  if (cache && Date.now() - cache.at < 30_000) return cache.url;
  let url: string | null = null;
  try {
    const dir = ZAYNAB_HARAM_PATH.split("/")[0];
    const file = ZAYNAB_HARAM_PATH.split("/")[1];
    const { data } = await storage.from(JAWAD_PUBLIC_BUCKET).list(dir, { limit: 20 });
    const f = (data ?? []).find((x) => x.name === file);
    if (f) url = `${publicUrl(ZAYNAB_HARAM_PATH)}?v=${new Date(f.updated_at ?? 0).getTime() || 1}`;
  } catch {
    return null;
  }
  cache = { at: Date.now(), url };
  return url;
}

/** The shrine photograph's bytes (what every generation is sent). */
export async function haramBytes(): Promise<Uint8Array> {
  const { data, error } = await storage.from(JAWAD_PUBLIC_BUCKET).download(ZAYNAB_HARAM_PATH);
  if (error || !data) throw new UserError("صورة الحضرة لم تُرفع بعد؛ صاحب المنصة يضيفها أول.", 503);
  return new Uint8Array(await data.arrayBuffer());
}

/** The owner's: an image he uploaded becomes the shrine photograph (long side ≤ 2048, JPEG), replacing the old one. */
export async function setHaram(ownerId: string, uploadId: unknown) {
  if (!isUuid(uploadId)) throw new UserError("ملف غير صحيح.", 400);
  const { data: row } = await createAdminClient().from("jawad_uploads").select("storage_path,kind,status").eq("id", uploadId).eq("user_id", ownerId).maybeSingle();
  if (!row || row.kind !== "image" || row.status !== "ready") throw new UserError("اختر صورة جاهزة للحضرة (PNG أو JPG أو WEBP).", 400);
  const dl = await storage.from(JAWAD_BUCKET).download(row.storage_path);
  if (dl.error || !dl.data) throw new UserError("ما قدرنا نقرأ الصورة؛ جرّب مرة ثانية.", 502);
  const jpg = await sharp(Buffer.from(await dl.data.arrayBuffer())).rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  const up = await storage.from(JAWAD_PUBLIC_BUCKET).upload(ZAYNAB_HARAM_PATH, jpg, { contentType: "image/jpeg", upsert: true, cacheControl: "public, max-age=3600" });
  if (up.error) throw new UserError("ما قدرنا نحفظ صورة الحضرة.", 500);
  cache = null;
}

/** What a request costs: GPT Image 2 at the studio's price, for the picture count asked (the people's photos + the shrine). */
export async function zaynabQuote(input: ZaynabInput, photos: number) {
  const rt = await loadRuntime();
  const image = rt.generators.find((g) => g.id === ZAYNAB_IMAGE);
  const refs: RefMeta[] = Array.from({ length: photos + 1 }, (_, i) => ({ id: `q${i}`, kind: "image", role: "reference", mime: "image/jpeg", bytes: 1, name: `image${i + 1}`, status: "ready" }));
  const result = evaluate(generatorById(ZAYNAB_IMAGE)!, {
    settings: { aspect: input.aspect, resolution: "std", quality: "medium", count: input.count },
    prompt: zaynabPrompt(input, photos), instructions: "", refStyle: "references", refs, strict: true,
  }, rt.prices[ZAYNAB_IMAGE]);
  if (!result.price.ok || result.issues.length) throw new UserError(result.issues[0]?.message ?? "تعذّر تسعير الصورة؛ جرّب لاحقًا.", 503);
  return { coins: result.price.coins, section: image?.sectionId ?? "images" };
}
