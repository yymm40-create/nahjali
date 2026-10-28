import { describe, expect, it } from "vitest";
import { shortBalance, UserError } from "@/lib/api";
import { DEFAULT_CREDIT_SETTINGS, exactPackOf, exactSar, packOf } from "@config/credits";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";

describe("«خلص رصيدك»: ادفع بمقدار العملية بس", () => {
  it("a short wallet is a 402 that says what the operation costs and carries it for the page", () => {
    const e = shortBalance(150, 0, "هالصورة");
    expect(e).toBeInstanceOf(UserError);
    expect(e.status).toBe(402);
    expect(e.data).toEqual({ topup: { need: 150, balance: 0, what: "هالصورة" } });
    expect(e.message).toContain("تكلفة هالصورة ¤1.50");
    expect(shortBalance(300, 120, "هالفيديو").message).toContain("ورصيدك ¤1.20");
  });

  it("the exact top-up is whole riyals of what is missing, 3 to 1000, and an order can be made of it", () => {
    expect(exactSar(150)).toBe(3);
    expect(exactSar(300)).toBe(3);
    expect(exactSar(301)).toBe(4);
    expect(exactSar(1)).toBe(3);
    expect(exactSar(0)).toBe(3);
    expect(exactSar(10_000_000)).toBe(1000);
    expect(exactPackOf("exact-3")).toMatchObject({ id: "exact-3", price: 3, credit: 3 });
    expect(exactPackOf("exact-2")).toBeNull();
    expect(exactPackOf("exact-0")).toBeNull();
    expect(exactPackOf("exact-1001")).toBeNull();
    expect(exactPackOf("exact-2.5")).toBeNull();
    expect(exactPackOf("x")).toBeNull();
    expect(packOf(DEFAULT_CREDIT_SETTINGS, "exact-7")?.price).toBe(7);
    expect(packOf(DEFAULT_CREDIT_SETTINGS, DEFAULT_CREDIT_SETTINGS.packs[0].id)?.id).toBe(DEFAULT_CREDIT_SETTINGS.packs[0].id);
  });

  it("is in what Claude knows about the site", () => {
    expect(JAWAD_KNOWLEDGE).toContain("«خلص رصيدك»");
  });
});
