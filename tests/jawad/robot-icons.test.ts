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

  it("the robots are quiet: the small intro card opens by itself only on the very first visit, then every icon starts folded", () => {
    const guide = read("src/components/jawad/RobotGuide.tsx");
    expect(guide).toMatch(/read\(SEEN\) !== "1"/);
    expect(guide).toMatch(/write\(SEEN, "1"\)/);
    expect(guide).toMatch(/read\(FOLD\) !== "0"/);
    expect(read("src/components/MovableBubble.tsx")).toMatch(/jw-bubble-fold:\$\{id\}`\) !== "0"/);
  });

  it("the introduction is one small card attached to the icon, not a full-screen window", () => {
    const guide = read("src/components/jawad/RobotGuide.tsx");
    expect(guide).toMatch(/className="rg-pop"/);
    expect(guide).not.toMatch(/rg-back|rg-card|aria-modal/);
    expect(read("src/components/jawad/robot-guide.css")).not.toMatch(/\.rg-back/);
  });
});
