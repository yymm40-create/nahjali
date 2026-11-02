import vm from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SCENE_KIT_JS } from "@/lib/editor/scene/kit";
import { SCENE_RUNTIME_JS } from "@/lib/editor/scene/runtime";
import { SCENE_CONTRACT } from "@/lib/editor/scene/skill";

// «💬 مختبر الموشن» as a conversation, and the finished piece kept editable (its texts and colours are params).

const s = vi.hoisted(() => ({ calls: [] as { text: string; maxTokens: number; effort?: string; schema: { properties: Record<string, unknown> } }[], reply: {} as unknown }));
vi.mock("@/lib/film/anthropic", () => ({
  callClaudeJson: async (a: { turns: { content: { type: string; text?: string }[] }[]; maxTokens: number; effort?: string; schema: { properties: Record<string, unknown> } }) => {
    s.calls.push({ text: a.turns[0].content.filter((p) => p.type === "text").map((p) => p.text).join("\n"), maxTokens: a.maxTokens, effort: a.effort, schema: a.schema });
    return { data: s.reply, raw: "", usage: { input_tokens: 1, output_tokens: 1 } };
  },
  claudeCost: () => 0.01,
  claudeWhy: (_e: unknown, say: string) => say,
}));
vi.mock("@/lib/editor/pricing", () => ({ claudeCharged: async (_w: unknown, _m: unknown, _l: string, run: () => Promise<object>) => ({ ...(await run()), coins: 1, model: "claude-opus-5-5" }) }));
vi.mock("@/lib/editor/server", () => ({ stillOpen: () => {} }));

const project = { id: "p1", user_id: "u1", timeline: { width: 1080, height: 1920 } } as never;
const who = { id: "u1", owner: false };
const program = "scene({ duration: 4, params: { title: { label: 'العنوان', type: 'text', value: 'هلا' } }, draw: function (K, t, ctx) { K.text(ctx, K.p('title', 'هلا'), 10, 10, {}); } });";

describe("the lab as a conversation", () => {
  beforeEach(() => {
    s.calls = [];
    process.env.ANTHROPIC_API_KEY = "test";
  });

  it("with no piece yet, a change is a plan from a brief of the whole conversation", async () => {
    const { labChat } = await import("@/lib/editor/scene/director");
    s.reply = { reply: "تمام", action: "code", brief: "", code: "" };
    const r = await labChat(project, who, { message: "إعلان لتطبيقي", history: [{ role: "user", text: "أبي شي ذهبي" }] });
    if (!("reply" in r)) throw new Error("cut");
    expect(r.action).toBe("plan");
    expect(r.brief).toBe("إعلان لتطبيقي");
    expect(s.calls[0].text).toContain("THE CONVERSATION SO FAR:\nالشخص: أبي شي ذهبي");
    expect(s.calls[0].text).toContain("There is no plan yet.");
  });

  it("with a piece, a change comes back as the whole revised program, and an attached logo is drawn as the real picture", async () => {
    const { labChat } = await import("@/lib/editor/scene/director");
    s.reply = { reply: "حطيته", action: "code", brief: "", code: program };
    const r = await labChat(project, who, { message: "حط الشعار في النهاية", plan: { title: "x", seconds: 4 }, code: program, assets: [{ id: "a1", name: "logo.png", w: 512, h: 512 }], params: { title: "مرحبا" } });
    if (!("reply" in r)) throw new Error("cut");
    expect(r.action).toBe("code");
    expect(r.code).toContain("K.p('title'");
    expect(s.calls[0].text).toContain("a1 = «logo.png» 512×512");
    expect(s.calls[0].text).toContain("draw the REAL picture (K.picture)");
    expect(s.calls[0].text).toContain('"title":"مرحبا"');
    expect(s.calls[0].maxTokens).toBeGreaterThanOrEqual(32000);
    await expect(labChat(project, who, { message: "" })).rejects.toThrow();
  });
});

