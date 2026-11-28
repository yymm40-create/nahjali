import { NextResponse } from "next/server";
import { cleanContest } from "@/lib/mahdi/contests";
import { todayFor } from "@/lib/mahdi/engine";
import { mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { createContest, listContests } from "@/lib/mahdi/server/contests";
import { createAdminClient } from "@/lib/supabase/admin";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** «مسابقة الثبات»: the contests I run and the ones I joined. */
export const GET = mahdiRoute(async (req: Request) => {
  const { user, profile } = await requireProfile(req);
  return NextResponse.json(await listContests(createAdminClient(), user.id, todayFor(profile)), { headers: NO_STORE });
});

/** A new contest (anyone may run one; the organiser shares its link). */
export const POST = mahdiRoute(async (req: Request) => {
  const { user, profile } = await requireProfile(req);
  const today = todayFor(profile);
  const v = cleanContest(await readJson(req), today);
  if (!v.ok) throw new UserError(v.error, 400);
  const id = await createContest(createAdminClient(), user.id, v.value, today);
  return NextResponse.json({ id });
});
