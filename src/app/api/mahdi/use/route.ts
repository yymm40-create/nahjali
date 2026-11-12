import { NextResponse } from "next/server";
import { mahdiRoute, readJson, requireUser } from "@/lib/mahdi/server/api";
import { plausibleDay } from "@/lib/mahdi/use";

/** `{ day, area }`: I opened this section today (once per day and section; a repeat changes nothing). */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireUser(req);
  const { day, area } = await readJson(req, 1024);
  if (!plausibleDay(day) || typeof area !== "string" || !/^[a-z0-9-]{1,30}$/.test(area)) return NextResponse.json({ ok: false }, { status: 400 });
  // Before migration 0110 runs the table is missing: nothing to count yet, and the app carries on
  await supabase.from("mahdi_use_days").upsert({ user_id: user.id, day, area }, { onConflict: "user_id,day,area", ignoreDuplicates: true });
  return NextResponse.json({ ok: true });
});
