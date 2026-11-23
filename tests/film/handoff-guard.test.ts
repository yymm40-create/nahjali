import { describe, expect, it } from "vitest";
import { completeHandoff } from "@/lib/film/handoff-guard";

describe("an empty handoff carries the approved screenplay", () => {
  const sp = "# القصة المطوّرة\nقطرة دم فضولية…\n# السيناريو\nاللقطة 1 (٠–٦ ث) — أربع حجرات…".repeat(3);
  it("adds the screenplay to a handoff with only its title and end line (seen 23 Nov 2026)", () => {
    const h = completeHandoff("# رسالة التسليم النهائية\n\nنهاية رسالة التسليم", sp);
    expect(h.startsWith("# رسالة التسليم النهائية")).toBe(true);
    expect(h).toContain("# السيناريو المعتمد (كما اعتمده المستخدم)");
    expect(h).toContain(sp);
    expect(h.endsWith("نهاية رسالة التسليم")).toBe(true);
    expect(h.split("نهاية رسالة التسليم").length).toBe(2);
  });
  it("leaves a real handoff, or one that already holds the screenplay, as it is", () => {
    const real = "# رسالة التسليم\n" + "سجل الشخصيات… ".repeat(80);
    expect(completeHandoff(real, sp)).toBe(real.trim());
    expect(completeHandoff(`قصير\n${sp}`, sp)).toBe(`قصير\n${sp}`);
    expect(completeHandoff("قصير", "")).toBe("قصير");
  });
});
