// «نقود برتقالية»: whoever entered a code that prices everything at the tool's cost sees an orange coin and the cost
// price everywhere; nobody else ever sees either.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SmartCoin from "@/components/SmartCoin";
import Riyal from "@/components/Riyal";
import { evaluate, priceTable } from "@/lib/jawad/engine";
import { generatorById } from "@config/jawad/generators";
import { capClaudeModel, CLAUDE_MODELS, modelsUpTo } from "@config/claude-models";
import { costOfLines } from "@config/coins";

const read = (p: string) => readFileSync(p, "utf8");

describe("the coin", () => {
  it("is sky-blue for everyone by default, and orange only when asked for (a code that prices at cost)", () => {
    const sky = renderToStaticMarkup(createElement(SmartCoin, { size: 20 }));
    const orange = renderToStaticMarkup(createElement(SmartCoin, { size: 20, tone: "orange" }));
    expect(sky).toContain('data-coin="sky"');
    expect(sky).toContain("#38bdf8");
    expect(sky).not.toMatch(/#fb923c|#ea580c|orange/);
    expect(orange).toContain('data-coin="orange"');
    expect(orange).toContain("#fb923c");
    expect(orange).toContain("#ea580c");
    expect(orange).not.toContain("#38bdf8");
    // two gradients with their own ids, so a page with both never mixes them
    expect(sky).toContain('id="smart-riyal"');
    expect(orange).toContain('id="smart-riyal-orange"');
    // every price shown through the shared price component draws the same coin
    expect(renderToStaticMarkup(createElement(Riyal, { halalas: 3500 }))).toContain('data-coin="sky"');
  });

  it("follows the person's own codes: the page asks the server once, a code entry makes it ask again", () => {
    const hook = read("src/components/usePerks.ts");
    expect(hook).toContain('fetch("/api/access/perks"');
    expect(hook).toContain("sessionStorage");
    expect(read("src/components/SmartCoin.tsx")).toContain("useAtCost()");
    expect(read("src/components/SecretGate.tsx")).toContain("forgetPerks()");
    const api = read("src/app/api/access/perks/route.ts");
    expect(api).toContain("perksOf(user.email)");
    // anyone not signed in, or without such a code, gets the plain defaults
    expect(api).toContain("p?.atCost === true");
  });
});

describe("the prices an orange-coin person sees are the cost", () => {
  const vid = generatorById("byteplus-seedance-2-0")!;
  const input = { settings: { resolution: "480p", duration: 15, ratio: "16:9" }, prompt: "x", instructions: "", refStyle: "none" as const, refs: [] };

  it("the studio quote: the price table's cost to the halala, nothing struck through; unchanged for everyone else", () => {
    const table = priceTable(vid, undefined);
    const normal = evaluate(vid, input, table);
    const cost = evaluate(vid, { ...input, atCost: true }, table);
    expect(normal.price.ok && cost.price.ok).toBe(true);
    if (normal.price.ok && cost.price.ok) {
      const lines = normal.price.lines;
      expect(cost.price.coins).toBe(costOfLines(lines));
      expect(cost.price.was).toBeUndefined();
      expect(cost.price.coins).toBeLessThan(normal.price.coins);
      expect(normal.price.was).toBeGreaterThan(normal.price.coins);
    }
  });

  it("the server charges the same figure the quote shows, so the person is never asked to confirm a changed price", () => {
    const jobs = read("src/lib/jawad/server/jobs.ts");
    expect(jobs).toContain("costOfLines(e.price.lines)");
    const studio = read("src/components/jawad/studio/Studio.tsx");
    expect(studio.match(/atCost,? ?\}|atCost \}/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(studio).toContain("useAtCost()");
  });

  it("the Claude picker stops at the ceiling and shows a typical reply at cost", () => {
    const keys = (cap: Parameters<typeof modelsUpTo>[0]) => modelsUpTo(cap).map((m) => m.key);
    expect(keys("opus")).toEqual(["fable", "opus", "sonnet", "haiku"].filter((k) => k !== "fable"));
    expect(keys(null)).toHaveLength(CLAUDE_MODELS.length);
    expect(keys("haiku")).toEqual(["haiku"]);
    expect(capClaudeModel(CLAUDE_MODELS.find((m) => m.key === "fable")!.id, "opus")).toBe(CLAUDE_MODELS.find((m) => m.key === "opus")!.id);
    const picker = read("src/components/robots/ClaudeModelPicker.tsx");
    expect(picker).toContain("modelsUpTo(perks.claudeModel)");
    expect(picker).toContain("costHalalas(typicalReplyUsd(m))");
  });

  it("the person is told, on the coins page and by the header, that their coin is orange and why", () => {
    expect(read("src/app/jawad-ai/coins/page.tsx")).toContain("نقودك برتقالية");
    expect(read("src/components/jawad/CoinBalance.tsx")).toContain("بسعر الأداة");
    expect(read("src/app/admin/access/Codes.tsx")).toContain('tone="orange"');
  });
});
