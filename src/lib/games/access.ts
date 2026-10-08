// «صانع الألعاب الذكي» — who may use it, by the owner's switch (/admin/games): "owner" (only the owner), "codes" (those
// holding the «games» permission: named in an email or in a code), "all" (everyone the site lets in). Server only.

import { UserError } from "@/lib/api";
import { requireApiUser } from "@/lib/api";
import { can, hasAnyAccess } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { GAMES_KV, type GamesVisibility } from "@config/games";
import { isAdmin } from "@config/site";

const CLOSED = "«صانع الألعاب الذكي» مقفل لحسابك حاليًا.";

export async function getVisibility(): Promise<GamesVisibility> {
  const { data } = await createAdminClient().from("games_kv").select("value").eq("key", GAMES_KV.visibility).maybeSingle();
  const v = String(data?.value ?? "");
  return v === "codes" || v === "all" ? v : "owner";
}

export async function setVisibility(v: GamesVisibility) {
  if (v !== "owner" && v !== "codes" && v !== "all") throw new UserError("خيار غير صحيح.");
  const { error } = await createAdminClient().from("games_kv").upsert({ key: GAMES_KV.visibility, value: v, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** May this person open it now? (the owner always) */
export async function gamesAllowed(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  if (isAdmin(email)) return true;
  const v = await getVisibility();
  if (v === "all") return hasAnyAccess(email);
  if (v === "codes") return can(email, "games");
  return false;
}

export async function requireGamesUser() {
  const user = await requireApiUser();
  if (!(await gamesAllowed(user.email))) throw new UserError(CLOSED, 403);
  return { user };
}
