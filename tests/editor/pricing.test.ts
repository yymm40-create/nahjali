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
  getLimit: async (key: string) => limits.values[key] ?? ({ editor_claude_daily: 40, editor_speech_minutes: 120 } as Record<string, number>)[key] ?? 0,
}));

const { charged, editorLimit } = await import("@/lib/editor/pricing");
const person = { id: "u", email: "a@b.c", owner: false };

describe("the editor's limits and prices (/admin/limits)", () => {
  beforeEach(() => {
    coins.required = false;
    coins.held = [];
    coins.released = [];
    limits.values = {};
  });

  it("uses the owner's daily limits, and the owner has none", async () => {
    expect(await editorLimit("editor_claude_daily", person)).toBe(40);
    limits.values.editor_claude_daily = 5;
    expect(await editorLimit("editor_claude_daily", person)).toBe(5);
    expect(await editorLimit("editor_claude_daily", { ...person, owner: true })).toBe(Infinity);
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
    expect(coins.held).toEqual([6]);
    expect(coins.released).toEqual([]);
  });

  it("gives the coins back when the call fails", async () => {
    coins.required = true;
    limits.values.editor_price_claude = 4;
    await expect(charged(person, "editor_price_claude", 1, "x", async () => Promise.reject(new Error("down")))).rejects.toThrow("down");
    expect(coins.released).toEqual([4]);
  });

  it("never charges the owner", async () => {
    coins.required = true;
    limits.values.editor_price_claude = 4;
    await charged({ ...person, owner: true }, "editor_price_claude", 1, "x", async () => null);
    expect(coins.held).toEqual([]);
  });
});
