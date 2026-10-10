// «زهراء فوتو ماستر» — who may open it, by the owner's switch (/admin/photo): "owner" (only the owner), "codes" (those holding
// the «photo» permission: named in an email, in a code, or by the all-opening «الكود السري»), "all" (everyone the site lets in).
// Server only.

import { requireApiUser, UserError } from "@/lib/api";
import { can, hasAnyAccess, unlimitedFor } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPublicOpen } from "@/lib/launch";
import { DEFAULT_PHOTO_VISIBILITY, PHOTO_KV, type PhotoVisibility } from "@config/photo";
import { isAdmin } from "@config/site";

const CLOSED = "«زهراء فوتو ماستر» مقفلة لحسابك حاليًا.";

export async function getVisibility(): Promise<PhotoVisibility> {
  const { data } = await createAdminClient().from("photo_kv").select("value").eq("key", PHOTO_KV.visibility).maybeSingle();
  const v = String(data?.value ?? "");
  if (v === "owner" || v === "codes" || v === "all") return v;
  // never set: open to everyone once the site is open (the launch switch), else the default
  return (await isPublicOpen().catch(() => false)) ? "all" : DEFAULT_PHOTO_VISIBILITY;
}

export async function setVisibility(v: PhotoVisibility) {
  if (v !== "owner" && v !== "codes" && v !== "all") throw new UserError("خيار غير صحيح.");
  const { error } = await createAdminClient().from("photo_kv").upsert({ key: PHOTO_KV.visibility, value: v, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** May this person open it now? (the owner always) */
export async function photoAllowed(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  if (isAdmin(email)) return true;
  const v = await getVisibility();
  if (v === "all") return hasAnyAccess(email);
  if (v === "codes") return can(email, "photo");
  return false;
}

export async function requirePhotoUser() {
  const user = await requireApiUser();
  if (!(await photoAllowed(user.email))) throw new UserError(CLOSED, 403);
  return { user, free: await unlimitedFor(user.email) };
}
