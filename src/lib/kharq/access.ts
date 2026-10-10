// «محمد الخارق» — who may open it, by the owner's switch (/admin/kharq): "owner" (only the owner), "codes" (those
// holding the «kharq» permission: named in an email or in a code), "all" (everyone the site lets in). Server only.

import { requireApiUser, UserError } from "@/lib/api";
import { can, hasAnyAccess } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPublicOpen } from "@/lib/launch";
import { KHARQ, KHARQ_KV, type KharqVisibility } from "@config/kharq";
import { isAdmin } from "@config/site";

const CLOSED = `«${KHARQ.name}» مقفل لحسابك حاليًا.`;

export async function getVisibility(): Promise<KharqVisibility> {
  const { data } = await createAdminClient().from("kharq_kv").select("value").eq("key", KHARQ_KV.visibility).maybeSingle();
  const v = String(data?.value ?? "");
  if (v === "owner" || v === "codes" || v === "all") return v;
  // never set: open to everyone once the site is open (the launch switch), else the owner only
  return (await isPublicOpen().catch(() => false)) ? "all" : "owner";
}

export async function setVisibility(v: KharqVisibility) {
  if (v !== "owner" && v !== "codes" && v !== "all") throw new UserError("خيار غير صحيح.");
  const { error } = await createAdminClient().from("kharq_kv").upsert({ key: KHARQ_KV.visibility, value: v, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** May this person open it now? (the owner always) */
export async function kharqAllowed(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  if (isAdmin(email)) return true;
  const v = await getVisibility();
  if (v === "all") return hasAnyAccess(email);
  if (v === "codes") return can(email, "kharq");
  return false;
}

export async function requireKharqUser() {
  const user = await requireApiUser();
  if (!(await kharqAllowed(user.email))) throw new UserError(CLOSED, 403);
  return { user };
}
