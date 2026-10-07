import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIMITS } from "@/lib/film/limits";
import { isAdmin } from "@config/site";

/**
 * Owners only — «حيدرة كت»'s prices for everyone:
 *   { action: "set", scope: "all", key, value }   value null/"" removes the row (back to the default)
 */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  const body = (await req.json().catch(() => ({}))) as { action?: string; scope?: string; key?: string; value?: unknown };
  if (body.action !== "set" || body.scope !== "all") throw new UserError("طلب غير معروف.", 400);
  const key = String(body.key ?? "");
  if (!(key in LIMITS)) throw new UserError("حد غير معروف.", 400);
  const clear = body.value === null || body.value === "";
  const value = Number(body.value);
  if (!clear && !(Number.isInteger(value) && value >= 0 && value <= 100000)) throw new UserError("اكتب رقم صحيح (٠ أو أكثر).", 400);
  const db = createAdminClient();
  const { error } = clear
    ? await db.from("film_limits").delete().eq("scope", "all").eq("target", "").eq("key", key)
    : await db.from("film_limits").upsert({ scope: "all", target: "", key, value, updated_at: new Date().toISOString() });
  if (error) throw new UserError("جدول الحدود ما انضاف للحين: شغّل ملف SQL رقم 0014 في Supabase.", 500);
  return NextResponse.json({ ok: true });
});
