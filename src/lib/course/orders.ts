// «دورة الجواد الذكي» — a buyer's order: started at «ادفع الآن» (the price they saw is kept for a few hours), «تم التحويل» tells the
// owner, and the owner's «أكّد» unlocks them: the group link on the page, and the gift of زهرات (riyals of balance) granted ONCE.
// Server only.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantCoins } from "@/lib/coins";
import { COURSE, cleanPhone, isLadder, isProduct, offerFor, offersAt, type Bank, type Product, type CourseSettings } from "@config/course";
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
  /** the lesson-place course it buys (null on the first orders, before each course had its own page) */
  courseId: string | null;
  courseTitle: string;
  /** the discount code used, if any */
  code: string;
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
  courseId: (r.course_id as string | null) ?? null,
  courseTitle: "",
  code: String(r.code ?? ""),
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

/** The price a course's discount code gives (null when the code isn't one of that course's active codes). */
export async function codePrice(courseId: string, raw: unknown): Promise<{ code: string; price: number } | null> {
  const code = String(raw ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,40}$/.test(code) || !/^[0-9a-f-]{36}$/i.test(courseId)) return null;
  const { data } = await db().from("learn_codes").select("price_sar").eq("course_id", courseId).eq("code", code).maybeSingle();
  const price = Number(data?.price_sar) || 0;
  return price > 0 ? { code, price } : null;
}

/** The order with its course's name (for the owner's message). */
async function titled(o: Order): Promise<Order> {
  if (!o.courseId) return o;
  const { data } = await db().from("learn_courses").select("title").eq("id", o.courseId).maybeSingle();
  return { ...o, courseTitle: String(data?.title ?? "") };
}

export interface Started {
  order: Order;
  bank: Bank;
}

