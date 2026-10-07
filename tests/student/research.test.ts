import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const inserted: Record<string, unknown>[] = [];
vi.mock("@/lib/jawad/student/db", () => ({
  getProject: async () => ({ id: "p", user_id: "u", title: "الخلية", level: "متوسط", audience: "", brief: { mode: "research", purpose: "exam" } }),
  sources: async () => [],
  touch: async () => {},
  addVersion: async () => ({}),
  versionOf: async () => null,
  sdb: () => ({ from: () => ({ insert: async (row: Record<string, unknown>) => (inserted.push(row), { error: null }) }) }),
}));

const { researchHandler } = await import("@/lib/jawad/student/research");
let body: { tools: { type: string; allowed_domains?: string[] }[]; system: { text: string }[]; messages: { content: { text: string }[] }[] } | null = null;

beforeEach(() => {
  inserted.length = 0;
  vi.stubEnv("ANTHROPIC_API_KEY", "x");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return new Response(
        JSON.stringify({
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 10 },
          content: [
            { type: "web_fetch_tool_result", content: { type: "web_fetch_result", url: "https://www.moe.edu.kw/science", content: { title: "منهج العلوم" } } },
            { type: "text", text: "الخلية وحدة بناء الكائن الحي.", citations: [{ url: "https://www.moe.edu.kw/science", title: "منهج العلوم" }] },
          ],
        }),
      );
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("«كلاود يبحث لي» with «وين يبحث»", () => {
  it("reads the given page, searches only its site, and writes the material with its source", async () => {
    const r = await researchHandler.step({ id: "j", user_id: "u", project_id: "p", input: { asMaterial: true, focus: "الخلية للصف الثاني", where: "https://www.moe.edu.kw/science" }, progress: {} } as never);
    expect(r.done).toBe(true);
    const search = body!.tools.find((t) => t.type === "web_search_20260209")!;
    expect(search.allowed_domains).toEqual(["moe.edu.kw"]);
    expect(body!.tools.some((t) => t.type === "web_fetch_20260209")).toBe(true);
    expect(body!.system.at(-1)!.text).toContain("never use other sites");
    expect(body!.messages[0].content[0].text).toContain("https://www.moe.edu.kw/science");
    expect(inserted[0]).toMatchObject({ kind: "text", status: "ready" });
    expect(String(inserted[0].body)).toContain("[1] منهج العلوم — https://www.moe.edu.kw/science");
  });

  it("without places: any reliable source, no page reading", async () => {
    await researchHandler.step({ id: "j", user_id: "u", project_id: "p", input: { asMaterial: true, focus: "الخلية" }, progress: {} } as never);
    expect(body!.tools.map((t) => t.type)).toEqual(["web_search_20260209"]);
    expect(body!.tools[0].allowed_domains).toBeUndefined();
  });
});
