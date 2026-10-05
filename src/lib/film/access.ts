import { notFound } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { requireApiUser, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin, isFreeGuest } from "@config/site";
import { FILM_PUBLIC_TRIAL } from "@config/film";
import { accessMode, emailAccess, getLimit } from "./limits";
import type { FilmProject } from "./types";

export const FILM_MESSAGES = {
  noAccess: "صانع الفيلم مقفل حاليًا.",
  notFound: "ما لقينا هذا المشروع.",
} as const;

type Who = { id: string; email?: string | null };

let ownerIds: Promise<Set<string>> | null = null;
/** User IDs of the owner's accounts (looked up once per server instance). */
function getOwnerIds() {
  ownerIds ??= (async () => {
    const out = new Set<string>();
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await createAdminClient().auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      for (const u of data.users) if (isAdmin(u.email)) out.add(u.id);
      if (data.users.length < 1000) break;
    }
    return out;
  })().catch((e) => {
    ownerIds = null;
    throw e;
  });
  return ownerIds;
}

/** The trial's users: the first `users` people (owner excluded) to start a film project since the trial began, in order. */
export async function filmTrialUsers() {
  const owners = await getOwnerIds();
  const { data } = await createAdminClient()
    .from("film_projects")
    .select("user_id,created_at")
    .gte("created_at", FILM_PUBLIC_TRIAL.since)
    .order("created_at", { ascending: true })
    .limit(500);
  const ids: string[] = [];
  for (const r of (data ?? []) as { user_id: string }[]) {
    if (!owners.has(r.user_id) && !ids.includes(r.user_id)) ids.push(r.user_id);
  }
  return ids.slice(0, await getLimit("trial_users"));
}

/**
 * A trial user's videos: `made` once one has finished (their trial is then over), `taken` also counts one
 * being generated now (so they can't start a second).
 */
export async function filmTrialVideos(userId: string) {
  const db = createAdminClient();
  const { data: projects } = await db.from("film_projects").select("id").eq("user_id", userId).gte("created_at", FILM_PUBLIC_TRIAL.since);
  const ids = (projects ?? []).map((p) => p.id as string);
  if (!ids.length) return { made: 0, taken: 0 };
  const { data } = await db.from("film_assets").select("status").eq("kind", "video").in("project_id", ids);
  const rows = (data ?? []) as { status: string }[];
  return {
    made: rows.filter((r) => ["generated", "approved", "rejected"].includes(r.status)).length,
    taken: rows.filter((r) => r.status !== "failed").length,
  };
}

/** Why a signed-in user can't use the film maker during the trial: their own trial is done, or all places are taken. */
export async function filmTrialState(user: Who): Promise<"open" | "done" | "full"> {
  if (isAdmin(user.email)) return "open";
  const users = await filmTrialUsers();
  if (users.includes(user.id)) return (await filmTrialVideos(user.id)).made >= (await getLimit("videos", user.email)) ? "done" : "open";
  return users.length < (await getLimit("trial_users")) ? "open" : "full";
}

/**
 * The owner always has access. During the public trial, the first few users (one full film each, until
 * their first video is made); afterwards only the owner. Otherwise only the invite list (/admin/film).
 */
export async function canUseFilm(user: Who) {
  if (!user.email) return false;
  if (isAdmin(user.email) || isFreeGuest(user.email)) return true;
  // The owner's choices on /admin/limits: a decision for this email first, then the mode for everyone
  const own = await emailAccess("film", user.email);
  if (own !== undefined) return own;
  const mode = await accessMode("film");
  if (mode === "closed") return false;
  if (mode === "open") return true;
  if (mode === "trial") return (await filmTrialState(user)) === "open";
  const { data } = await createAdminClient()
    .from("film_allowed_emails")
    .select("email")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  return Boolean(data);
}

/** Whether the free trial's rules (places, free videos) apply to this user: trial mode, not the owner, not let in by email. */
export async function filmTrialApplies(user: Who) {
  if (isAdmin(user.email) || (await emailAccess("film", user.email)) === true) return false;
  return (await accessMode("film")) === "trial";
}

/** For server pages: signed-in user with film access, or null if signed in without access. */
export async function requireFilmUser(next: string): Promise<{ user: User; allowed: boolean }> {
  const user = await requireUser(next);
  return { user, allowed: await canUseFilm(user) };
}

/** For API routes: signed-in user with film access, else 401/403. */
export async function requireFilmApiUser() {
  const user = await requireApiUser();
  if (!(await canUseFilm(user))) throw new UserError(FILM_MESSAGES.noAccess, 403);
  return user;
}

async function loadProject(projectId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return null;
  const { data } = await createAdminClient().from("film_projects").select("*").eq("id", projectId).maybeSingle();
  return (data as FilmProject) ?? null;
}

/** API: loads a project and verifies the user owns it (the owner's admin role gives no extra access here). */
export async function getOwnedProject(projectId: string, userId: string) {
  const project = await loadProject(projectId);
  if (!project || project.user_id !== userId) throw new UserError(FILM_MESSAGES.notFound, 404);
  return project;
}

/** Pages: same check, 404 otherwise. */
export async function requireProject(projectId: string, userId: string) {
  const project = await loadProject(projectId);
  if (!project || project.user_id !== userId) notFound();
  return project;
}
