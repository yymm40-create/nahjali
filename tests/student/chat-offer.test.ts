import { beforeEach, describe, expect, it, vi } from "vitest";

// A whole turn of «محادثة مع صادق» with a made-up model: his marker is cut out of what the student reads and kept as
// an offer in the saved conversation, and he is told what the material already holds.

const s = vi.hoisted(() => ({
  reply: "",
  system: "",
  saved: null as null | { content: { messages: { role: string; text: string; offer?: unknown }[] } },
  made: [] as unknown[],
}));
vi.mock("@/lib/games/claude", () => ({
  talk: async (a: { system: string }) => {
    s.system = a.system;
    return { text: s.reply, usd: 0.01 };
  },
}));
vi.mock("@/lib/film/anthropic", () => ({ callClaudeSearch: async () => null }));
vi.mock("@/lib/jawad/student/claude", () => ({ MATERIAL_RULE: "RULE" }));
vi.mock("@/lib/jawad/student/context", () => ({
  loadCtx: async () => ({ project: { level: "", brief: {}, branch: "student" }, understanding: { topic: "الصدقة" }, khateeb: "" }),
  allText: () => "نص المادة",
  researchText: () => "",
  understandingText: () => "فهم المادة",
}));
vi.mock("@/lib/jawad/student/db", () => ({
  outputs: async () => s.made,
  saveOutput: async (_id: string, patch: { content: { messages: { role: string; text: string; offer?: unknown }[] } }) => void (s.saved = patch),
}));

const chat = { id: "c1", project_id: "p1", kind: "chat", content: { messages: [] } } as never;

describe("a turn of «محادثة مع صادق»", () => {
  beforeEach(() => {
    s.saved = null;
    s.made = [];
    s.system = "";
  });

  it("tells him what he can make and what already exists", async () => {
    s.made = [{ kind: "summary", title: "ملخص", status: "done" }, { kind: "chat", title: "محادثة مع صادق", status: "done" }];
    s.reply = "هذا شرح بدون صنع.";
    const { chatTurn } = await import("@/lib/jawad/student/chat");
    await chatTurn("u1", chat, "اشرح لي", false);
    expect(s.system).toContain("MAKING THINGS FROM THIS CONVERSATION");
    expect(s.system).toContain("summary («ملخص», done)");
    expect(s.system).toContain("[[MERGE]]");
  });

  it("keeps his words and an open offer, and cuts the marker out of what the student reads", async () => {
    s.reply = 'تمام، أسوي لك اختبار قصير. اضغط «نفّذ».\n[[MAKE]]{"outputs":[{"kind":"quiz","note":"١٠ أسئلة"}]}';
    const { chatTurn } = await import("@/lib/jawad/student/chat");
    const r = await chatTurn("u1", chat, "سوّ لي اختبار ١٠ أسئلة", false);
    const last = r.messages[r.messages.length - 1] as { text: string; offer?: { items: { kind: string; note: string }[]; state: string } };
    expect(last.text).toBe("تمام، أسوي لك اختبار قصير. اضغط «نفّذ».");
    expect(last.text).not.toContain("[[");
    expect(last.offer).toEqual({ items: [{ kind: "quiz", note: "١٠ أسئلة" }], merge: false, state: "open" });
    // and it is the conversation that was saved, so a refresh keeps the card
    expect(s.saved!.content.messages[1].offer).toEqual(last.offer);
  });

  it("a plain answer carries no offer", async () => {
    s.reply = "الصدقة تطهّر المال.";
    const { chatTurn } = await import("@/lib/jawad/student/chat");
    const r = await chatTurn("u1", chat, "وش فايدة الصدقة؟", false);
    expect("offer" in r.messages[1]).toBe(false);
  });
});
