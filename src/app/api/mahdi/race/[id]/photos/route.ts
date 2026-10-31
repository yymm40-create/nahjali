import { NextResponse } from "next/server";
import sharp from "sharp";
import { RACE_LIMITS } from "@config/mahdi-race";
import { check, mahdiRoute, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { logEvent, raceById, requireMember } from "@/lib/mahdi/server/race";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

/** One souvenir photo, for the race's own people only. */
export const GET = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { user } = await requireProfile(req);
  const db = createAdminClient();
  const race = await raceById(db, requireId((await params).id));
  await requireMember(db, race, user.id);
  const { data } = await db.from("mahdi_race_photos").select("image").eq("race_id", race.id).eq("id", requireId(new URL(req.url).searchParams.get("p") ?? "")).maybeSingle();
  if (!data?.image) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(Buffer.from(data.image as string, "base64")), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=86400" } });
});

/** Adds a photo to the album: the leader only. Re-encoded here, which also drops its location and camera data. */
export const POST = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { user, profile } = await requireProfile(req);
  const db = createAdminClient();
  const race = await raceById(db, requireId((await params).id));
  if (race.owner_id !== user.id) throw new UserError("هذي للقائد فقط", 403);
  const { count } = await db.from("mahdi_race_photos").select("id", { count: "exact", head: true }).eq("race_id", race.id);
  if ((count ?? 0) >= RACE_LIMITS.photos) throw new UserError(`أقصى عدد ${RACE_LIMITS.photos} صورة`, 400);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) throw new UserError("اختر صورة", 415);
  if (file.size > RACE_LIMITS.photoBytes) throw new UserError("الصورة كبيرة", 413);
  const round = form?.get("round");
  let webp: Buffer;
  try {
    webp = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 60_000_000 }).rotate().resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
  } catch {
    throw new UserError("ما قدرنا نقرأ الصورة، جرب صورة ثانية", 415);
  }
  const row = check(await db.from("mahdi_race_photos").insert({ race_id: race.id, round_id: typeof round === "string" && round ? requireId(round) : null, image: webp.toString("base64") }).select("id").single()) as { id: string };
  await logEvent(db, race.id, { id: user.id, name: profile.displayName }, "photo_added", { photo: row.id, round: typeof round === "string" ? round : null });
  return NextResponse.json({ id: row.id });
});
