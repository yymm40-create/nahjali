import { NextResponse } from "next/server";
import { mahdiRoute, requireProfile } from "@/lib/mahdi/server/api";
import { listMyGroups } from "@/lib/mahdi/server/groups";
import { myKhatmas } from "@/lib/mahdi/server/khatma";
import { createAdminClient } from "@/lib/supabase/admin";

/** «الختمة العلوية»: the khatma of each of my groups (private groups only for now). */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const db = createAdminClient();
  const { groups } = await listMyGroups(db, user.id);
  return NextResponse.json(await myKhatmas(db, user.id, groups), { headers: { "Cache-Control": "private, no-store" } });
});
