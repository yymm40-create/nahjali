import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACCESS_MODES, LIMITS, SECTIONS_ACCESS, type AccessMode, type AccessSection, type LimitKey } from "@/lib/film/limits";
import { ABOVE_YOU, isAdmin, mayActOn } from "@config/site";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Owner only — «التحكم بالموارد والمحاولات»:
 *   { action: "set", scope: "all" | "email", target?, key, value }   value null/"" removes the row (back to the default)
 *     key: a limit (LIMITS), "access_<section>" (scope all: the mode's code) or "allow_<section>" (scope email: 1 allow / 0 block)
 *   { action: "remove_email", target }                                removes every limit of one email
 */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  const body = (await req.json().catch(() => ({}))) as { action?: string; scope?: string; target?: string; key?: string; value?: unknown };
  const db = createAdminClient();
  const target = body.scope === "all" ? "" : String(body.target ?? "").trim().toLowerCase();
  if (body.scope !== "all" && (!EMAIL_RE.test(target) || target.length > 254)) throw new UserError("اكتب إيميل صحيح.", 400);
  if (!mayActOn(user.email, target)) throw new UserError(ABOVE_YOU, 403);

  if (body.action === "remove_email") {
    const { error } = await db.from("film_limits").delete().eq("scope", "email").eq("target", target);
    if (error) throw new UserError("جدول الحدود ما انضاف للحين: شغّل ملف SQL رقم 0014 في Supabase.", 500);
    return NextResponse.json({ ok: true });
  }

  if (body.action !== "set" || !(body.scope === "all" || body.scope === "email")) throw new UserError("طلب غير معروف.", 400);
  const key = String(body.key ?? "");
  const clear = body.value === null || body.value === "";
  const value = Number(body.value);
  // Who can use a section: the mode for everyone, or allow (1) / block (0) one email
  const access = /^access_(.+)$/.exec(key)?.[1];
  const allow = /^allow_(.+)$/.exec(key)?.[1];
  if (access) {
    const section = SECTIONS_ACCESS[access as AccessSection];
    const mode = Object.entries(ACCESS_MODES).find(([, m]) => m.code === value)?.[0] as AccessMode | undefined;
    if (body.scope !== "all" || !section || (!clear && (!mode || !section.modes.includes(mode)))) throw new UserError("إعداد غير صحيح.", 400);
  } else if (allow) {
    if (body.scope !== "email" || !(allow in SECTIONS_ACCESS) || (!clear && value !== 0 && value !== 1)) throw new UserError("إعداد غير صحيح.", 400);
  } else {
    if (!(key in LIMITS)) throw new UserError("حد غير معروف.", 400);
    if (body.scope === "email" && !LIMITS[key as LimitKey].perUser) throw new UserError("هذا الحد للموقع كله بس.", 400);
    if (!clear && !(Number.isInteger(value) && value >= 0 && value <= 100000)) throw new UserError("اكتب رقم صحيح (٠ أو أكثر).", 400);
  }
  const { error } = clear
    ? await db.from("film_limits").delete().eq("scope", body.scope).eq("target", target).eq("key", key)
    : await db.from("film_limits").upsert({ scope: body.scope, target, key, value, updated_at: new Date().toISOString() });
  if (error) throw new UserError("جدول الحدود ما انضاف للحين: شغّل ملف SQL رقم 0014 في Supabase.", 500);
  return NextResponse.json({ ok: true });
});
