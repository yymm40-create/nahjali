import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("«↔️ اقلب الواجهة» in the editor", () => {
  const src = readFileSync("src/components/jawad/editor/Editor.tsx", "utf8");
  it("flips the menus column over the look's own side, kept on the device, from «⋯ المزيد»", () => {
    expect(src).toMatch(/const mirror = T\.mirror !== flip;/);
    expect(src).toMatch(/jw-editor-flip/);
    expect(src).toMatch(/اقلب الواجهة/);
    // every place that decides the side reads the flipped value, not the look's
    expect(src.match(/\bT\.mirror\b/g)).toHaveLength(1);
  });
});
