import { NextResponse } from "next/server";
import { RACE_LIMITS } from "@config/mahdi-race";
import { check, mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { logEvent, text } from "@/lib/mahdi/server/race";
import { createAdminClient } from "@/lib/supabase/admin";

/** Joins by the code the leader shared, under the name the player chose. Joining again only changes the name. */
export const POST = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const b = await readJson(req);
  const code = text(b.code, 12).toUpperCase();
  const name = text(b.name, RACE_LIMITS.name);
  const db = createAdminClient();
  const { data: race } = await db.from("mahdi_races").select("id").eq("code", code).maybeSingle();
  if (!race) throw new UserError("الكود غير صحيح", 404);
  const { data: had } = await db.from("mahdi_race_players").select("user_id").eq("race_id", race.id).eq("user_id", user.id).maybeSingle();
  if (had) {
    check(await db.from("mahdi_race_players").update({ name }).eq("race_id", race.id).eq("user_id", user.id));
    await logEvent(db, race.id, { id: user.id, name }, "player_renamed", { name });
  } else {
    const { count } = await db.from("mahdi_race_players").select("user_id", { count: "exact", head: true }).eq("race_id", race.id);
    if ((count ?? 0) >= RACE_LIMITS.players) throw new UserError("المسابقة اكتملت", 400);
    check(await db.from("mahdi_race_players").insert({ race_id: race.id, user_id: user.id, name }));
    await logEvent(db, race.id, { id: user.id, name }, "player_joined", { name });
  }
  return NextResponse.json({ id: race.id });
});
