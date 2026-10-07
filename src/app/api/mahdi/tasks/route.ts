import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayIn } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireId, requireProfile, UserError, UUID_RE } from "@/lib/mahdi/server/api";
import { loadTasks } from "@/lib/mahdi/server/snapshot";

const MAX_PER_DAY = 100;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const title = (v: unknown) => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  if (!s || s.length > 200) throw new UserError(t.tasks.badTitle, 400);
  return s;
};
const timeOf = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || !TIME_RE.test(v)) throw new UserError(t.errors.invalid, 400);
  return v;
};
/** A habit of mine (through RLS), or null. */
async function habitOf(supabase: SupabaseClient, v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || !UUID_RE.test(v)) throw new UserError(t.errors.invalid, 400);
  const { data } = await supabase.from("mahdi_habits").select("id").eq("id", v).maybeSingle();
  if (!data) throw new UserError(t.errors.notFound, 404);
  return v;
}
/** Before SQL 0036 the table doesn't exist: say so plainly. */
function fail(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "42P01" || error.code === "PGRST205") throw new UserError(t.tasks.notReady, 503);
  throw error;
}

/** «مهام اليوم»: today's tasks. */
export const GET = mahdiRoute(async (req: Request) => {
  const { supabase, profile } = await requireProfile(req);
  return NextResponse.json({ tasks: await loadTasks(supabase, todayIn(profile.timeZone)).catch(() => []) });
});

/** A new task for today: `{ title, at?: "HH:MM" | null, habitId?: string | null }`. */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user, profile } = await requireProfile(req);
  const body = await readJson(req);
  const today = todayIn(profile.timeZone);
  const { count, error: e1 } = await supabase.from("mahdi_day_tasks").select("id", { count: "exact", head: true }).eq("task_date", today);
  fail(e1);
  if ((count ?? 0) >= MAX_PER_DAY) throw new UserError(t.tasks.tooMany(MAX_PER_DAY), 429);
  const { error } = await supabase
    .from("mahdi_day_tasks")
    .insert({ user_id: user.id, task_date: today, title: title(body.title), at_time: timeOf(body.at), habit_id: await habitOf(supabase, body.habitId), sort_order: count ?? 0 });
  fail(error);
  return NextResponse.json({ tasks: await loadTasks(supabase, today) });
});

/** Ticks / unticks or edits a task: `{ id, done?, title?, at?, habitId? }`. A new time is reminded again. */
export const PATCH = mahdiRoute(async (req: Request) => {
  const { supabase, profile } = await requireProfile(req);
  const body = await readJson(req);
  const id = requireId(body.id);
  const patch: Record<string, unknown> = {};
  if (typeof body.done === "boolean") patch.done_at = body.done ? new Date().toISOString() : null;
  if ("title" in body) patch.title = title(body.title);
  if ("at" in body) {
    patch.at_time = timeOf(body.at);
    patch.notified = 0;
  }
  if ("habitId" in body) patch.habit_id = await habitOf(supabase, body.habitId);
  const { data, error } = await supabase.from("mahdi_day_tasks").update(patch).eq("id", id).select("id");
  fail(error);
  if (!data?.length) throw new UserError(t.errors.notFound, 404);
  return NextResponse.json({ tasks: await loadTasks(supabase, todayIn(profile.timeZone)) });
});

/** Removes a task: `{ id }`. */
export const DELETE = mahdiRoute(async (req: Request) => {
  const { supabase, profile } = await requireProfile(req);
  const body = await readJson(req);
  const { error } = await supabase.from("mahdi_day_tasks").delete().eq("id", requireId(body.id));
  fail(error);
  return NextResponse.json({ tasks: await loadTasks(supabase, todayIn(profile.timeZone)) });
});
