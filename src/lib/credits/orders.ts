// «اشحن رصيدك» — an order to top up the balance: started (the bank data shown) → «تم التحويل» (the owner's phone buzzes) → the owner's
// «✅» adds the balance ONCE (credited_at is marked first, so a repeat can never add it twice) or «❌». Server only.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantCoins } from "@/lib/coins";
import { cleanPhone, type Bank } from "@config/course";
import { CREDITS, packOf } from "@config/credits";
import { loadSettings as loadCourseSettings } from "@/lib/course/settings";
import { loadCreditSettings } from "./settings";
import { notifyCreditTransfer } from "./telegram";

const db = () => createAdminClient();

export type CreditStatus = "started" | "transferred" | "confirmed" | "rejected";

export interface CreditOrder {
  id: string;
  userId: string | null;
  email: string;
  name: string;
  phone: string;
  packId: string;
  packName: string;
  price: number;
  credit: number;
  status: CreditStatus;
  transferredAt: string | null;
  confirmedAt: string | null;
  creditedAt: string | null;
  note: string;
  createdAt: string;
}

const view = (r: Record<string, unknown>): CreditOrder => ({
  id: r.id as string,
  userId: (r.user_id as string | null) ?? null,
  email: String(r.email ?? ""),
  name: String(r.name ?? ""),
  phone: String(r.phone ?? ""),
  packId: String(r.pack_id ?? ""),
  packName: String(r.pack_name ?? ""),
  price: Number(r.price_sar ?? 0),
  credit: Number(r.credit_sar ?? 0),
  status: r.status as CreditStatus,
  transferredAt: (r.transferred_at as string | null) ?? null,
  confirmedAt: (r.confirmed_at as string | null) ?? null,
  creditedAt: (r.credited_at as string | null) ?? null,
  note: String(r.note ?? ""),
  createdAt: String(r.created_at),
});

const NO_TABLE = "شحن الرصيد ما انضاف للحين في قاعدة البيانات: شغّل ملف SQL رقم 0049 في Supabase.";
const wrap = (e: { message?: string } | null) => {
  if (e) throw new UserError(/relation|does not exist|schema cache|PGRST205/i.test(e.message ?? "") ? NO_TABLE : "تعذّر تنفيذ الطلب. جرّب مرة ثانية.", 500);
};

/** «ادفع الآن»: the order for a package and the bank data to transfer to (the same bank data as the course, set in /admin/course). */
export async function startCreditOrder(user: { id: string; email?: string | null }, b: { pack: unknown; name: unknown; phone: unknown }): Promise<{ order: CreditOrder; bank: Bank }> {
  const [s, course] = await Promise.all([loadCreditSettings(), loadCourseSettings()]);
  const pack = packOf(s, b.pack);
  if (!pack) throw new UserError("هذي الباقة غير متاحة؛ حدّث الصفحة.", 409);
  const name = typeof b.name === "string" ? b.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > 80) throw new UserError("اكتب اسمك الثلاثي (يساعدنا نطابق التحويل).", 400);
  const phone = cleanPhone(b.phone);
  if (!phone) throw new UserError("رقم الجوال غير صحيح؛ اكتبه مع المفتاح أو بصيغة 05xxxxxxxx.", 400);
  const bank = course.bank;
  if (!bank.iban && !bank.account) throw new UserError("بيانات التحويل ما انضافت للحين؛ تواصل معنا وبنرسلها لك.", 503);

  const { data: rows, error } = await db().from("credit_orders").select("*").eq("user_id", user.id).in("status", ["started", "transferred"]).order("created_at", { ascending: false }).limit(20);
  wrap(error);
  const open = (rows ?? []).map(view);
  const at = new Date().toISOString();
  const same = open.find((o) => o.status === "started" && o.packId === pack.id);
  const fields = { email: user.email ?? "", name, phone, pack_name: pack.name, price_sar: pack.price, credit_sar: pack.credit, updated_at: at };
  if (same) {
    const { data, error: e2 } = await db().from("credit_orders").update(fields).eq("id", same.id).eq("status", "started").select("*").single();
    wrap(e2);
    return { order: view(data!), bank };
  }
  if (open.length >= CREDITS.maxOpen) throw new UserError("عندك طلبات شحن مفتوحة كثيرة؛ انتظر تأكيد الموجودة أو راسلنا.", 429);
  const { data, error: e3 } = await db().from("credit_orders").insert({ user_id: user.id, pack_id: pack.id, ...fields }).select("*").single();
  wrap(e3);
  return { order: view(data!), bank };
}

