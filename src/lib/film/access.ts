import { notFound } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { requireApiUser, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { can } from "@/lib/access";
import type { FilmProject } from "./types";
import { assertTeamStage, type TeamStage } from "./team";

export const FILM_MESSAGES = {
  noAccess: "صانع الأفلام الذكي مقفل لحسابك حاليًا.",
  notFound: "ما لقينا هذا المشروع.",
} as const;

type Who = { id: string; email?: string | null };

/** «صانع الأفلام الذكي» (المشهد القصير والمسلسل الذكي): for those the dashboard's list lets in (and the owners). */
export async function canUseFilm(user: Who) {
  return can(user.email, "film");
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

/**
 * Whether this person works in a series as a team member: the series is in team mode and its owner added them.
 * (In individual mode only the owner works on it.)
 */
export async function isSeriesTeamMember(seriesId: string | null | undefined, userId: string) {
  if (!seriesId) return false;
  const db = createAdminClient();
  const [{ data: s }, { data: m }] = await Promise.all([
    db.from("film_series").select("mode").eq("id", seriesId).maybeSingle(),
    db.from("film_series_members").select("user_id").eq("series_id", seriesId).eq("user_id", userId).maybeSingle(),
  ]);
  return s?.mode === "team" && Boolean(m);
}

/** The project's owner, or (for a scene of a series in team mode) one of the people its owner added. */
export async function canOpenProject(project: FilmProject, userId: string) {
  return project.user_id === userId || isSeriesTeamMember(project.series_id, userId);
}

/** API: loads a project and verifies the user may work on it (the owner's admin role gives no extra access here). */
export async function getOwnedProject(projectId: string, userId: string, stage?: TeamStage | "all") {
  const project = await loadProject(projectId);
  if (!project || !(await canOpenProject(project, userId))) throw new UserError(FILM_MESSAGES.notFound, 404);
  // a team member works only on the steps the series' owner gave them
  if (stage) await assertTeamStage(project, userId, stage);
  return project;
}

/** Pages: same check, 404 otherwise. */
export async function requireProject(projectId: string, userId: string) {
  const project = await loadProject(projectId);
  if (!project || !(await canOpenProject(project, userId))) notFound();
  return project;
}
