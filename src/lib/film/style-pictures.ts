// «الستايل» — the pictures of the library's styles: the course guide's 24 ship with the site (public/film/styles); the
// others are drawn ONCE by GPT Image 2 from /admin/film (the owner presses a button), made small (640×360 jpg) and kept
// in the public bucket, so every gallery — the studios, the film's style test, the content maker — shows the same
// picture to everyone. Until a style has one, the galleries show a tile in its family's colours. Server only.

import sharp from "sharp";
import { UserError } from "@/lib/api";
import { openaiImage } from "@/lib/jawad/server/providers/openai";
import { ProviderError, providerUserId } from "@/lib/jawad/server/providers/common";
import { JAWAD_PUBLIC_BUCKET, publicUrl } from "@/lib/jawad/server/runtime";
import { storage } from "@/lib/storage";
import { gptImage2OutputTokens } from "@config/jawad/generators";
import { FILM_STYLES, findStyle, GUIDE_STYLE_IDS, styleImage, stylePicturePrompt } from "@config/film-styles";

export const STYLE_PICTURE_DIR = "film-styles";
const MODEL = "gpt-image-2-2026-04-21";
const QUALITY = "medium" as const;
const path = (id: string) => `${STYLE_PICTURE_DIR}/${id}.jpg`;

/** About what one picture costs (a 1536×864 picture at medium quality), in dollars. */
export const STYLE_PICTURE_USD = (gptImage2OutputTokens(1536, 864, QUALITY) * 30) / 1e6;

let cache: { at: number; map: Record<string, string> } | null = null;

/** Every style's picture that exists — the shipped ones and the drawn ones — by style id (kept a minute). */
export async function stylePictures(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < 60_000) return cache.map;
  const map: Record<string, string> = {};
  for (const s of FILM_STYLES) {
    const shipped = styleImage(s.id);
    if (shipped) map[s.id] = shipped;
  }
  const { data } = await storage.from(JAWAD_PUBLIC_BUCKET).list(STYLE_PICTURE_DIR, { limit: 500 });
  for (const f of data ?? []) {
    const id = f.name.replace(/\.jpg$/, "");
    if (f.name.endsWith(".jpg") && findStyle(id) && !GUIDE_STYLE_IDS.has(id)) map[id] = `${publicUrl(path(id))}?v=${new Date(f.updated_at ?? 0).getTime() || 1}`;
  }
  cache = { at: Date.now(), map };
  return map;
}

/** The same, never failing: the shipped pictures alone when the bucket can't be read. */
export async function stylePicturesSafe(): Promise<Record<string, string>> {
  return stylePictures().catch(() => Object.fromEntries(FILM_STYLES.flatMap((s) => (styleImage(s.id) ? [[s.id, styleImage(s.id)!]] : []))));
}

/** Draws and keeps the picture of one new style (drawn again if it already has one). The guide's 24 keep theirs. */
export async function makeStylePicture(id: string): Promise<{ id: string; usd: number }> {
  const s = findStyle(id);
  if (!s) throw new UserError("ستايل غير معروف.", 400);
  if (GUIDE_STYLE_IDS.has(id)) throw new UserError("صورة هذا الستايل من الدليل نفسه.", 400);
  if (!process.env.OPENAI_API_KEY) throw new UserError("صناعة الصور غير مفعّلة على الخادم.", 503);
  let png: Buffer;
  let usd = 0;
  try {
    const r = await openaiImage({ model: MODEL, prompt: stylePicturePrompt(id), aspect: "16:9", resolution: "std", quality: QUALITY, count: 1, references: [], user: providerUserId("film-styles"), timeoutMs: 150_000 });
    usd = r.costUsd ?? STYLE_PICTURE_USD;
    png = r.images[0];
  } catch (e) {
    throw new UserError(e instanceof ProviderError ? e.userMessage : "تعذّر رسم صورة الستايل.", 502);
  }
  const jpg = await sharp(png).resize({ width: 640, height: 360, fit: "cover" }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  const up = await storage.from(JAWAD_PUBLIC_BUCKET).upload(path(id), jpg, { contentType: "image/jpeg", upsert: true, cacheControl: "public, max-age=86400" });
  if (up.error) throw new UserError("ما قدرنا نحفظ صورة الستايل.", 500);
  cache = null;
  return { id, usd: Math.round(usd * 10000) / 10000 };
}
