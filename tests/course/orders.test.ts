import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, readSettings, type CourseSettings } from "@config/course";

// The orders against a small in-memory database: the price of the phase, the price kept for a few hours, one open order per product,
// the owner told on «تم التحويل», and — on «أكّد» — the buyer unlocked and the gift granted ONCE.
type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = { course_orders: [] };
let seq = 0;

function builder(table: string) {
  const st = { op: "select" as "select" | "insert" | "update" | "upsert", filters: [] as ((r: Row) => boolean)[], patch: {} as Row, order: null as null | [string, boolean], limit: 1e9 };
  const run = (): { data: Row[]; error: null } => {
    const rows = tables[table] ?? (tables[table] = []);
    if (st.op === "upsert") {
      rows.push(st.patch);
      return { data: [st.patch], error: null };
    }
    if (st.op === "insert") {
      const r = { id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`, created_at: new Date(1_800_000_000_000 + seq).toISOString(), status: "started", note: "", bonus_granted_at: null, transferred_at: null, confirmed_at: null, ...st.patch };
      rows.push(r);
      return { data: [r], error: null };
    }
    const hit = rows.filter((r) => st.filters.every((f) => f(r)));
    if (st.op === "update") {
      hit.forEach((r) => Object.assign(r, st.patch));
      return { data: hit, error: null };
    }
    let out = hit;
    if (st.order) out = [...out].sort((a, b) => (String(a[st.order![0]]) < String(b[st.order![0]]) ? 1 : -1) * (st.order![1] ? -1 : 1));
    return { data: out.slice(0, st.limit), error: null };
  };
  const q: Record<string, unknown> = {
    select: () => q,
    insert: (p: Row) => ((st.op = "insert"), (st.patch = p), q),
    upsert: (p: Row) => ((st.op = "upsert"), (st.patch = p), q),
    update: (p: Row) => ((st.op = "update"), (st.patch = p), q),
    eq: (k: string, v: unknown) => (st.filters.push((r) => r[k] === v), q),
    in: (k: string, v: unknown[]) => (st.filters.push((r) => v.includes(r[k])), q),
    is: (k: string, v: unknown) => (st.filters.push((r) => (r[k] ?? null) === v), q),
    neq: (k: string, v: unknown) => (st.filters.push((r) => r[k] !== v), q),
    order: (k: string, o?: { ascending?: boolean }) => ((st.order = [k, o?.ascending !== false]), q),
    limit: (n: number) => ((st.limit = n), q),
    single: async () => ({ data: run().data[0] ?? null, error: null }),
    maybeSingle: async () => ({ data: run().data[0] ?? null, error: null }),
    then: (res: (v: unknown) => unknown) => Promise.resolve(run()).then(res),
  };
  return q;
}

let settings: CourseSettings;
const grant = vi.fn(async () => 0);
const notify = vi.fn(async () => true);
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => builder(t) }) }));
vi.mock("@/lib/coins", () => ({ grantCoins: (...a: unknown[]) => grant(...(a as [])) }));
vi.mock("@/lib/course/settings", () => ({ loadSettings: async () => settings }));
vi.mock("@/lib/course/telegram", () => ({ notifyTransfer: (...a: unknown[]) => notify(...(a as [])) }));

const T0 = Date.parse("2026-10-10T12:00:00Z");
const H = 3_600_000;
const bank = { holder: "علي", iban: "SA0380000000608010167519", account: "608010167519", swift: "RIBLSARI", bank: "بنك" };
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const U = { id: "u-1", email: "buyer@example.com" };
const who = { name: "محمد علي حسن", phone: "0501234567" };

beforeEach(() => {
  tables.course_orders = [];
  tables.learn_grants = [];
  tables.learn_codes = [];
  tables.learn_courses = [{ id: A, title: "دورة الجواد الأولى", published: true, price_sar: 60 }, { id: B, title: "الدورة الثانية", published: true, price_sar: 90 }];
  grant.mockClear();
  notify.mockClear();
  settings = readSettings({ ...DEFAULT_SETTINGS, launchAt: new Date(T0).toISOString(), bank, bonus: { comboA: 0, recordedB: 30, recordedC: 20 } });
});

describe("«ادفع الآن»", () => {
  it("makes an order for the recorded course at 60, with the bank data to transfer to, at any time", async () => {
    const { startOrder } = await import("@/lib/course/orders");
    for (const [i, t] of [T0 - 5 * H, T0 + 2 * H, T0 + 60 * H].entries()) {
      const r = await startOrder({ id: `u-${i}`, email: `b${i}@example.com` }, { courseId: A, ...who }, t);
      expect(r.order).toMatchObject({ product: "recorded", amount: 60, bonus: 0, status: "started", phone: "+966501234567" });
      expect(new Date(r.order.lockedUntil).getTime()).toBe(t + 180 * 60_000);
      expect(r.bank.iban).toBe(bank.iban);
    }
  });

  it("each course is sold on its own, at its own price; one that is hidden, unpriced or unknown is not sold", async () => {
    const { startOrder } = await import("@/lib/course/orders");
    const a = await startOrder(U, { courseId: A, ...who }, T0);
    const b = await startOrder(U, { courseId: B, ...who }, T0);
    expect([a.order.courseId, a.order.amount, b.order.courseId, b.order.amount]).toEqual([A, 60, B, 90]);
    tables.learn_courses[1].published = false;
    await expect(startOrder({ id: "u-8" }, { courseId: B, ...who }, T0)).rejects.toThrow(/غير معروضة/);
    tables.learn_courses[0].price_sar = null;
    await expect(startOrder({ id: "u-8" }, { courseId: A, ...who }, T0)).rejects.toThrow(/غير معروضة/);
    await expect(startOrder({ id: "u-8" }, { courseId: "33333333-3333-4333-8333-333333333333", ...who }, T0)).rejects.toThrow(/غير معروضة/);
    await expect(startOrder({ id: "u-8" }, { courseId: "x", ...who }, T0)).rejects.toThrow(/غير معروضة/);
  });

  it("buying one course doesn't say «already in» for another, and each order opens its own course only", async () => {
    const { startOrder, confirmOrder } = await import("@/lib/course/orders");
    const a = await startOrder(U, { courseId: A, ...who }, T0);
    await confirmOrder(a.order.id, "owner");
    await expect(startOrder(U, { courseId: A, ...who }, T0)).rejects.toThrow(/مؤكد/);
    const b = await startOrder(U, { courseId: B, ...who }, T0);
    await confirmOrder(b.order.id, "owner");
    expect(tables.learn_grants.map((g) => g.course_id)).toEqual([A, B]);
  });

  it("a course's discount code gives its price; a wrong code, another course's code or none changes nothing", async () => {
    const { startOrder, codePrice } = await import("@/lib/course/orders");
    tables.learn_codes = [{ course_id: A, code: "JAWAD20", price_sar: 40 }, { course_id: B, code: "ONLYB", price_sar: 50 }];
    expect(await codePrice(A, " jawad20 ")).toEqual({ code: "JAWAD20", price: 40 });
    expect(await codePrice(A, "ONLYB")).toBeNull();
    expect(await codePrice(A, "bad code!")).toBeNull();
    const a = await startOrder(U, { courseId: A, code: "jawad20", ...who }, T0);
    expect(a.order).toMatchObject({ amount: 40, code: "JAWAD20" });
    // the same open order without the code goes back to the full price
    const again = await startOrder(U, { courseId: A, ...who }, T0 + 1000);
    expect(again.order).toMatchObject({ id: a.order.id, amount: 60, code: "" });
    await expect(startOrder(U, { courseId: A, code: "ONLYB", ...who }, T0)).rejects.toThrow(/كود الخصم/);
  });

  it("the price before the discount is kept for the strike-through", async () => {
    const { startOrder } = await import("@/lib/course/orders");
    tables.learn_courses[0].was_sar = 100;
    const a = await startOrder(U, { courseId: A, ...who }, T0);
    expect(a.order).toMatchObject({ amount: 60, was: 100 });
  });

  it("refuses a bad name or phone", async () => {
    const { startOrder } = await import("@/lib/course/orders");
    await expect(startOrder(U, { courseId: A, name: "م", phone: who.phone }, T0 + 2 * H)).rejects.toThrow(/اسمك/);
    await expect(startOrder(U, { courseId: A, name: who.name, phone: "123" }, T0 + 2 * H)).rejects.toThrow(/رقم الجوال/);
    expect(tables.course_orders).toHaveLength(0);
  });

  it("won't take money before the bank data is set", async () => {
    settings = readSettings({ ...settings, bank: {} });
    const { startOrder } = await import("@/lib/course/orders");
    await expect(startOrder(U, { courseId: A, ...who }, T0 + H)).rejects.toThrow(/بيانات التحويل/);
  });

  it("pressing it again reuses the same order", async () => {
    const { startOrder } = await import("@/lib/course/orders");
    const a = await startOrder(U, { courseId: A, ...who }, T0 + 25 * H);
    const b = await startOrder(U, { courseId: A, ...who, name: "محمد علي" }, T0 + 25 * H + 60 * 60_000);
    expect(b.order.id).toBe(a.order.id);
    expect(b.order.amount).toBe(60);
    expect(b.order.name).toBe("محمد علي");
    expect(tables.course_orders).toHaveLength(1);
  });

  it("limits the open orders of one person", async () => {
    const { startOrder } = await import("@/lib/course/orders");
    for (let i = 0; i < 4; i++) tables.course_orders.push({ id: `o${i}`, user_id: U.id, product: "live", status: "transferred", created_at: new Date(T0 + i).toISOString(), locked_until: new Date(T0).toISOString(), amount_sar: 40, was_sar: 80, bonus_sar: 0, phase: "B", name: "x", phone: "+966501234567", email: "" });
    await expect(startOrder(U, { courseId: A, ...who }, T0 + 2 * H)).rejects.toThrow(/طلبات مفتوحة/);
  });

  it("tells a confirmed buyer of that course they are already in", async () => {
    const { startOrder, confirmOrder } = await import("@/lib/course/orders");
    const a = await startOrder(U, { courseId: A, ...who }, T0 + H);
    await confirmOrder(a.order.id, "owner");
    await expect(startOrder(U, { courseId: A, ...who }, T0 + 2 * H)).rejects.toThrow(/مؤكد/);
  });
});

describe("«تم التحويل»", () => {
  it("marks it, and tells the owner once", async () => {
    const { startOrder, markTransferred } = await import("@/lib/course/orders");
    const a = await startOrder(U, { courseId: A, ...who }, T0 + H);
    const t = await markTransferred({ id: U.id }, a.order.id, T0 + 2 * H);
    expect(t.status).toBe("transferred");
    expect(t.transferredAt).toBe(new Date(T0 + 2 * H).toISOString());
    expect(notify).toHaveBeenCalledTimes(1);
    const again = await markTransferred({ id: U.id }, a.order.id, T0 + 3 * H);
    expect(again.status).toBe("transferred");
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("is refused after the price ran out, for someone else's order, and the buyer is never failed by a broken notification", async () => {
    const { startOrder, markTransferred } = await import("@/lib/course/orders");
    const a = await startOrder(U, { courseId: A, ...who }, T0 + H);
    await expect(markTransferred({ id: U.id }, a.order.id, T0 + H + 181 * 60_000)).rejects.toThrow(/انتهت مهلة السعر/);
    await expect(markTransferred({ id: "someone-else" }, a.order.id, T0 + 2 * H)).rejects.toThrow(/ما لقينا/);
    notify.mockRejectedValueOnce(new Error("telegram down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const t = await markTransferred({ id: U.id }, a.order.id, T0 + 2 * H);
    spy.mockRestore();
    expect(t.status).toBe("transferred");
  });
});

describe("what a buyer has", () => {
  it("opens from «تم التحويل» for the group link only, and the course itself only once the owner confirms", async () => {
    const { startOrder, markTransferred, rejectOrder, myCourse } = await import("@/lib/course/orders");
    expect((await myCourse(U.id)).groupOpen).toBe(false);
    const a = await startOrder(U, { courseId: A, ...who }, T0 + H);
    expect((await myCourse(U.id)).groupOpen).toBe(false);
    await markTransferred({ id: U.id }, a.order.id, T0 + 2 * H);
    const m = await myCourse(U.id);
    expect(m.groupOpen).toBe(true);
    expect(m.unlocked).toBe(false);
    expect(m.products).toEqual([]);
    await rejectOrder(a.order.id, "owner");
    expect((await myCourse(U.id)).groupOpen).toBe(false);
  });
});

describe("«أكّد»", () => {
  it("unlocks the recorded course for the buyer at once, with no gift", async () => {
    const { startOrder, markTransferred, confirmOrder, myCourse } = await import("@/lib/course/orders");
    const a = await startOrder(U, { courseId: A, ...who }, T0 + 30 * H);
    await markTransferred({ id: U.id }, a.order.id, T0 + 31 * H);
    const r = await confirmOrder(a.order.id, "تيليجرام", T0 + 32 * H);
    expect(r.already).toBe(false);
    expect(r.order).toMatchObject({ status: "confirmed", bonus: 0 });
    expect(grant).not.toHaveBeenCalled();
    expect((await confirmOrder(a.order.id, "لوحة", T0 + 33 * H)).already).toBe(true);
    const mine = await myCourse(U.id);
    expect(mine.unlocked).toBe(true);
    expect(mine.products).toEqual(["recorded"]);
  });

  it("opens ONLY the course this page sells, for the buyer's e-mail — a later course is never opened by it", async () => {
    const { startOrder, confirmOrder } = await import("@/lib/course/orders");
    const a = await startOrder(U, { courseId: A, ...who }, T0 + H);
    await confirmOrder(a.order.id, "تيليجرام");
    await confirmOrder(a.order.id, "تيليجرام");
    expect(new Set(tables.learn_grants.map((g) => `${g.course_id}|${g.email}`))).toEqual(new Set([`${A}|buyer@example.com`]));
  });

  it("whoever bought the live or the whole course also has the recorded one", async () => {
    const { myCourse } = await import("@/lib/course/orders");
    const row = (id: string, user: string, product: string) => ({ id, user_id: user, product, status: "confirmed", created_at: new Date(T0).toISOString(), locked_until: new Date(T0).toISOString(), amount_sar: 40, was_sar: 80, bonus_sar: 0, phase: "A", name: "x", phone: "+966501234567", email: "" });
    tables.course_orders.push(row("c1", "u-live", "live"), row("c2", "u-combo", "combo"));
    expect((await myCourse("u-live")).products.sort()).toEqual(["live", "recorded"]);
    expect((await myCourse("u-combo")).products.sort()).toEqual(["combo", "live", "recorded"]);
  });

  it("an old order's gift is granted once; a failed grant does not leave it marked", async () => {
    const { confirmOrder } = await import("@/lib/course/orders");
    tables.course_orders.push({ id: "g1", user_id: "u-2", product: "recorded", status: "transferred", created_at: new Date(T0).toISOString(), locked_until: new Date(T0).toISOString(), amount_sar: 80, was_sar: 150, bonus_sar: 30, bonus_granted_at: null, phase: "B", name: "x", phone: "+966501234567", email: "b@x.com" });
    grant.mockRejectedValueOnce(new Error("wallet down"));
    await expect(confirmOrder("g1", "owner")).rejects.toThrow("wallet down");
    expect(tables.course_orders.find((r) => r.id === "g1")?.bonus_granted_at).toBeNull();
    const ok = await confirmOrder("g1", "owner");
    expect(ok.already).toBe(true);
    expect(grant).toHaveBeenCalledTimes(2);
    expect(grant).toHaveBeenLastCalledWith("u-2", 3000, expect.stringContaining("30 زهرة"));
    await confirmOrder("g1", "owner");
    expect(grant).toHaveBeenCalledTimes(2);
  });

  it("a rejected order can't be rejected again, and one the owner already confirmed can't be rejected", async () => {
    const { startOrder, rejectOrder, confirmOrder } = await import("@/lib/course/orders");
    const a = await startOrder(U, { courseId: A, ...who }, T0 + H);
    expect((await rejectOrder(a.order.id, "owner", "ما وصل التحويل")).status).toBe("rejected");
    await expect(rejectOrder(a.order.id, "owner")).rejects.toThrow(/ما عاد قابل/);
    await confirmOrder(a.order.id, "owner");
    await expect(rejectOrder(a.order.id, "owner")).rejects.toThrow(/ما عاد قابل/);
  });
});
