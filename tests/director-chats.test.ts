import { describe, expect, it } from "vitest";
import { contextOf, readMedia } from "@/lib/director/chats";

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
});
