import { NextResponse } from "next/server";
import sharp from "sharp";
import { RACE_LIMITS } from "@config/mahdi-race";
import { check, mahdiRoute, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { logEvent, raceById } from "@/lib/mahdi/server/race";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

/** A player's selfie, for the race's own people only. Kept in the race's row, so it goes when the race is deleted. */
export const GET = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { user } = await requireProfile(req);
  const db = createAdminClient();
  const race = await raceById(db, requireId((await params).id));
  const who = requireId(new URL(req.url).searchParams.get("u") ?? "");
  if (race.owner_id !== user.id) {
    const { data: m } = await db.from("mahdi_race_players").select("user_id").eq("race_id", race.id).eq("user_id", user.id).maybeSingle();
    if (!m) throw new UserError("ما انضممت لهذي المسابقة", 403);
  }
  const { data } = await db.from("mahdi_race_players").select("selfie").eq("race_id", race.id).eq("user_id", who).maybeSingle();
  if (!data?.selfie) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(Buffer.from(data.selfie as string, "base64")), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=3600" } });
});

/** Saves the player's own selfie: re-encoded small here, which also drops the photo's location and camera data. */
export const POST = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { user } = await requireProfile(req);
  const db = createAdminClient();
  const race = await raceById(db, requireId((await params).id));
  const { data: me } = await db.from("mahdi_race_players").select("selfie_v, name").eq("race_id", race.id).eq("user_id", user.id).maybeSingle();
  if (!me) throw new UserError("ما انضممت لهذي المسابقة", 403);
  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) throw new UserError("اختر صورة", 415);
  if (file.size > RACE_LIMITS.selfieBytes) throw new UserError("الصورة كبيرة", 413);
  let webp: Buffer;
  try {
    webp = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 }).rotate().resize(256, 256, { fit: "cover" }).webp({ quality: 78 }).toBuffer();
  } catch {
    throw new UserError("ما قدرنا نقرأ الصورة، جرب صورة ثانية", 415);
  }
  check(await db.from("mahdi_race_players").update({ selfie: webp.toString("base64"), selfie_v: (me.selfie_v as number) + 1 }).eq("race_id", race.id).eq("user_id", user.id));
  await logEvent(db, race.id, { id: user.id, name: me.name as string }, "selfie_taken", { version: (me.selfie_v as number) + 1 });
  return NextResponse.json({ ok: true });
});
