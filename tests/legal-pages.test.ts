import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CARD_PAYMENT_PUBLIC } from "@config/pricing";

const read = (p: string) => readFileSync(p, "utf8");

describe("الصفحات القانونية (شرط بوابة الدفع)", () => {
  it("has a refund and exchange policy page linked from the footer, the shop, the terms and the sitemap, and open without the secret gate", () => {
    expect(read("src/app/refund/page.tsx")).toContain("سياسة الاسترجاع والاستبدال");
    for (const f of ["src/components/jawad/Landing.tsx", "src/components/jawad/credits/CreditsShop.tsx", "src/app/terms/page.tsx", "src/app/sitemap.ts", "src/app/robots.ts", "src/components/SecretGate.tsx"]) expect(read(f), f).toContain("/refund");
  });
  it("the terms and the privacy policy speak of card payment only once it is open to everyone", () => {
    expect(read("src/app/terms/page.tsx")).toContain("CARD_PAYMENT_PUBLIC");
    expect(read("src/app/privacy/page.tsx")).toContain("CARD_PAYMENT_PUBLIC");
    expect(CARD_PAYMENT_PUBLIC).toBe(false); // flip it with the gateway's approval, not before
  });
});
