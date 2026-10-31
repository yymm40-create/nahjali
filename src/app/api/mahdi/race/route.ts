import { NextResponse } from "next/server";
import { isAdmin } from "@config/site";
import { RACE_LIMITS } from "@config/mahdi-race";
import { check, mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { createRace, logEvent, text } from "@/lib/mahdi/server/race";
import { createAdminClient } from "@/lib/supabase/admin";

/** The races this person leads or plays in, and whether they may start one. */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const db = createAdminClient();
  const led = check(await db.from("mahdi_races").select("id, title, code, created_at").eq("owner_id", user.id).order("created_at", { ascending: false })) ?? [];
  const mine = (check(await db.from("mahdi_race_players").select("race_id").eq("user_id", user.id)) ?? []) as { race_id: string }[];
  const joined = mine.length ? (check(await db.from("mahdi_races").select("id, title, code, created_at").in("id", mine.map((m) => m.race_id)).order("created_at", { ascending: false })) ?? []) : [];
  return NextResponse.json({ canLead: isAdmin(user.email), led, joined }, { headers: { "Cache-Control": "private, no-store" } });
});

/** Starts a race with the day's default rounds: the site's owners only. */
export const POST = mahdiRoute(async (req: Request) => {
  const { user, profile } = await requireProfile(req);
  if (!isAdmin(user.email)) throw new UserError("بدء المسابقة للإدارة فقط", 403);
  const b = await readJson(req);
  const db = createAdminClient();
  const title = text(b.title, RACE_LIMITS.title);
  const id = await createRace(db, user.id, title);
  await logEvent(db, id, { id: user.id, name: profile.displayName }, "race_created", { title });
  return NextResponse.json({ id });
});
