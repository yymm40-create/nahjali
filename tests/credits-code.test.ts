import { describe, expect, it } from "vitest";
import { activeCode, discounted, readCreditSettings } from "@config/credits";

describe("كود خصم الشحن", () => {
  const until = new Date(Date.now() + 3600_000).toISOString();
  const s = readCreditSettings({ codes: [{ code: " jawad15 ", pct: 15, until }, { code: "OLD", pct: 20, until: "2020-01-01T00:00:00Z" }, { code: "x", pct: 15, until }, { code: "BIG", pct: 95, until }] });

  it("keeps only well-formed codes, upper-cased", () => {
    expect(s.codes?.map((c) => c.code)).toEqual(["JAWAD15", "OLD"]);
  });
  it("works while its time lasts, whatever the case typed", () => {
    expect(activeCode(s, "Jawad15")?.pct).toBe(15);
    expect(activeCode(s, "OLD")).toBeNull();
    expect(activeCode(s, "NOPE")).toBeNull();
  });
  it("takes the percent off in whole riyals, rounded down, at least one", () => {
    expect(discounted(10, 15)).toBe(8);
    expect(discounted(119, 15)).toBe(101);
    expect(discounted(549, 15)).toBe(466);
    expect(discounted(100, 15)).toBe(85);
    expect(discounted(1, 15)).toBe(1);
  });
  it("a saved list without codes reads as none", () => {
    expect(readCreditSettings({}).codes).toEqual([]);
  });
});
