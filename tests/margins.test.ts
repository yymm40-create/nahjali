import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { claudeHalalas, coinsFor, DEFAULT_PRICING, getPricing, marginFor, sellKind } from "@config/coins";
import { coinsOf, costOf, generatorById, priceKindOf } from "@config/jawad/generators";
import { evaluate, priceTable } from "@/lib/jawad/engine";
import { priceOf } from "@/lib/coins";
import { serviceKind } from "@/lib/film/credits";
import { jobMix } from "@/lib/jawad/student/jobs";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";

const read = (p: string) => readFileSync(p, "utf8");

describe("الربح: ٦٠٪ على كل شي في البرنامج، إلا روبوتات Claude (وحيدرا ماكس) ٣٠٪ — بدون خصم ولا سعر مشطوب", () => {
  it("has the owner's margins by default", () => {
    expect(DEFAULT_PRICING).toEqual({ usdToSar: 3.75, stepHalalas: 50, marginPct: 60 });
    expect([marginFor("image"), marginFor("video"), marginFor("claude"), marginFor("max"), marginFor("other")]).toEqual([60, 60, 30, 30, 60]);
  });

  it("prices each kind at its margin (cost 1000 halalas)", () => {
    expect(sellKind(1000, "image")).toBe(1600);
    expect(sellKind(1000, "video")).toBe(1600);
    expect(sellKind(1000, "other")).toBe(1600);
    // Claude: the real cost + 30٪, to the halala, never rounded up to half a riyal; «حيدرا ماكس» the same
    expect(sellKind(1000, "claude")).toBe(1300);
    expect(sellKind(7, "claude")).toBe(10);
    expect(sellKind(1000, "max")).toBe(1300);
    expect(coinsFor(1, "claude")).toBe(claudeHalalas(1));
    expect(coinsFor(1, "max")).toBe(claudeHalalas(1, getPricing(), "max"));
    expect(claudeHalalas(1, getPricing(), "max")).toBe(Math.ceil(375 * 1.3));
  });

  it("no discount anywhere: the offer week and the struck price are gone from the code", () => {
    const coins = read("config/coins.ts");
    expect(coins).not.toMatch(/PROMO|promoActive|wasHalalas|wasMarginPct/);
    expect(read("config/jawad/types.ts")).not.toContain("was?: number");
    expect(read("config/jawad/generators.ts")).not.toMatch(/wasOf|REALFACE_MARGIN_PCT|realFaceLift/);
  });

  it("a studio generator is priced by what it makes: GPT Image 2 «ربح الصور», the other picture models the general, a video 40٪, sound the general", () => {
    expect(priceKindOf(generatorById("openai-gpt-image-2"))).toBe("image");
    const others = ["image", "video", "audio"].map((o) => priceKindOf({ id: "x", output: o }));
    expect(others).toEqual(["other", "video", "other"]);
    const vid = generatorById("byteplus-seedance-2-0")!;
    const e = evaluate(vid, { settings: { resolution: "1080p", duration: 15, ratio: "16:9" }, prompt: "x", instructions: "", refStyle: "none", refs: [] }, priceTable(vid, undefined));
    expect(e.price.ok).toBe(true);
    if (e.price.ok) {
      const cost = costOf(e.price.lines.reduce((s, l) => s + l.centi, 0));
      expect(e.price.coins).toBe(sellKind(cost, "video"));
      // the videos and the rest share the one margin (60٪)
      expect(e.price.coins).toBe(sellKind(cost, "other"));
      expect(e.price.coins).toBe(coinsOf(e.price.lines.reduce((s, l) => s + l.centi, 0), "video"));
    }
  });

  it("the film's jobs follow their service; a mixed job splits its cost by its parts", () => {
    expect(["anthropic", "openai_image", "seedance", "lipsync", "elevenlabs"].map(serviceKind)).toEqual(["claude", "image", "video", "video", "other"]);
    expect(priceOf(10, { claude: 1, image: 1 })).toBe(coinsFor(5, "claude") + coinsFor(5, "image"));
    expect(priceOf(10, true)).toBe(coinsFor(10, "claude"));
    expect(priceOf(10, false)).toBe(coinsFor(10, "other"));
    expect(priceOf(0, { claude: 1 })).toBe(0);
  });

  it("the student's steps: Claude's own work, GPT Image 2's pictures, a step's own split when it has one", () => {
    expect(jobMix("understand")).toBe("claude");
    expect(jobMix("plan")).toBe("claude");
    expect(jobMix("extract")).toBe("claude");
    expect(jobMix("pictures")).toBe("image");
    expect(jobMix("media")).toBe("other");
    expect(jobMix("final", { _mix: { claude: 2, image: 1, other: 0 } })).toEqual({ claude: 2, image: 1, other: 0 });
  });

  it("is wired where money is taken", () => {
    expect(read("src/lib/jawad/engine.ts")).toContain("priceKindOf(def)");
    // «حيدرا ماكس»'s programs are metered at its own profit
    for (const f of ["src/lib/claude-code/picture.ts", "src/lib/claude-code/grade.ts", "src/lib/claude-code/layout.ts", "src/lib/claude-code/voice.ts"]) expect(read(f), f).toContain('{ price: "max" }');
    for (const f of ["src/lib/editor/claude-code.ts", "src/lib/editor/scene/director.ts", "src/lib/editor/scene/cover.ts"]) expect(read(f), f).toContain('"max",');
    expect(read("src/lib/film/usage.ts")).toContain("serviceKind(input.service)");
    expect(read("src/lib/jawad/server/smart-edit.ts")).toContain('coinsOf(sum(extra.filter((l) => l.claude)), "claude")');
    expect(read("src/lib/editor/upscale.ts")).toContain('"video")');
    expect(read("src/lib/mahdi/server/cover-enhance.ts")).toContain('"image")');
    // one profit setting, under a new key (the old per-kind margins still stored no longer apply)
    expect(read("src/lib/coins.ts")).toContain('price_profit_pct: "marginPct"');
    expect(read("src/lib/coins.ts")).not.toContain('price_margin_pct: "marginPct"');
    expect(read("src/lib/film/limits.ts")).toMatch(/price_profit_pct: \{[^}]*default: 60/);
  });

  it("is in what Claude knows about the site", () => {
    expect(JAWAD_KNOWLEDGE).toContain("60٪ on EVERYTHING in the program");
    expect(JAWAD_KNOWLEDGE).toContain("its real usage + 30٪");
    expect(JAWAD_KNOWLEDGE).toContain("NO DISCOUNT");
    expect(JAWAD_KNOWLEDGE).not.toContain("«أسبوع العرض» (the owner, 26 October");
  });
});
