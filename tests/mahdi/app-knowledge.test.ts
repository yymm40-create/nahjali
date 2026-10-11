import { describe, expect, it } from "vitest";
import { isMahdiAsk, MAHDI_BRIEF, MAHDI_AUDIENCES, MAHDI_FEATURES, MAHDI_CONTENT_RULES } from "@config/mahdi/app-knowledge";

describe("what محمد باقر knows about «لأجل المهدي»", () => {
  it("covers every part of the app", () => {
    const ids = MAHDI_FEATURES.map((f) => f.id);
    for (const id of ["habits", "today", "progress", "rewards", "reading", "health", "challenges", "community", "groups", "family", "share", "notify", "look", "assistant"]) expect(ids).toContain(id);
    for (const f of MAHDI_FEATURES) {
      expect(f.forWho.length, f.id).toBeGreaterThan(3);
      expect(f.problem.length, f.id).toBeGreaterThan(3);
      expect(f.sell.length, f.id).toBeGreaterThan(0);
    }
  });
  it("every audience points to real features", () => {
    for (const a of MAHDI_AUDIENCES) for (const id of a.features) expect(MAHDI_FEATURES.some((f) => f.id === id), id).toBe(true);
  });
  it("the brief carries the link, the price and the no-music rule", () => {
    expect(MAHDI_BRIEF).toContain("www.aljawadai.app/mahdi");
    expect(MAHDI_BRIEF).toContain("مجاني");
    expect(MAHDI_CONTENT_RULES.some((r) => r.includes("لا موسيقى"))).toBe(true);
    expect(MAHDI_BRIEF).toContain("لا تخترع أرقامًا");
  });
  it("knows when the conversation is about the app", () => {
    expect(isMahdiAsk("سوّ لي كاروسيل يسوّق لتطبيق لأجل المهدي")).toBe(true);
    expect(isMahdiAsk("ريل عن الصحة العلوية")).toBe(true);
    expect(isMahdiAsk("أبي إعلان لمطعم شاورما")).toBe(false);
  });
});
