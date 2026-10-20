import { NextResponse } from "next/server";
import { MAHDI_LIMITS } from "@config/mahdi";
import { t } from "@/lib/mahdi/i18n";
import { check, mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { loadSnapshot } from "@/lib/mahdi/server/snapshot";
import { checkGoals } from "@/lib/mahdi/server/goals";
import { cleanIcon, parseColor, parseGoal, requireName } from "@/lib/mahdi/server/validate";

/** Creates a project, or a strategic goal (`kind: "goal"` with its `goal` plan). Returns the new id and a fresh snapshot. */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user, profile } = await requireProfile(req);
  const body = await readJson(req);
  const name = requireName(body.name, MAHDI_LIMITS.projectNameMax);
  const icon = cleanIcon(body.icon);
  const color = body.color === undefined ? "gold" : parseColor(body.color);
  const isGoal = body.kind === "goal";
  const goal = isGoal ? parseGoal(body.goal) : null;

  const { count } = await supabase.from("mahdi_projects").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= MAHDI_LIMITS.maxProjects) throw new UserError(t.errors.tooMany, 403);

  const fields = { user_id: user.id, name, icon, color, sort_order: count ?? 0 };
  const insert = (more: Record<string, unknown>) => supabase.from("mahdi_projects").insert({ ...fields, ...more }).select("id").single();
  // a goal needs SQL 0086 (its columns); a plain project works with or without it
  const row = isGoal ? checkGoals(await insert({ kind: "goal", goal })) : check(await insert({}));
  return NextResponse.json({ id: (row as { id: string }).id, snapshot: await loadSnapshot(supabase, profile) });
});
