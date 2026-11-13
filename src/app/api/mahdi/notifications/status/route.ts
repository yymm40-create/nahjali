import { NextResponse } from "next/server";
import { isAdmin } from "@config/site";
import { mahdiRoute, requireProfile } from "@/lib/mahdi/server/api";
import { pushConfigured } from "@/lib/mahdi/server/notify";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Is the notification system alive? For everyone: the server's keys are set, and how many devices of mine are subscribed. For the
 * owner also: when the 15-minute dispatcher last ran (its heartbeat, migration 0102), how many people have a device, and what the
 * last runs sent. Nothing secret is returned (only whether a secret is set).
 */
export const GET = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  const mine = await supabase.from("mahdi_push_subscriptions").select("id", { count: "exact", head: true });
  const out: Record<string, unknown> = {
    configured: pushConfigured(),
    cronSecret: (process.env.MAHDI_CRON_SECRET ?? "").length >= 24,
    devices: mine.count ?? 0,
    admin: false,
  };
  if (isAdmin(user.email)) {
    const db = createAdminClient();
    const [runs, people, log] = await Promise.all([
      db.from("mahdi_dispatch_runs").select("ran_at, checked, sent, engage_sent").order("ran_at", { ascending: false }).limit(8),
      db.from("mahdi_push_subscriptions").select("user_id", { count: "exact", head: true }),
      db.from("mahdi_push_log").select("user_id", { count: "exact", head: true }).gte("day", new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)),
    ]);
    Object.assign(out, {
      admin: true,
      // null error = the heartbeat table exists (migration 0102)
      heartbeatReady: !runs.error,
      // minutes since each run (counted here, on the server, so the page needs no clock)
      runs: runs.error ? [] : (runs.data ?? []).map((x) => ({ ...x, age_min: Math.max(0, Math.round((Date.now() - new Date(x.ran_at).getTime()) / 60_000)) })),
      devicesAll: people.count ?? 0,
      engageLastDay: log.error ? null : (log.count ?? 0),
    });
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "private, no-store" } });
});
