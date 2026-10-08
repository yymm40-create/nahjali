import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { forgetAccess } from "@/lib/access";
import { isPerm, newCodeText, normalizePerms } from "@config/access";
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
  if (typeof body.action === "string" && body.action.startsWith("codes_")) return NextResponse.json(await codes(body.action, body as Record<string, unknown>));
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

const NO_TABLE = "جدول الأكواد ما انضاف للحين: شغّل ملف SQL رقم 0041 في Supabase.";
const whole = (v: unknown, min: number, max: number) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < min || n > max) throw new UserError(`الرقم لازم بين ${min} و${max}.`, 400);
  return n;
};

/**
 * «الأكواد» — many codes, each with its own sections and time, standing alone:
 *   codes_new     { label, code?, perms, expiresAt?, validHours?, maxUses? }   a new code (made for you when the text is empty)
 *   codes_set     { id, enabled }                                              switch ONE code off or on
 *   codes_delete  { id }                                                       remove a code (closes only what it opened)
 *   codes_unuse   { id, email }                                                close ONE person's entry of ONE code
 */
async function codes(action: string, b: Record<string, unknown>) {
  const db = createAdminClient();
  if (action === "codes_new") {
    const label = String(b.label ?? "").trim().slice(0, 80);
    if (!label) throw new UserError("اكتب اسم للكود (مثلًا: «ضيوف الألعاب»).", 400);
    const perms = normalizePerms(b.perms);
    if (!perms.length) throw new UserError("اختر قسم واحد على الأقل يفتحه هذا الكود.", 400);
    let code = String(b.code ?? "").trim();
    if (code && (code.length < 4 || code.length > 64)) throw new UserError("الكود من ٤ إلى ٦٤ حرف.", 400);
    if (!code) code = newCodeText();
    // never the same text as the old all-opening code (the two would be ambiguous)
    const { data: old } = await db.from("site_secret").select("code").eq("id", 1).maybeSingle();
    if (old?.code && old.code === code) throw new UserError("هذا نفس نص «الكود السري» الشامل؛ اختر نص ثاني.", 400);
    let expiresAt: string | null = null;
    if (b.expiresAt) {
      const t = new Date(String(b.expiresAt));
      if (Number.isNaN(t.getTime()) || t.getTime() <= Date.now()) throw new UserError("وقت الانتهاء لازم يكون في المستقبل.", 400);
      expiresAt = t.toISOString();
    }
    const { data, error } = await db
      .from("site_codes")
      .insert({ label, code, perms, expires_at: expiresAt, valid_hours: whole(b.validHours, 1, 8760), max_uses: whole(b.maxUses, 1, 10000), enabled: true })
      .select("id,code")
      .single();
    if (error) {
      if (error.code === "23505") throw new UserError("هذا الكود مستخدم؛ اختر نص ثاني.", 409);
      throw new UserError(NO_TABLE, 500);
    }
    return { ok: true, id: data.id, code: data.code };
  }
  const id = String(b.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new UserError("كود غير معروف.", 400);
  if (action === "codes_set") {
    if (typeof b.enabled !== "boolean") throw new UserError("طلب غير صحيح.", 400);
    const { error } = await db.from("site_codes").update({ enabled: b.enabled }).eq("id", id);
    if (error) throw new UserError(NO_TABLE, 500);
  } else if (action === "codes_delete") {
    const { error } = await db.from("site_codes").delete().eq("id", id);
    if (error) throw new UserError(NO_TABLE, 500);
  } else if (action === "codes_unuse") {
    const email = String(b.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new UserError("إيميل غير صحيح.", 400);
    await db.from("site_code_uses").delete().eq("code_id", id).eq("email", email);
    forgetAccess(email);
    return { ok: true };
  } else throw new UserError("طلب غير معروف.", 400);
  // a code changed: every person it concerned gets their sections read again
  forgetAccess();
  return { ok: true };
}
