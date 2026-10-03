import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { pushConfigured, pushToUser, type SubRow } from "@/lib/mahdi/server/notify";
import { createAdminClient } from "@/lib/supabase/admin";

const lastTest = new Map<string, number>();

/** Sends a test notification to my own devices (at most one every 20 seconds). */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  if (!pushConfigured()) throw new UserError(t.notify.notConfigured, 503);
  const last = lastTest.get(user.id) ?? 0;
  if (Date.now() - last < 20_000) throw new UserError(t.notify.testWait, 429);
  lastTest.set(user.id, Date.now());
  const { data } = await supabase.from("mahdi_push_subscriptions").select("id, user_id, endpoint, p256dh, auth, failures");
  const subs = (data ?? []) as SubRow[];
  if (!subs.length) throw new UserError(t.notify.testNone, 400);
  const sent = await pushToUser(createAdminClient(), subs, { title: t.notify.title2, body: t.notify.body, url: "/mahdi", tag: "mahdi-test" });
  if (!sent) throw new UserError(t.notify.testNone, 400);
  return NextResponse.json({ sent });
});
