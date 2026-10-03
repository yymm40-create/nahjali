import { notFound } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { requireApiUser, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@config/site";
import { FILM_PUBLIC_TRIAL } from "@config/film";
import type { FilmProject } from "./types";

export const FILM_MESSAGES = {
  noAccess: "صانع الفيلم مقفل حاليًا.",
  notFound: "ما لقينا هذا المشروع.",
} as const;

/**
 * Free trial videos made so far (`made`: finished, whatever the client did with them since) and still
 * counting against the trial (`taken`: also the ones being generated now).
 */
export async function filmTrialVideos() {
  const { data } = await createAdminClient().from("film_assets").select("status").eq("kind", "video").eq("meta->>trial", "true");
  const rows = (data ?? []) as { status: string }[];
  return {
    made: rows.filter((r) => ["generated", "approved", "rejected"].includes(r.status)).length,
    taken: rows.filter((r) => r.status !== "failed").length,
  };
}

/** True once the public trial's free videos have all been made: the film maker is locked for everyone but the owner. */
export async function filmTrialOver() {
  return FILM_PUBLIC_TRIAL.open && (await filmTrialVideos()).made >= FILM_PUBLIC_TRIAL.freeVideos;
}

/**
 * The owner always has access. During the public trial everyone signed in has access until it is over;
 * otherwise only the invite list (/admin/film).
 */
export async function canUseFilm(email: string | undefined | null) {
  if (!email) return false;
  if (isAdmin(email)) return true;
  if (FILM_PUBLIC_TRIAL.open) return !(await filmTrialOver());
  const { data } = await createAdminClient()
    .from("film_allowed_emails")
    .select("email")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return Boolean(data);
}

/** For server pages: signed-in user with film access, or null if signed in without access. */
export async function requireFilmUser(next: string): Promise<{ user: User; allowed: boolean }> {
  const user = await requireUser(next);
  return { user, allowed: await canUseFilm(user.email) };
}

/** For API routes: signed-in user with film access, else 401/403. */
export async function requireFilmApiUser() {
  const user = await requireApiUser();
  if (!(await canUseFilm(user.email))) throw new UserError(FILM_MESSAGES.noAccess, 403);
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
