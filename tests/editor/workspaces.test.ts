import { describe, expect, it } from "vitest";
import { PAGE_INFO, PRO, WORKSPACES, wsVars } from "@/components/jawad/editor/workspaces";
import { FONT_BY_ID } from "@/lib/editor/fonts";

describe("«الواجهة الاحترافية»", () => {
  it("one design of ours: neutral greys (no hue) and one accent", () => {
    expect(WORKSPACES).toEqual([PRO]);
    for (const c of [PRO.pal.bg, PRO.pal.s1, PRO.pal.s2, PRO.pal.s3, PRO.pal.line, PRO.pal.ink, PRO.pal.muted]) {
      const n = parseInt(c.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(1);
    }
    expect(PRO.pal.accent).toBe("#e8a33d");
  });
  it("its pages are the editor's, the colour page a big one", () => {
    expect(PRO.pages.map(([p]) => p)).toEqual(["media", "edit", "fx", "color", "audio", "deliver"]);
    for (const [p] of PRO.pages) expect(PAGE_INFO[p]).toBeTruthy();
    expect(PAGE_INFO.color.big).toBe(true);
    expect(FONT_BY_ID.has(PRO.font!)).toBe(true);
  });
  it("sets the site's tokens", () => {
    const v = wsVars(PRO);
    expect(v["--jw-accent"]).toBe(PRO.pal.accent);
    expect(v["--jw-surface"]).toBe(PRO.pal.s1);
  });
});
