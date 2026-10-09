// «دورة الجواد الذكي» — a buyer's order: started at «ادفع الآن» (the price they saw is kept for a few hours), «تم التحويل» tells the
// owner, and the owner's «أكّد» unlocks them: the group link on the page, and the gift of زهرات (riyals of balance) granted ONCE.
// Server only.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantCoins } from "@/lib/coins";
import { COURSE, cleanPhone, offerFor, offersAt, type Bank, type Product, type CourseSettings } from "@config/course";
import { loadSettings } from "./settings";
import { notifyTransfer } from "./telegram";

const db = () => createAdminClient();

export type Status = "started" | "transferred" | "confirmed" | "rejected";

export interface Order {
  id: string;
  userId: string | null;
  email: string;
  name: string;
  phone: string;
  product: Product;
  phase: "A" | "B" | "C";
  amount: number;
  was: number;
  bonus: number;
  status: Status;
  lockedUntil: string;
  transferredAt: string | null;
  confirmedAt: string | null;
  bonusGrantedAt: string | null;
  note: string;
  createdAt: string;
}

const view = (r: Record<string, unknown>): Order => ({
  id: r.id as string,
  userId: (r.user_id as string | null) ?? null,
  email: String(r.email ?? ""),
  name: String(r.name ?? ""),
  phone: String(r.phone ?? ""),
  product: r.product as Product,
  phase: r.phase as Order["phase"],
  amount: Number(r.amount_sar ?? 0),
  was: Number(r.was_sar ?? 0),
  bonus: Number(r.bonus_sar ?? 0),
  status: r.status as Status,
  lockedUntil: String(r.locked_until),
  transferredAt: (r.transferred_at as string | null) ?? null,
  confirmedAt: (r.confirmed_at as string | null) ?? null,
  bonusGrantedAt: (r.bonus_granted_at as string | null) ?? null,
  note: String(r.note ?? ""),
  createdAt: String(r.created_at),
});

const NO_TABLE = "«دورة الجواد» ما انضافت للحين في قاعدة البيانات: شغّل ملف SQL رقم 0047 في Supabase.";
const wrap = (e: { message?: string } | null) => {
  if (e) throw new UserError(/relation|does not exist|schema cache|PGRST205/i.test(e.message ?? "") ? NO_TABLE : "تعذّر تنفيذ الطلب. جرّب مرة ثانية.", 500);
};

/** Which products a confirmed order covers: the whole course covers live and recorded too. */
const covers = (have: Product, want: Product) => have === want || have === "combo";

export interface Started {
  order: Order;
  bank: Bank;
}

/** «ادفع الآن»: the order for a product at today's price (the price is kept for a few hours), and the bank data to transfer to. */
export async function startOrder(user: { id: string; email?: string | null }, b: { product: Product; name: unknown; phone: unknown }, now = Date.now()): Promise<Started> {
  const s = await loadSettings();
  const offer = offerFor(s, b.product, now);
  if (!offer) throw new UserError("هذا الخيار غير متاح الحين؛ حدّث الصفحة وشوف الخيارات المتاحة.", 409);
  const name = typeof b.name === "string" ? b.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > 80) throw new UserError("اكتب اسمك الثلاثي (يساعدنا نطابق التحويل).", 400);
  const phone = cleanPhone(b.phone);
  if (!phone) throw new UserError("رقم الجوال غير صحيح؛ اكتبه مع المفتاح أو بصيغة 05xxxxxxxx.", 400);
  if (!s.bank.iban && !s.bank.account) throw new UserError("بيانات التحويل ما انضافت للحين؛ تواصل معنا وبنرسلها لك.", 503);

  const { data: rows, error } = await db().from("course_orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
  wrap(error);
  const mine = (rows ?? []).map(view);
  if (mine.some((o) => o.status === "confirmed" && covers(o.product, b.product))) throw new UserError("اشتراكك مؤكد من قبل ✅", 409);
  const lock = new Date(now + COURSE.lockMinutes * 60_000).toISOString();
  const open = mine.find((o) => o.product === b.product && o.status === "started");
  const base = { email: user.email ?? "", name, phone, phase: "A" as const, amount_sar: offer.price, was_sar: offer.was, bonus_sar: offer.bonus, locked_until: lock, updated_at: new Date(now).toISOString() };
  const phase = offersAt(s, now).phase;
  if (phase === "soon") throw new UserError("الدورة ما بدأت للحين.", 409);
  if (open) {
    // the same order again: the price stays while it is kept, else it follows today's
    const keep = new Date(open.lockedUntil).getTime() > now;
    const patch = keep ? { name, phone, email: base.email, updated_at: base.updated_at } : { ...base, phase };
    const { data, error: e2 } = await db().from("course_orders").update(patch).eq("id", open.id).eq("status", "started").select("*").single();
    wrap(e2);
    return { order: view(data!), bank: s.bank };
  }
  if (mine.filter((o) => o.status === "started" || o.status === "transferred").length >= COURSE.maxOpen) throw new UserError("عندك طلبات مفتوحة كثيرة؛ انتظر تأكيد الموجودة أو تواصل معنا.", 429);
  const { data, error: e3 } = await db().from("course_orders").insert({ user_id: user.id, product: b.product, ...base, phase }).select("*").single();
  wrap(e3);
  return { order: view(data!), bank: s.bank };
}

