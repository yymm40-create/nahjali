import { describe, expect, it } from "vitest";
import { MOTION_QUESTIONS, MOTION_SKILL, MOTION_SOURCES } from "@/lib/editor/motion";

describe("حيدرا ماكس's motion-graphics skill", () => {
  it("asks the brief first, and knows the channels by name when someone asks for one", () => {
    expect(MOTION_SOURCES.map((s) => s.name)).toEqual(["Kurzgesagt", "Vox", "Ben Marriott", "School of Motion", "Motion Design School"]);
    expect(MOTION_QUESTIONS.map((q) => q.key)).toContain("duration");
    for (const q of MOTION_QUESTIONS) expect(MOTION_SKILL).toContain(q.ar);
  });

  it("speaks only in the editor's own means, with the templates and RTL rules", () => {
    for (const word of ["make speech", "duck", "RTL", "layout engine", '"kind":"stat"', "majlis", "diacritized", "Never ask a generator"]) expect(MOTION_SKILL).toContain(word);
    // nothing animates letter by letter in Arabic
    expect(MOTION_SKILL).toMatch(/never letter animation/);
  });

  it("orders the old look forgotten: he composes every background and draws every arrival", () => {
    expect(MOTION_SKILL).toContain("FORGET THE OLD LOOK");
    expect(MOTION_SKILL).toMatch(/COMPOSE THE BACKGROUND yourself/);
    expect(MOTION_SKILL).toMatch(/DRAW EVERY ARRIVAL yourself/);
    // the old vocabulary is no longer offered to him: no art themes, no drawn scenes to name
    for (const gone of ['"theme"', '"scene":"stars"', "arabesque", "«الريل السريع»"]) expect(MOTION_SKILL).not.toContain(gone);
    // and the new fields are the ones he writes
    for (const field of ['"bg"', '"enter"', '"blur"', '"over"', '"vignette"']) expect(MOTION_SKILL).toContain(field);
  });
});
