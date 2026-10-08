import { describe, expect, it } from "vitest";
import { MOTION_QUESTIONS, MOTION_SKILL, MOTION_SOURCES } from "@/lib/editor/motion";

describe("حيدرة's motion-graphics skill", () => {
  it("is learnt from the five channels and asks the brief first", () => {
    expect(MOTION_SOURCES.map((s) => s.name)).toEqual(["Kurzgesagt", "Vox", "Ben Marriott", "School of Motion", "Motion Design School"]);
    for (const s of MOTION_SOURCES) expect(MOTION_SKILL).toContain(s.name);
    expect(MOTION_QUESTIONS.map((q) => q.key)).toContain("duration");
    for (const q of MOTION_QUESTIONS) expect(MOTION_SKILL).toContain(q.ar);
  });
  it("speaks only in the editor's own means, with the templates and RTL rules", () => {
    for (const word of ["set_key", "set_background", "make speech", "make sfx", "fromRight", "duck", "Title card", "Lower third", "Outro / CTA", "RTL", "████"]) expect(MOTION_SKILL).toContain(word);
    // nothing animates letter by letter in Arabic
    expect(MOTION_SKILL).toMatch(/never letter animation/);
  });
});
