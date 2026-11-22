import { NextResponse } from "next/server";
import { isAdmin } from "@config/site";
import { mahdiRoute, requireUser, UserError } from "@/lib/mahdi/server/api";
import { allSheikhRows } from "@/lib/mahdi/server/sheikh";
import { sheikhLog } from "@/lib/mahdi/sheikh-log";
import { t } from "@/lib/mahdi/i18n";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store" };

/** «أسئلة الشيخ الذكي» (the owner only): every question people asked (not the owner's own) with its answer and the numbers, nobody named. */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireUser(req);
  if (!isAdmin(user.email)) throw new UserError(t.errors.notFound, 404);
  if (new URL(req.url).searchParams.has("probe")) return NextResponse.json({ ok: true }, { headers: NO_STORE });
  const rows = await allSheikhRows();
  if (!rows) return NextResponse.json({ ready: false }, { headers: NO_STORE });
  // the owner's own questions are left out (his order, 22 November 2026): only what people asked
  return NextResponse.json({ ready: true, ...sheikhLog(rows.filter((r) => r.user_id !== user.id), null) }, { headers: NO_STORE });
});
