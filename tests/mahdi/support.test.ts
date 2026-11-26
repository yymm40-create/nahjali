import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

// «ادعم التطبيق»: the owner takes no money from the app — support is sharing and rating it.
describe("«ادعم التطبيق»", () => {
  it("takes no money: no payment on the support page", () => {
    const src = read("src/components/mahdi/support/SupportView.tsx");
    expect(src).not.toMatch(/\/api\/pay|SmartCoin|amount/i);
    expect(read("src/app/api/pay/route.ts")).not.toContain("mahdi");
  });
  it("offers sharing and rating", () => {
    const src = read("src/components/mahdi/support/SupportView.tsx");
    expect(src).toContain("S.share");
    expect(src).toContain("S.rate");
  });
  it("is reachable from «المزيد»", () => {
    expect(read("src/app/mahdi/(app)/more/page.tsx")).toContain('"/mahdi/support"');
  });
});
