import { sellHalalas } from "@config/coins";
import { beforeEach, describe, expect, it, vi } from "vitest";

const coins = vi.hoisted(() => ({ required: false, held: [] as number[], released: [] as number[] }));
const limits = vi.hoisted(() => ({ values: {} as Record<string, number> }));

vi.mock("@/lib/coins", () => ({
  coinsRequired: async () => coins.required,
  holdCoins: async (_u: string, n: number) => {
    if (n > 0) coins.held.push(n);
  },
  releaseCoins: async (_u: string, n: number) => {
    if (n > 0) coins.released.push(n);
  },
}));
vi.mock("@/lib/film/limits", () => ({
  getLimit: async (key: string) => limits.values[key] ?? 0,
}));

const { charged } = await import("@/lib/editor/pricing");
const person = { id: "u", email: "a@b.c", owner: false };

describe("the editor's prices (/admin/limits)", () => {
  beforeEach(() => {
    coins.required = false;
    coins.held = [];
    coins.released = [];
    limits.values = {};
  });

  it("is free while coins aren't required, even with a price", async () => {
    limits.values.editor_price_claude = 3;
    expect(await charged(person, "editor_price_claude", 1, "x", async () => "ok")).toBe("ok");
    expect(coins.held).toEqual([]);
  });

  it("holds the price × units when coins are required", async () => {
    coins.required = true;
    limits.values.editor_price_caption = 2;
    await charged(person, "editor_price_caption", 3, "x", async () => null);
    // cost 2 × 3 = 6 halalas → the customer pays it rounded up to half a riyal + the profit (rounded up): 1.00 SAR
    expect(coins.held).toEqual([sellHalalas(6)]);
    expect(sellHalalas(6)).toBe(100);
    expect(coins.released).toEqual([]);
  });

  it("gives the coins back when the call fails", async () => {
    coins.required = true;
    limits.values.editor_price_claude = 4;
    await expect(charged(person, "editor_price_claude", 1, "x", async () => Promise.reject(new Error("down")))).rejects.toThrow("down");
    expect(coins.released).toEqual([sellHalalas(4)]);
  });

  it("never charges the owner", async () => {
    coins.required = true;
    limits.values.editor_price_claude = 4;
    await charged({ ...person, owner: true }, "editor_price_claude", 1, "x", async () => null);
    expect(coins.held).toEqual([]);
  });
});
