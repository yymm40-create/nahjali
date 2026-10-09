// «المصمم الذكي» — who may use it, by the owner's switch (/admin/designer): "owner" (only the owner), "codes" (those
// holding the «designer» permission: named in an email, in a code, or by the all-opening «الكود السري»), "all"
// (everyone the site lets in). Server only.

import { requireApiUser, UserError } from "@/lib/api";
import { can, hasAnyAccess } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_DESIGNER_VISIBILITY, DESIGNER_KV, type DesignerVisibility } from "@config/designer";
import { isAdmin } from "@config/site";

const CLOSED = "«المصمم الذكي» مقفل لحسابك حاليًا.";

export async function getVisibility(): Promise<DesignerVisibility> {
  const { data } = await createAdminClient().from("designer_kv").select("value").eq("key", DESIGNER_KV.visibility).maybeSingle();
  const v = String(data?.value ?? "");
  return v === "owner" || v === "codes" || v === "all" ? v : DEFAULT_DESIGNER_VISIBILITY;
}

export async function setVisibility(v: DesignerVisibility) {
  if (v !== "owner" && v !== "codes" && v !== "all") throw new UserError("خيار غير صحيح.");
  const { error } = await createAdminClient().from("designer_kv").upsert({ key: DESIGNER_KV.visibility, value: v, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** May this person open it now? (the owner always) */
export async function designerAllowed(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  if (isAdmin(email)) return true;
  const v = await getVisibility();
  if (v === "all") return hasAnyAccess(email);
  if (v === "codes") return can(email, "designer");
  return false;
}

export async function requireDesignerUser() {
  const user = await requireApiUser();
  if (!(await designerAllowed(user.email))) throw new UserError(CLOSED, 403);
  return { user };
}
