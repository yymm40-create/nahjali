import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { check, mahdiRoute, readJson, requireProfile, UserError, UUID_RE } from "@/lib/mahdi/server/api";
import { readingReply } from "@/lib/mahdi/server/reading-write";

const metricOf = (v: unknown) => (v === "minutes" || v === "pages" || v === "narrations" ? v : null);

function goal(v: unknown) {
  if (v === null || v === undefined) return { metric: null, target: null };
  const g = v as { metric?: unknown; target?: unknown };
  const metric = metricOf(g.metric);
  const target = Number(g.target);
  if (!metric || !Number.isInteger(target) || target < 1 || target > 100000) throw new UserError(t.errors.invalid, 400);
  return { metric, target };
}

/** Reading goals: `{ daily: { metric, target } | null, weekly: … | null, habitId: string | null, habitMetric }`. */
export const PUT = mahdiRoute(async (req: Request) => {
  const { supabase, user, profile } = await requireProfile(req);
  const body = await readJson(req);
  const daily = goal(body.daily);
  const weekly = goal(body.weekly);
  let habitId: string | null = null;
  if (typeof body.habitId === "string" && body.habitId) {
    if (!UUID_RE.test(body.habitId)) throw new UserError(t.errors.invalid, 400);
    // Through RLS: only my own habit is found
    const { data } = await supabase.from("mahdi_habits").select("id").eq("id", body.habitId).maybeSingle();
    if (!data) throw new UserError(t.errors.notFound, 404);
    habitId = body.habitId;
  }
  check(
    await supabase.from("mahdi_reading_goals").upsert({
      user_id: user.id,
      daily_metric: daily.metric,
      daily_target: daily.target,
      weekly_metric: weekly.metric,
      weekly_target: weekly.target,
      habit_id: habitId,
      habit_metric: metricOf(body.habitMetric) ?? "minutes",
    }),
  );
  return NextResponse.json(await readingReply(supabase, profile));
});
