import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MOTION_DIRECTOR_SKILL_TEXT } from "@/lib/editor/motion-director-text";
import { MOTION_SKILL } from "@/lib/editor/motion";

const FILE = "config/editor/skills/motion-video-director/SKILL.md";

describe("the owner's motion skill, as it is", () => {
  it("is the file itself, word for word (never rewritten or shortened)", () => {
    // if this fails, SKILL.md changed: regenerate with `npx tsx scripts/generate-motion-skill.mts`
    expect(MOTION_DIRECTOR_SKILL_TEXT).toBe(readFileSync(FILE, "utf8"));
    expect(MOTION_DIRECTOR_SKILL_TEXT.length).toBeGreaterThan(20_000);
  });

  it("reaches حيدرا ماكس whole, inside its tags", () => {
    expect(MOTION_SKILL).toContain(`<motion-skill>\n${MOTION_DIRECTOR_SKILL_TEXT}\n</motion-skill>`);
    // the parts that are his craft, named in the skill itself
    for (const w of ["Motion graphics catalogue", "Animation principles", "Typography & kinetic type", "QA checklist", "Reverse-engineered reference recipes"]) expect(MOTION_DIRECTOR_SKILL_TEXT).toContain(w);
  });

  it("says plainly which of its mechanics are not his (no terminal, no render scripts) without touching its craft", () => {
    expect(MOTION_SKILL).toMatch(/not on a machine with a terminal/);
    expect(MOTION_SKILL).toMatch(/Skip only those mechanics/);
  });
});
