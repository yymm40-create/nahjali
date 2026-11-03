import { describe, expect, it } from "vitest";
import { contextOf, readMedia } from "@/lib/director/chats";
import { needsContract } from "@/lib/director/chat";

describe("Jawad Director conversations", () => {
  it("keeps every simultaneous generation's settings independent", () => {
    const media = readMedia([
      { id: "a", kind: "video", prompt: "A", generatorId: "first", resolution: "480p", seconds: 4, withSound: false },
      { id: "b", kind: "video", prompt: "B", generatorId: "second", resolution: "1080p", seconds: 9, withSound: true },
      { id: "c", kind: "video", prompt: "C", generatorId: "third", resolution: "720p", seconds: 15, withSound: false },
    ]);
    expect(media?.map((item) => [item.id, item.generatorId, item.resolution, item.seconds, item.withSound])).toEqual([
      ["a", "first", "480p", 4, false],
      ["b", "second", "1080p", 9, true],
      ["c", "third", "720p", 15, false],
    ]);
  });

  it("warns early enough to prepare a handoff", () => {
    const messages = Array.from({ length: 36 }, (_, index) => ({ role: index % 2 ? "assistant" as const : "user" as const, text: "مشهد ".repeat(450) }));
    const context = contextOf(messages);
    expect(context.shouldHandoff).toBe(true);
    expect(["warning", "critical"]).toContain(context.level);
  });

  it("sends the reply contract once per session, not with every message", () => {
    const turns = (n: number) => Array.from({ length: n * 2 }, (_, i) => ({ role: i % 2 ? "assistant" as const : "user" as const, text: "x" }));
    // the conversation's first message: no session yet
    expect(needsContract(null, null)).toBe(true);
    expect(needsContract(null, { parentChatId: null, messages: turns(1) })).toBe(true);
    // a session that already holds it
    expect(needsContract("sesn_a", { parentChatId: null, messages: turns(1) })).toBe(false);
    expect(needsContract("sesn_a", { parentChatId: null, messages: turns(5) })).toBe(false);
    // after a handoff: the new session began with the handoff alone, so the person's first message carries it
    expect(needsContract("sesn_b", { parentChatId: "parent", messages: turns(1) })).toBe(true);
    expect(needsContract("sesn_b", { parentChatId: "parent", messages: turns(2) })).toBe(false);
  });
});
