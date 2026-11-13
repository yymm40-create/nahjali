// «🔴 النقود الحمراء»: the owner's list of e-mails that pay the platform's own price (0٪ profit, no rounding to half a
// riyal) — their coin is red everywhere, and the same cost prices as «بسعر الأداة» reach them.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SmartCoin from "@/components/SmartCoin";
import { normalizeAtCostEmails } from "@/lib/at-cost";
import { costHalalas, coinsFor } from "@config/coins";
import { priceOf } from "@/lib/coins";

const read = (p: string) => readFileSync(p, "utf8");

describe("the red coin", () => {
  it("draws red with its own gradient, never blue or orange", () => {
    const red = renderToStaticMarkup(createElement(SmartCoin, { size: 20, tone: "red" }));
    expect(red).toContain('data-coin="red"');
    expect(red).toContain('id="smart-riyal-red"');
    expect(red).toContain("#dc2626");
    expect(red).not.toMatch(/#38bdf8|#fb923c/);
  });

  it("the list keeps only well-formed e-mails, lower-cased, once", () => {
    expect(normalizeAtCostEmails([" A@B.co ", "a@b.co", "nope", 3, null])).toEqual(["a@b.co"]);
    expect(normalizeAtCostEmails(undefined)).toEqual([]);
  });

  it("an e-mail on the list prices at cost: 0٪ profit, to the halala, not half a riyal", () => {
    const usd = 0.1234;
    expect(priceOf(usd, "video", true)).toBe(costHalalas(usd));
    expect(priceOf(usd, "video", true)).toBeLessThan(coinsFor(usd, "video"));
    expect(costHalalas(usd) % 50).not.toBe(0);
  });

  it("is wired: the access turns at cost on and marks red, the page and the dashboard follow", () => {
    const access = read("src/lib/access.ts");
    expect(access).toContain("isAtCostEmail(email)");
    expect(access).toContain("red ? { ...byCodes, atCost: true } : byCodes");
    expect(read("src/app/api/access/perks/route.ts")).toContain("red: a?.redCoin === true");
    expect(read("src/components/usePerks.ts")).toContain('p.red ? "red"');
    expect(read("src/app/api/admin/access/route.ts")).toContain('body.action === "red"');
    expect(read("src/app/admin/access/page.tsx")).toContain("<RedCoins");
  });
});
