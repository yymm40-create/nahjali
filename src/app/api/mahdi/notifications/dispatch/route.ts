import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { dispatchEngagement } from "@/lib/mahdi/server/engage";
import { dispatchHabitAlerts, dispatchPlanAlerts, dispatchReminders, dispatchTaskReminders, pushConfigured } from "@/lib/mahdi/server/notify";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.MAHDI_CRON_SECRET;
  if (!secret || secret.length < 24) return false; // never open when the secret is missing or weak
  const given = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Called by Supabase pg_cron + pg_net every 15 minutes (see supabase/migrations/0009_mahdi_notifications_cron.sql).
 * Protected by `Authorization: Bearer <MAHDI_CRON_SECRET>`; anyone else gets 404, as if the route did not exist.
 */
export async function POST(req: Request) {
  if (!authorized(req)) return new NextResponse(null, { status: 404 });
  if (!pushConfigured()) return NextResponse.json({ error: "VAPID keys are not set" }, { status: 503 });
  try {
    const db = createAdminClient();
    const habits = await dispatchReminders(db);
    // «مهام اليوم» at their times (never stops the habit reminders above)
    const tasks = await dispatchTaskReminders(db).catch((e) => (console.error("[mahdi dispatch tasks]", e), null));
    // «اجعله تنبيهًا» on habits and planner events (each on its own, never stopping the others)
    const habitAlerts = await dispatchHabitAlerts(db).catch((e) => (console.error("[mahdi dispatch habit alerts]", e), null));
    const plan = await dispatchPlanAlerts(db).catch((e) => (console.error("[mahdi dispatch plan alerts]", e), null));
    // «تنبيهات تجيبك للتطبيق» (the morning verse, the review notes, the streak, the comeback): never stops what is above
    const engage = await dispatchEngagement(db).catch((e) => (console.error("[mahdi dispatch engage]", e), null));
    // the heartbeat (migration 0102): the app can say when the dispatcher last ran
    await db.from("mahdi_dispatch_runs").insert({ checked: habits.checked, sent: habits.sent, engage_sent: engage?.sent ?? 0 }).then(
      () => db.from("mahdi_dispatch_runs").delete().lt("ran_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
      () => undefined,
    );
    return NextResponse.json({ ...habits, tasks, habitAlerts, plan, engage });
  } catch (err) {
    console.error("[mahdi dispatch]", err);
    return NextResponse.json({ error: "dispatch failed" }, { status: 500 });
  }
}
