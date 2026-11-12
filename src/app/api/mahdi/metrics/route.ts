import { NextResponse } from "next/server";
import { isAdmin } from "@config/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { mahdiRoute, requireUser, UserError } from "@/lib/mahdi/server/api";
import { t } from "@/lib/mahdi/i18n";

/** The owner's usage numbers (migration 0110): `{ ready: false }` until the file runs. */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireUser(req);
  if (!isAdmin(user.email)) throw new UserError(t.errors.notFound, 404);
  // The «المزيد» page only asks whether to show the link
  if (new URL(req.url).searchParams.has("probe")) return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  const { data, error } = await createAdminClient().rpc("mahdi_admin_metrics");
  if (error) return NextResponse.json({ ready: false }, { headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({ ready: true, ...(data as object) }, { headers: { "Cache-Control": "private, no-store" } });
});
