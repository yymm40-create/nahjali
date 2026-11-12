import { describe, expect, it } from "vitest";
import { amountLabel, cleanNote, parseAmount, PAY_MAX } from "@/lib/pay-link";
import { rulesFor } from "@/lib/rate-limit";

// «ادفع بالمبلغ اللي تبيه»: what the payer types becomes the exact invoice amount, or nothing.
describe("pay link amount", () => {
  it("reads plain, Arabic and Persian digits and decimal points", () => {
    expect(parseAmount("100")).toBe(100);
    expect(parseAmount("١٠٠")).toBe(100);
    expect(parseAmount("۲۵۰")).toBe(250);
    expect(parseAmount("12.5")).toBe(12.5);
    expect(parseAmount("١٢٫٥")).toBe(12.5);
    expect(parseAmount("12,5")).toBe(12.5);
    expect(parseAmount("1,250")).toBe(1250);
    expect(parseAmount(" 100 ريال ")).toBe(100);
    expect(parseAmount(99.999)).toBe(100);
  });
  it("refuses what is not a payable amount", () => {
    for (const v of ["", "abc", "0", "0.5", "-10", "1e5", String(PAY_MAX + 1), null, undefined, {}]) expect(parseAmount(v), String(v)).toBeNull();
  });
  it("labels whole and fractional riyals", () => {
    expect(amountLabel(100)).toBe("100");
    expect(amountLabel(12.5)).toBe("12.50");
  });
  it("keeps the note short and on one line", () => {
    expect(cleanNote("  إعلان\nماركو  ")).toBe("إعلان ماركو");
    expect(cleanNote("x".repeat(200))).toHaveLength(80);
    expect(cleanNote(5)).toBe("");
  });
  it("is rate-limited, since it needs no sign-in", () => {
    expect(rulesFor("/api/pay", "POST").some((r) => r.key === "pay")).toBe(true);
  });
});
