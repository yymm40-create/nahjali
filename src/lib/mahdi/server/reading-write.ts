// SERVER ONLY. Shared steps of the reading routes: the linked habit, the reply, and checks.
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAHDI_LIMITS } from "@config/mahdi";
import { habitDelta, isDueOn, versionAt, type BookUnit, type ReadingGoals } from "../engine";
import type { Profile } from "../types";
import { habitsFromRows, type HabitRow, type VersionRow } from "./rows";
import { loadReading } from "./reading";

/**
 * Adds (or, with `sign = -1`, takes back) a session's minutes, pages or narrations to the habit linked in the reading goals,
 * on the session's day. A done/not-done habit becomes done. Nothing happens if the habit does not run that day.
 */
export async function applyToHabit(supabase: SupabaseClient, goals: ReadingGoals, date: string, seconds: number, count: number, unit: BookUnit, sign: 1 | -1) {
  if (!goals.habitId) return;
  await addToHabit(supabase, goals.habitId, date, habitDelta(goals.habitMetric, seconds, count, unit), sign);
}

/** Adds (or takes back) `delta` to one habit's day, if the habit runs that day. A done/not-done habit becomes done. */
export async function addToHabit(supabase: SupabaseClient, habitId: string, date: string, delta: number, sign: 1 | -1) {
  if (delta <= 0) return;
  const [{ data: h }, { data: vs }, { data: log }] = await Promise.all([
    supabase.from("mahdi_habits").select("*").eq("id", habitId).maybeSingle(),
    supabase.from("mahdi_habit_versions").select("habit_id,effective_from,measure,target,unit,freq,days,state,reason,prev_state").eq("habit_id", habitId),
    supabase.from("mahdi_logs").select("value").eq("habit_id", habitId).eq("log_date", date).maybeSingle(),
  ]);
  if (!h) return;
  const habit = habitsFromRows([h as HabitRow], (vs ?? []) as VersionRow[])[0];
  const v = versionAt({ id: habit.id, projectId: habit.projectId, versions: habit.versions, logs: {} }, date);
  // Week/month goals count any day; day goals only their own days
  if (!v || v.state !== "active" || ((v.freq === "daily" || v.freq === "days") && !isDueOn(v, date))) return;
  const cur = Number(log?.value ?? 0);
  const next = v.measure === "check" ? (sign > 0 ? 1 : cur) : Math.max(0, Math.round((cur + sign * delta) * 100) / 100);
  if (next === cur) return;
  await supabase.rpc("mahdi_set_log", { p_habit: habitId, p_date: date, p_value: next, p_client_ts: new Date().toISOString() });
}

/** The reply of every reading change: the fresh reading data. */
export async function readingReply(supabase: SupabaseClient, profile: Profile) {
  return { reading: await loadReading(supabase, profile.userId) };
}

// ───────────────────────── a book's own habit («القارئ العلوي» → العادات) ─────────────────────────

const missingColumn = (e: unknown) => ["42703", "PGRST204"].includes((e as { code?: string } | null)?.code ?? "");
/** Pages (or narrations) a day for a new book's habit: the reading goal's daily pages when there is one, else 10 (5 narrations). */
export const defaultBookTarget = (unit: BookUnit, goals?: ReadingGoals) =>
  unit === "page" && goals?.daily?.metric === "pages" ? Math.max(1, Math.min(1000, goals.daily.target)) : unit === "narration" ? 5 : 10;

/** The habit linked to one of my books, or null (and null before SQL 0125). */
export async function bookHabitOf(supabase: SupabaseClient, bookId: string): Promise<string | null> {
  const { data, error } = await supabase.from("mahdi_user_books").select("habit_id").eq("book_id", bookId).maybeSingle();
  if (error) return null;
  return (data?.habit_id as string | null) ?? null;
}

/**
 * Makes the habit of one of my books: «قراءة «العنوان»», counted in pages (or narrations) a day, daily, in the project
 * «القارئ العلوي» (made once). The book is linked to it. Returns the habit, or null before SQL 0125, when the book
 * already has one, or at the habits limit.
 */
