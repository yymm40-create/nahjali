// «صانع الألعاب الذكي» — who may use it: the owner always; anyone else only while the owner has the section switched on
// (/jawad-ai/admin/sections) AND they hold the «games» permission. Server only.

import { UserError } from "@/lib/api";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { requirePermApiUser } from "@/lib/jawad/server/access";
import { isAdmin } from "@config/site";

const CLOSED = "«صانع الألعاب الذكي» مقفل لحسابك حاليًا.";

export async function requireGamesUser() {
  const { user } = await requirePermApiUser("games", CLOSED);
  if (!isAdmin(user.email)) {
    const on = (await loadRuntime()).sections.find((s) => s.implementation === "games")?.enabled;
    if (!on) throw new UserError(CLOSED, 403);
  }
  return { user };
}
