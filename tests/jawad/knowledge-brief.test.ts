import { describe, expect, it } from "vitest";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";
import { lookupKnowledge, sectionKnowledge, siteKnowledge, siteLookupBlock } from "@config/jawad/knowledge-brief";
import { addSiteLookup, siteSystem } from "@/lib/film/anthropic";

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

// «لو انطلب منه شي معين يبحث فيه بس»: the whole text goes with no call; what a message asks about is looked up.
describe("the lookup", () => {
  it("finds the passages a message asks about, in Arabic, though the knowledge is in English", () => {
    expect(lookupKnowledge("كيف اشحن رصيدي؟")).toContain("/jawad-ai/credits");
    expect(lookupKnowledge("وش هي الذاكرة؟")).toContain("/jawad-ai/memory");
    expect(lookupKnowledge("ابي اسوي لعبة")).toContain("/jawad-ai/games");
  });
  it("gives nothing to a message that is not about the site", () => {
    expect(lookupKnowledge("هلا")).toBe("");
    expect(lookupKnowledge("اكتب لي قصيدة عن الحب")).toBe("");
  });
  it("is small, and does not send again what the robot already has", () => {
    expect(lookupKnowledge("وين ألقى زهراء فوتو ماستر").length).toBeLessThanOrEqual(7000);
    const mine = siteKnowledge("أنت «قنبر» في «صانع الألعاب الذكي»");
    expect(mine).toContain("## Your section (in full)");
    expect(lookupKnowledge("ابي اسوي لعبة", mine)).not.toContain("8. «صانع الألعاب الذكي»");
  });
  it("no system carries the whole text; the robot's own section is found from its task", () => {
    const sys = JSON.stringify(siteSystem("أنت «محمد باقر» في «صانع المحتوى»"));
    expect(sys.length).toBeLessThan(JAWAD_KNOWLEDGE.length / 4);
    expect(sys).toContain("Your section (in full)");
  });
  it("rides on the latest message only", () => {
    const m = addSiteLookup([{ role: "user", content: "قديم" }, { role: "assistant", content: "تمام" }, { role: "user", content: [{ type: "text", text: "كيف اشحن رصيدي؟" }] }]);
    expect(m[0].content).toBe("قديم");
    const last = m[2].content as { type: string; text: string }[];
    expect(last[0].text.startsWith("<site_lookup>")).toBe(true);
    expect(last[1].text).toBe("كيف اشحن رصيدي؟");
    expect(siteLookupBlock("هلا")).toBe("");
    expect(addSiteLookup([{ role: "user", content: "هلا" }])[0].content).toBe("هلا");
  });
});
