import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// «المصمم الذكي»: a change to a design is a PATCH on the program it was drawn from (kept with the design), not a new
// program written from zero; when the patch can't be applied or the result throws, the design is drawn whole once.

const claude = vi.hoisted(() => ({ answers: [] as unknown[], calls: [] as { schema: object; effort?: string; text: string; images: number }[] }));
vi.mock("@/lib/film/anthropic", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  callClaudeJson: async (o: { schema: object; effort?: string; turns: { content: { type: string; text?: string }[] }[] }) => {
    const parts = o.turns[0].content;
    claude.calls.push({ schema: o.schema, effort: o.effort, text: parts.filter((p) => p.type === "text").map((p) => p.text).join("\n"), images: parts.filter((p) => p.type === "image64").length });
    return { data: claude.answers.shift(), raw: "", usage: { input_tokens: 0, output_tokens: 0 } };
  },
  claudeCost: () => 0,
}));
vi.mock("@/lib/claude-run", () => ({ robotTurn: async (_u: unknown, _m: unknown, _l: string, run: () => Promise<object>) => ({ ...(await run()), model: "claude-opus-5-5", coins: 1 }) }));

// the browser side: the scene page and the server are stand-ins; a program containing BOOM throws on the scene page
const page = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[], answer: (() => ({})) as (b: Record<string, unknown>) => unknown, loaded: [] as string[] }));
vi.mock("@/lib/fetch", () => ({ postJson: async (_url: string, body: Record<string, unknown>) => (page.calls.push(body), page.answer(body)) }));
vi.mock("@/components/jawad/editor/scene-host", () => {
  class SceneError extends Error {
    constructor(message: string, public where: string, public t?: number, public stack2 = "") {
      super(message);
    }
  }
  class SceneHost {
    async load(code: string) {
      page.loaded.push(code);
      if (code.includes("BOOM")) throw new SceneError("boom", "draw");
    }
    async frame() {
      return { width: 10, height: 10, close() {} };
    }
    destroy() {}
  }
  return { SceneError, SceneHost, sceneFont: () => null };
});

import { patchProgram, pictureReview, pictureWrite } from "@/lib/claude-code/picture";
import { drawWithCode, type DrawEdit } from "@/components/claude-code/draw";
import { editOf, photoKeys, readProgram } from "@/lib/designer/program";
import { readPending } from "@/lib/designer/chats";
import { ANSWER_SCHEMA } from "@/lib/designer/chat";

const PROGRAM = `scene({ duration: 1, blur: 0, draw(K, t, ctx) {
  ctx.fillStyle = "#101820";
  K.text(ctx, "حفل زفاف سعيد", 720, 400);
  K.text(ctx, "الخميس ٢٠ رجب", 720, 900);
} });`;
const user = { id: "u1", email: "a@b.c" } as never;

describe("the design's program, kept with it", () => {
  it("round-trips through the artwork's record and is offered as an edit for the same frame only", () => {
    const record = { code: PROGRAM, fonts: { head: "amiri", body: "readex" }, size: [1440, 1440] as [number, number], photos: photoKeys({ art: "art-1", refs: ["p1", "r1", "p2"], place: ["p2", "p1"] }) };
    expect(record.photos).toEqual(["art-1", "p1", "p2"]);
    const stored = JSON.parse(JSON.stringify({ prompt: "brief", program: record }));
    expect(readProgram(stored.program)).toEqual(record);
    expect(readProgram(stored.program, [1440, 1440])).toEqual(record);
    expect(readProgram(stored.program, [1080, 1920])).toBeNull();
    for (const bad of [null, {}, { ...record, code: "" }, { ...record, fonts: {} }, { ...record, size: [0, 5] }, { ...record, code: "x".repeat(200_000) }]) expect(readProgram(bad)).toBeNull();

    const same = editOf({ program: stored.program, aspect: "1:1", brief: "OLD", said: "صحح كلمة", photos: ["art-1", "p1", "p2"] });
    expect(same).toEqual({ code: PROGRAM, fonts: record.fonts, brief: "OLD", said: "صحح كلمة", photosChanged: false });
    expect(editOf({ program: stored.program, aspect: "1:1", brief: "", said: "", photos: ["art-2", "p1", "p2"] })?.photosChanged).toBe(true);
    // another shape is another design: drawn from zero
    expect(editOf({ program: stored.program, aspect: "9:16", brief: "", said: "", photos: [] })).toBeNull();
  });

  it("a pending change keeps the design it changes; «كاظم» says whether it is a change", () => {
    expect(readPending({ id: "d1", at: 3, artwork: "x", base: "file-1" })?.base).toBe("file-1");
    expect(readPending({ id: "d1", at: 3, artwork: "x" })?.base).toBeUndefined();
    expect(ANSWER_SCHEMA.properties.produce.properties.change.type).toBe("boolean");
  });
});

