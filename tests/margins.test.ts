import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { claudeHalalas, coinsFor, DEFAULT_PRICING, getPricing, marginFor, sellHalalas, sellKind, wasHalalas, wasMarginFor } from "@config/coins";
import { coinsOf, costOf, generatorById, priceKindOf } from "@config/jawad/generators";
import { evaluate, priceTable } from "@/lib/jawad/engine";
import { priceOf } from "@/lib/coins";
import { serviceKind } from "@/lib/film/credits";
import { jobMix } from "@/lib/jawad/student/jobs";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";

const read = (p: string) => readFileSync(p, "utf8");

describe("الربح حسب النوع: Claude وحيدرا ماكس ٦٠٪، GPT Image 2 ٣٠٪، الفيديو ٤٠٪، سيدنس الواقعي ١٠٪، الباقي ٤٠٪", () => {
  it("has the owner's margins by default, and the struck price keeps the same gap above each", () => {
    expect(DEFAULT_PRICING).toMatchObject({ marginPct: 40, wasMarginPct: 70, imageMarginPct: 30, videoMarginPct: 40 });
    expect([marginFor("image"), marginFor("video"), marginFor("claude"), marginFor("max"), marginFor("other")]).toEqual([30, 40, 60, 60, 40]);
    expect([wasMarginFor("image"), wasMarginFor("video"), wasMarginFor("other")]).toEqual([60, 70, 70]);
  });

  it("prices each kind at its own margin (cost 1000 halalas)", () => {
    expect(sellKind(1000, "image")).toBe(1000 + 300);
    expect(sellKind(1000, "video")).toBe(1000 + 400);
    expect(sellKind(1000, "other")).toBe(1000 + 400);
    // Claude: the real cost + 60٪, to the halala, never rounded up to half a riyal; «حيدرا ماكس» the same
    expect(sellKind(1000, "claude")).toBe(1600);
    expect(sellKind(7, "claude")).toBe(12);
    expect(sellKind(1000, "max")).toBe(1600);
    expect(coinsFor(1, "claude")).toBe(claudeHalalas(1));
    expect(coinsFor(1, "max")).toBe(claudeHalalas(1, getPricing(), "max"));
    expect(claudeHalalas(1, getPricing(), "max")).toBe(Math.ceil(375 * 1.6));
    expect(wasHalalas(1000, getPricing(), "image")).toBe(sellHalalas(1000, getPricing(), 60));
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
      // the videos and the rest share 40٪ now (the owner, 21 October 2026)
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
    expect(read("src/lib/coins.ts")).toContain("price_image_margin_pct");
    expect(read("src/lib/film/limits.ts")).toContain("price_video_margin_pct");
  });

  it("is in what Claude knows about the site", () => {
    expect(JAWAD_KNOWLEDGE).toContain("GPT Image 2's pictures 30٪");
    expect(JAWAD_KNOWLEDGE).toContain("«حيدرا ماكس»'s programs 60٪");
    expect(JAWAD_KNOWLEDGE).toContain("«أسبوع العرض»");
  });
});

describe("«أسبوع العرض»: ١٠٪ على كل شي إلا شغل Claude (٦٠٪) حتى نهاية ٢ نوفمبر ٢٠٢٦، بعدها يرجع الربح المعتاد", () => {
  it("is 10٪ on every kind but Claude's during the week, over the owner's settings, and the struck price shows the usual one", async () => {
    const { PROMO, promoActive, setPromoClock, setPricing } = await import("@config/coins");
    setPricing({ marginPct: 50, imageMarginPct: 45, videoMarginPct: 55 });
    setPromoClock(() => Date.parse("2026-10-27T12:00:00Z"));
    try {
      expect(promoActive()).toBe(true);
      expect([marginFor("image"), marginFor("video"), marginFor("other"), marginFor("claude"), marginFor("max")]).toEqual([10, 10, 10, 60, 60]);
      expect(sellKind(1000, "video")).toBe(1000 + 100);
      expect(wasMarginFor("video")).toBe(10 + (getPricing().wasMarginPct - 50));
      // «سيدنس الواقعي» stays at its own 10٪
      const rf = generatorById("seedance-real-face");
      if (rf) expect(priceKindOf(rf)).toBe("video");
      // the week ends by itself
      setPromoClock(() => PROMO.until);
      expect(promoActive()).toBe(false);
      expect([marginFor("image"), marginFor("video"), marginFor("other"), marginFor("claude")]).toEqual([45, 55, 50, 60]);
    } finally {
      setPromoClock(() => Infinity);
      setPricing(null);
    }
  });
});
