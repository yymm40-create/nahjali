import { describe, expect, it } from "vitest";
import { PSYCH_TRICKS, PSYCH_TRICKS_RULES } from "@config/content-psych";
import { systemText } from "@/lib/content/persona";

// The owner, 6 Nov 2026: «الحيل النفسية… حطها في صانع المحتوى» — every carousel uses the six tricks and two open loops.
describe("«الحيل النفسية» in the content maker", () => {
  it("names the six tricks and the open-loop rule", () => {
    expect(PSYCH_TRICKS).toHaveLength(6);
    for (const t of PSYCH_TRICKS) expect(PSYCH_TRICKS_RULES).toContain(t.name);
    expect(PSYCH_TRICKS_RULES).toContain("الحلقتين المفتوحتين");
    expect(PSYCH_TRICKS_RULES).toContain("كل كاروسيل");
  });
  it("rides in محمد باقر's system every message", () => {
    expect(systemText("persona")).toContain(PSYCH_TRICKS_RULES);
  });
});
