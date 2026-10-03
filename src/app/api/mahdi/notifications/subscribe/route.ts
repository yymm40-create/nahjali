import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { check, mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { createAdminClient } from "@/lib/supabase/admin";

const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/** Registers this device for Web Push: `{ endpoint, keys: { p256dh, auth } }` from `PushSubscription.toJSON()`. */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  const body = await readJson(req, 8 * 1024);
  const keys = (body.keys ?? {}) as Record<string, unknown>;
  const { endpoint } = body;
  if (typeof endpoint !== "string" || endpoint.length > 1000 || !/^https:\/\//.test(endpoint)) throw new UserError(t.errors.invalid, 400);
  if (typeof keys.p256dh !== "string" || typeof keys.auth !== "string" || keys.p256dh.length > 200 || keys.auth.length > 100 || !B64URL.test(keys.p256dh) || !B64URL.test(keys.auth)) {
    throw new UserError(t.errors.invalid, 400);
  }
  // A device can belong to one person at a time: if another account used this browser before, its row goes
  // (a cross-user write, so the service role, limited to this one endpoint)
  await createAdminClient().from("mahdi_push_subscriptions").delete().eq("endpoint", endpoint).neq("user_id", user.id);
  const { count } = await supabase.from("mahdi_push_subscriptions").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= 10) throw new UserError(t.errors.tooMany, 400);
  check(await supabase.from("mahdi_push_subscriptions").upsert({ user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, failures: 0 }, { onConflict: "endpoint" }));
  return NextResponse.json({ ok: true });
});

/** Removes this device: `{ endpoint }`. */
export const DELETE = mahdiRoute(async (req: Request) => {
  const { supabase } = await requireProfile(req);
  const { endpoint } = await readJson(req, 4 * 1024);
  if (typeof endpoint !== "string") throw new UserError(t.errors.invalid, 400);
  check(await supabase.from("mahdi_push_subscriptions").delete().eq("endpoint", endpoint));
  return NextResponse.json({ ok: true });
});