describe("a change is a patch on the program (server)", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test";
    claude.answers = [];
    claude.calls = [];
  });

  it("applies exact edits; a broken patch fails; a whole program is used only when he wrote one", () => {
    expect(patchProgram(PROGRAM, { edits: [{ old: "حفل زفاف سعيد", new: "حفل زفاف مبارك" }], code: "" })).toEqual({ code: PROGRAM.replace("سعيد", "مبارك") });
    expect(patchProgram(PROGRAM, { edits: [{ old: "K.text", new: "x" }], code: "" })).toMatchObject({ patchFailed: expect.stringContaining("more than once") });
    expect(patchProgram(PROGRAM, { edits: [], code: "" })).toEqual({ patchFailed: "the patch has no edits" });
    expect(patchProgram(PROGRAM, { edits: [{ old: "missing", new: "x" }], code: "scene({ draw(K){} })" })).toEqual({ code: "scene({ draw(K){} })" });
  });

  it("asks for edits (medium thought, no reference pictures) and returns the patched program whole", async () => {
    claude.answers.push({ edits: [{ old: "الخميس ٢٠ رجب", new: "الجمعة ٢١ رجب" }], code: "", fonts: { head: "amiri", body: "readex" }, notes: "تم" });
    const jpeg = "QUJD";
    const r = await pictureWrite(user, { action: "write", edit: true, prompt: "NEW BRIEF", brief: "OLD BRIEF", said: "غيّر التاريخ", code: PROGRAM, fonts: { head: "amiri", body: "readex" }, aspect: "1:1", references: [jpeg, jpeg], photos: [jpeg] });
    expect(r.code).toBe(PROGRAM.replace("الخميس ٢٠ رجب", "الجمعة ٢١ رجب"));
    expect(r).not.toHaveProperty("patchFailed");
    const call = claude.calls[0];
    expect(call.effort).toBe("medium");
    expect(call.images).toBe(0);
    expect((call.schema as { required: string[] }).required).toContain("edits");
    for (const s of ["CHANGE the picture's program", "NEW BRIEF", "OLD BRIEF", "غيّر التاريخ", PROGRAM]) expect(call.text).toContain(s);
  });

  it("says so when the patch can't be applied (the page then draws from zero)", async () => {
    claude.answers.push({ edits: [{ old: "not in the program", new: "x" }], code: "", fonts: { head: "amiri", body: "readex" }, notes: "" });
    const r = await pictureWrite(user, { edit: true, prompt: "NEW", code: PROGRAM, aspect: "1:1" });
    expect(r.code).toBe("");
    expect(r).toMatchObject({ patchFailed: expect.stringContaining("not in the text") });
  });

  it("without the flag, writing and reviewing are as before (a whole program, high thought)", async () => {
    claude.answers.push({ code: PROGRAM, fonts: { head: "amiri", body: "readex" }, notes: "" });
    await pictureWrite(user, { prompt: "DRAW", aspect: "1:1" });
    expect(claude.calls[0].effort).toBe("high");
    expect((claude.calls[0].schema as { required: string[] }).required).not.toContain("edits");
    const low = { ask: 5, composition: 9, type: 9, light: 9, color: 9, finish: 9 };
    claude.answers.push({ scores: low, worst: [], verdict: "", code: PROGRAM.replace("#101820", "#202830") });
    const r = await pictureReview(user, { prompt: "DRAW", code: PROGRAM, still: "QUJD", round: 1 });
    expect(r.code).toContain("#202830");
    // the review of a change fixes with edits too
    claude.answers.push({ scores: low, worst: [], verdict: "", code: "", edits: [{ old: "#101820", new: "#303840" }] });
    const p = await pictureReview(user, { prompt: "DRAW", code: PROGRAM, still: "QUJD", round: 1, patch: true });
    expect(p.code).toBe(PROGRAM.replace("#101820", "#303840"));
  });
});

