import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STYLE_TEST_KEY, drawnWithTest, promptWithTestStyle, sheetEdits, styleTestCandidate, styleTestPictures, styleTestRef, testRefFor, testRefOn } from "@/lib/film/style-test-ref";
import { CLIENT_CHANGES_HEAD, MASTER_STYLE_ONLY, MASTER_STYLE_SECONDARY, TEST_STYLE_FOR_MASTER, TEST_STYLE_FOR_SHEET, TEST_STYLE_LOCK } from "@config/film-prompts/sheet-maker";

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

  it("the drawing takes only its look from it, never its people or places, and the master stays the last image of a sheet", () => {
    for (const t of [TEST_STYLE_FOR_MASTER, TEST_STYLE_FOR_SHEET]) expect(t).toMatch(/ONLY/);
    expect(TEST_STYLE_FOR_SHEET).toMatch(/SECOND-TO-LAST/);
    const src = readFileSync("src/lib/film/sheets.ts", "utf8");
    const body = src.slice(src.indexOf("async function generateSheet("), src.indexOf("async function userMessages("));
    // the converted real person returns before the test picture is attached
    expect(body.indexOf("convertUploads(assets, sheetId).length")).toBeLessThan(body.indexOf("if (test) refs.push(test);"));
    expect(body.indexOf("if (test) refs.push(test);")).toBeLessThan(body.indexOf("if (!master) refs.push(images[MASTER_ID]);"));
    // a character sheet carries the film maker's fixed three-panel layout (config/film-prompts/character-sheet)
    expect(body).toContain("promptWithTestStyle(isCharacter ? withCharacterLayout(prompt.data.prompt) : prompt.data.prompt, { master, withTest: Boolean(test), styleText: style?.body, edits })");
    expect(src).toContain('case "set_test_ref"');
  });

  it("a card's own «📎» wins over the film's setting; without it the setting decides", () => {
    const off = style({ testRef: { on: false, assetId: "a1" } });
    // ticked on the card while the film's setting is off: the picked picture goes
    expect(testRefFor(off, tests, true)?.id).toBe("a1");
    expect(styleTestCandidate(off, tests)?.id).toBe("a1");
    // unticked on the card while the setting is on: nothing goes
    expect(testRefFor(style(), tests, false)).toBeNull();
    // the chain that draws by itself follows the setting
    expect(testRefFor(style(), tests, undefined)?.id).toBe("a2");
    expect(testRefFor(off, tests, undefined)).toBeNull();
    // ticked, but no test picture: nothing to send (and nothing said to be sent)
    expect(testRefFor(style(), [], true)).toBeNull();
  });

  it("a picture says it went with the test picture only when the server wrote so on it", () => {
    expect(drawnWithTest({ style_test_ref: "a2" })).toBe(true);
    expect(drawnWithTest({})).toBe(false);
    expect(drawnWithTest(null)).toBe(false);
    const src = readFileSync("src/lib/film/sheets.ts", "utf8");
    // written on the picture's row with the very picture that was attached to it
    expect(src).toContain("meta: test ? { style_test_ref: test.id } : {}");
    // the card's choice reaches the drawing
    expect(src).toContain("await generateSheet(project, user, v, assets, useTest);");
    const card = readFileSync("src/app/film/[id]/sheets/SheetCards.tsx", "utf8");
    expect(card).toContain("...(canTest ? { useTest } : {})");
  });

  it("with the test frame the frame governs the look: the written style leaves the prompt and the master is secondary", () => {
    const styleText = "Friendly Rounded 3D — rounded friendly shapes, soft low-noise surfaces, warm key light with cool fill";
    const prompt = `Character sheet of the boy.\nVISUAL STYLE: ${styleText}\nFour views and five expressions.`;
    const sheet = promptWithTestStyle(prompt, { master: false, withTest: true, styleText });
    expect(sheet).not.toContain(styleText);
    expect(sheet).toContain(TEST_STYLE_LOCK);
    expect(sheet).toContain(TEST_STYLE_FOR_SHEET);
    expect(sheet).toContain(MASTER_STYLE_SECONDARY);
    expect(sheet).not.toContain(MASTER_STYLE_ONLY);
    // the frame decides colors and shapes, the prompt decides what is drawn
    expect(TEST_STYLE_FOR_SHEET).toMatch(/colors/);
    expect(TEST_STYLE_FOR_SHEET).toMatch(/shapes/);
    expect(TEST_STYLE_FOR_SHEET).toMatch(/WHAT is drawn/);
    const master = promptWithTestStyle(prompt, { master: true, withTest: true, styleText });
    expect(master).toContain(TEST_STYLE_FOR_MASTER);
    expect(master).not.toContain(MASTER_STYLE_SECONDARY);
    expect(master).not.toContain(MASTER_STYLE_ONLY);
  });

  it("without it nothing changes: the written style stays and the master governs as before", () => {
    const styleText = "Friendly Rounded 3D — rounded friendly shapes, soft low-noise surfaces";
    const prompt = `Sheet.\nVISUAL STYLE: ${styleText}`;
    expect(promptWithTestStyle(prompt, { master: false, withTest: false, styleText, edits: ["خلّ الثوب أزرق"] })).toBe(`${prompt}\n\n${MASTER_STYLE_ONLY}`);
    expect(promptWithTestStyle(prompt, { master: true, withTest: false, styleText })).toBe(prompt);
  });

  it("the person's own edits of the sheet come last, above the test frame, in their words", () => {
    const text = promptWithTestStyle("Sheet.", { master: false, withTest: true, styleText: null, edits: ["خلّ الثوب أزرق", " ", "اللحية أقصر"] });
    expect(text.indexOf(TEST_STYLE_FOR_SHEET)).toBeLessThan(text.indexOf(CLIENT_CHANGES_HEAD));
    expect(text.endsWith(`${CLIENT_CHANGES_HEAD}\n1. خلّ الثوب أزرق\n2. اللحية أقصر`)).toBe(true);
    // the frame's notes say the client's changes come before it
    for (const t of [TEST_STYLE_FOR_MASTER, TEST_STYLE_FOR_SHEET]) expect(t).toContain("CLIENT'S CHANGES");
  });

  it("finds this sheet's edits in the conversation, and only this sheet's", () => {
    const msgs = ["اعتمد", "تعديل على CHR-01:\nخلّ الثوب أزرق", "تعديل على CHR-02:\nأطول", "تعديل على CHR-01:\nاللحية أقصر", "تعديل:\nعام"];
    expect(sheetEdits(msgs, "CHR-01")).toEqual(["خلّ الثوب أزرق", "اللحية أقصر"]);
    expect(sheetEdits(msgs, "ENV-01")).toEqual([]);
    expect(sheetEdits(Array.from({ length: 9 }, (_, i) => `تعديل على CHR-01:\n${i}`), "CHR-01")).toEqual(["3", "4", "5", "6", "7", "8"]);
  });
});
