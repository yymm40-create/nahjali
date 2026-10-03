import { NextResponse } from "next/server";
import { reminderSlots, toMinutes, type ReminderMode } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { check, mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { oneOf, parseBool, parseTime } from "@/lib/mahdi/server/validate";

/** Saves the reminder settings: `{ mode, times, quietStart, quietEnd, habitReminders }` (through RLS: only my row). */
export const PUT = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  const body = await readJson(req);
  const mode = oneOf(body.mode, ["off", "daily", "every_12h", "every_6h", "custom"] as const) as ReminderMode;
  const quietStart = parseTime(body.quietStart);
  const quietEnd = parseTime(body.quietEnd);
  if (!quietStart || !quietEnd) throw new UserError(t.errors.invalid, 400);

  if (!Array.isArray(body.times) || body.times.length > 6) throw new UserError(t.notify.timesLimit, 400);
  let times = [...new Set(body.times.map((x) => parseTime(x)).filter((x): x is string => Boolean(x)))];
  times.sort((a, b) => (toMinutes(a)! - toMinutes(b)!));
  if (mode !== "off" && mode !== "custom") times = times.slice(0, 1); // one starting time; the mode repeats it
  if (mode !== "off" && times.length === 0) throw new UserError(t.notify.atLeastOne, 400);
  if (times.length === 0) times = ["20:00"];
  if (mode !== "off" && reminderSlots(mode, times).length === 0) throw new UserError(t.errors.invalid, 400);

  const row = { user_id: user.id, mode, times, quiet_start: quietStart, quiet_end: quietEnd, habit_reminders: parseBool(body.habitReminders) };
  check(await supabase.from("mahdi_notification_settings").upsert(row));
  return NextResponse.json({ notifications: { mode, times, quietStart, quietEnd, habitReminders: row.habit_reminders } });
});
