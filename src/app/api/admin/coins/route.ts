import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantCoins } from "@/lib/coins";
import { isAdmin } from "@config/site";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NO_TABLES = "جداول النقود الذكية ما انضافت للحين: شغّل ملف SQL رقم 0015 في Supabase.";

/**
 * Owner only — «النقود الذكية»:
 *   { action: "required", on }               paid film operations need coins (on) or are free (off)
 *   { action: "grant", email, amount, note }  add (or take back, negative) coins for one user
 *   { action: "library", email, months }      «المكتبة» for one user: add months (1–12) from today or from its end, or stop it (0)
 */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  const body = (await req.json().catch(() => ({}))) as { action?: string; on?: boolean; email?: string; amount?: unknown; note?: string; months?: unknown };
  const db = createAdminClient();

  if (body.action === "required") {
    const { error } = await db.from("film_limits").upsert({ scope: "all", target: "", key: "coins_required", value: body.on ? 1 : 0, updated_at: new Date().toISOString() });
    if (error) throw new UserError("جدول الحدود ما انضاف (SQL رقم 0014).", 500);
    return NextResponse.json({ ok: true });
  }

  /** The account with this email (it must be registered on the site). */
  async function userByEmail(raw: unknown) {
    const email = String(raw ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new UserError("اكتب إيميل صحيح.", 400);
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      const found = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
      if (found) return found;
      if (data.users.length < 1000) break;
    }
    throw new UserError("ما لقينا حساب بهذا الإيميل (لازم يكون مسجّل في الموقع).", 404);
  }

  if (body.action === "library") {
    const months = Number(body.months);
    if (!Number.isInteger(months) || months < 0 || months > 12) throw new UserError("اختر عدد الأشهر (١–١٢) أو أوقفها.", 400);
    const target = await userByEmail(body.email);
    await db.from("smart_coin_wallets").upsert({ user_id: target }, { onConflict: "user_id", ignoreDuplicates: true });
    const { data: w, error: readError } = await db.from("smart_coin_wallets").select("library_until").eq("user_id", target).maybeSingle();
    if (readError) throw new UserError("«المكتبة» تحتاج ملف قاعدة البيانات 0025 في Supabase.", 500);
    const now = Date.now();
    const from = Math.max(now, w?.library_until ? new Date(w.library_until as string).getTime() : 0);
    const until = months === 0 ? null : new Date(new Date(from).setMonth(new Date(from).getMonth() + months)).toISOString();
    const { error } = await db.from("smart_coin_wallets").update({ library_until: until, library_period: months === 0 ? null : months === 12 ? "yearly" : "monthly", updated_at: new Date().toISOString() }).eq("user_id", target);
    if (error) throw new UserError("ما انحفظ. جرّب بعد شوي.", 500);
    return NextResponse.json({ ok: true, until });
  }

  if (body.action === "grant") {
    const amount = Number(body.amount);
    if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 100000) throw new UserError("اكتب عدد صحيح (موجب للإضافة، سالب للسحب).", 400);
    const target = await userByEmail(body.email);
    const balance = await grantCoins(target, amount, String(body.note ?? "").slice(0, 120) || "من صاحب الموقع").catch(() => {
      throw new UserError(NO_TABLES, 500);
    });
    return NextResponse.json({ ok: true, balance });
  }

  throw new UserError("طلب غير معروف.", 400);
});
