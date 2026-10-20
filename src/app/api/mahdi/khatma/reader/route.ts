import { NextResponse } from "next/server";
import { todayIn } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { addTime, applyMinutesToHabit, loadReader, setFreePage, setTimeHabit } from "@/lib/mahdi/server/quran-reader";
import { parseIntIn } from "@/lib/mahdi/server/validate";
import { createAdminClient } from "@/lib/supabase/admin";

/** The reader's clock: today's seconds, the habit reading time fills, and the page of the free reading. */
export const GET = mahdiRoute(async (req: Request) => {
  const { user, profile } = await requireProfile(req);
  return NextResponse.json(await loadReader(createAdminClient(), user.id, todayIn(profile.timeZone)), { headers: { "Cache-Control": "private, no-store" } });
});

/**
 * Reader actions: time { seconds } (the clock's report: added to today, and the minutes it completed go to the linked
 * habit) · habit { habitId | null } · page { page } (the free reading's place).
 */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user, profile } = await requireProfile(req);
  // the page's clock also reports as a beacon when it is left (text/plain), so the body is read as text
  const body = (await req.text().then((x) => JSON.parse(x)).catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") throw new UserError(t.errors.invalid, 400);
  const db = createAdminClient();
  const today = todayIn(profile.timeZone);
  switch (body.action) {
    case "time": {
      const r = await addTime(db, user.id, today, Number(body.seconds) || 0);
      const state = await loadReader(db, user.id, today);
      const credited = state.timeHabitId && r.minutes > 0 ? await applyMinutesToHabit(supabase, state.timeHabitId, today, r.minutes) : false;
      return NextResponse.json({ todaySeconds: r.after, minutes: r.minutes, credited });
    }
    case "habit": {
      let habitId: string | null = null;
      if (body.habitId !== null) {
        habitId = requireId(body.habitId);
        const { data } = await supabase.from("mahdi_habits").select("id").eq("id", habitId).maybeSingle();
        if (!data) throw new UserError(t.errors.notFound, 404);
      }
      await setTimeHabit(db, user.id, habitId);
      return NextResponse.json({ ok: true });
    }
    case "page":
      await setFreePage(db, user.id, parseIntIn(body.page, 1, 604));
      return NextResponse.json({ ok: true });
  }
  throw new UserError(t.errors.invalid, 400);
});