/** «تم التحويل»: the owner is told (his phone buzzes). */
export async function markTransferred(user: { id: string }, orderId: string, now = Date.now()): Promise<Order> {
  const { data: row, error } = await db().from("course_orders").select("*").eq("id", orderId).eq("user_id", user.id).maybeSingle();
  wrap(error);
  if (!row) throw new UserError("ما لقينا هذا الطلب.", 404);
  const o = view(row);
  if (o.status === "transferred" || o.status === "confirmed") return o;
  if (o.status !== "started") throw new UserError("هذا الطلب مغلق؛ ابدأ طلبًا جديدًا.", 409);
  if (new Date(o.lockedUntil).getTime() < now) throw new UserError("انتهت مهلة السعر. اضغط «ادفع الآن» من جديد وشوف السعر الحالي.", 409);
  const at = new Date(now).toISOString();
  const { data, error: e2 } = await db().from("course_orders").update({ status: "transferred", transferred_at: at, updated_at: at }).eq("id", o.id).eq("status", "started").select("*").maybeSingle();
  wrap(e2);
  const done = data ? view(data) : o;
  // the owner's phone: a failure to message must never fail the buyer (the dashboard lists the order anyway)
  try {
    await notifyTransfer(done, await loadSettings());
  } catch (e) {
    console.error("course notify", e);
  }
  return done;
}

/** The gift of زهرات (1 زهرة = 1 riyal of balance; the wallet counts halalas), granted ONCE: the mark is set first, so a repeat can never give it twice. */
async function grantGift(o: Order, at: string): Promise<Order> {
  if (!(o.bonus > 0 && o.userId) || o.bonusGrantedAt) return o;
  const { data: marked } = await db().from("course_orders").update({ bonus_granted_at: at }).eq("id", o.id).is("bonus_granted_at", null).select("*").maybeSingle();
  if (!marked) return o;
  try {
    await grantCoins(o.userId, o.bonus * 100, `هدية ${o.bonus} زهرة من ${COURSE.name}`);
    return view(marked);
  } catch (e) {
    // the wallet failed: the mark goes back, so pressing «أكّد» again gives it (the order itself stays confirmed)
    await db().from("course_orders").update({ bonus_granted_at: null }).eq("id", o.id);
    throw e;
  }
}

/** The owner saw the money: the buyer is unlocked and the gift is granted (once, even if the first try failed). */
export async function confirmOrder(id: string, by: string, now = Date.now()): Promise<{ order: Order; already: boolean }> {
  const at = new Date(now).toISOString();
  const { data, error } = await db().from("course_orders").update({ status: "confirmed", confirmed_at: at, confirmed_by: by.slice(0, 120), updated_at: at }).eq("id", id).in("status", ["started", "transferred", "rejected"]).select("*").maybeSingle();
  wrap(error);
  let row = data;
  if (!row) {
    const { data: cur } = await db().from("course_orders").select("*").eq("id", id).maybeSingle();
    if (!cur) throw new UserError("ما لقينا هذا الطلب.", 404);
    row = cur;
  }
  const o = view(row);
  return { order: o.status === "confirmed" ? await grantGift(o, at) : o, already: !data };
}

export async function rejectOrder(id: string, by: string, note = ""): Promise<Order> {
  const at = new Date().toISOString();
  const { data, error } = await db().from("course_orders").update({ status: "rejected", note: `${by.slice(0, 60)}${note ? `: ${note}` : ""}`.slice(0, 400), updated_at: at }).eq("id", id).in("status", ["started", "transferred"]).select("*").maybeSingle();
  wrap(error);
  if (!data) throw new UserError("هذا الطلب ما عاد قابل للرفض (مؤكد أو مرفوض من قبل).", 409);
  return view(data);
}

export async function getOrder(id: string): Promise<Order | null> {
  const { data } = await db().from("course_orders").select("*").eq("id", id).maybeSingle();
  return data ? view(data) : null;
}

/** A person's latest order of each product, and what their confirmed ones unlock. */
export async function myCourse(userId: string): Promise<{ orders: Order[]; unlocked: boolean; groupOpen: boolean; products: Product[] }> {
  const { data } = await db().from("course_orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  const orders = (data ?? []).map(view);
  const confirmed = orders.filter((o) => o.status === "confirmed");
  // the group link shows from «تم التحويل» on: the owner lets nobody in WhatsApp before he has seen the money
  return { orders, unlocked: confirmed.length > 0, groupOpen: orders.some((o) => o.status === "transferred" || o.status === "confirmed"), products: [...new Set(confirmed.flatMap((o) => (o.product === "combo" ? (["live", "recorded", "combo"] as Product[]) : [o.product])))] };
}

export async function listOrders(status?: Status): Promise<Order[]> {
  let q = db().from("course_orders").select("*").order("created_at", { ascending: false }).limit(300);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []).map(view);
}

export type { CourseSettings };
