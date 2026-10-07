import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { dispatchReminders, dispatchTaskReminders, pushConfigured } from "@/lib/mahdi/server/notify";
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
    return NextResponse.json({ ...habits, tasks });
  } catch (err) {
    console.error("[mahdi dispatch]", err);
    return NextResponse.json({ error: "dispatch failed" }, { status: 500 });
  }
}
