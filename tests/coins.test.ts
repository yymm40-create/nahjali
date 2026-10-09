import { describe, expect, it, beforeEach } from "vitest";
import { DEFAULT_PRICING, coinsFor, costHalalas, fmtSar, getPricing, roundUpStep, savingPct, sellHalalas, setPricing, wasHalalas, PLANS, ONE_TIME_PASS, topUpCoins } from "@config/coins";
import { coinsOf, costOf, wasOf } from "@config/jawad/generators";

describe("riyal pricing: cost → rounded up to half a riyal → + margin (rounded up)", () => {
  beforeEach(() => setPricing(null));

  it("defaults: 3.75 per dollar, half-riyal step, 30% now and 60% struck", () => {
    expect(getPricing()).toEqual({ usdToSar: 3.75, stepHalalas: 50, marginPct: 30, wasMarginPct: 60 });
  });

  it("rounds UP to the step: 0.45 → 0.50, 1.10 → 1.50, 1.50 stays", () => {
    expect(roundUpStep(45)).toBe(50);
    expect(roundUpStep(110)).toBe(150);
    expect(roundUpStep(150)).toBe(150);
    expect(roundUpStep(1)).toBe(50);
    expect(roundUpStep(0)).toBe(0);
  });

  it("cost in halalas from dollars, rounded up to the halala", () => {
    expect(costHalalas(0.12)).toBe(45); // 0.45 SAR
    expect(costHalalas(0.01)).toBe(4); // 3.75 halalas → 4
    expect(costHalalas(0)).toBe(0);
  });

  it("the customer's price: rounded cost + rounded profit", () => {
    // cost 0.45 → 0.50; profit 30% of 0.45 = 0.135 → 0.50 ⇒ 1.00
    expect(sellHalalas(45)).toBe(100);
    // cost 1.10 → 1.50; profit 0.33 → 0.50 ⇒ 2.00
    expect(sellHalalas(110)).toBe(200);
    // cost 10.00 → 10.00; profit 3.00 → 3.00 ⇒ 13.00
    expect(sellHalalas(1000)).toBe(1300);
    expect(sellHalalas(0)).toBe(0);
  });

  it("the struck «was» price uses the full margin and is never below the price", () => {
    expect(wasHalalas(1000)).toBe(1600);
    expect(wasHalalas(45)).toBe(100); // 0.50 + (0.27 → 0.50)
    for (const c of [1, 45, 110, 333, 1000, 12345]) expect(wasHalalas(c)).toBeGreaterThanOrEqual(sellHalalas(c));
    expect(savingPct(1300, 1600)).toBe(19);
    expect(savingPct(100, 100)).toBe(0);
  });

  it("coinsFor goes from dollars straight to the customer's halalas", () => {
    expect(coinsFor(0.12)).toBe(100);
    expect(coinsFor(0)).toBe(0);
  });

  it("the generators' price keys (hundredths of a halala of cost) sell the same way", () => {
    expect(costOf(4500)).toBe(45);
    expect(coinsOf(4500)).toBe(100);
    expect(wasOf(100000)).toBe(1600);
  });

  it("the owner's settings change every price, and bad values fall back", () => {
    setPricing({ usdToSar: 4, stepHalalas: 10, marginPct: 50, wasMarginPct: 100 });
    expect(costHalalas(0.1)).toBe(40);
    expect(sellHalalas(40)).toBe(60);
    expect(wasHalalas(40)).toBe(80);
    setPricing({ usdToSar: -1, stepHalalas: 0, marginPct: -5, wasMarginPct: -5 });
    expect(getPricing()).toEqual(DEFAULT_PRICING);
  });

  it("formats halalas as riyals", () => {
    expect(fmtSar(250)).toBe("2.50");
    expect(fmtSar(1000)).toBe("10");
    expect(fmtSar(0)).toBe("0");
    expect(fmtSar(123456)).toBe("1,234.56");
    expect(fmtSar(null)).toBe("0");
  });

  it("plans and top-ups are riyal for riyal (halalas)", () => {
    for (const p of PLANS) expect(p.coins).toBe(p.monthlySar * 100);
    expect(ONE_TIME_PASS.coins).toBe(ONE_TIME_PASS.priceSar * 100);
    expect(topUpCoins(20)).toBe(2000);
  });
});
