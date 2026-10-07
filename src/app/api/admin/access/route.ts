import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { forgetAccess } from "@/lib/access";
import { isPerm } from "@config/access";
import { ABOVE_YOU, isAdmin, mayActOn } from "@config/site";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Owners only — «السماح», the site's one list of who may use what:
 *   { action: "set", email, perms }   adds the email (or changes what it may use)
 *   { action: "remove", email }       takes it off the list (everything closes for it)
 *   { action: "code", code, enabled } «الكود السري»: a new code (closes it for all who came in by the old one), or on/off
 *   { action: "uncode", email }       closes it for one person who came in by the code
 */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  const body = (await req.json().catch(() => ({}))) as { action?: string; email?: string; perms?: unknown; code?: unknown; enabled?: unknown };
  if (body.action === "code") return NextResponse.json(await setCode(body.code, body.enabled));
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) throw new UserError("اكتب إيميل صحيح.", 400);
  if (!mayActOn(user.email, email)) throw new UserError(ABOVE_YOU, 403);
  if (isAdmin(email)) throw new UserError("هذا من أصحاب الموقع: كل شي مفتوح له دائمًا.", 400);
  const db = createAdminClient();

  if (body.action === "set") {
    if (!Array.isArray(body.perms)) throw new UserError("طلب غير صحيح.", 400);
    const perms = [...new Set(body.perms.filter(isPerm))];
    const { error } = await db.from("site_access").upsert({ email, perms, updated_at: new Date().toISOString() });
    if (error) throw new UserError("جدول السماح ما انضاف للحين: شغّل ملف SQL رقم 0035 في Supabase.", 500);
  } else if (body.action === "uncode") {
    await db.from("site_code_grants").delete().eq("email", email);
  } else if (body.action === "remove") {
    const { error } = await db.from("site_access").delete().eq("email", email);
    if (error) throw new UserError("جدول السماح ما انضاف للحين: شغّل ملف SQL رقم 0035 في Supabase.", 500);
  } else {
    throw new UserError("طلب غير معروف.", 400);
  }
  forgetAccess(email);
  return NextResponse.json({ ok: true });
});

async function setCode(code: unknown, enabled: unknown) {
  const db = createAdminClient();
  const { data: now } = await db.from("site_secret").select("code").eq("id", 1).maybeSingle();
  if (!now) throw new UserError("جدول الكود ما انضاف للحين: شغّل ملف SQL رقم 0035 في Supabase.", 500);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof code === "string") {
    const c = code.trim();
    if (c.length < 4 || c.length > 64) throw new UserError("الكود من ٤ إلى ٦٤ حرف.", 400);
    // a new code: a new id, so whoever came in by the old one is closed again
    if (c !== now.code) Object.assign(patch, { code: c, code_id: crypto.randomUUID() });
  }
  if (typeof enabled === "boolean") patch.enabled = enabled;
  const { error } = await db.from("site_secret").update(patch).eq("id", 1);
  if (error) throw error;
  forgetAccess();
  return { ok: true };
}
