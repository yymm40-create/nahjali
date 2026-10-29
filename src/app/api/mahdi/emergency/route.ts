import { NextResponse } from "next/server";
import { addDays, todayIn, validEmergencyTarget, versionAt, type Item } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { check, mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { habitsFromRows, type HabitRow, type VersionRow } from "@/lib/mahdi/server/rows";
import { loadSnapshot } from "@/lib/mahdi/server/snapshot";
import { parseDate } from "@/lib/mahdi/server/validate";

// «خانة الطوارئ»: (1) which habits carry an emergency goal and how small it is — many at once, from one or several projects;
// (2) which days the person chose «اليوم طوارئ» for a habit. Needs migration 0098.

const MISSING = ["42P01", "42703", "PGRST204", "PGRST205"];
const NOT_READY = "خانة الطوارئ تحتاج تجهيز قاعدة البيانات (ملف 0098).";
const ready = <T>(res: { data: T; error: unknown }): T => {
  if (res.error && MISSING.includes((res.error as { code?: string }).code ?? "")) throw new UserError(NOT_READY, 503);
  return check(res);
};

const MAX_ITEMS = 200;
const ids = (v: unknown) => {
  if (!Array.isArray(v) || !v.length || v.length > MAX_ITEMS) throw new UserError(t.errors.invalid, 400);
  return [...new Set(v.map(requireId))];
};

export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user, profile } = await requireProfile(req);
  const body = await readJson(req);
  const today = todayIn(profile.timeZone);

  if (body.action === "set") {
    const items = (Array.isArray(body.items) ? body.items : []).slice(0, MAX_ITEMS).map((x) => (x ?? {}) as Record<string, unknown>);
    if (!items.length) throw new UserError(t.errors.invalid, 400);
    const habitIds = [...new Set(items.map((i) => requireId(i.habitId)))];
    const habits = check(await supabase.from("mahdi_habits").select("*").in("id", habitIds)) as HabitRow[];
    const versions = check(await supabase.from("mahdi_habit_versions").select("*").in("habit_id", habitIds).order("effective_from", { ascending: true })) as VersionRow[];
    const byId = new Map(habitsFromRows(habits, versions).map((h) => [h.id, h]));
    for (const i of items) {
      const h = byId.get(String(i.habitId));
      if (!h) throw new UserError(t.errors.notFound, 404);
      let target: number | null = null;
      if (i.target !== null && i.target !== undefined) {
        const item: Item = { id: h.id, projectId: h.projectId, versions: h.versions, logs: {} };
        const v = versionAt(item, today) ?? h.versions[0];
        target = v ? validEmergencyTarget(v.measure, v.target, i.target) : null;
        // a number that is not smaller than the habit's goal (or a done / not done habit) is no emergency
        if (target === null) throw new UserError("رقم الطوارئ لازم يكون أقل من هدف العادة، والعادة عدّاد أو كمية (مو «تمّت/ما تمّت»).", 400);
      }
      ready(await supabase.from("mahdi_habits").update({ emergency_target: target }).eq("id", h.id));
    }
    return NextResponse.json({ snapshot: await loadSnapshot(supabase, profile) });
  }

  if (body.action === "day") {
    const date = parseDate(body.date);
    if (date < addDays(today, -30) || date > addDays(today, 1)) throw new UserError(t.errors.invalid, 400);
    const habitIds = ids(body.habitIds);
    const withEmergency = (ready(await supabase.from("mahdi_habits").select("id, emergency_target").in("id", habitIds)) as { id: string; emergency_target: number | null }[]).filter(
      (h) => h.emergency_target !== null,
    );
    if (!withEmergency.length) throw new UserError("هذي العادة ما عندها خانة طوارئ. حدّد رقم الطوارئ لها أول.", 400);
    const on = body.on !== false;
    if (on) ready(await supabase.from("mahdi_emergency_days").upsert(withEmergency.map((h) => ({ habit_id: h.id, user_id: user.id, day: date })), { onConflict: "habit_id,day" }));
    else ready(await supabase.from("mahdi_emergency_days").delete().in("habit_id", withEmergency.map((h) => h.id)).eq("day", date));
    return NextResponse.json({ snapshot: await loadSnapshot(supabase, profile) });
  }

  throw new UserError(t.errors.invalid, 400);
});
