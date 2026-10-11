import { describe, expect, it } from "vitest";
import { PAGE_INFO, WORKSPACES, wsVars } from "@/components/jawad/editor/workspaces";
import { FONT_BY_ID } from "@/lib/editor/fonts";

describe("«واجهات البرامج»", () => {
  it("twenty editors, each its own", () => {
    expect(WORKSPACES).toHaveLength(20);
    expect(new Set(WORKSPACES.map((w) => w.id)).size).toBe(20);
    expect(new Set(WORKSPACES.map((w) => w.pal.accent)).size).toBeGreaterThan(14);
  });
  it("every page and font is one the editor has", () => {

    for (const w of WORKSPACES) {
      expect(w.pages.length).toBeGreaterThan(2);
      for (const [p] of w.pages) expect(PAGE_INFO[p]).toBeTruthy();
      if (w.font) expect(FONT_BY_ID.has(w.font)).toBe(true);
      expect(w.menus.length).toBeGreaterThan(2);
    }
  });
  it("the colour page is a big page wherever it is", () => {
    expect(PAGE_INFO.color.big).toBe(true);
    expect(WORKSPACES.filter((w) => w.pages.some(([p]) => p === "color")).length).toBeGreaterThanOrEqual(18);
  });
  it("sets the site's tokens", () => {
    const v = wsVars(WORKSPACES[0]);
    expect(v["--jw-accent"]).toBe(WORKSPACES[0].pal.accent);
    expect(v["--jw-surface"]).toBe(WORKSPACES[0].pal.s1);
  });
});