/** «ادفع الآن»: the order for ONE course at its own price (kept for a few hours), and the bank data to transfer to. */
export async function startOrder(user: { id: string; email?: string | null }, b: { courseId: unknown; name: unknown; phone: unknown; code?: unknown; product?: unknown }, now = Date.now()): Promise<Started> {
  const s = await loadSettings();
  const courseId = typeof b.courseId === "string" ? b.courseId : "";
  const { data: course } = /^[0-9a-f-]{36}$/i.test(courseId) ? await db().from("learn_courses").select("*").eq("id", courseId).maybeSingle() : { data: null };
  let price = Number(course?.price_sar) || 0;
  const was = Number(course?.was_sar) || 0;
  // a discount code of THIS course gives its own price
  const hasCode = typeof b.code === "string" && b.code.trim() !== "";
  const coded = hasCode && course?.published && price > 0 ? await codePrice(courseId, b.code) : null;
  if (hasCode && course?.published && price > 0 && !coded) throw new UserError("كود الخصم غير صحيح لهذه الدورة.", 400);
  // the clock course sells the product the person chose at today's price (a code still gives its own price); the others their recorded course
  const ladder = isLadder(s, courseId);
  const product: Product = ladder ? (isProduct(b.product) ? b.product : "combo") : "recorded";
  if (coded && !ladder) price = coded.price;
  // a course is on sale while it is shown to students and has a price
  const found = course?.published && price > 0 ? offerFor(s, product, now, price, was, courseId) : null;
  if (!found) throw new UserError(ladder && offersAt(s, now, price, was, courseId).offers.length ? "هذا الخيار ما عاد معروض بهذا السعر؛ حدّث الصفحة وشوف أسعار اليوم." : "هذه الدورة غير معروضة للبيع الحين.", 409);
  const offer = coded && ladder ? { ...found, price: coded.price, was: Math.max(found.was, found.price) } : found;
  const name = typeof b.name === "string" ? b.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > 80) throw new UserError("اكتب اسمك الثلاثي (يساعدنا نطابق التحويل).", 400);
  const phone = cleanPhone(b.phone);
  if (!phone) throw new UserError("رقم الجوال غير صحيح؛ اكتبه مع المفتاح أو بصيغة 05xxxxxxxx.", 400);
  if (!s.bank.iban && !s.bank.account) throw new UserError("بيانات التحويل ما انضافت للحين؛ تواصل معنا وبنرسلها لك.", 503);

  const { data: rows, error } = await db().from("course_orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
  wrap(error);
  const mine = (rows ?? []).map(view);
  if (mine.some((o) => o.status === "confirmed" && o.courseId === courseId)) throw new UserError("اشتراكك مؤكد من قبل ✅", 409);
  const lock = new Date(now + COURSE.lockMinutes * 60_000).toISOString();
  const open = mine.find((o) => o.courseId === courseId && o.status === "started");
  const base = { ...(coded ? { code: coded.code } : {}), product, email: user.email ?? "", name, phone, phase: "A" as const, amount_sar: offer.price, was_sar: offer.was, bonus_sar: offer.bonus, locked_until: lock, updated_at: new Date(now).toISOString() };
  const at = offersAt(s, now, price, was, courseId).phase;
  const phase = at === "soon" ? "C" : at;
  if (open) {
    // the same order again: the price stays while it is kept, else it follows today's
    const keep = new Date(open.lockedUntil).getTime() > now && open.product === product && open.amount <= offer.price && open.code === (coded?.code ?? "");
    const patch = keep ? { name, phone, email: base.email, updated_at: base.updated_at } : { ...base, ...(open.code && !coded ? { code: "" } : {}), phase };
    const { data, error: e2 } = await db().from("course_orders").update(patch).eq("id", open.id).eq("status", "started").select("*").single();
    wrap(e2);
    return { order: view(data!), bank: s.bank };
  }
  if (mine.filter((o) => o.status === "started" || o.status === "transferred").length >= COURSE.maxOpen) throw new UserError("عندك طلبات مفتوحة كثيرة؛ انتظر تأكيد الموجودة أو تواصل معنا.", 429);
  const { data, error: e3 } = await db().from("course_orders").insert({ user_id: user.id, course_id: courseId, ...base, phase }).select("*").single();
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
  if (new Date(o.lockedUntil).getTime() <= now) throw new UserError("انتهت مهلة السعر. اضغط «ادفع الآن» من جديد وشوف السعر الحالي.", 409);
  const at = new Date(now).toISOString();
  const { data, error: e2 } = await db().from("course_orders").update({ status: "transferred", transferred_at: at, updated_at: at }).eq("id", o.id).eq("status", "started").select("*").maybeSingle();
  wrap(e2);
  const done = data ? view(data) : o;
  // the owner's phone: a failure to message must never fail the buyer (the dashboard lists the order anyway)
  try {
    await notifyTransfer(await titled(done), await loadSettings());
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

/** The course this page sells opens for THIS buyer only (their e-mail is added to it): a course added later never opens by itself. */
async function openCourse(o: Order) {
  const s = await loadSettings();
  // the clock course's live-only ticket is the live session (its group), not the recording
  if (o.product === "live" && isLadder(s, o.courseId)) return;
  const id = o.courseId || s.learnCourseId;
  const email = o.email.trim().toLowerCase();
  if (!id || !email) return;
  const { error } = await db().from("learn_grants").upsert({ course_id: id, email, granted_by: "شراء" }, { onConflict: "course_id,email" });
  if (error) console.error("course open", error);
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
  if (o.status === "confirmed") await openCourse(o);
  return { order: await titled(o.status === "confirmed" ? await grantGift(o, at) : o), already: !data };
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
  return data ? await titled(view(data)) : null;
}

/** A person's latest order of each product, and what their confirmed ones unlock. */
export async function myCourse(userId: string): Promise<{ orders: Order[]; unlocked: boolean; groupOpen: boolean; products: Product[] }> {
  const { data } = await db().from("course_orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  const orders = (data ?? []).map(view);
  const confirmed = orders.filter((o) => o.status === "confirmed");
  // the group link shows from «تم التحويل» on: the owner lets nobody in WhatsApp before he has seen the money
  return { orders, unlocked: confirmed.length > 0, groupOpen: orders.some((o) => o.status === "transferred" || o.status === "confirmed"), // whoever bought the live course (or the whole one) has the recorded course too
    products: [...new Set(confirmed.flatMap((o) => (o.product === "combo" ? (["live", "recorded", "combo"] as Product[]) : o.product === "live" ? (["live", "recorded"] as Product[]) : [o.product])))] };
}

export async function listOrders(status?: Status): Promise<Order[]> {
  let q = db().from("course_orders").select("*").order("created_at", { ascending: false }).limit(300);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return [];
  const list = (data ?? []).map(view);
  // each order with its course's name (one look-up for all of them)
  const ids = [...new Set(list.map((o) => o.courseId).filter(Boolean))] as string[];
  const { data: cs } = ids.length ? await db().from("learn_courses").select("id,title").in("id", ids) : { data: [] };
  const names = new Map((cs ?? []).map((c) => [String(c.id), String(c.title ?? "")]));
  return list.map((o) => (o.courseId ? { ...o, courseTitle: names.get(o.courseId) ?? "" } : o));
}

export type { CourseSettings };
