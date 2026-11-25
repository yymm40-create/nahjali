import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { landing } from "@/lib/credits/checkout";
import { SUPPORT_AMOUNTS, SUPPORT_DEFAULT, SUPPORT_DONE_PATH, SUPPORT_REF, supportLine } from "@/lib/mahdi/support";
import { parseAmount } from "@/lib/pay-link";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

// «اريد زر لدعم تطبيق المهدي او طريقه ادعم هذا التطبيق بما استطيع»: the free-amount payment link, marked for the app and back to it.
describe("«ادعم التطبيق»", () => {
  it("marks the payment as support for «لأجل المهدي»", () => {
    expect(supportLine("")).toBe("دعم لأجل المهدي");
    expect(supportLine("أبو علي")).toBe("دعم لأجل المهدي — أبو علي");
  });
  it("comes back to the app's own thank-you page after paying, and the site's payments are unchanged", () => {
    expect(landing("pay", true, { paymentId: "p1", ref: SUPPORT_REF })).toBe(`${SUPPORT_DONE_PATH}?id=p1`);
    expect(landing("pay", false, { paymentId: "p1", ref: SUPPORT_REF })).toBe(`${SUPPORT_DONE_PATH}?id=p1`);
    expect(landing("pay", true, { paymentId: "p1" })).toBe("/jawad-ai/pay/done?id=p1");
    expect(landing("pay", true, { paymentId: "p1", ref: "" })).toBe("/jawad-ai/pay/done?id=p1");
  });
  it("offers quick amounts the payment link accepts", () => {
    for (const v of [...SUPPORT_AMOUNTS, SUPPORT_DEFAULT]) expect(parseAmount(v)).toBe(v);
  });
  it("sends `for: mahdi` to the existing /api/pay and the route honours it", () => {
    expect(read("src/components/mahdi/support/SupportView.tsx")).toMatch(/fetch\("\/api\/pay"[^\n]*for: SUPPORT_REF/);
    const route = read("src/app/api/pay/route.ts");
    expect(route).toContain("b.for === SUPPORT_REF");
    expect(route).toContain("supportLine(note)");
  });
  it("shows amounts with the coin's logo, never a currency word", () => {
    for (const p of ["src/components/mahdi/support/SupportView.tsx", "src/app/mahdi/(app)/support/page.tsx", "src/app/mahdi/(app)/support/done/page.tsx"]) {
      const src = read(p);
      expect(src, p).not.toMatch(/ريال|ر\.س|SAR/);
    }
    expect(read("src/app/mahdi/(app)/support/done/page.tsx")).toContain("<Amount riyals={r.amount}");
  });
  it("is reachable from «المزيد»", () => {
    expect(read("src/app/mahdi/(app)/more/page.tsx")).toContain("<SupportLink />");
  });
});
