import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, LIGHT_THEMES, MAHDI_THEMES, PICKED_THEMES } from "@config/mahdi";
import { DEFAULT_WIDGETS, WIDGETS, homeWidgets, moveWidget, parseWidgets } from "@/lib/mahdi/home-widgets";
import { BOTTOM, navGroups } from "@/components/mahdi/nav";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

describe("«لأجل المهدي» redesign: four looks", () => {
  it("offers exactly four, each a different look", () => {
    expect(PICKED_THEMES.map((x) => x.key)).toEqual(["aurora", "neon", "pop", "cinematic"]);
    expect(new Set(PICKED_THEMES.map((x) => x.themeColor)).size).toBe(4);
    expect(DEFAULT_THEME).toBe("aurora");
    expect(LIGHT_THEMES).toEqual(expect.arrayContaining(["aurora", "pop"]));
  });

  it("each look has its own letters, colours and corners in the CSS", () => {
    const css = read("src/app/mahdi/mahdi.css");
    for (const k of ["aurora", "neon", "pop"]) {
      const block = css.slice(css.indexOf(`.mahdi-root[data-mtheme="${k}"] {`));
      const body = block.slice(0, block.indexOf("\n}"));
      expect(body, k).toContain("--m-font");
      expect(body, k).toContain("--m-radius");
      expect(body, k).toContain("--m-primary-bg");
      expect(body, k).toContain("--m-bg");
    }
    // three different families for the three new looks
    expect(css).toContain("var(--font-readex)");
    expect(css).toContain("var(--font-lalezar)");
    expect(css).toContain("var(--font-baloo)");
    const layout = read("src/app/mahdi/layout.tsx");
    for (const f of ["ReadexPro.ttf", "Lalezar-Regular.ttf", "BalooBhaijaan2.ttf"]) expect(layout).toContain(f);
  });

  it("the older looks still work for whoever has them, and the database accepts the new ones", () => {
    expect(MAHDI_THEMES.filter((x) => x.legacy).map((x) => x.key)).toEqual(["minimal", "night"]);
    const sql = read("supabase/migrations/0062_mahdi_redesign.sql");
    for (const k of MAHDI_THEMES.map((x) => x.key)) expect(sql).toContain(`'${k}'`);
    expect(sql).toContain("home_widgets");
    // before the migration a new look is saved as the nearest older one instead of failing
    expect(read("src/app/api/mahdi/profile/route.ts")).toContain("beforeMigration");
  });
});

describe("the side menu (☰) holds everything", () => {
  const all = navGroups("ali").flatMap((g) => g.items);
  it("every place of the app is in it, each once", () => {
    for (const href of ["/mahdi", "/mahdi/projects", "/mahdi/reading", "/mahdi/health", "/mahdi/progress", "/mahdi/challenges", "/mahdi/community", "/mahdi/stories", "/mahdi/groups", "/mahdi/u/ali", "/mahdi/inbox", "/mahdi/more", "/mahdi/more/rewards", "/mahdi/more/family", "/mahdi/more/privacy", "/mahdi/more/notifications"])
      expect(all.map((n) => n.href), href).toContain(href);
    expect(new Set(all.map((n) => n.href)).size).toBe(all.length);
    expect(new Set(all.map((n) => n.label)).size).toBe(all.length);
  });
  it("the bottom bar keeps four places around the «+»", () => {
    expect(BOTTOM.map((n) => n.href)).toEqual(["/mahdi", "/mahdi/projects", "/mahdi/reading", "/mahdi/community"]);
    const shell = read("src/components/mahdi/AppShell.tsx");
    expect(shell).toContain('name="menu"');
    expect(shell).toContain("m-drawer");
  });
});

describe("the home the person arranges", () => {
  it("the standard home: the two daily goals first, then the habits to tap", () => {
    expect(DEFAULT_WIDGETS.slice(0, 3)).toEqual(["habits", "reading", "quick"]);
    expect(homeWidgets(null)).toEqual([...DEFAULT_WIDGETS]);
  });
  it("reads only known cards, each once, in the person's order", () => {
    expect(parseWidgets(["week", "nope", "week", "quick", 3])).toEqual(["week", "quick"]);
    expect(homeWidgets([])).toEqual([]);
    expect(parseWidgets("x")).toEqual([...DEFAULT_WIDGETS]);
  });
  it("moves a card up and down, never off the ends", () => {
    expect(moveWidget(["habits", "reading", "quick"], "quick", -1)).toEqual(["habits", "quick", "reading"]);
    expect(moveWidget(["habits", "reading"], "habits", -1)).toEqual(["habits", "reading"]);
  });
  it("every card is drawn by the board", () => {
    const board = read("src/components/mahdi/HomeBoard.tsx");
    for (const w of WIDGETS) expect(board, w.id).toContain(`case "${w.id}":`);
  });
});
