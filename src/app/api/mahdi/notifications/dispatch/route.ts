import { NextResponse } from "next/server";
import { dispatchContests } from "@/lib/mahdi/server/contests";
import { dispatchEngagement } from "@/lib/mahdi/server/engage";
import { dispatchHabitAlerts, dispatchPlanAlerts, dispatchReminders, dispatchTaskReminders, pushConfigured } from "@/lib/mahdi/server/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAuthorized } from "@/lib/mahdi/server/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Called by Supabase pg_cron + pg_net every 15 minutes (0009), and every minute with `?only=minute` for the timed tasks and
 * the planner alerts (0127). Protected by `Authorization: Bearer <secret>` (cron-auth.ts); anyone else gets 404.
 */
export async function POST(req: Request) {
  if (!(await cronAuthorized(req))) return new NextResponse(null, { status: 404 });
  if (!pushConfigured()) return NextResponse.json({ error: "VAPID keys are not set" }, { status: 503 });
  try {
    const db = createAdminClient();
    // `?only=minute` (every minute, SQL 0127): every reminder at a time the person chose — tasks, planner events, habit
    // alerts and the habit reminders — on its own minute (the owner, 25 November 2026: «لاتحط قانون ربع الساعة»). Each
    // is marked once sent (notified, reminded_on, reminder_sent_at, last_sent_at), so a minute's run never sends one twice.
    if (new URL(req.url).searchParams.get("only") === "minute") {
      const tasks = await dispatchTaskReminders(db).catch((e) => (console.error("[mahdi minute tasks]", e), null));
      const plan = await dispatchPlanAlerts(db).catch((e) => (console.error("[mahdi minute plan]", e), null));
      const habitAlerts = await dispatchHabitAlerts(db, new Date(), { needSentColumn: true }).catch((e) => (console.error("[mahdi minute habit alerts]", e), null));
      const habits = await dispatchReminders(db).catch((e) => (console.error("[mahdi minute habits]", e), null));
      return NextResponse.json({ tasks, plan, habitAlerts, habits });
    }
    // once SQL 0127 is in, everything at a chosen time goes every minute (above): not here too (both start on :00, :15…)
    const minuteJob = !(await db.rpc("mahdi_cron_ok", { p_token: "" })).error;
    const habits = minuteJob ? { checked: 0, sent: 0 } : await dispatchReminders(db);
    // «مهام اليوم» at their times (never stops the habit reminders above)
    const tasks = minuteJob ? null : await dispatchTaskReminders(db).catch((e) => (console.error("[mahdi dispatch tasks]", e), null));
    // «اجعله تنبيهًا» on habits and planner events (each on its own, never stopping the others)
    const habitAlerts = minuteJob ? null : await dispatchHabitAlerts(db).catch((e) => (console.error("[mahdi dispatch habit alerts]", e), null));
    const plan = minuteJob ? null : await dispatchPlanAlerts(db).catch((e) => (console.error("[mahdi dispatch plan alerts]", e), null));
    // «تنبيهات تجيبك للتطبيق» (the morning verse, the review notes, the streak, the comeback): never stops what is above
    const engage = await dispatchEngagement(db).catch((e) => (console.error("[mahdi dispatch engage]", e), null));
    // «مسابقة الثبات»: the organiser's weekly summary and the end of a contest (SQL 0137; nothing before it)
    const contests = await dispatchContests(db).catch((e) => (console.error("[mahdi dispatch contests]", e), null));
    // the heartbeat (migration 0102): the app can say when the dispatcher last ran
    await db.from("mahdi_dispatch_runs").insert({ checked: habits.checked, sent: habits.sent, engage_sent: engage?.sent ?? 0 }).then(
      () => db.from("mahdi_dispatch_runs").delete().lt("ran_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
      () => undefined,
    );
    return NextResponse.json({ ...habits, tasks, habitAlerts, plan, engage, contests });
  } catch (err) {
    console.error("[mahdi dispatch]", err);
    return NextResponse.json({ error: "dispatch failed" }, { status: 500 });
  }
}