export async function createBookHabit(supabase: SupabaseClient, userId: string, today: string, bookId: string, target: number): Promise<string | null> {
  const [{ data: entry, error }, { count: habits }] = await Promise.all([
    supabase.from("mahdi_user_books").select("habit_id, book:mahdi_books (title, unit)").eq("book_id", bookId).maybeSingle(),
    supabase.from("mahdi_habits").select("id", { count: "exact", head: true }),
  ]);
  if (error || !entry) return null;
  const e = entry as unknown as { habit_id: string | null; book: { title: string; unit: BookUnit } | null };
  if (e.habit_id || !e.book || (habits ?? 0) + 1 > MAHDI_LIMITS.maxHabits) return null;
  const projectId = await readerProject(supabase, userId);
  if (!projectId) return null;
  const unit = e.book.unit === "narration" ? "narration" : "page";
  const title = e.book.title.length > 44 ? `${e.book.title.slice(0, 43)}…` : e.book.title;
  const { data: habitId, error: e2 } = await supabase.rpc("mahdi_create_habit", {
    p_project: projectId,
    p_name: `قراءة «${title}»`,
    p_icon: "📖",
    p_category: "القراءة",
    p_notes: "يتسجّل وحده من «القارئ العلوي»: كل صفحة تقرؤها في هالكتاب تنضاف هنا.",
    p_reminder: null,
    p_start: today,
    p_measure: "count",
    p_target: target,
    p_unit: unit === "narration" ? "رواية" : "صفحة",
    p_freq: "daily",
    p_days: [],
  });
  if (e2 || !habitId) return null;
  const { error: e3 } = await supabase.from("mahdi_user_books").update({ habit_id: habitId, daily_target: target }).eq("book_id", bookId);
  if (e3) {
    // before SQL 0125 the link can't be kept: don't leave a habit that nothing fills
    await supabase.from("mahdi_habits").delete().eq("id", habitId as string);
    if (missingColumn(e3)) return null;
    throw e3;
  }
  return habitId as string;
}

/** The project «القارئ العلوي» of my habits (an open one with that name, else a new one). */
async function readerProject(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data: found } = await supabase.from("mahdi_projects").select("id").eq("name", "القارئ العلوي").is("archived_at", null).limit(1).maybeSingle();
  if (found) return found.id as string;
  const { count } = await supabase.from("mahdi_projects").select("id", { count: "exact", head: true });
  if ((count ?? 0) + 1 > MAHDI_LIMITS.maxProjects) return null;
  const { data, error } = await supabase.from("mahdi_projects").insert({ user_id: userId, name: "القارئ العلوي", icon: "📚", color: "amber", sort_order: count ?? 0 }).select("id").single();
  return error ? null : (data.id as string);
}

/** A new daily target for a book's habit: the book keeps it, and the habit's goal changes from today. */
export async function setBookTarget(supabase: SupabaseClient, userId: string, today: string, bookId: string, target: number) {
  const habitId = await bookHabitOf(supabase, bookId);
  await supabase.from("mahdi_user_books").update({ daily_target: target }).eq("book_id", bookId);
  if (!habitId) return;
  const { data: versions } = await supabase.from("mahdi_habit_versions").select("*").eq("habit_id", habitId).order("effective_from", { ascending: true });
  const latest = versions?.[versions.length - 1];
  if (!latest) return;
  const from = today > versions![0].effective_from ? today : versions![0].effective_from;
  await supabase
    .from("mahdi_habit_versions")
    .upsert({ habit_id: habitId, user_id: userId, effective_from: from, measure: "count", target, unit: latest.unit, freq: latest.freq, days: latest.days, state: latest.state, reason: "", prev_state: null }, { onConflict: "habit_id,effective_from" });
}

/** No habit for this book: the habit made for it is deleted (with its days) and the link cleared. */
export async function removeBookHabit(supabase: SupabaseClient, bookId: string) {
  const habitId = await bookHabitOf(supabase, bookId);
  if (!habitId) return;
  await supabase.from("mahdi_user_books").update({ habit_id: null }).eq("book_id", bookId);
  await supabase.from("mahdi_habits").delete().eq("id", habitId);
}

/** A just-added book's habit, with the default pages a day (never stops the adding). */
export async function autoBookHabit(supabase: SupabaseClient, userId: string, today: string, bookId: string) {
  try {
    const [{ data: b }, reading] = await Promise.all([supabase.from("mahdi_books").select("unit").eq("id", bookId).maybeSingle(), loadReading(supabase, userId)]);
    await createBookHabit(supabase, userId, today, bookId, defaultBookTarget(b?.unit === "narration" ? "narration" : "page", reading.goals));
  } catch (e) {
    console.error("[mahdi book habit]", e);
  }
}
