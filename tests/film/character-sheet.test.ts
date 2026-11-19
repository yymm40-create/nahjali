import { describe, expect, it } from "vitest";
import { CHARACTER_LOOK_RULE, CHARACTER_SHEET_LAYOUT, hasCharacterLayout, withCharacterLayout } from "@config/film-prompts/character-sheet";

describe("a series character's picture: three views on grey, one face only", () => {
  it("asks for the three views on a plain grey background", () => {
    expect(CHARACTER_SHEET_LAYOUT).toMatch(/three tall panels/);
    expect(CHARACTER_SHEET_LAYOUT).toMatch(/plain flat neutral medium grey background \(not white, not black\)/);
    expect(CHARACTER_SHEET_LAYOUT).toMatch(/LEFT PANEL: head-and-shoulders close-up/);
    expect(CHARACTER_SHEET_LAYOUT).toMatch(/RIGHT PANEL: full-body back view/);
  });

  it("keeps the face off the front body view", () => {
    expect(CHARACTER_SHEET_LAYOUT).toMatch(/MIDDLE PANEL: front view of the character's body framed from the neck down/);
    expect(CHARACTER_SHEET_LAYOUT).toMatch(/The only face in the whole sheet is the close-up in the left panel/);
    expect(CHARACTER_SHEET_LAYOUT).not.toMatch(/expressions|three-quarter|side profile/);
  });

  it("lets سجاد write the look only, and adds the layout after it", () => {
    expect(CHARACTER_LOOK_RULE).toMatch(/Do not describe panels, views, poses, backgrounds/);
    const p = withCharacterLayout("  An eleven-year-old boy with short dark curly hair.  ");
    expect(p.startsWith("An eleven-year-old boy")).toBe(true);
    expect(p.endsWith(CHARACTER_SHEET_LAYOUT)).toBe(true);
    expect(hasCharacterLayout(p)).toBe(true);
  });

  it("writes an old character prompt again", () => {
    const old = "a CHARACTER REFERENCE SHEET on a plain light background: front, three-quarter, side and back views, plus 3–4 facial expressions";
    expect(hasCharacterLayout(old)).toBe(false);
  });
});
