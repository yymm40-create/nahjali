// «الجواد الذكي!» | JAWAD AI — is «المكتبة» (an add-on) open for this person? Server only. Kept apart from the library
// itself so that voices, uploads and jobs can ask without importing each other.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@config/site";
import { LIBRARY_ADDON } from "@config/coins";

const db = () => createAdminClient();
export const missing = (e: { code?: string; message?: string } | null) => Boolean(e && (e.code === "42P01" || e.code === "42703" || e.code === "PGRST204" || e.code === "PGRST205" || /jawad_library|library_until/.test(e.message ?? "")));

export interface LibraryAccess {
  active: boolean;
  /** Until when it is paid for (null: never, or the owner). */
  until: string | null;
  owner: boolean;
  /** The database file 0025 has been run. */
  migrated: boolean;
}

/** Is «المكتبة» open for this person? The owner always; others while their add-on runs. */
export async function libraryAccess(userId: string, owner: boolean): Promise<LibraryAccess> {
  const { data, error } = await db().from("smart_coin_wallets").select("library_until").eq("user_id", userId).maybeSingle();
  const migrated = !missing(error);
  const until = (data?.library_until as string | null | undefined) ?? null;
  return { active: owner || Boolean(until && new Date(until).getTime() > Date.now()), until, owner, migrated };
}

/** The same, from the user id alone (the owner is recognised by their account's email). */
export async function libraryOpenFor(userId: string) {
  const a = await libraryAccess(userId, false);
  if (a.active) return true;
  const { data } = await db().auth.admin.getUserById(userId);
  return isAdmin(data.user?.email);
}

export const LOCKED_MESSAGE = `«${LIBRARY_ADDON.name}» إضافة باشتراك ${LIBRARY_ADDON.monthlySar} ريال شهريًا: تحفظ فيها أصواتك وشخصياتك وأماكنك وتستخدمها متى ما تبي.`;

/** Throws when the library is closed for this person (or its tables aren't there yet). */
export async function requireLibrary(userId: string, owner: boolean) {
  const a = await libraryAccess(userId, owner);
  if (!a.migrated) throw new UserError("«المكتبة» قيد التجهيز (ملف قاعدة البيانات 0025).", 503);
  if (!a.active) throw new UserError(LOCKED_MESSAGE, 402);
  return a;
}


/** The library names of these uploads (those kept in «المكتبة»). */
export async function libraryNames(uploadIds: string[]) {
  if (!uploadIds.length) return [];
  const { data, error } = await db().from("jawad_library").select("name").in("upload_id", uploadIds);
  return missing(error) ? [] : (data ?? []).map((r) => r.name as string);
}

/** Is this upload kept in someone's library (so it is never deleted with a reference)? */
export async function inLibrary(uploadId: string) {
  const { data, error } = await db().from("jawad_library").select("id").eq("upload_id", uploadId).limit(1);
  return !missing(error) && Boolean(data?.length);
}
