import { NextResponse } from "next/server";
import { mahdiRoute, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { raceById, raceExport } from "@/lib/mahdi/server/race";
import { createAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/** The day's whole record as one file, for building the film. Leader only. */
export const GET = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { user } = await requireProfile(req);
  const db = createAdminClient();
  const race = await raceById(db, requireId((await params).id));
  if (race.owner_id !== user.id) throw new UserError("هذي للقائد فقط", 403);
  const body = await raceExport(db, race);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="race-${race.code}.json"`, "Cache-Control": "private, no-store" },
  });
});
