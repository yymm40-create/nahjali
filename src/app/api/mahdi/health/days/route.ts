import { NextResponse } from "next/server";
import { cleanDay } from "@/lib/mahdi/health/tracker";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { missingTable } from "@/lib/mahdi/server/inbox";

/** «الصحة العلوية» tracker: my days from `?from=YYYY-MM-DD` (default: the last 400). `ready` is false until SQL 0060 runs. */
export const GET = mahdiRoute(async (req: Request) => {
  const { supabase } = await requireProfile(req);
  const from = new URL(req.url).searchParams.get("from");
  let q = supabase.from("mahdi_health_days").select("data").order("day", { ascending: false }).limit(400);
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) q = q.gte("day", from);
  const { data, error } = await q;
  if (error) {
    if (missingTable(error)) return NextResponse.json({ ready: false, days: [] });
    throw error;
  }
  return NextResponse.json({ ready: true, days: (data ?? []).map((r) => cleanDay(r.data)).filter(Boolean) });
});

/** Saves one day. */
export const PUT = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  const day = cleanDay((await readJson(req)).day);
  if (!day) throw new UserError(t.errors.invalid, 400);
  const { error } = await supabase.from("mahdi_health_days").upsert({ user_id: user.id, day: day.date, data: day, updated_at: new Date().toISOString() });
  if (error) {
    if (missingTable(error)) return NextResponse.json({ ready: false, day });
    throw error;
  }
  return NextResponse.json({ ready: true, day });
});
