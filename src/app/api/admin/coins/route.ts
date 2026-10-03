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
 */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  const body = (await req.json().catch(() => ({}))) as { action?: string; on?: boolean; email?: string; amount?: unknown; note?: string };
  const db = createAdminClient();

  if (body.action === "required") {
    const { error } = await db.from("film_limits").upsert({ scope: "all", target: "", key: "coins_required", value: body.on ? 1 : 0, updated_at: new Date().toISOString() });
    if (error) throw new UserError("جدول الحدود ما انضاف (SQL رقم 0014).", 500);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "grant") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const amount = Number(body.amount);
    if (!EMAIL_RE.test(email)) throw new UserError("اكتب إيميل صحيح.", 400);
    if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 100000) throw new UserError("اكتب عدد صحيح (موجب للإضافة، سالب للسحب).", 400);
    let target: string | undefined;
    for (let page = 1; page <= 20 && !target; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      target = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
      if (data.users.length < 1000) break;
    }
    if (!target) throw new UserError("ما لقينا حساب بهذا الإيميل (لازم يكون مسجّل في الموقع).", 404);
    const balance = await grantCoins(target, amount, String(body.note ?? "").slice(0, 120) || "من صاحب الموقع").catch(() => {
      throw new UserError(NO_TABLES, 500);
    });
    return NextResponse.json({ ok: true, balance });
  }

  throw new UserError("طلب غير معروف.", 400);
});
