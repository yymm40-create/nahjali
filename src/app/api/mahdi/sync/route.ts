import { NextResponse } from "next/server";
import { mahdiRoute, requireProfile } from "@/lib/mahdi/server/api";
import { loadSnapshot } from "@/lib/mahdi/server/snapshot";

/** Everything the app shows, fresh from the database (used after reconnecting or returning to the app). */
export const GET = mahdiRoute(async (req: Request) => {
  const { supabase, profile } = await requireProfile(req);
  return NextResponse.json(await loadSnapshot(supabase, profile), { headers: { "Cache-Control": "no-store" } });
});
