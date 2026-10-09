import { describe, expect, it } from "vitest";
import { CONTENT_KINDS, isCarouselAspect } from "@config/content";
import { allContentExamples, contentExamplesBrief, contentExamplesFor, detectContentKind, EXAMPLES_PER_KIND, nearestContentExamples } from "@config/content-examples";

// «محمد باقر» learns the six kinds of work from a thousand worked examples each. Every example has to be recognised
// as its own kind from its request alone, name what is known and what is still to be asked, give the deliverable's
// skeleton, 

describe("the six kinds", () => {
  it("are six, each with a name and what it is, and a thousand examples", () => {
    expect(CONTENT_KINDS).toHaveLength(6);
    expect(allContentExamples()).toHaveLength(6 * EXAMPLES_PER_KIND);
    expect(isCarouselAspect("1:1")).toBe(true);
    expect(isCarouselAspect("4:5")).toBe(false);
  });

  it("are recognised from plain requests, and a request with none is null", () => {
    expect(detectContentKind("أبي كاروسيل عن القهوة")).toBe("carousel");
    expect(detectContentKind("اكتب لي سكربت ريل")).toBe("reel_script");
    expect(detectContentKind("أبي ريل منتج من مقاطعي")).toBe("reel_produced");
    expect(detectContentKind("سوّ لي موشن جرافيكس")).toBe("motion");
    expect(detectContentKind("اكتب لي كابشن")).toBe("titles");
    expect(detectContentKind("عندي مقال أبي أعيد توظيفه في كاروسيل وسكربت")).toBe("repurpose");
    expect(detectContentKind("مرحبا")).toBeNull();
  });
});

for (const k of CONTENT_KINDS) {
  describe(`${k.id}: ${EXAMPLES_PER_KIND} examples`, () => {
    const list = contentExamplesFor(k.id);

    it("are a thousand distinct ones", () => {
      expect(list).toHaveLength(EXAMPLES_PER_KIND);
      expect(new Set(list.map((e) => `${e.ask}|${e.outline.join("|")}|${e.missing.join("|")}`)).size).toBe(EXAMPLES_PER_KIND);
      expect(new Set(list.map((e) => e.ask)).size).toBeGreaterThan(EXAMPLES_PER_KIND / 4);
    });

    it.each(list.map((e) => [e.id, e] as const))("%s is recognised, and complete", (_id, e) => {
      expect(detectContentKind(e.ask)).toBe(k.id);
      expect(e.ask.length).toBeGreaterThan(10);
      expect(e.ask.length).toBeLessThan(400);
      expect(["as_is", "develop", "unknown"]).toContain(e.brief.policy);
      expect(e.missing.length).toBeGreaterThanOrEqual(1);
      expect(e.missing.length).toBeLessThanOrEqual(8);
      expect(e.outline.length).toBeGreaterThanOrEqual(3);
      // what is known is never asked again
      if (e.brief.platform) expect(e.missing.join(" ")).not.toMatch(/^المنصة$|المنصة والمقاس/);
      if (e.brief.policy !== "unknown") expect(e.missing.join(" ")).not.toContain("كما هو أم تطويره");
      // the site's rule
    });

    it("come back first for their own requests", () => {
      for (const e of list.slice(0, 40)) {
        const near = nearestContentExamples(e.ask, 3);
        expect(near[0]?.kind, e.ask).toBe(k.id);
        expect(near.map((x) => x.ask)).toContain(e.ask);
      }
      const brief = contentExamplesBrief(list.slice(0, 2));
      expect(brief).toContain(k.name);
      expect(brief).toContain(list[0].ask);
    });
  });
}
