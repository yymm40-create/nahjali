import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ZAYNAB_GREETING, ZAYNAB_IMAGE, ZAYNAB_MAX_PHOTOS, ZAYNAB_RECIPE, ZAYNAB_SHEET_FILE, ZAYNAB_VIEWS, ZAYNAB_VIEW_TILE, zaynabBrief, zaynabInput, zaynabPromptProblems, zaynabQuoteRefs, zaynabViewFile } from "@config/jawad/zaynab";
import { FREE_FIRST_ENDS_AT, FREE_FIRST_HOURS, freeFirstOpen } from "@config/jawad/free-first";
import { FILM_STYLES } from "@config/film-styles";
import { DEFAULT_SECTIONS, RESERVED_SECTION_IDS } from "@config/jawad/sections";
import { generatorById } from "@config/jawad/generators";
import { evaluate } from "@/lib/jawad/engine";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const ok = { view: "shrine", style: "pixar-classic", time: "night", weather: "rain", aspect: "3:2", labels: ["أبي", ""], greeting: true, count: 1, consent: true };
const pixar = FILM_STYLES.find((s) => /pixar/.test(s.id))!;

describe("«في حضرة السيدة زينب (ع)»", () => {
  it("is unlisted: no section on the bar, its address reserved, hidden from search engines", () => {
    expect(DEFAULT_SECTIONS.some((s) => s.id === "zaynab" || (s.implementation as string) === "zaynab")).toBe(false);
    expect(RESERVED_SECTION_IDS).toContain("zaynab");
    expect(read("src/app/jawad-ai/zaynab/page.tsx")).toContain("index: false");
  });

  it("the whole environment sheet and every photo go to GPT Image 2 as references, the sheet first", () => {
    const sheet = readFileSync(new URL(`../../${ZAYNAB_SHEET_FILE}`, import.meta.url));
    expect([sheet[0], sheet[1]]).toEqual([0xff, 0xd8]);
    expect(sheet.length).toBeGreaterThan(200_000);
    const route = read("src/app/api/jawad/zaynab/route.ts");
    expect(route).toContain("sheetBytes()");
    expect(route).toContain("[sheet.id, ...uploads]");
    expect(read("next.config.ts")).toContain("./public/zaynab/*.jpg");
    expect(ZAYNAB_MAX_PHOTOS).toBeGreaterThanOrEqual(5);
  });

  it("«جواد» writes the prompt: his own system prompt, the recipe, and the references themselves — no template", () => {
    const server = read("src/lib/jawad/server/zaynab.ts");
    expect(server).toContain("assistantSystem(\"image\", [def])");
    expect(server).toContain("ZAYNAB_RECIPE");
    expect(server).toContain('{ type: "image64", data: sheet');
    expect(server).toContain('{ type: "image", url: v.url }');
    // the prompt that was priced is the one that is made
    const route = read("src/app/api/jawad/zaynab/route.ts");
    expect(route).toContain("jawadWritesZaynab(input");
    expect(route).toContain("promptSealed(body.seal");
    expect(route).not.toContain("styleId");
    // the owner's order: nothing realistic left, and جواد is not bound by the photos (who they are and how many only)
    expect(ZAYNAB_RECIPE).toContain("NOTHING REALISTIC REMAINS");
    expect(ZAYNAB_RECIPE).toContain("YOU ARE NOT BOUND by the photos");
    // the owner's clothing rule: a thobe without a ghutra; a plain black Zaynabi head abaya, only the face and hands showing
    expect(ZAYNAB_RECIPE).toContain("plain THOBE only — NO ghutra, NO shemagh");
    expect(ZAYNAB_RECIPE).toContain("ZAYNABI HEAD ABAYA");
    expect(ZAYNAB_RECIPE).toContain("only the face and the hands are visible");
    expect(ZAYNAB_RECIPE).not.toContain("true-to-life");
    expect(ZAYNAB_RECIPE).not.toContain("DO NOT BEAUTIFY");
    expect(ZAYNAB_RECIPE).toContain("Image 1 is the owner's ENVIRONMENT SHEET");
  });

  it("the brief carries the person's choices: the tile, the people, the library style, time, weather and the greeting", () => {
    const b = zaynabBrief(zaynabInput({ ...ok, style: pixar.id, view: "up" }), 2);
    expect(b).toContain(ZAYNAB_VIEW_TILE.up);
    expect(b).toContain("Image 2 — «أبي»");
    expect(b).toContain("Image 3");
    expect(b).toContain(pixar.text);
    expect(b).toContain("night");
    expect(b).toContain("rain");
    for (const line of ZAYNAB_GREETING) expect(b).toContain(`«${line}»`);
    expect(zaynabBrief(zaynabInput({ ...ok, greeting: false }), 1)).toContain("no writing in the picture");
    expect(zaynabBrief(zaynabInput(ok), 1)).toContain("nothing realistic left");
  });

  it("only the library's styles, and the person's choices are checked", () => {
    expect(() => zaynabInput({ ...ok, style: pixar.id })).not.toThrow();
    expect(() => zaynabInput({ ...ok, style: "my-own-look" })).toThrow();
    // a style is always chosen: «بدون ستايل» is not offered here
    expect(() => zaynabInput({ ...ok, style: "" })).toThrow();
    const page = read("src/components/jawad/zaynab/ZaynabStudio.tsx");
    expect(page).toContain("allowNone={false}");
    // nothing chosen in advance: the person picks the style (it used to start on Pixar, so everyone got Pixar)
    expect(page).toContain('{ view: "shrine", style: "",');
    expect(page).toContain("!input.style");
    expect(() => zaynabInput({ ...ok, view: "nowhere" })).toThrow();
    expect(() => zaynabInput({ ...ok, weather: "fog" })).toThrow();
    expect(() => zaynabInput({ ...ok, consent: false })).toThrow();
    expect(read("src/components/jawad/zaynab/ZaynabStudio.tsx")).toContain("<StylePicker");
    for (const v of ZAYNAB_VIEWS) expect(readFileSync(new URL(`../../${zaynabViewFile(v.id)}`, import.meta.url)).length).toBeGreaterThan(5000);
  });

  it("his prompt is sent back to him if the greeting is not letter for letter, or the sheet is not Image 1", () => {
    const input = zaynabInput(ok);
    expect(zaynabPromptProblems("", input).length).toBeGreaterThan(0);
    expect(zaynabPromptProblems("Image 1 is the sheet. A picture.", input).join(" ")).toContain(ZAYNAB_GREETING[0]);
    expect(zaynabPromptProblems(`Image 1 is the sheet. «${ZAYNAB_GREETING[0]}» «${ZAYNAB_GREETING[1]}»`, input)).toEqual([]);
    expect(zaynabPromptProblems("Image 1 is the sheet.", zaynabInput({ ...ok, greeting: false }))).toEqual([]);
  });

  it("the price is asked with references GPT Image 2's rules accept", () => {
    for (const photos of [1, 2, 6]) {
      const r = evaluate(generatorById(ZAYNAB_IMAGE)!, { settings: { aspect: "3:2", resolution: "std", quality: "medium", count: 1 }, prompt: "Image 1 …", instructions: "", refStyle: "references", refs: zaynabQuoteRefs(photos), strict: true }, {});
      expect(r.issues.filter((i) => i.field === "refs"), `photos ${photos}`).toEqual([]);
    }
  });

  it("the first attempt is free for 26 hours on both branches, once per account, never for a failed one", () => {
    expect(FREE_FIRST_HOURS).toBe(26);
    expect(freeFirstOpen(new Date(FREE_FIRST_ENDS_AT).getTime() - 1000)).toBe(true);
    expect(freeFirstOpen(new Date(FREE_FIRST_ENDS_AT).getTime() + 1000)).toBe(false);
    const free = read("src/lib/jawad/server/free-first.ts");
    expect(free).toContain('.neq("status", "failed")');
    for (const f of ["src/app/api/jawad/zaynab/route.ts", "src/app/api/jawad/cartoon/route.ts"]) expect(read(f)).toContain("freeFirstEligible(");
    expect(read("src/lib/jawad/server/jobs.ts")).toContain("server.free === true");
    expect(read("src/app/api/jawad/zaynab/route.ts")).toContain("input.count === 1");
  });

  it("Claude knows it", () => {
    expect(JAWAD_KNOWLEDGE).toContain("/jawad-ai/zaynab");
    expect(JAWAD_KNOWLEDGE).toContain("«جواد» WRITES THE PROMPT");
  });
});
