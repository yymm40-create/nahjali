import { NextResponse } from "next/server";
import { HISTORY_DAYS } from "@config/mahdi";
import { addDays, canMark, isDayMarkKind, pauseAround, pauseDays, todayFor, type DayMark } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { check, mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { loadDayMarks } from "@/lib/mahdi/server/snapshot";
import { REFUSED } from "@/lib/mahdi/client/day-marks";
import { parseDate } from "@/lib/mahdi/server/validate";

// «أيام العذر والقضاء»: mark a day as excused (travel, illness, the shar'i excuse — two a week at most), pause up to 14 days, mark a
// missed day as made up («قضاء»), or take a mark off. Needs migration 0131; before it runs the answer is 503 «not ready» and the app
// keeps the marks on the device instead (see src/lib/mahdi/client/day-marks.ts).

const MISSING = ["42P01", "42703", "PGRST204", "PGRST205"];
const DAY_MARKS_NOT_READY = "أيام العذر تحتاج تجهيز قاعدة البيانات (ملف 0131).";
const ready = <T>(res: { data: T; error: unknown }): T => {
  if (res.error && MISSING.includes((res.error as { code?: string }).code ?? "")) throw new UserError(DAY_MARKS_NOT_READY, 503);
  return check(res);
};

export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user, profile } = await requireProfile(req);
  const body = await readJson(req);
  const today = todayFor(profile);
  const from = addDays(today, -HISTORY_DAYS);
  const load = async () => {
    try {
      return await loadDayMarks(supabase, from);
    } catch (e) {
      ready({ data: null, error: e });
      throw e;
    }
  };
  const marks: DayMark[] = await load();

  if (body.action === "set") {
    const day = parseDate(body.day);
    if (!isDayMarkKind(body.kind) || body.kind === "pause") throw new UserError(t.errors.invalid, 400);
    const ok = canMark(marks, day, body.kind, today, profile.weekStart);
    if (!ok.ok) throw new UserError(REFUSED[ok.reason] ?? t.errors.invalid, 400);
    ready(await supabase.from("mahdi_day_marks").upsert({ user_id: user.id, day, kind: body.kind }, { onConflict: "user_id,day" }));
  } else if (body.action === "pause") {
    const start = parseDate(body.from);
    const days = pauseDays(start, Number(body.days));
    if (!days) throw new UserError(REFUSED.pauseLong, 400);
    const ok = canMark(marks, start, "pause", today, profile.weekStart);
    if (!ok.ok) throw new UserError(REFUSED[ok.reason] ?? t.errors.invalid, 400);
    // a pause may start today and run into the next days (unlike the other marks, which are for days that came)
    ready(await supabase.from("mahdi_day_marks").upsert(days.map((day) => ({ user_id: user.id, day, kind: "pause" })), { onConflict: "user_id,day" }));
  } else if (body.action === "clear") {
    const day = parseDate(body.day);
    ready(await supabase.from("mahdi_day_marks").delete().eq("user_id", user.id).eq("day", day));
  } else if (body.action === "endPause") {
    // ends the pause that covers `day`: its days from `day` on go (the days already gone by stay excused)
    const day = parseDate(body.day);
    const p = pauseAround(marks, day);
    if (p) ready(await supabase.from("mahdi_day_marks").delete().eq("user_id", user.id).eq("kind", "pause").gte("day", day).lte("day", p.to));
  } else throw new UserError(t.errors.invalid, 400);

  return NextResponse.json({ marks: await load() });
});
