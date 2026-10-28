import { beforeEach, describe, expect, it, vi } from "vitest";

// Every robot's long conversation (the owner, 28 October 2026): nothing is forgotten — past the window the robot
// writes itself a handoff of everything before, reads it FIRST, then the latest turns, and tells the person.

const rows = new Map<string, { up_to: number; text: string }>();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      let key = "";
      const q = {
        select: () => q,
        eq: (_k: string, v: string) => ((key = v), q),
        maybeSingle: async () => ({ data: rows.get(key) ?? null, error: null }),
        upsert: (r: { key: string; up_to: number; text: string }) => (rows.set(r.key, { up_to: r.up_to, text: r.text }), Promise.resolve({ error: null })),
      };
      return q;
    },
  }),
}));
const seen: string[] = [];
vi.mock("@/lib/film/anthropic", () => ({
  claudeCost: () => 0.01,
  callClaudeJson: async (o: { turns: { content: string }[] }) => {
    seen.push(o.turns[0].content);
    return { data: { handoff: `تسليم ${seen.length}` }, usage: {} };
  },
}));

const { remember, withNote, HANDOFF_NOTE } = await import("@/lib/robot-handoff");
const chat = (n: number) => Array.from({ length: n }, (_, i) => ({ role: (i % 2 ? "assistant" : "user") as "user" | "assistant", text: `رسالة ${i + 1}` }));

beforeEach(() => {
  rows.clear();
  seen.length = 0;
});

describe("a robot's long conversation is handed over, never cut", () => {
  it("reads everything while it fits", async () => {
    const m = await remember({ key: "t:1", userId: null, robot: "محمد باقر", turns: chat(10), window: 30 });
    expect(m.lead).toEqual([]);
    expect(m.kept).toHaveLength(10);
    expect(m.fresh).toBe(false);
  });

  it("past the window: writes its handoff of what came before, reads it first, then the latest turns, and says so", async () => {
    const m = await remember({ key: "t:2", userId: null, robot: "محمد باقر", turns: chat(31), window: 30 });
    expect(m.fresh).toBe(true);
    expect(seen[0]).toContain("رسالة 1");
    expect(m.lead[0].content).toContain("تسليم 1");
    expect(m.lead.map((t) => t.role)).toEqual(["user", "assistant"]);
    expect(m.kept[0].role).toBe("user");
    // what the handoff covers + what is kept = the whole conversation, nothing dropped
    expect(rows.get("t:2")!.up_to + m.kept.length).toBe(31);
    expect(m.kept.at(-1)!.text).toBe("رسالة 31");
    expect(withNote("رد", true)).toBe(`${HANDOFF_NOTE}\n\nرد`);
    expect(withNote("رد", false)).toBe("رد");
  });

  it("keeps the handoff until another half window has passed, then builds on it", async () => {
    await remember({ key: "t:3", userId: null, robot: "كاظم", turns: chat(31), window: 30 });
    const again = await remember({ key: "t:3", userId: null, robot: "كاظم", turns: chat(40), window: 30 });
    expect(again.fresh).toBe(false);
    expect(seen).toHaveLength(1);
    const later = await remember({ key: "t:3", userId: null, robot: "كاظم", turns: chat(60), window: 30 });
    expect(later.fresh).toBe(true);
    expect(seen[1]).toContain("PREVIOUS HANDOFF:\nتسليم 1");
    expect(rows.get("t:3")!.up_to + later.kept.length).toBe(60);
  });

  it("a conversation cut shorter than its handoff starts again", async () => {
    await remember({ key: "t:4", userId: null, robot: "قنبر", turns: chat(31), window: 30 });
    const short = await remember({ key: "t:4", userId: null, robot: "قنبر", turns: chat(5), window: 30 });
    expect(short.lead).toEqual([]);
    expect(short.kept).toHaveLength(5);
  });
});
