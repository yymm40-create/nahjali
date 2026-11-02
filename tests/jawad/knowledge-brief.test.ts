import { describe, expect, it } from "vitest";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";
import { sectionKnowledge } from "@config/jawad/knowledge-brief";

// The short knowledge of one section (the owner's order: «محمد باقر» was sent the whole ~96k tokens every message).
describe("the short knowledge of a section", () => {
  const k = sectionKnowledge("صانع المحتوى");
  it("is a small part of the whole", () => {
    expect(k.length).toBeLessThan(JAWAD_KNOWLEDGE.length / 4);
  });
  it("keeps its own section word for word, and names every other one", () => {
    const own = JAWAD_KNOWLEDGE.split("\n").find((l) => l.startsWith("9. «صانع المحتوى»"))!;
    expect(k).toContain(own);
    for (const l of JAWAD_KNOWLEDGE.split("\n").filter((x) => /^\d+\.\s«/.test(x))) expect(k).toContain(l.slice(0, 40));
    expect(k).toContain("## Content and safety");
  });
  it("is the same text every time (it caches)", () => {
    expect(sectionKnowledge("صانع المحتوى")).toBe(k);
  });
});
