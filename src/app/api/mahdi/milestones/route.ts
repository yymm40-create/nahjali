import { NextResponse } from "next/server";
import { GOAL_LIMITS, MAHDI_LIMITS } from "@config/mahdi";
import { addDays, todayIn } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { checkGoals } from "@/lib/mahdi/server/goals";
import { loadSnapshot } from "@/lib/mahdi/server/snapshot";
import { cleanLine, parseDate, parseMilestoneTarget, parsePeriod, requireName } from "@/lib/mahdi/server/validate";

/** Adds a milestone («هدف مرحلي») to one of my strategic goals. Returns the new id and a fresh snapshot. */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user, profile } = await requireProfile(req);
  const body = await readJson(req);
  const projectId = requireId(body.projectId);
  const project = checkGoals(await supabase.from("mahdi_projects").select("id, kind, archived_at").eq("id", projectId).maybeSingle()) as
    | { id: string; kind: string; archived_at: string | null }
    | null;
  if (!project || project.kind !== "goal") throw new UserError(t.errors.notFound, 404);
  if (project.archived_at) throw new UserError(t.errors.archivedProject, 409);

  const { count } = await supabase.from("mahdi_milestones").select("id", { count: "exact", head: true }).eq("project_id", projectId);
  if ((count ?? 0) >= GOAL_LIMITS.maxMilestones) throw new UserError(t.errors.tooMany, 403);

  const today = todayIn(profile.timeZone);
  const startsOn = body.startsOn === undefined ? today : parseDate(body.startsOn);
  if (startsOn < addDays(today, -5 * 366) || startsOn > addDays(today, 366)) throw new UserError(t.errors.invalid, 400);

  const row = checkGoals(
    await supabase
      .from("mahdi_milestones")
      .insert({
        user_id: user.id,
        project_id: projectId,
        title: requireName(body.title, GOAL_LIMITS.milestoneTitleMax),
        obstacle: cleanLine(body.obstacle, GOAL_LIMITS.obstacleMax),
        plan: cleanLine(body.plan, GOAL_LIMITS.planMax),
        target: parseMilestoneTarget(body.target),
        unit: cleanLine(body.unit, MAHDI_LIMITS.unitMax),
        period: parsePeriod(body.period),
        starts_on: startsOn,
        sort_order: count ?? 0,
      })
      .select("id")
      .single(),
  ) as { id: string };
  return NextResponse.json({ id: row.id, snapshot: await loadSnapshot(supabase, profile) });
});
