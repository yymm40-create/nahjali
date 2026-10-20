import vm from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SCENE_KIT_JS } from "@/lib/editor/scene/kit";
import { SCENE_RUNTIME_JS } from "@/lib/editor/scene/runtime";
import { SCENE_CONTRACT } from "@/lib/editor/scene/skill";

// «💬 مختبر الموشن» as a conversation, and the finished piece kept editable (its texts and colours are params).

const s = vi.hoisted(() => ({ calls: [] as { text: string; maxTokens: number }[], reply: {} as unknown }));
vi.mock("@/lib/film/anthropic", () => ({
  callClaudeJson: async (a: { turns: { content: { type: string; text?: string }[] }[]; maxTokens: number }) => {
    s.calls.push({ text: a.turns[0].content.filter((p) => p.type === "text").map((p) => p.text).join("\n"), maxTokens: a.maxTokens });
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
    expect(r.action).toBe("plan");
    expect(r.brief).toBe("إعلان لتطبيقي");
    expect(s.calls[0].text).toContain("THE CONVERSATION SO FAR:\nالشخص: أبي شي ذهبي");
    expect(s.calls[0].text).toContain("There is no plan yet.");
  });

  it("with a piece, a change comes back as the whole revised program, and an attached logo is drawn as the real picture", async () => {
    const { labChat } = await import("@/lib/editor/scene/director");
    s.reply = { reply: "حطيته", action: "code", brief: "", code: program };
    const r = await labChat(project, who, { message: "حط الشعار في النهاية", plan: { title: "x", seconds: 4 }, code: program, assets: [{ id: "a1", name: "logo.png", w: 512, h: 512 }], params: { title: "مرحبا" } });
    expect(r.action).toBe("code");
    expect(r.code).toContain("K.p('title'");
    expect(s.calls[0].text).toContain("a1 = «logo.png» 512×512");
    expect(s.calls[0].text).toContain("draw the REAL picture (K.picture)");
    expect(s.calls[0].text).toContain('"title":"مرحبا"');
    expect(s.calls[0].maxTokens).toBeGreaterThanOrEqual(32000);
    await expect(labChat(project, who, { message: "" })).rejects.toThrow();
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
