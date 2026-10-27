import { describe, expect, it } from "vitest";
import { cleanPayer, payerOf, PAYER_PREFIX, type CreditOrder } from "@/lib/credits/orders";
import { creditText } from "@/lib/credits/telegram";

const order = (note: string): CreditOrder => ({ id: "x", userId: "u", email: "a@b.c", name: "علي", phone: "0555", packId: "exact-2", packName: "بمقدار اللي تحتاجه", price: 2, credit: 2, status: "transferred", transferredAt: null, confirmedAt: null, creditedAt: null, note, createdAt: "2026-10-27T10:00:00Z", source: null });

describe("اسم الدافع في التحويل البنكي", () => {
  it("is cleaned (no markup, one line, 80 characters) and read back from the order's note", () => {
    expect(cleanPayer("  محمد   <b>أحمد</b>\n")).toBe("محمد b أحمد /b");
    expect(cleanPayer("x".repeat(200))).toHaveLength(80);
    expect(cleanPayer(5)).toBe("");
    expect(payerOf({ note: `${PAYER_PREFIX}محمد أحمد` })).toBe("محمد أحمد");
    expect(payerOf({ note: "paylink:123" })).toBe("");
  });
  it("shows in the owner's Telegram message, and only when it was written", () => {
    expect(creditText(order(`${PAYER_PREFIX}محمد أحمد`))).toContain("🏦 اسم الدافع في التحويل: <b>محمد أحمد</b>");
    expect(creditText(order(""))).not.toContain("اسم الدافع");
  });
});