/** «تم التحويل»: the owner is told at once (his phone buzzes). */
export async function markCreditTransferred(user: { id: string }, orderId: string): Promise<CreditOrder> {
  const { data: row, error } = await db().from("credit_orders").select("*").eq("id", orderId).eq("user_id", user.id).maybeSingle();
  wrap(error);
  if (!row) throw new UserError("ما لقينا هذا الطلب.", 404);
  const o = view(row);
  if (o.status === "transferred" || o.status === "confirmed") return o;
  if (o.status !== "started") throw new UserError("هذا الطلب مغلق؛ ابدأ طلبًا جديدًا.", 409);
  const at = new Date().toISOString();
  const { data, error: e2 } = await db().from("credit_orders").update({ status: "transferred", transferred_at: at, updated_at: at }).eq("id", o.id).eq("status", "started").select("*").maybeSingle();
  wrap(e2);
  const done = data ? view(data) : o;
  try {
    await notifyCreditTransfer(done);
  } catch (e) {
    console.error("credits notify", e);
  }
  return done;
}

/** The balance, added ONCE: the mark is set first; if the wallet fails the mark goes back, so «أكّد» again adds it. */
async function credit(o: CreditOrder, at: string): Promise<CreditOrder> {
  if (!o.userId || o.creditedAt) return o;
  const { data: marked } = await db().from("credit_orders").update({ credited_at: at }).eq("id", o.id).is("credited_at", null).select("*").maybeSingle();
  if (!marked) return o;
  try {
    await grantCoins(o.userId, o.credit * 100, `شحن رصيد: باقة ${o.packName}`);
    return view(marked);
  } catch (e) {
    await db().from("credit_orders").update({ credited_at: null }).eq("id", o.id);
    throw e;
  }
}

/** The owner saw the money: confirmed and the balance added (once, even if the first try failed). */
export async function confirmCreditOrder(id: string, by: string): Promise<{ order: CreditOrder; already: boolean }> {
  const at = new Date().toISOString();
  const { data, error } = await db().from("credit_orders").update({ status: "confirmed", confirmed_at: at, confirmed_by: by.slice(0, 120), updated_at: at }).eq("id", id).in("status", ["started", "transferred", "rejected"]).select("*").maybeSingle();
  wrap(error);
  let row = data;
  if (!row) {
    const { data: cur } = await db().from("credit_orders").select("*").eq("id", id).maybeSingle();
    if (!cur) throw new UserError("ما لقينا هذا الطلب.", 404);
    row = cur;
  }
  const o = view(row);
  return { order: o.status === "confirmed" ? await credit(o, at) : o, already: !data && !!o.creditedAt };
}

export async function rejectCreditOrder(id: string, by: string, note = ""): Promise<CreditOrder> {
  const at = new Date().toISOString();
  const { data, error } = await db().from("credit_orders").update({ status: "rejected", note: `${by.slice(0, 60)}${note ? `: ${note}` : ""}`.slice(0, 400), updated_at: at }).eq("id", id).in("status", ["started", "transferred"]).select("*").maybeSingle();
  wrap(error);
  if (!data) throw new UserError("هذا الطلب ما عاد قابل للرفض (مؤكد أو مرفوض من قبل).", 409);
  return view(data);
}

export async function getCreditOrder(id: string): Promise<CreditOrder | null> {
  const { data } = await db().from("credit_orders").select("*").eq("id", id).maybeSingle();
  return data ? view(data) : null;
}

export async function myCreditOrders(userId: string): Promise<CreditOrder[]> {
  const { data, error } = await db().from("credit_orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
  if (error) return [];
  return (data ?? []).map(view);
}

export async function listCreditOrders(status?: CreditStatus): Promise<CreditOrder[]> {
  let q = db().from("credit_orders").select("*").order("created_at", { ascending: false }).limit(300);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []).map(view);
}
