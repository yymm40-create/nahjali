import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");

describe("one icon per robot", () => {
  it("سجاد is one movable, foldable icon (no fixed button at the bottom), and the page's guide bubble steps aside for him", () => {
    const sajjad = read("src/app/film/SajjadPanel.tsx");
    expect(sajjad).toMatch(/<MovableBubble id="sajjad"/);
    expect(sajjad).not.toMatch(/className="sajjad-fab"/);
    const guide = read("src/components/jawad/RobotGuide.tsx");
    expect(guide).toMatch(/\^\\\/jawad-ai\\\/film\(\\\/\|\$\)/);
  });
});
