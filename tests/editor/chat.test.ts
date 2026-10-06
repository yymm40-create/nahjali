import { describe, expect, it } from "vitest";
import { chatTurns, isLongChat, readMessages } from "@/lib/editor/chat";

const at = "2026-10-06T00:00:00.000Z";

describe("the edit's conversation with Claude", () => {
  it("keeps only well-formed turns", () => {
    const m = readMessages([{ role: "user", text: "قص السكتات", at }, { role: "system", text: "x" }, null, { role: "assistant", text: "تم", done: 3, at }]);
    expect(m).toEqual([{ role: "user", text: "قص السكتات", at }, { role: "assistant", text: "تم", done: 3, at }]);
  });

  it("sends Claude the last turns, starting with the person, without errors", () => {
    const m = readMessages([
      { role: "assistant", text: "هلا", at },
      { role: "user", text: "أ", at },
      { role: "assistant", text: "ما قدرت", error: true, at },
      { role: "assistant", text: "ب", at },
    ]);
    expect(chatTurns({ messages: m, handoff: null })).toEqual([{ role: "user", content: "أ" }, { role: "assistant", content: "ب" }]);
  });

  it("starts a handed-over conversation from its handoff", () => {
    const t = chatTurns({ messages: [{ role: "user", text: "كمّل", at }], handoff: "الهدف: ريل ٣٠ ثانية" });
    expect(t[0]).toEqual({ role: "user", content: expect.stringContaining("الهدف: ريل ٣٠ ثانية") });
    expect(t.map((x) => x.role)).toEqual(["user", "assistant", "user"]);
  });

  it("says when it got long", () => {
    expect(isLongChat(Array.from({ length: 39 }, () => ({ text: "x" })))).toBe(false);
    expect(isLongChat(Array.from({ length: 40 }, () => ({ text: "x" })))).toBe(true);
    expect(isLongChat([{ text: "x".repeat(24_000) }])).toBe(true);
  });
});
