// «الجواد الذكي!» | JAWAD AI — who is signed in and whether they may use the platform. Server only.
// Reuses the site's Supabase sign-in; who may enter is the dashboard's one list (/admin/limits → «السماح»): everyone
// else sees «قيد التطوير».

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, UserError } from "@/lib/api";
import { can, hasAnyAccess, unlimitedFor, type Perm } from "@/lib/access";
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

/** May this person use any part of JAWAD AI? (each section checks its own permission too: see src/lib/access.ts) */
export async function canUseJawad(user: { email?: string | null } | null) {
  return hasAnyAccess(user?.email);
}

/** Makes for free («بلا حدود»): the owners, the all-opening code, an e-mail or a code the owner marked so. */
export const freeFor = (user: { email?: string | null } | null) => unlimitedFor(user?.email);

/** Should this visitor see the platform (rather than «قيد التطوير»)? Only those the dashboard's list lets in. */
export const jawadVisibleTo = async (user: { email?: string | null } | null) => hasAnyAccess(user?.email);

/** Where to sign in without leaving JAWAD AI, coming back to `next` afterwards. */
export const jawadLogin = (next: string) => `${JAWAD.base}/login?next=${encodeURIComponent(next)}`;

/** Pages: the signed-in user, or a redirect to JAWAD AI's own sign-in page. */
export async function requireJawadUser(next: string) {
  const { user, owner } = await jawadSession();
  if (!user) redirect(jawadLogin(next));
  return { user, owner, allowed: await canUseJawad(user) };
}

/**
 * Dashboard pages: the owner, else sign-in (signed out) or 404. Every dashboard page calls it itself: a page renders
 * alongside its layout, so the layout's check alone would still let the page's content into the response.
 */
export async function requireJawadOwnerPage(next: string) {
  const { user, owner } = await requireJawadUser(next);
  if (!owner) notFound();
  return user;
}

/** API: the signed-in user allowed to use JAWAD AI, else 401/403. `owner`: makes for free (the owners and the unlimited). */
export async function requireJawadApiUser() {
  const user = await requireApiUser();
  if (!(await canUseJawad(user))) throw new UserError(JAWAD_MESSAGES.closed, 403);
  return { user, owner: await unlimitedFor(user.email) };
}

/** API for one section: the signed-in user it is open to (the dashboard's list), else 401/403. */
export async function requirePermApiUser(perm: Perm, closed: string = JAWAD_MESSAGES.closed) {
  const user = await requireApiUser();
  if (!(await can(user.email, perm))) throw new UserError(closed, 403);
  return { user, owner: await unlimitedFor(user.email) };
}

/** API for «الطالب الذكي» (with the images and voices it makes). */
export const requireStudentApiUser = () => requirePermApiUser("student", "«الطالب الذكي» مقفل لحسابك حاليًا.");

/** API for «حيدرة كت». */
export const requireEditorApiUser = () => requirePermApiUser("editor", "«حيدرة كت» مقفل لحسابك حاليًا.");

/** API: the owner only (404 for everyone else, like the rest of the dashboard). */
export async function requireJawadOwner() {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  return user;
}
