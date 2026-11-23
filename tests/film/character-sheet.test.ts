import { describe, expect, it } from "vitest";
import { CHARACTER_LOOK_RULE, CHARACTER_SHEET_LAYOUT, hasCharacterLayout, withCharacterLayout } from "@config/film-prompts/character-sheet";
import { SHEET_MAKER_PROMPT } from "@config/film-prompts/sheet-maker";

// «الكاركترشيت خلاص وحدة فكل صانع الفيلم»: three-quarter from above the chest, the front without the face, the back
describe("the film maker's one character sheet", () => {
  it("is exactly three panels, one face only", () => {
    expect(CHARACTER_SHEET_LAYOUT).toContain("three-quarter view framed from just above the chest up");
    expect(CHARACTER_SHEET_LAYOUT).toContain("framed from the neck down");
    expect(CHARACTER_SHEET_LAYOUT).toContain("head and face are not visible in this panel at all");
    expect(CHARACTER_SHEET_LAYOUT).toContain("RIGHT PANEL: full-body back view");
    expect(CHARACTER_SHEET_LAYOUT).toContain("The only face in the whole sheet is in the left panel");
    expect(CHARACTER_SHEET_LAYOUT).toContain("No other views, no expression studies");
    // a covered or luminous face stays so
    expect(CHARACTER_SHEET_LAYOUT).toMatch(/covered, veiled, hidden in light or featureless/);
  });

  it("is added once, after the look", () => {
    const p = withCharacterLayout("  A boy of ten in a red jersey.  ");
    expect(p.startsWith("A boy of ten in a red jersey.")).toBe(true);
    expect(hasCharacterLayout(p)).toBe(true);
    expect(withCharacterLayout(p)).toBe(p);
    expect(CHARACTER_LOOK_RULE).toContain("Do not describe panels");
  });

  it("the sheet maker is told the same standard", () => {
    expect(SHEET_MAKER_PROMPT).toContain("CHARACTER SHEET STANDARD (the website's fixed layout, the same for every character)");
    expect(SHEET_MAKER_PROMPT).not.toContain("C. Turnaround");
  });
});
