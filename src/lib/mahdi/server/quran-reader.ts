// SERVER ONLY. «الختمة العلوية» · the reader's clock (migration 0084): the seconds read each day, the habit those
// minutes fill, and the page of the free reading. Every function takes the signed-in account's id and touches only its rows.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isDueOn, versionAt } from "../engine";
import { CLOCK, habitAfterReading, isTimeHabit, wholeMinutes } from "../khatma/reader";
import { habitsFromRows, type HabitRow, type VersionRow } from "./rows";

const MISSING = ["42P01", "42703", "PGRST204", "PGRST205"];
const missing = (e: { code?: string } | null) => !!e && MISSING.includes(e.code ?? "");

export interface ReaderState {
  ready: boolean;
  timeHabitId: string | null;
  freePage: number | null;
  todaySeconds: number;
}

/** The reader's settings and today's seconds (ready false = 0084 not run yet). */
export async function loadReader(db: SupabaseClient, me: string, today: string): Promise<ReaderState> {
  const [s, t] = await Promise.all([
    db.from("mahdi_quran_reader").select("time_habit_id, free_page").eq("user_id", me).maybeSingle(),
    db.from("mahdi_quran_time").select("seconds").eq("user_id", me).eq("read_on", today).maybeSingle(),
  ]);
  if (missing(s.error) || missing(t.error)) return { ready: false, timeHabitId: null, freePage: null, todaySeconds: 0 };
  if (s.error) throw s.error;
  if (t.error) throw t.error;
  return { ready: true, timeHabitId: (s.data?.time_habit_id as string | null) ?? null, freePage: (s.data?.free_page as number | null) ?? null, todaySeconds: (t.data?.seconds as number | undefined) ?? 0 };
}

/**
 * Adds seconds of reading to today. Returns the day's total, the whole minutes this report completed (what the habit is
 * credited) and what it moved. A report carries at most `CLOCK.maxPerReport` seconds.
 */
export async function addTime(db: SupabaseClient, me: string, today: string, seconds: number): Promise<{ before: number; after: number; minutes: number }> {
  const add = Math.max(0, Math.min(CLOCK.maxPerReport, Math.floor(seconds)));
  const { data, error } = await db.from("mahdi_quran_time").select("seconds").eq("user_id", me).eq("read_on", today).maybeSingle();
  if (error) throw error;
  const before = (data?.seconds as number | undefined) ?? 0;
  const after = Math.min(CLOCK.maxPerDay, before + add);
  if (after !== before) {
    const { error: e2 } = await db.from("mahdi_quran_time").upsert({ user_id: me, read_on: today, seconds: after, updated_at: new Date().toISOString() }, { onConflict: "user_id,read_on" });
    if (e2) throw e2;
  }
  return { before, after, minutes: wholeMinutes(after) - wholeMinutes(before) };
}

/** Sets (or clears) the habit reading time fills. The caller has checked the habit is the person's. */
export async function setTimeHabit(db: SupabaseClient, me: string, habitId: string | null) {
  const { error } = await db.from("mahdi_quran_reader").upsert({ user_id: me, time_habit_id: habitId, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

/** Keeps the page of the free reading. */
export async function setFreePage(db: SupabaseClient, me: string, page: number) {
  const { error } = await db.from("mahdi_quran_reader").upsert({ user_id: me, free_page: page, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

/**
 * Adds `minutes` of reading to the habit on `date` (through the person's own client: only their habit is visible, and the
 * log function is theirs). An amount grows by them in its unit; a done / not done habit becomes done. Nothing when the
 * habit does not run that day, is paused, or is a counter. Returns whether the log moved.
 */
export async function applyMinutesToHabit(supabase: SupabaseClient, habitId: string, date: string, minutes: number): Promise<boolean> {
  if (minutes <= 0) return false;
  const [{ data: h }, { data: vs }, { data: log }] = await Promise.all([
    supabase.from("mahdi_habits").select("*").eq("id", habitId).maybeSingle(),
    supabase.from("mahdi_habit_versions").select("habit_id,effective_from,measure,target,unit,freq,days,state,reason,prev_state").eq("habit_id", habitId),
    supabase.from("mahdi_logs").select("value").eq("habit_id", habitId).eq("log_date", date).maybeSingle(),
  ]);
  if (!h) return false;
  const habit = habitsFromRows([h as HabitRow], (vs ?? []) as VersionRow[])[0];
  const v = versionAt({ id: habit.id, projectId: habit.projectId, versions: habit.versions, logs: {} }, date);
  if (!v || v.state !== "active" || !isTimeHabit(v.measure) || ((v.freq === "daily" || v.freq === "days") && !isDueOn(v, date))) return false;
  const cur = Number(log?.value ?? 0);
  const next = habitAfterReading(v.measure, v.unit, cur, minutes);
  if (next === cur) return false;
  const { error } = await supabase.rpc("mahdi_set_log", { p_habit: habitId, p_date: date, p_value: next, p_client_ts: new Date().toISOString() });
  return !error;
}
