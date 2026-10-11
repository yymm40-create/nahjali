import { NextResponse } from "next/server";
import { MAHDI_LIMITS, PROJECT_COLORS } from "@config/mahdi";
import { cleanPlan, FOOD_HABITS, habitsFor, type FoodHabit, type GymWay, type HabitSpec } from "@/lib/mahdi/health/plan";
import { todayIn } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { check, mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { loadSnapshot } from "@/lib/mahdi/server/snapshot";

const PROJECTS = {
  one: [{ group: null, name: "الصحة العلوية", icon: "💪", color: "emerald" }],
  two: [
    { group: "gym", name: "الجيم", icon: "🏋️", color: "garnet" },
    { group: "food", name: "التغذية", icon: "🥗", color: "olive" },
  ],
} as const;

/**
 * «الصحة العلوية» → habits: makes the plan's habits (the way the person chose: by days, by exercises or weekly, plus the
 * nutrition habits they ticked) inside a new project «الصحة العلوية», two projects «الجيم» and «التغذية», or one of
 * their projects. All the habits are built here from the plan, so nothing else is accepted from the page.
 */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user, profile } = await requireProfile(req);
  const body = await readJson(req);
  const plan = cleanPlan(body.plan);
  if (!plan) throw new UserError(t.errors.invalid, 400);
  const gym = (["days", "exercises", "weekly"] as const).includes(body.gym as GymWay) ? (body.gym as GymWay) : null;
  const food = Array.isArray(body.food) ? body.food.filter((x): x is FoodHabit => FOOD_HABITS.includes(x as FoodHabit)) : [];
  const specs = habitsFor(plan, gym, food);
  if (!specs.length) throw new UserError("اختر عادة وحدة على الأقل.", 400);

  const [{ count: habits }, { count: projects }] = await Promise.all([
    supabase.from("mahdi_habits").select("id", { count: "exact", head: true }),
    supabase.from("mahdi_projects").select("id", { count: "exact", head: true }),
  ]);
  if ((habits ?? 0) + specs.length > MAHDI_LIMITS.maxHabits) throw new UserError(t.errors.tooMany, 403);

  // where the habits go
  const target: Record<"gym" | "food", string> = { gym: "", food: "" };
  if (body.where === "existing") {
    const id = requireId(body.projectId);
    const p = (await supabase.from("mahdi_projects").select("id, archived_at").eq("id", id).maybeSingle()).data;
    if (!p) throw new UserError(t.errors.notFound, 404);
    if (p.archived_at) throw new UserError(t.errors.archivedProject, 409);
    target.gym = target.food = id;
  } else {
    const wanted = body.where === "two" ? PROJECTS.two.filter((x) => specs.some((s) => s.group === x.group)) : PROJECTS.one;
    if ((projects ?? 0) + wanted.length > MAHDI_LIMITS.maxProjects) throw new UserError(t.errors.tooMany, 403);
    let order = projects ?? 0;
    for (const w of wanted) {
      if (!PROJECT_COLORS.includes(w.color)) continue;
      const row = check(
        await supabase.from("mahdi_projects").insert({ user_id: user.id, name: w.name, icon: w.icon, color: w.color, sort_order: order++ }).select("id").single(),
      ) as { id: string };
      if (w.group) target[w.group] = row.id;
      else target.gym = target.food = row.id;
    }
  }

  const start = todayIn(profile.timeZone);
  let made = 0;
  for (const s of specs as HabitSpec[]) {
    const projectId = target[s.group];
    if (!projectId) continue;
    check(
      await supabase.rpc("mahdi_create_habit", {
        p_project: projectId,
        p_name: s.name.slice(0, MAHDI_LIMITS.habitNameMax),
        p_icon: s.icon,
        p_category: s.group === "gym" ? "الجيم" : "التغذية",
        p_notes: s.notes.slice(0, MAHDI_LIMITS.notesMax),
        p_reminder: null,
        p_start: start,
        p_measure: s.measure,
        p_target: s.target,
        p_unit: s.unit.slice(0, MAHDI_LIMITS.unitMax),
        p_freq: s.freq,
        p_days: s.days,
      }),
    );
    made++;
  }
  return NextResponse.json({ made, projectId: target.gym || target.food, snapshot: await loadSnapshot(supabase, profile) });
});
