// «الجواد الذكي!» | JAWAD AI — who is signed in and whether they may use the platform. Server only.
// Reuses the site's Supabase sign-in; who may enter is set on /admin/limits (section "✨ JAWAD AI", closed by default:
// the owner only, everyone else sees «قيد التطوير»).

import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, UserError } from "@/lib/api";
import { accessMode, emailAccess, limitRows } from "@/lib/film/limits";
import { isAdmin } from "@config/site";
import { JAWAD } from "@config/jawad/brand";

export const JAWAD_MESSAGES = {
  closed: "منصة JAWAD AI قيد التطوير حاليًا.",
  notFound: "ما لقينا هذا العمل.",
} as const;

/** The signed-in user (or null), once per request. */
export const jawadSession = cache(async (): Promise<{ user: User | null; owner: boolean }> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user, owner: isAdmin(user?.email) };
});

/** May this person use JAWAD AI? The owner always may. */
export async function canUseJawad(user: { email?: string | null } | null) {
  if (!user?.email) return false;
  if (isAdmin(user.email)) return true;
  const rows = await limitRows();
  const own = await emailAccess("jawad", user.email, rows);
  if (own !== undefined) return own;
  return (await accessMode("jawad", rows)) === "open";
}

/** Should this visitor see the platform (rather than «قيد التطوير»)? Signed-out visitors see it only when it's open to all. */
export async function jawadVisibleTo(user: { email?: string | null } | null) {
  return user?.email ? canUseJawad(user) : (await accessMode("jawad")) === "open";
}

/** Where to sign in without leaving JAWAD AI, coming back to `next` afterwards. */
export const jawadLogin = (next: string) => `${JAWAD.base}/login?next=${encodeURIComponent(next)}`;

/** Pages: the signed-in user, or a redirect to JAWAD AI's own sign-in page. */
export async function requireJawadUser(next: string) {
  const { user, owner } = await jawadSession();
  if (!user) redirect(jawadLogin(next));
  return { user, owner, allowed: await canUseJawad(user) };
}

/** API: the signed-in user allowed to use JAWAD AI, else 401/403. */
export async function requireJawadApiUser() {
  const user = await requireApiUser();
  if (!(await canUseJawad(user))) throw new UserError(JAWAD_MESSAGES.closed, 403);
  return { user, owner: isAdmin(user.email) };
}

/** API: the owner only (404 for everyone else, like the rest of the dashboard). */
export async function requireJawadOwner() {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  return user;
}
