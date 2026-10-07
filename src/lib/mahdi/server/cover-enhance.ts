// SERVER ONLY. «حسّن الغلاف»: GPT Image 2 turns a phone photo of a book cover into a clean, straight cover while
// keeping everything printed on it. Coins are held before the call and given back if it fails.
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { User } from "@supabase/supabase-js";
import { COVER_ENHANCE } from "@config/mahdi";
import { isUnlimited } from "@config/site";
import { coinsRequired, refundCoins, reserveCoins } from "@/lib/coins";
import { openaiImage } from "@/lib/jawad/server/providers/openai";
import { ProviderError } from "@/lib/jawad/server/providers/common";
import { createAdminClient } from "@/lib/supabase/admin";
import { t } from "../i18n";
import { UserError } from "./api";
import { missingTable } from "./inbox";

const E = t.reading.enhance;
const KIND = "cover_enhance";
const LABEL = "لأجل المهدي · تحسين غلاف كتاب";
const MAX_BYTES = 8 * 1024 * 1024;

/** Written in English (the model follows it best); "Image 1" is the photo, as OpenAI's prompting guide recommends. */
const PROMPT = `Image 1 is a phone photo of the front cover of a real, printed book.
Produce a clean, flat, straight-on image of exactly this cover, as if it had been scanned:
- Crop to the cover's edges and let the cover fill the whole frame. Remove the background, hands, fingers and anything that is not the cover.
- Correct the perspective, rotation and any bending, so the cover is a flat rectangle.
- Remove glare, reflections and shadows; even out the lighting and the white balance; make it sharp.
Keep everything that is printed on the cover exactly as it is: every letter of the title, the author's name and all other text, in the same language, spelling, font, size, color and position; the same artwork, ornaments, logos, colors and layout.
Do not add, remove, translate, retouch the design of, restyle or invent anything. If part of the cover is hidden or cut off in the photo, leave that part plain instead of making it up.`;

/** What one enhancement costs this person now (0 for the owner, or while coins are switched off). */
export async function enhancePrice(user: Pick<User, "email">) {
  return isUnlimited(user.email) || !(await coinsRequired()) ? 0 : COVER_ENHANCE.coins;
}

export async function enhanceCover(user: User, photo: unknown): Promise<{ image: string; coins: number }> {
  if (!(photo instanceof File) || photo.size === 0) throw new UserError(t.reading.coverBadType, 400);
  if (photo.size > MAX_BYTES) throw new UserError(t.reading.coverTooBig, 413);
  if (!process.env.OPENAI_API_KEY) throw new UserError(E.unavailable, 503);
  const db = createAdminClient();

  // At most a few a day per person
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const used = await db.from("mahdi_ai_uses").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("kind", KIND).gte("created_at", since);
  if (used.error) throw new UserError(missingTable(used.error) ? E.unavailable : t.errors.generic, 503);
  if ((used.count ?? 0) >= COVER_ENHANCE.perDay) throw new UserError(E.tooMany, 429);

  // The photo as a PNG the API accepts (turned upright, at most 2048 px, no camera or location data)
  let png: Buffer;
  try {
    png = await sharp(Buffer.from(await photo.arrayBuffer()), { limitInputPixels: 50_000_000 }).rotate().resize(2048, 2048, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  } catch {
    throw new UserError(t.reading.coverBadType, 415);
  }

  const coins = await enhancePrice(user);
  const ref = `mahdi-cover:${randomUUID()}`;
  if (coins) {
    try {
      await reserveCoins(user, ref, COVER_ENHANCE.costUsd, LABEL);
    } catch (e) {
      if (e instanceof UserError && e.status === 402) throw new UserError(E.noCoins(coins), 402);
      throw e;
    }
  }
  const { data: use } = await db.from("mahdi_ai_uses").insert({ user_id: user.id, kind: KIND }).select("id").single();
  // Counted again after saving: several requests sent at the same moment can't all pass the daily limit
  const again = await db.from("mahdi_ai_uses").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("kind", KIND).gte("created_at", since);
  if ((again.count ?? 0) > COVER_ENHANCE.perDay) {
    if (use) await db.from("mahdi_ai_uses").delete().eq("id", use.id);
    if (coins) await refundCoins(ref).catch((e) => console.error("[mahdi] cover refund", ref, e));
    throw new UserError(E.tooMany, 429);
  }

  try {
    const r = await openaiImage({
      model: COVER_ENHANCE.model,
      prompt: PROMPT,
      aspect: "2:3",
      resolution: "std",
      quality: COVER_ENHANCE.quality,
      count: 1,
      references: [{ bytes: png, mime: "image/png" }],
      user: user.id,
    });
    const webp = await sharp(r.images[0]).resize(720, 1080, { fit: "inside", withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
    if (use) await db.from("mahdi_ai_uses").update({ ok: true, cost_usd: r.costUsd }).eq("id", use.id);
    return { image: `data:image/webp;base64,${webp.toString("base64")}`, coins };
  } catch (err) {
    console.error("[mahdi] cover enhance", user.id, err instanceof ProviderError ? err.detail : err);
    if (coins) await refundCoins(ref).catch((e) => console.error("[mahdi] cover refund", ref, e));
    throw new UserError(E.failed(coins), 502);
  }
}
