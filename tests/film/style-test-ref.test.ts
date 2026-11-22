import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STYLE_TEST_KEY, styleTestPictures, styleTestRef, testRefOn } from "@/lib/film/style-test-ref";
import { TEST_STYLE_FOR_MASTER, TEST_STYLE_FOR_SHEET } from "@config/film-prompts/sheet-maker";

const pic = (id: string, styleId: string, at: number, o: Partial<{ status: string; ref_key: string; kind: string }> = {}) => ({
  id, kind: "image", ref_key: STYLE_TEST_KEY, status: "generated", meta: { styleId }, created_at: `2026-11-22T10:0${at}:00Z`, ...o,
});
const style = (data: Record<string, unknown> = {}, status = "approved") => ({ status, data: { styleId: "anime", ...data } });
const tests = [pic("a1", "anime", 1), pic("p1", "pixar", 2), pic("a2", "anime", 3), pic("a3", "anime", 4, { status: "failed" }), pic("a4", "anime", 5, { status: "generating" })];

describe("«صورة الاختبار مرجع»", () => {
  it("is on by default — in films made before it too (their style row has no choice)", () => {
    expect(testRefOn(style())).toBe(true);
    expect(styleTestRef(style(), tests)?.id).toBe("a2");
  });

  it("only the chosen style's pictures that are drawn, never another style's, a failed one or one still drawing", () => {
    expect(styleTestPictures(style(), tests).map((p) => p.id)).toEqual(["a1", "a2"]);
    expect(styleTestPictures(style(), [pic("x", "anime", 1, { ref_key: "CHR-01" })])).toEqual([]);
  });

  it("the person may pick another test picture of the style, or switch it off", () => {
    expect(styleTestRef(style({ testRef: { on: true, assetId: "a1" } }), tests)?.id).toBe("a1");
    // a picture that is not the style's falls back to the latest one
    expect(styleTestRef(style({ testRef: { on: true, assetId: "p1" } }), tests)?.id).toBe("a2");
    expect(styleTestRef(style({ testRef: { on: false } }), tests)).toBeNull();
    expect(testRefOn(style({ testRef: { on: false } }))).toBe(false);
  });

  it("nothing before the style is approved, and nothing without a picture or a file", () => {
    expect(styleTestRef(style({}, "awaiting_approval"), tests)).toBeNull();
    expect(styleTestRef(null, tests)).toBeNull();
    expect(styleTestRef(style(), [])).toBeNull();
    expect(styleTestRef(style(), tests, (p) => p.id !== "a2")?.id).toBe("a1");
  });

  it("the drawing takes only its style, never its people or places, and the master stays the last image of a sheet", () => {
    for (const t of [TEST_STYLE_FOR_MASTER, TEST_STYLE_FOR_SHEET]) expect(t).toMatch(/ONLY/);
    expect(TEST_STYLE_FOR_SHEET).toMatch(/SECOND-TO-LAST/);
    const src = readFileSync("src/lib/film/sheets.ts", "utf8");
    const body = src.slice(src.indexOf("async function generateSheet("), src.indexOf("type ImageJob"));
    // the converted real person returns before the test picture is attached
    expect(body.indexOf("convertUploads(assets, sheetId).length")).toBeLessThan(body.indexOf("if (test) refs.push(test);"));
    expect(body.indexOf("if (test) refs.push(test);")).toBeLessThan(body.indexOf("refs.push(images[MASTER_ID]);"));
    expect(body).toContain("TEST_STYLE_FOR_MASTER");
    expect(src).toContain('case "set_test_ref"');
  });
});
