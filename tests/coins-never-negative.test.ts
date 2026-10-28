import { beforeEach, describe, expect, it, vi } from "vitest";

// «حل ١» (the owner, 28 October 2026): the estimate is held before an operation, what it did not use goes back, and a
// wallet never goes below zero — so a top-up always arrives whole (no old debt eats it).

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
const wallets = new Map<string, number>();

function query(name: string) {
  const conds: [string, unknown][] = [];
  const rows = () => (tables[name] ?? []).filter((r) => conds.every(([k, v]) => r[k] === v));
  const q = {
    select: () => q,
    update: () => q,
    delete: () => q,
    eq: (k: string, v: unknown) => (conds.push([k, v]), q),
    limit: () => q,
    in: () => q,
    upsert: () => q,
    insert: () => q,
    order: () => q,
    maybeSingle: async () => {
      if (name === "smart_coin_wallets") return { data: { balance: wallets.get(String(conds[0][1])) ?? 0 }, error: null };
      if (name === "film_limits") return { data: null, error: null };
      return { data: rows()[0] ?? null, error: null };
    },
    then: (ok: (r: { data: Row[]; error: null }) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve({ data: rows(), error: null }).then(ok, bad),
  };
  return q;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: query,
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "someone@example.com" } } }) } },
    rpc: async (fn: string, a: { p_user: string; p_delta: number; p_reason: string; p_ref: string; p_label: string; p_allow_negative: boolean }) => {
      if (fn !== "adjust_smart_coins") return { data: null, error: new Error("no team") };
      const next = (wallets.get(a.p_user) ?? 0) + a.p_delta;
      if (next < 0 && a.p_delta < 0 && !a.p_allow_negative) return { data: null, error: null };
      wallets.set(a.p_user, next);
      (tables.smart_coin_ledger ??= []).push({ user_id: a.p_user, delta: a.p_delta, ref: a.p_ref, label: a.p_label, reason: a.p_reason });
      return { data: next, error: null };
    },
  }),
}));
vi.mock("@/lib/access", () => ({ unlimitedFor: async () => false, fullAccessOf: async () => null }));

const coins = await import("@/lib/coins");
const { coinsFor, claudeHalalas } = await import("@config/coins");
const { typicalReplyUsd, CLAUDE_MODELS } = await import("@config/claude-models");

beforeEach(() => {
  wallets.clear();
  for (const k of Object.keys(tables)) delete tables[k];
});

describe("the estimate is held first, and a wallet never goes below zero", () => {
  it("refuses a job the balance does not cover, and takes nothing", async () => {
    wallets.set("u", 50);
    await expect(coins.reserveCoins({ id: "u" }, "job1", 1, "test")).rejects.toThrow();
    expect(wallets.get("u")).toBe(50);
  });

  it("holds the estimate, then gives back what the job did not use", async () => {
    wallets.set("u", 2000);
    const est = coinsFor(1);
    await coins.reserveCoins({ id: "u" }, "job2", 1, "test");
    expect(wallets.get("u")).toBe(2000 - est);
    await coins.settleCoins("job2", 0.1);
    expect(wallets.get("u")).toBe(2000 - coinsFor(0.1));
  });

  it("a job that cost more than its estimate takes only what is left — never below zero", async () => {
    wallets.set("u", coinsFor(1) + 10);
    await coins.reserveCoins({ id: "u" }, "job3", 1, "test");
    await coins.settleCoins("job3", 50);
    expect(wallets.get("u")).toBe(0);
  });

  it("a failed job gives everything back", async () => {
    wallets.set("u", 2000);
    await coins.reserveCoins({ id: "u" }, "job4", 1, "test");
    await coins.refundCoins("job4");
    expect(wallets.get("u")).toBe(2000);
  });

  it("an old pay-after-use job is charged at most the balance", async () => {
    wallets.set("u", 30);
    expect(await coins.chargeAfter("u", "job5", 10, "test")).toBe(30);
    expect(wallets.get("u")).toBe(0);
  });

  it("a robot's reply holds about one reply, settles to its real cost, and a failed one gives it back", async () => {
    const model = CLAUDE_MODELS[0];
    const held = claudeHalalas(typicalReplyUsd(model));
    wallets.set("u", held - 1);
    await expect(coins.claudeMeter({ id: "u" }, model, "chat")).rejects.toThrow();
    expect(wallets.get("u")).toBe(held - 1);

    wallets.set("u", held + 100);
    const bill = await coins.claudeMeter({ id: "u" }, model, "chat");
    expect(wallets.get("u")).toBe(100);
    const charged = await bill.settle(1000);
    expect(wallets.get("u")).toBe(0);
    expect(charged).toBe(held + 100);

    wallets.set("u", held + 100);
    const failed = await coins.claudeMeter({ id: "u" }, model, "chat");
    await failed.release();
    expect(wallets.get("u")).toBe(held + 100);
  });
});