describe("a change answered as a patch (the output is the dear part: a few edits instead of the whole program)", () => {
  beforeEach(() => {
    s.calls = [];
    process.env.ANTHROPIC_API_KEY = "test";
  });
  const piece = { plan: { title: "x", seconds: 4 }, code: program };

  it("a note comes back as exact edits on the current program, applied on the server, at medium thought; he still reads the whole program", async () => {
    const { labChat } = await import("@/lib/editor/scene/director");
    s.reply = { reply: "تم", action: "code", brief: "", code: "", edits: [{ old: "value: 'هلا'", new: "value: 'مرحبا'" }], options: [], search: "" };
    const r = await labChat(project, who, { message: "خل العنوان مرحبا", ...piece });
    if (!("reply" in r)) throw new Error("cut");
    expect(r.action).toBe("code");
    expect(r.code).toBe(program.replace("value: 'هلا'", "value: 'مرحبا'"));
    expect(r).not.toHaveProperty("patchFailed");
    expect(s.calls[0].schema.properties).toHaveProperty("edits");
    expect(s.calls[0].effort).toBe("medium");
    expect(s.calls[0].text).toContain(`THE CURRENT PROGRAM:\n${program}`);
    expect(s.calls[0].text).toContain('return "edits" on THE CURRENT PROGRAM');
  });

  it("a patch that does not apply (not found, or found twice) gives no program and says why; asked again whole, it is the complete program", async () => {
    const { labChat } = await import("@/lib/editor/scene/director");
    for (const old of ["'غير موجود'", "'هلا'"]) {
      s.reply = { reply: "تم", action: "code", brief: "", code: "", edits: [{ old, new: "'x'" }], options: [], search: "" };
      const r = await labChat(project, who, { message: "خل العنوان x", ...piece });
      if (!("reply" in r)) throw new Error("cut");
      expect(r.action).toBe("code");
      expect(r.code).toBe("");
      expect(r.patchFailed).toMatch(old === "'هلا'" ? /more than once/ : /not in the text/);
    }
    s.calls = [];
    s.reply = { reply: "تم", action: "code", brief: "", code: program, options: [], search: "" };
    const r = await labChat(project, who, { message: "خل العنوان x", ...piece, whole: true, patchFailed: "edit 1 of 1: its old text occurs more than once" });
    if (!("reply" in r)) throw new Error("cut");
    expect(r.code).toBe(program);
    expect(s.calls[0].schema.properties).not.toHaveProperty("edits");
    expect(s.calls[0].text).toContain("return the COMPLETE revised program");
    expect(s.calls[0].text).toContain("A PATCH THAT COULD NOT BE APPLIED (edit 1 of 1: its old text occurs more than once)");
  });

  it("a fix after a runtime error is a patch when the page asks, and says so when it does not apply", async () => {
    const { labWrite } = await import("@/lib/editor/scene/director");
    s.reply = { edits: [{ old: "K.text(ctx,", new: "K.text(ctx," }, { old: "duration: 4", new: "duration: 4.5" }], code: "", notes: "صلّحته" };
    const fix = { plan: { title: "x", seconds: 4 }, seconds: 4, code: program, errors: "At t = 1 s the frame threw: x is not defined" };
    const r = await labWrite(project, who, { ...fix, patch: true });
    if (!("code" in r)) throw new Error("cut");
    expect(r.code).toBe(program.replace("duration: 4", "duration: 4.5"));
    expect(r.problems).toEqual([]);
    expect(s.calls[0].schema.properties).toHaveProperty("edits");
    expect(s.calls[0].text).toContain('Answer with "edits" on THE PROGRAM');
    s.reply = { edits: [{ old: "nope", new: "x" }], code: "", notes: "" };
    const bad = await labWrite(project, who, { ...fix, patch: true });
    if (!("code" in bad)) throw new Error("cut");
    expect(bad.code).toBe("");
    expect(bad).toHaveProperty("patchFailed");
    // without `patch` it is the whole program, as before
    s.calls = [];
    s.reply = { code: program, notes: "" };
    const all = await labWrite(project, who, fix);
    if (!("code" in all)) throw new Error("cut");
    expect(all.code).toBe(program);
    expect(s.calls[0].schema.properties).not.toHaveProperty("edits");
    expect(s.calls[0].text).toContain("Write the COMPLETE program");
  });
});

describe("the piece stays editable", () => {
  it("every shown word and the main colours are params the scene reads with K.p, the person's values over its own", () => {
    expect(SCENE_CONTRACT).toContain("EVERY word shown on screen and the 2–4 main colours of the palette are params");
    const context: Record<string, unknown> = { module: { exports: {} }, Math, console };
    vm.createContext(context);
    vm.runInContext(SCENE_KIT_JS, context);
    const K = (context.module as { exports: { P: Record<string, string>; p: (id: string, d?: string) => string } }).exports;
    expect(K.p("title", "x")).toBe("x");
    K.P = { title: "مرحبا", empty: "" };
    expect(K.p("title", "x")).toBe("مرحبا");
    expect(K.p("empty", "x")).toBe("x");
    expect(SCENE_RUNTIME_JS).toContain("K.P[k] = over[k] !== undefined && over[k] !== null ? String(over[k])");
    expect(SCENE_RUNTIME_JS).toContain("params: plist");
  });
});
