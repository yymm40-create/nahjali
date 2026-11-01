import { NextResponse } from "next/server";
import { check, mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { logEvent, raceById } from "@/lib/mahdi/server/race";
import { createAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };
/** What a player's own phone may add to the record; the leader's phone adds its round tools too. */
const PLAYER_KINDS = new Set(["page_opened", "role_seen", "game_opened"]);

/** The live record for the leader's monitor (newest first). */
export const GET = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { user } = await requireProfile(req);
  const db = createAdminClient();
  const race = await raceById(db, requireId((await params).id));
  if (race.owner_id !== user.id) throw new UserError("هذي للقائد فقط", 403);
  const events = check(await db.from("mahdi_race_events").select("id, at, actor_name, kind, data").eq("race_id", race.id).order("id", { ascending: false }).limit(100));
  return NextResponse.json({ events }, { headers: { "Cache-Control": "private, no-store" } });
});

/** One thing that happened on a phone. */
export const POST = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { user, profile } = await requireProfile(req);
  const db = createAdminClient();
  const race = await raceById(db, requireId((await params).id));
  const b = await readJson(req, 4 * 1024);
  const kind = typeof b.kind === "string" ? b.kind : "";
  if (!kind || kind.length > 40) throw new UserError("طلب غير معروف", 400);
  const data = b.data && typeof b.data === "object" && !Array.isArray(b.data) ? (b.data as Record<string, unknown>) : {};
  let name = profile.displayName;
  if (race.owner_id !== user.id) {
    if (!PLAYER_KINDS.has(kind)) throw new UserError("هذي للقائد فقط", 403);
    const { data: m } = await db.from("mahdi_race_players").select("name").eq("race_id", race.id).eq("user_id", user.id).maybeSingle();
    if (!m) throw new UserError("ما انضممت لهذي المسابقة", 403);
    name = m.name as string;
  }
  await logEvent(db, race.id, { id: user.id, name }, kind, data, b.clientAt);
  return NextResponse.json({ ok: true });
});
