import { NextResponse } from "next/server";
import { check, mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { actionContext, logEvent, raceAction, raceById, raceView } from "@/lib/mahdi/server/race";
import { createAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/** The live state, as this person may see it (polled every few seconds). */
export const GET = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { user } = await requireProfile(req);
  const db = createAdminClient();
  const race = await raceById(db, requireId((await params).id));
  return NextResponse.json(await raceView(db, race, user.id), { headers: { "Cache-Control": "private, no-store" } });
});

/** The leader's controls. */
export const PATCH = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { user, profile } = await requireProfile(req);
  const db = createAdminClient();
  const race = await raceById(db, requireId((await params).id));
  if (race.owner_id !== user.id) throw new UserError("هذي للقائد فقط", 403);
  const b = await readJson(req);
  const before = await actionContext(db, race.id, b);
  await raceAction(db, race, b);
  const view = await raceView(db, await raceById(db, race.id), user.id);
  // The record keeps the action, what it touched, and the score and teams right after it.
  const { action, ...fields } = b;
  await logEvent(db, race.id, { id: user.id, name: profile.displayName }, String(action), { ...fields, ...before, scores: view.scores, teams: view.players.map((p) => ({ name: p.name, team: p.team, spy: p.spy })), winner: view.race.winner, currentRound: view.race.currentRound });
  return NextResponse.json(view);
});

/** Ends the race for good, its selfies and points with it: the leader only. */
export const DELETE = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { user } = await requireProfile(req);
  const db = createAdminClient();
  const race = await raceById(db, requireId((await params).id));
  if (race.owner_id !== user.id) throw new UserError("هذي للقائد فقط", 403);
  check(await db.from("mahdi_races").delete().eq("id", race.id));
  return NextResponse.json({ ok: true });
});
