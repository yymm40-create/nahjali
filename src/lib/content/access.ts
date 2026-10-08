// «صانع المحتوى» — who may use it, by the owner's switch (/admin/content): "owner" (only the owner), "codes" (those
// holding the «content» permission: named in an email, in a code, or by the all-opening «الكود السري» — the default),
// "all" (everyone the site lets in). Server only.

import { requireApiUser, UserError } from "@/lib/api";
import { can, hasAnyAccess } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONTENT_KV, DEFAULT_CONTENT_VISIBILITY, type ContentVisibility } from "@config/content";
import { isAdmin } from "@config/site";

const CLOSED = "«صانع المحتوى» مقفل لحسابك حاليًا.";

export async function getVisibility(): Promise<ContentVisibility> {
  const { data } = await createAdminClient().from("content_kv").select("value").eq("key", CONTENT_KV.visibility).maybeSingle();
  const v = String(data?.value ?? "");
  return v === "owner" || v === "codes" || v === "all" ? v : DEFAULT_CONTENT_VISIBILITY;
}

export async function setVisibility(v: ContentVisibility) {
  if (v !== "owner" && v !== "codes" && v !== "all") throw new UserError("خيار غير صحيح.");
  const { error } = await createAdminClient().from("content_kv").upsert({ key: CONTENT_KV.visibility, value: v, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** May this person open it now? (the owner always) */
export async function contentAllowed(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  if (isAdmin(email)) return true;
  const v = await getVisibility();
  if (v === "all") return hasAnyAccess(email);
  if (v === "codes") return can(email, "content");
  return false;
}

export async function requireContentUser() {
  const user = await requireApiUser();
  if (!(await contentAllowed(user.email))) throw new UserError(CLOSED, 403);
  return { user };
}
