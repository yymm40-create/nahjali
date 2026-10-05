import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { MAHDI_LIMITS } from "@config/mahdi";
import { t } from "@/lib/mahdi/i18n";
import { check, mahdiRoute, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { AVATAR_BUCKET, profileFromRow, type ProfileRow } from "@/lib/mahdi/server/rows";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncPublicProfile } from "@/lib/mahdi/server/public";

export const runtime = "nodejs";

/**
 * Sets the profile picture: re-encoded on our server as a 256×256 WebP (which also drops the photo's
 * location and camera data) and saved under a new random name. The old picture is deleted.
 */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new UserError(t.more.avatarBadType, 400);
  if (file.size > MAHDI_LIMITS.avatarMaxBytes) throw new UserError(t.more.avatarTooBig, 413);
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new UserError(t.more.avatarBadType, 415);

  let webp: Buffer;
  try {
    webp = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(256, 256, { fit: "cover" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new UserError(t.more.avatarBadType, 415);
  }

  // Storage writes go through the service role; the path is always derived from the signed-in user
  const storage = createAdminClient().storage.from(AVATAR_BUCKET);
  const path = `${user.id}/${randomUUID()}.webp`;
  const { error } = await storage.upload(path, webp, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (error) throw error;

  const old = (await supabase.from("mahdi_profiles").select("avatar_path").eq("user_id", user.id).single()).data?.avatar_path;
  const row = check(await createAdminClient().from("mahdi_profiles").update({ avatar_path: path }).eq("user_id", user.id).select("*").single());
  if (old && old.startsWith(`${user.id}/`)) await storage.remove([old]);
  await syncPublicProfile(user.id);
  return NextResponse.json({ profile: profileFromRow(row as ProfileRow) });
});

/** Removes the profile picture. */
export const DELETE = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  const old = (await supabase.from("mahdi_profiles").select("avatar_path").eq("user_id", user.id).single()).data?.avatar_path;
  const row = check(await createAdminClient().from("mahdi_profiles").update({ avatar_path: null }).eq("user_id", user.id).select("*").single());
  if (old && old.startsWith(`${user.id}/`)) await createAdminClient().storage.from(AVATAR_BUCKET).remove([old]);
  await syncPublicProfile(user.id);
  return NextResponse.json({ profile: profileFromRow(row as ProfileRow) });
});
