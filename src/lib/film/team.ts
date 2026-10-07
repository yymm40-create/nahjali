// «المسلسل الذكي» in team mode: what each member may do and who pays. The series' owner gives each member the steps
// they work on (e.g. the screenwriter only) and a number of attempts (paid replies and generations); everything made
// inside a team series is paid from its «نقود الفريق الذكي». Server only.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FilmProject } from "./types";
import { isTeamStage, TEAM_STAGES, type TeamStage } from "./team-rights";

export { isTeamStage, TEAM_STAGES, type TeamStage };

const db = () => createAdminClient();
const stageLabel = (s: TeamStage) => TEAM_STAGES.find((x) => x.key === s)!.label;

/** The step a paid film operation belongs to. */
export const OPERATION_STAGE: Record<string, TeamStage> = {
  screenwriter: "screenwriter",
  sheets: "sheets",
  sheet_image: "sheets",
  director: "director",
  director_video: "director",
  voice_line: "director",
};

export interface MemberRights {
  /** null: every step */
  stages: TeamStage[] | null;
  /** null: no limit */
  maxAttempts: number | null;
  usedAttempts: number;
}

/** A series in team mode, if this project is one of its scenes. */
export async function teamSeriesOf(project: Pick<FilmProject, "series_id">): Promise<{ id: string; ownerId: string } | null> {
  if (!project.series_id) return null;
  const { data } = await db().from("film_series").select("id,user_id,mode").eq("id", project.series_id).maybeSingle();
  return data?.mode === "team" ? { id: data.id as string, ownerId: data.user_id as string } : null;
}

export async function memberRights(seriesId: string, userId: string): Promise<MemberRights | null> {
  const { data, error } = await db().from("film_series_members").select("*").eq("series_id", seriesId).eq("user_id", userId).maybeSingle();
  if (error || !data) return null;
  const stages = Array.isArray(data.stages) ? (data.stages as unknown[]).filter(isTeamStage) : null;
  return { stages, maxAttempts: (data.max_attempts as number | null | undefined) ?? null, usedAttempts: (data.used_attempts as number | undefined) ?? 0 };
}

/**
 * Throws unless this person may work on `stage` of the project: its owner always may; a member only on the steps the
 * series' owner gave them ("all": only a member with every step, e.g. to rewind the scene).
 */
export async function assertTeamStage(project: Pick<FilmProject, "user_id" | "series_id">, userId: string, stage: TeamStage | "all") {
  if (project.user_id === userId || !project.series_id) return;
  const r = await memberRights(project.series_id, userId);
  if (!r?.stages) return;
  if (stage === "all") {
    if (TEAM_STAGES.every((s) => r.stages!.includes(s.key))) return;
    throw new UserError("هذي الخطوة لصاحب المسلسل (أو لعضو عنده كل الصلاحيات).", 403);
  }
  if (!r.stages.includes(stage)) {
    throw new UserError(`صاحب المسلسل ما أعطاك صلاحية «${stageLabel(stage)}». صلاحياتك: ${r.stages.map(stageLabel).join("، ") || "ولا خطوة"}.`, 403);
  }
}

/** Takes one of a member's attempts (the owner has no limit), or refuses clearly when none are left. */
export async function takeAttempt(seriesId: string, ownerId: string, userId: string) {
  if (userId === ownerId) return false;
  const { data, error } = await db().rpc("take_team_attempt", { p_series: seriesId, p_user: userId });
  if (error) return false; // before migration 0033: no limits yet
  if (data !== true) throw new UserError("خلصت محاولاتك اللي أعطاك إياها صاحب المسلسل. اطلب منه يزيدها.", 403);
  return true;
}

/** A failed attempt is given back. */
export async function giveAttempt(seriesId: string, userId: string) {
  await db().rpc("give_team_attempt", { p_series: seriesId, p_user: userId });
}

/**
 * Before a paid film operation in a team series: the member must have its step and an attempt left. Returns the
 * series (its wallet pays), or null outside a team series (the owner's own coins pay).
 */
export async function teamPayment(projectId: string, actorId: string, operation: string) {
  const { data } = await db().from("film_projects").select("user_id,series_id").eq("id", projectId).maybeSingle();
  if (!data) return null;
  const series = await teamSeriesOf(data as Pick<FilmProject, "series_id">);
  if (!series) return null;
  const stage = OPERATION_STAGE[operation];
  if (stage) await assertTeamStage(data as Pick<FilmProject, "user_id" | "series_id">, actorId, stage);
  const took = await takeAttempt(series.id, series.ownerId, actorId);
  return { ...series, took };
}
