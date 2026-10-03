// SERVER ONLY. Shared steps of the reading routes: the linked habit, the reply, and checks.
import type { SupabaseClient } from "@supabase/supabase-js";
import { habitDelta, isDueOn, versionAt, type ReadingGoals } from "../engine";
import type { Profile } from "../types";
import { habitsFromRows, type HabitRow, type VersionRow } from "./rows";
import { loadReading } from "./reading";

/**
 * Adds (or, with `sign = -1`, takes back) a session's minutes or pages to the habit linked in the reading goals,
 * on the session's day. A done/not-done habit becomes done. Nothing happens if the habit does not run that day.
 */
export async function applyToHabit(supabase: SupabaseClient, goals: ReadingGoals, date: string, seconds: number, pages: number, sign: 1 | -1) {
  if (!goals.habitId) return;
  const delta = habitDelta(goals.habitMetric, seconds, pages);
  if (delta <= 0) return;
  const [{ data: h }, { data: vs }, { data: log }] = await Promise.all([
    supabase.from("mahdi_habits").select("*").eq("id", goals.habitId).maybeSingle(),
    supabase.from("mahdi_habit_versions").select("habit_id,effective_from,measure,target,unit,freq,days,state,reason,prev_state").eq("habit_id", goals.habitId),
    supabase.from("mahdi_logs").select("value").eq("habit_id", goals.habitId).eq("log_date", date).maybeSingle(),
  ]);
  if (!h) return;
  const habit = habitsFromRows([h as HabitRow], (vs ?? []) as VersionRow[])[0];
  const v = versionAt({ id: habit.id, projectId: habit.projectId, versions: habit.versions, logs: {} }, date);
  // Week/month goals count any day; day goals only their own days
  if (!v || v.state !== "active" || ((v.freq === "daily" || v.freq === "days") && !isDueOn(v, date))) return;
  const cur = Number(log?.value ?? 0);
  const next = v.measure === "check" ? (sign > 0 ? 1 : cur) : Math.max(0, Math.round((cur + sign * delta) * 100) / 100);
  if (next === cur) return;
  await supabase.rpc("mahdi_set_log", { p_habit: goals.habitId, p_date: date, p_value: next, p_client_ts: new Date().toISOString() });
}

/** The reply of every reading change: the fresh reading data. */
export async function readingReply(supabase: SupabaseClient, profile: Profile) {
  return { reading: await loadReading(supabase, profile.userId) };
}