describe("a change is a patch on the program (browser)", () => {
  const PASS = { scores: { ask: 9 }, pass: true, verdict: "ok" };
  const edit: DrawEdit = { code: PROGRAM, fonts: { head: "amiri", body: "readex" }, brief: "OLD", said: "صحح", photosChanged: false };
  const steps: string[] = [];
  const draw = (e: DrawEdit | null) => drawWithCode({ prompt: "NEW", aspect: "1:1", style: "", references: [], photos: [], model: "opus", from: "designer", edit: e, onStep: (s) => steps.push(s.text) });

  beforeEach(() => {
    page.calls = [];
    page.loaded = [];
    steps.length = 0;
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }), toDataURL: () => "data:image/png;base64,UE5H" }) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("patches, renders and reviews once — no program written from zero", async () => {
    const patched = PROGRAM.replace("سعيد", "مبارك");
    page.answer = (b) => (b.action === "write" ? { code: patched, problems: [], fonts: edit.fonts, size: [1440, 1440], notes: "", coins: 2 } : { review: PASS, code: "", problems: [], coins: 3 });
    const r = await draw(edit);
    expect(page.calls.map((c) => [c.action, c.edit ?? c.patch ?? null])).toEqual([["write", true], ["review", true]]);
    expect(page.calls[0]).toMatchObject({ code: PROGRAM, brief: "OLD", said: "صحح", photosChanged: false });
    expect(r).toMatchObject({ edited: true, coins: 5, rounds: 1, program: { code: patched, size: [1440, 1440] } });
  });

  it("a fix the review asks for is applied as well (and its program kept)", async () => {
    const fixed = PROGRAM.replace("#101820", "#303840");
    page.answer = (b) => (b.action === "write" ? { code: PROGRAM, problems: [], fonts: edit.fonts, size: [1440, 1440], notes: "", coins: 1 } : { review: { ...PASS, pass: false }, code: fixed, problems: [], coins: 1 });
    const r = await draw(edit);
    expect(page.loaded).toEqual([PROGRAM, fixed]);
    expect(r.program?.code).toBe(fixed);
    expect(page.calls).toHaveLength(2);
  });

  it("falls back to the whole program once when the patch can't be applied", async () => {
    const whole = PROGRAM.replace("#101820", "#000000");
    page.answer = (b) => (b.action === "write" ? (b.edit ? { code: "", problems: [], fonts: edit.fonts, size: [1440, 1440], notes: "", patchFailed: "edit 1 of 1: not found", coins: 1 } : { code: whole, problems: [], fonts: edit.fonts, size: [1440, 1440], notes: "", coins: 10 }) : { review: PASS, code: "", problems: [], coins: 4 });
    const r = await draw(edit);
    expect(page.calls.map((c) => [c.action, c.edit ?? null])).toEqual([["write", true], ["write", null], ["review", null]]);
    expect(r.edited).toBeUndefined();
    expect(r.coins).toBe(15);
    expect(r.program?.code).toBe(whole);
    expect(steps.some((s) => s.includes("من جديد"))).toBe(true);
  });

  it("falls back to the whole program once when the patched program throws", async () => {
    page.answer = (b) => (b.action === "write" ? { code: b.edit ? `${PROGRAM}\n// BOOM` : PROGRAM, problems: [], fonts: edit.fonts, size: [1440, 1440], notes: "", coins: 1 } : { review: PASS, code: "", problems: [], coins: 1 });
    const r = await draw(edit);
    expect(page.calls.map((c) => [c.action, c.edit ?? null])).toEqual([["write", true], ["write", null], ["review", null]]);
    expect(r.program?.code).toBe(PROGRAM);
  });

  it("without an edit, a picture is drawn as before (and its program comes back to be kept)", async () => {
    page.answer = (b) => (b.action === "write" ? { code: PROGRAM, problems: [], fonts: edit.fonts, size: [1440, 1440], notes: "", coins: 1 } : { review: PASS, code: "", problems: [], coins: 1 });
    const r = await draw(null);
    expect(page.calls.map((c) => [c.action, c.edit ?? null])).toEqual([["write", null], ["review", null]]);
    expect(r.program?.code).toBe(PROGRAM);
    expect(r.edited).toBeUndefined();
  });
});
