import { NextResponse } from "next/server";
import { GOAL_LIMITS, MAHDI_LIMITS } from "@config/mahdi";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { checkGoals, findMilestone } from "@/lib/mahdi/server/goals";
import { loadSnapshot } from "@/lib/mahdi/server/snapshot";
import { cleanLine, parseBool, parseDate, parseMilestoneTarget, parsePeriod, requireName } from "@/lib/mahdi/server/validate";

type Ctx = { params: Promise<{ id: string }> };

/** Edits a milestone, or marks it done (`done: true`) / back at work. */
export const PATCH = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, profile } = await requireProfile(req);
  const id = requireId((await params).id);
  const body = await readJson(req);
  if (!(await findMilestone(supabase, id))) throw new UserError(t.errors.notFound, 404);

  const fields: Record<string, unknown> = {};
  if ("title" in body) fields.title = requireName(body.title, GOAL_LIMITS.milestoneTitleMax);
  if ("obstacle" in body) fields.obstacle = cleanLine(body.obstacle, GOAL_LIMITS.obstacleMax);
  if ("plan" in body) fields.plan = cleanLine(body.plan, GOAL_LIMITS.planMax);
  if ("target" in body) fields.target = parseMilestoneTarget(body.target);
  if ("unit" in body) fields.unit = cleanLine(body.unit, MAHDI_LIMITS.unitMax);
  if ("period" in body) fields.period = parsePeriod(body.period);
  if ("startsOn" in body) fields.starts_on = parseDate(body.startsOn);
  if ("done" in body) fields.done_at = parseBool(body.done) ? new Date().toISOString() : null;
  if (Object.keys(fields).length) checkGoals(await supabase.from("mahdi_milestones").update(fields).eq("id", id));
  return NextResponse.json({ snapshot: await loadSnapshot(supabase, profile) });
});

/** Deletes a milestone and its log; its habits stay as general habits of the goal. */
export const DELETE = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, profile } = await requireProfile(req);
  const id = requireId((await params).id);
  const deleted = checkGoals(await supabase.from("mahdi_milestones").delete().eq("id", id).select("id")) as unknown[];
  if (!deleted.length) throw new UserError(t.errors.notFound, 404);
  return NextResponse.json({ snapshot: await loadSnapshot(supabase, profile) });
});
