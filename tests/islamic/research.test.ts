import { beforeEach, describe, expect, it, vi } from "vitest";

// The deep research end to end with Claude and the library replaced by stand-ins: it searches round after round,
// numbers every passage once, keeps the primary source apart, and stops when Claude writes its notes.
const calls = vi.hoisted(() => ({ bodies: [] as Record<string, unknown>[], replies: [] as Record<string, unknown>[], searched: [] as [string, string][] }));

vi.mock("@/lib/film/anthropic", async (orig) => ({
  ...(await orig<typeof import("@/lib/film/anthropic")>()),
  claudeFetch: vi.fn(async (_u: string, init: RequestInit) => {
    calls.bodies.push(JSON.parse(String(init.body)));
    return { res: new Response(), body: calls.replies.shift() ?? { stop_reason: "end_turn", content: [{ type: "text", text: "انتهى" }], usage: { input_tokens: 1, output_tokens: 1 } } };
  }),
}));
vi.mock("@/lib/islamic/library", () => ({
  searchScoped: vi.fn(async (q: string, scope: string) => {
    calls.searched.push([q, scope]);
    const host = scope === "primary" ? "https://thaqalayn.com/chapter/1" : "https://www.aqaed.com/faq/1";
    return [1, 2].map((i) => ({ chunk_id: (scope === "primary" ? 100 : 200) + i + (q.includes("ثانية") ? 0 : 0), doc_id: `${scope}${i}`, n: 0, url: host, title: `${scope} ${i}`, kind: scope === "primary" ? "hadith-chapter" : "qa", source_name: scope, text: `نص ${scope} ${i}`, rank: 1 }));
  }),
}));

import { research } from "@/lib/islamic/research";

const usage = { input_tokens: 10, output_tokens: 10 };
beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test";
  calls.bodies.length = 0;
  calls.searched.length = 0;
  calls.replies.length = 0;
});

describe("the deep research", () => {
  it("searches thaqalayn then the complements, numbers each passage once, and ends with the notes", async () => {
    calls.replies.push(
      { stop_reason: "tool_use", usage, content: [{ type: "tool_use", id: "a", name: "search_library", input: { query: "ثواب زيارة الحسين", scope: "primary" } }, { type: "tool_use", id: "b", name: "search_library", input: { query: "زيارة الحسين ثانية", scope: "primary" } }] },
      { stop_reason: "tool_use", usage, content: [{ type: "tool_use", id: "c", name: "search_library", input: { query: "فضل الزيارة", scope: "complements" } }] },
      { stop_reason: "end_turn", usage, content: [{ type: "text", text: "وُجدت روايات في [1] و[2]" }] },
    );
    const r = await research("فضل زيارة الحسين", "", null);
    expect(calls.searched).toEqual([["ثواب زيارة الحسين", "primary"], ["زيارة الحسين ثانية", "primary"], ["فضل الزيارة", "complements"]]);
    // the same chunk found twice is kept once
    expect(r.passages.map((p) => p.chunk_id)).toEqual([101, 102, 201, 202]);
    expect(r.notes).toBe("وُجدت روايات في [1] و[2]");
    expect(r.searches).toHaveLength(3);
    // the tool results carry the numbers and say which source is primary
    const second = calls.bodies[1].messages as { role: string; content: unknown }[];
    const results = JSON.stringify(second[second.length - 1].content);
    expect(results).toContain("[1] (أساسي — الثقلين");
    expect(calls.bodies[0].tools).toBeDefined();
  });

  it("stops searching after its last round and asks for the notes without tools", async () => {
    for (let i = 0; i < 10; i++) calls.replies.push({ stop_reason: "tool_use", usage, content: [{ type: "tool_use", id: `t${i}`, name: "search_library", input: { query: `بحث ${i}`, scope: "primary" } }] });
    const r = await research("سؤال", "", null);
    expect(calls.bodies.length).toBe(6);
    expect(calls.bodies[5].tools).toBeUndefined();
    expect(r.searches.length).toBe(5);
  });
});
