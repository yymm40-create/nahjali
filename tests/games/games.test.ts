import { describe, expect, it } from "vitest";
import { GAMES_PLATFORM_RULES, QANBAR_PERSONA } from "@config/games";
import { DEFAULT_SECTIONS, FIXED_IMPLEMENTATIONS, RESERVED_SECTION_IDS, sectionPath } from "@config/jawad/sections";
import { cleanHistory, forModel, titleOf } from "@/lib/games/chats";
import { nameKey, namedIn, parseGameLines, type Game } from "@/lib/games/library";
import { systemText } from "@/lib/games/persona";
import { OPTIONS_RULE } from "@/lib/chat-options";
import { scenarios } from "@/lib/games/scenarios";
import { parseVerdict } from "@/lib/games/tests";

describe("«قنبر»", () => {
  it("keeps the owner's template and always adds the platform's rules after it", () => {
    expect(QANBAR_PERSONA.length).toBeGreaterThan(1000);
    const t = systemText("PERSONA", "LIB");
    expect(t.indexOf("PERSONA")).toBeLessThan(t.indexOf(GAMES_PLATFORM_RULES));
    expect(t.endsWith("LIB")).toBe(true);
    expect(GAMES_PLATFORM_RULES).toContain("لا تدّعِ");
    // every reply ends with clickable options (with a way to write one's own), told after the rules
    expect(t.indexOf(GAMES_PLATFORM_RULES)).toBeLessThan(t.indexOf(OPTIONS_RULE));
    expect(t.indexOf(OPTIONS_RULE)).toBeLessThan(t.indexOf("LIB"));
  });
});

describe("the section", () => {
  it("is registered, private by default, with its own page", () => {
    const s = DEFAULT_SECTIONS.find((x) => x.id === "games")!;
    expect(s.enabled).toBe(false);
    expect(RESERVED_SECTION_IDS).toContain("games");
    expect(FIXED_IMPLEMENTATIONS).toContain("games");
    expect(sectionPath(s)).toBe("/jawad-ai/games");
  });
});

describe("conversations", () => {
  it("merges same-role turns, drops junk, and starts with the person", () => {
    const h = cleanHistory([{ role: "assistant", text: "a" }, { role: "user", text: "x" }, { role: "user", text: "y" }, { role: "bad", text: "z" }, null, { role: "assistant", text: "" }]);
    expect(h.map((t) => t.role)).toEqual(["assistant", "user"]);
    expect(h[1].text).toBe("x\n\ny");
    expect(forModel(h)[0].role).toBe("user");
    expect(titleOf("  مرحبا   بك ")).toBe("مرحبا بك");
  });
});

describe("the library", () => {
  const games: Game[] = [{ id: "1", name: "ماينكرافت", genre: "", players: "", notes: "n", status: "approved", source: "owner" }];
  it("reads pasted lines and finds a named game however it is typed", () => {
    expect(parseGameLines("- ماينكرافت | ساندبوكس | 1 | عالم\n\nهولو نايت")).toEqual([
      { name: "ماينكرافت", genre: "ساندبوكس", players: "1", notes: "عالم" },
      { name: "هولو نايت", genre: "", players: "", notes: "" },
    ]);
    expect(nameKey("ماينكرافت")).toBe(nameKey("  ماينكرافت "));
    expect(namedIn("ابي لعبة مثل ماينكرافت", games).length).toBe(1);
    expect(namedIn("لعبة ثانية", games).length).toBe(0);
  });
});

describe("the tests", () => {
  it("makes up to 1000 different scenarios, the same each time, with every kind", () => {
    const a = scenarios(1000);
    expect(a.length).toBe(1000);
    expect(new Set(a.map((s) => s.message)).size).toBe(1000);
    expect(scenarios(50)).toEqual(a.slice(0, 50).map((s, i) => ({ ...s, id: `s${i + 1}` })));
    expect(new Set(a.map((s) => s.kind))).toEqual(new Set(["research", "develop", "ideate", "trap"]));
  });
  it("reads the judge's verdict, and fails what it cannot read", () => {
    expect(parseVerdict("SCORE: 9\nPASS: yes\nWENT_WELL: good\nWENT_WRONG: none\nFIX: none")).toEqual({ score: 9, pass: true, good: "good", bad: "", fix: "" });
    expect(parseVerdict("SCORE: 9\nPASS: yes").pass).toBe(true);
    expect(parseVerdict("SCORE: 5\nPASS: yes").pass).toBe(false);
    expect(parseVerdict("garbage")).toMatchObject({ score: 0, pass: false });
  });
});
