import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, readSettings, type CourseSettings } from "@config/course";

// The orders against a small in-memory database: the price of the phase, the price kept for a few hours, one open order per product,
// the owner told on «تم التحويل», and — on «أكّد» — the buyer unlocked and the gift granted ONCE.
type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = { course_orders: [] };
let seq = 0;

function builder(table: string) {
  const st = { op: "select" as "select" | "insert" | "update", filters: [] as ((r: Row) => boolean)[], patch: {} as Row, order: null as null | [string, boolean], limit: 1e9 };
  const run = (): { data: Row[]; error: null } => {
    const rows = tables[table] ?? (tables[table] = []);
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
const U = { id: "u-1", email: "buyer@example.com" };
const who = { name: "محمد علي حسن", phone: "0501234567" };

beforeEach(() => {
  tables.course_orders = [];
  grant.mockClear();
  notify.mockClear();
  settings = readSettings({ ...DEFAULT_SETTINGS, launchAt: new Date(T0).toISOString(), bank, bonus: { comboA: 0, recordedB: 30, recordedC: 20 } });
});

describe("«ادفع الآن»", () => {
  it("makes an order at the price of the phase, with the bank data to transfer to", async () => {
    const { startOrder } = await import("@/lib/course/orders");
    const r = await startOrder(U, { product: "combo", ...who }, T0 + 2 * H);
    expect(r.order).toMatchObject({ product: "combo", phase: "A", amount: 40, was: 230, bonus: 0, status: "started", phone: "+966501234567", email: "buyer@example.com" });
    expect(r.bank.iban).toBe(bank.iban);
    expect(new Date(r.order.lockedUntil).getTime()).toBe(T0 + 2 * H + 180 * 60_000);
    const b = await startOrder({ id: "u-2", email: "b@x.com" }, { product: "recorded", ...who }, T0 + 30 * H);
    expect(b.order).toMatchObject({ phase: "B", amount: 80, was: 150, bonus: 30 });
    const c = await startOrder({ id: "u-3", email: "c@x.com" }, { product: "live", ...who }, T0 + 60 * H);
    expect(c.order).toMatchObject({ phase: "C", amount: 80, was: 80 });
  });

  it("refuses a product that isn't on sale in this phase, a bad name or phone, and a course that hasn't started", async () => {
    const { startOrder } = await import("@/lib/course/orders");
    await expect(startOrder(U, { product: "live", ...who }, T0 + 2 * H)).rejects.toThrow(/غير متاح/);
    await expect(startOrder(U, { product: "combo", ...who }, T0 + 30 * H)).rejects.toThrow(/غير متاح/);
    await expect(startOrder(U, { product: "combo", name: "م", phone: who.phone }, T0 + 2 * H)).rejects.toThrow(/اسمك/);
    await expect(startOrder(U, { product: "combo", name: who.name, phone: "123" }, T0 + 2 * H)).rejects.toThrow(/رقم الجوال/);
    await expect(startOrder(U, { product: "combo", ...who }, T0 - H)).rejects.toThrow(/غير متاح/);
    expect(tables.course_orders).toHaveLength(0);
  });

  it("won't take money before the bank data is set", async () => {
    settings = readSettings({ ...settings, bank: {} });
    const { startOrder } = await import("@/lib/course/orders");
    await expect(startOrder(U, { product: "combo", ...who }, T0 + H)).rejects.toThrow(/بيانات التحويل/);
  });

  it("pressing it again reuses the same order, and keeps the price while it is kept — then follows the new price", async () => {
    const { startOrder } = await import("@/lib/course/orders");
    const a = await startOrder(U, { product: "recorded", ...who }, T0 + 25 * H);
    expect(a.order.amount).toBe(80);
    // two hours later the phase changed (after 48 h): the first price is still kept
    const b = await startOrder(U, { product: "recorded", ...who, name: "محمد علي" }, T0 + 25 * H + 120 * 60_000);
    expect(b.order.id).toBe(a.order.id);
    expect(b.order.amount).toBe(80);
    expect(b.order.name).toBe("محمد علي");
    // long after it ran out, in the third phase: the same order, today's price
    const c = await startOrder(U, { product: "recorded", ...who }, T0 + 60 * H);
    expect(c.order.id).toBe(a.order.id);
    expect(c.order).toMatchObject({ amount: 100, phase: "C", bonus: 20 });
    expect(tables.course_orders).toHaveLength(1);
  });

  it("limits the open orders of one person", async () => {
    const { startOrder } = await import("@/lib/course/orders");
    for (let i = 0; i < 4; i++) tables.course_orders.push({ id: `o${i}`, user_id: U.id, product: i % 2 ? "live" : "recorded", status: "transferred", created_at: new Date(T0 + i).toISOString(), locked_until: new Date(T0).toISOString(), amount_sar: 40, was_sar: 80, bonus_sar: 0, phase: "B", name: "x", phone: "+966501234567", email: "" });
    // (both products already have an order: a third kind can't be added past the limit)
    tables.course_orders.push({ id: "o9", user_id: U.id, product: "combo", status: "rejected", created_at: new Date(T0 + 9).toISOString(), locked_until: new Date(T0).toISOString(), amount_sar: 40, was_sar: 230, bonus_sar: 0, phase: "A", name: "x", phone: "+966501234567", email: "" });
    await expect(startOrder(U, { product: "combo", ...who }, T0 + 2 * H)).rejects.toThrow(/طلبات مفتوحة/);
  });

  it("tells a confirmed buyer they are already in", async () => {
    const { startOrder, confirmOrder } = await import("@/lib/course/orders");
    const a = await startOrder(U, { product: "combo", ...who }, T0 + H);
    await confirmOrder(a.order.id, "owner");
    await expect(startOrder(U, { product: "combo", ...who }, T0 + 2 * H)).rejects.toThrow(/مؤكد/);
  });
});

describe("«تم التحويل»", () => {
  it("marks it, and tells the owner once", async () => {
    const { startOrder, markTransferred } = await import("@/lib/course/orders");
    const a = await startOrder(U, { product: "combo", ...who }, T0 + H);
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
    const a = await startOrder(U, { product: "combo", ...who }, T0 + H);
    await expect(markTransferred({ id: U.id }, a.order.id, T0 + H + 181 * 60_000)).rejects.toThrow(/انتهت مهلة السعر/);
    await expect(markTransferred({ id: "someone-else" }, a.order.id, T0 + 2 * H)).rejects.toThrow(/ما لقينا/);
    notify.mockRejectedValueOnce(new Error("telegram down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const t = await markTransferred({ id: U.id }, a.order.id, T0 + 2 * H);
    spy.mockRestore();
    expect(t.status).toBe("transferred");
  });
});

describe("the group's link", () => {
  it("is open to a buyer from «تم التحويل» on (the owner approves each join in WhatsApp) and not before, nor after a rejection", async () => {
    const { startOrder, markTransferred, rejectOrder, myCourse } = await import("@/lib/course/orders");
    expect((await myCourse(U.id)).groupOpen).toBe(false);
    const a = await startOrder(U, { product: "combo", ...who }, T0 + H);
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
  it("unlocks the buyer and grants the gift once (1 زهرة = 1 riyal = 100 halalas), however many times it is pressed", async () => {
    const { startOrder, markTransferred, confirmOrder, myCourse } = await import("@/lib/course/orders");
    const a = await startOrder(U, { product: "recorded", ...who }, T0 + 30 * H);
    await markTransferred({ id: U.id }, a.order.id, T0 + 31 * H);
    const r = await confirmOrder(a.order.id, "تيليجرام", T0 + 32 * H);
    expect(r.already).toBe(false);
    expect(r.order).toMatchObject({ status: "confirmed", bonus: 30 });
    expect(grant).toHaveBeenCalledTimes(1);
    expect(grant).toHaveBeenCalledWith(U.id, 3000, expect.stringContaining("30 زهرة"));
    const r2 = await confirmOrder(a.order.id, "لوحة", T0 + 33 * H);
    expect(r2.already).toBe(true);
    expect(grant).toHaveBeenCalledTimes(1);
    const mine = await myCourse(U.id);
    expect(mine.unlocked).toBe(true);
    expect(mine.groupOpen).toBe(true);
    expect(mine.products).toEqual(["recorded"]);
  });

  it("the whole course unlocks live and recorded; no gift when there is none; a failed grant does not leave the gift marked", async () => {
    const { startOrder, confirmOrder, myCourse } = await import("@/lib/course/orders");
    const a = await startOrder(U, { product: "combo", ...who }, T0 + H);
    await confirmOrder(a.order.id, "owner");
    expect(grant).not.toHaveBeenCalled();
    expect((await myCourse(U.id)).products.sort()).toEqual(["combo", "live", "recorded"]);

    const b = await startOrder({ id: "u-2", email: "b@x.com" }, { product: "recorded", ...who }, T0 + 30 * H);
    grant.mockRejectedValueOnce(new Error("wallet down"));
    await expect(confirmOrder(b.order.id, "owner")).rejects.toThrow("wallet down");
    expect(tables.course_orders.find((r) => r.id === b.order.id)?.bonus_granted_at).toBeNull();
    // pressing «أكّد» again gives the gift that failed (the order was already confirmed), once
    const ok = await confirmOrder(b.order.id, "owner");
    expect(ok.already).toBe(true);
    expect(grant).toHaveBeenCalledTimes(2);
    expect(tables.course_orders.find((r) => r.id === b.order.id)?.bonus_granted_at).toBeTruthy();
    await confirmOrder(b.order.id, "owner");
    expect(grant).toHaveBeenCalledTimes(2);
  });

  it("a rejected order can't be rejected again, and one the owner already confirmed can't be rejected", async () => {
    const { startOrder, rejectOrder, confirmOrder } = await import("@/lib/course/orders");
    const a = await startOrder(U, { product: "combo", ...who }, T0 + H);
    expect((await rejectOrder(a.order.id, "owner", "ما وصل التحويل")).status).toBe("rejected");
    await expect(rejectOrder(a.order.id, "owner")).rejects.toThrow(/ما عاد قابل/);
    await confirmOrder(a.order.id, "owner");
    await expect(rejectOrder(a.order.id, "owner")).rejects.toThrow(/ما عاد قابل/);
  });
});
