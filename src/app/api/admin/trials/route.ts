import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { createAdminClient, listAllUsers } from "@/lib/supabase/admin";
import { ABOVE_YOU, isAdmin, mayActOn } from "@config/site";

/** Owner-only: set a custom daily free-trial limit for one email. { email, daily } (daily = 0 → back to default) */
export const POST = handle(async (req: Request) => {
  const me = await requireApiUser();
  if (!isAdmin(me.email)) throw new UserError("غير مسموح.", 404);
  const body = (await req.json().catch(() => ({}))) as { email?: string; daily?: unknown };
  const email = (body.email ?? "").trim().toLowerCase();
  const daily = Math.floor(Number(body.daily));
  if (!email) throw new UserError("اكتب الإيميل.", 400);
  if (!mayActOn(me.email, email)) throw new UserError(ABOVE_YOU, 403);
  if (!(daily >= 0 && daily <= 100)) throw new UserError("العدد لازم بين ٠ و ١٠٠.", 400);

  const db = createAdminClient();
  const target = (await listAllUsers()).find((u) => u.email?.toLowerCase() === email);
  if (!target) throw new UserError("هذا الإيميل ما سجّل دخول للموقع بعد.", 404);

  const { error } = await db.auth.admin.updateUserById(target.id, {
    app_metadata: { ...target.app_metadata, daily_trials: daily > 0 ? daily : null },
  });
  if (error) throw error;
  return NextResponse.json({ ok: true, daily: daily > 0 ? daily : null });
});
