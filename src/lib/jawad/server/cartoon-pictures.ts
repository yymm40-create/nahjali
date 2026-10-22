// «حولني الى الستايل الكرتوني» — the picture of each look. The owner draws them ONCE from /admin/film (a button; nothing
// is drawn by itself), GPT Image 2 makes a friendly made-up character (never a real person) in that look's world, small
// (640×360 jpg), kept in the public bucket so everyone sees the same one. A look without a picture shows its tile.
// Server only.

import sharp from "sharp";
import { UserError } from "@/lib/api";
import { openaiImage } from "@/lib/jawad/server/providers/openai";
import { ProviderError, providerUserId } from "@/lib/jawad/server/providers/common";
import { JAWAD_PUBLIC_BUCKET, publicUrl } from "@/lib/jawad/server/runtime";
import { storage } from "@/lib/storage";
import { gptImage2OutputTokens } from "@config/jawad/generators";
import { FILM_STYLES, styleImage } from "@config/film-styles";
import { CARTOON_PICTURE_DIR, CARTOON_PLACES, CARTOON_STYLES, cartoonPlacePath, cartoonPlaceSheetPrompt, cartoonStylePicturePrompt } from "@config/jawad/cartoon";

const MODEL = "gpt-image-2-2026-04-21";
const QUALITY = "medium" as const;
const path = (id: string) => `${CARTOON_PICTURE_DIR}/${id}.jpg`;

/** About what one picture costs (a 1536×864 picture at medium quality), in dollars. */
export const CARTOON_PICTURE_USD = (gptImage2OutputTokens(1536, 864, QUALITY) * 30) / 1e6;

let cache: { at: number; map: Record<string, string> } | null = null;

/** The looks' pictures that exist, by look id (kept a minute). Never fails: no pictures when the bucket can't be read. */
export async function cartoonPictures(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < 60_000) return cache.map;
  // the looks the library's guide already pictures (the guide's own pictures ship with the site) show those until one is drawn here
  const map: Record<string, string> = {};
  for (const s of FILM_STYLES) {
    const shipped = s.cartoon ? styleImage(s.id) : null;
    if (s.cartoon && shipped) map[s.cartoon] = shipped;
  }
  try {
    const { data } = await storage.from(JAWAD_PUBLIC_BUCKET).list(CARTOON_PICTURE_DIR, { limit: 200 });
    for (const f of data ?? []) {
      const id = f.name.replace(/\.jpg$/, "");
      if (f.name.endsWith(".jpg") && CARTOON_STYLES.some((s) => s.id === id)) map[id] = `${publicUrl(path(id))}?v=${new Date(f.updated_at ?? 0).getTime() || 1}`;
    }
  } catch {
    return map;
  }
  cache = { at: Date.now(), map };
  return map;
}

/** Draws and keeps the picture of one look (drawn again if it has one). */
export async function makeCartoonPicture(id: string): Promise<{ id: string; usd: number }> {
  if (!CARTOON_STYLES.some((s) => s.id === id)) throw new UserError("ستايل غير معروف.", 400);
  if (!process.env.OPENAI_API_KEY) throw new UserError("صناعة الصور غير مفعّلة على الخادم.", 503);
  let png: Buffer;
  let usd = 0;
  try {
    const r = await openaiImage({ model: MODEL, prompt: cartoonStylePicturePrompt(id), aspect: "16:9", resolution: "std", quality: QUALITY, count: 1, references: [], user: providerUserId("cartoon-styles"), timeoutMs: 150_000 });
    usd = r.costUsd ?? CARTOON_PICTURE_USD;
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

// ── the places' environment sheets: one per place and look, drawn by the owner from /admin/film, kept for everyone ──

let places: { at: number; map: Record<string, string> } | null = null;

/** The environment sheets that exist, by «place--look» (kept a minute). Never fails. */
export async function placeSheets(): Promise<Record<string, string>> {
  if (places && Date.now() - places.at < 60_000) return places.map;
  const map: Record<string, string> = {};
  try {
    const { data } = await storage.from(JAWAD_PUBLIC_BUCKET).list(`${CARTOON_PICTURE_DIR}/places`, { limit: 500 });
    for (const f of data ?? []) {
      const [place, style] = f.name.replace(/\.jpg$/, "").split("--");
      if (f.name.endsWith(".jpg") && Object.hasOwn(CARTOON_PLACES, place) && CARTOON_STYLES.some((s) => s.id === style)) map[`${place}--${style}`] = `${publicUrl(cartoonPlacePath(place, style))}?v=${new Date(f.updated_at ?? 0).getTime() || 1}`;
    }
  } catch {
    return map;
  }
  places = { at: Date.now(), map };
  return map;
}

/** The bytes of one environment sheet, or null when it is not drawn yet (the film then works from the description). */
export async function placeSheetBytes(place: string, style: string): Promise<Uint8Array | null> {
  try {
    const { data, error } = await storage.from(JAWAD_PUBLIC_BUCKET).download(cartoonPlacePath(place, style));
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  } catch {
    return null;
  }
}

/** Draws and keeps one place's environment sheet in one look (drawn again if it has one). */
export async function makePlaceSheet(place: string, style: string): Promise<{ id: string; usd: number }> {
  let prompt: string;
  try {
    prompt = cartoonPlaceSheetPrompt(place, style);
  } catch {
    throw new UserError("مكان أو ستايل غير معروف.", 400);
  }
  if (!process.env.OPENAI_API_KEY) throw new UserError("صناعة الصور غير مفعّلة على الخادم.", 503);
  let png: Buffer;
  let usd = 0;
  try {
    const r = await openaiImage({ model: MODEL, prompt, aspect: "16:9", resolution: "std", quality: QUALITY, count: 1, references: [], user: providerUserId("cartoon-places"), timeoutMs: 150_000 });
    usd = r.costUsd ?? CARTOON_PICTURE_USD;
    png = r.images[0];
  } catch (e) {
    throw new UserError(e instanceof ProviderError ? e.userMessage : "تعذّر رسم شيت البيئة.", 502);
  }
  // kept at full size: the film reads its details
  const jpg = await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  const up = await storage.from(JAWAD_PUBLIC_BUCKET).upload(cartoonPlacePath(place, style), jpg, { contentType: "image/jpeg", upsert: true, cacheControl: "public, max-age=86400" });
  if (up.error) throw new UserError("ما قدرنا نحفظ شيت البيئة.", 500);
  places = null;
  return { id: `${place}--${style}`, usd: Math.round(usd * 10000) / 10000 };
}
