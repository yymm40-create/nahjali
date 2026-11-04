import { beforeEach, describe, expect, it, vi } from "vitest";

// «مختبر الموشن» remembers what this person made lately (the owner: «قاعد يكرر في الموشنات اللي يسويها»): the plan of each
// of their saved lab conversations, reduced to what tells pieces apart, newest first — and nothing breaks without it.
const db = vi.hoisted(() => ({ rows: [] as unknown[], fail: false, asked: [] as string[] }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (db.fail) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    const q = {
      select: (c: string) => (db.asked.push(`select ${c}`), q),
      eq: (k: string, v: string) => (db.asked.push(`eq ${k}=${v}`), q),
      order: () => q,
      limit: (n: number) => (db.asked.push(`limit ${n}`), Promise.resolve({ data: db.rows, error: null })),
    };
    return { from: (t: string) => (db.asked.push(`from ${t}`), q) };
  },
}));

const plan = (title: string, extra: object = {}) => ({ title, idea: `فكرة ${title}`, format: "kinetic", palette: { bg: "#0b0b10", ink: "#f2f0eb", accent: "#d78d45" }, fonts: { head: "alexandria", body: "cairo" }, shots: [{ transition: "needle zoom", camera: "push" }, { transition: "needle zoom", camera: "orbit" }, { transition: "carry", camera: "" }], ...extra });

describe("the person's recent lab pieces", () => {
  beforeEach(() => {
    db.rows = [];
    db.fail = false;
    db.asked = [];
  });

  it("reads only the plans of this person's conversations (never a program), newest first, at most six", async () => {
    const { recentPieces, RECENT_MAX, RECENT_FETCH } = await import("@/lib/editor/scene/recent");
    const at = new Date(Date.now() - 3 * 86_400_000).toISOString();
    db.rows = [{ title: "محادثة", project_id: "p1", updated_at: at, plan: plan("أ") }, { title: "بلا خطة", project_id: "p2", updated_at: at, plan: null }, ...Array.from({ length: 8 }, (_, i) => ({ title: "", project_id: "p2", updated_at: at, plan: plan(`ب${i}`) }))];
    const list = await recentPieces("u1", "p1");
    expect(db.asked).toEqual(["from motion_lab_chats", "select title,project_id,updated_at,plan:state->plan", "eq user_id=u1", `limit ${RECENT_FETCH}`]);
    expect(list).toHaveLength(RECENT_MAX);
    expect(list[0]).toEqual({ title: "أ", idea: "فكرة أ", format: "kinetic", shots: 3, moves: ["needle zoom", "push", "orbit", "carry"], palette: "#0b0b10 #d78d45", fonts: "alexandria + cairo", here: true, days: 3 });
    expect(list[1].here).toBe(false);
  });

  it("gives an empty list when the database is not there, and the text is empty then", async () => {
    const { recentPieces, recentText } = await import("@/lib/editor/scene/recent");
    db.fail = true;
    expect(await recentPieces("u1", "p1")).toEqual([]);
    expect(await recentPieces("", "p1")).toEqual([]);
    expect(recentText([])).toBe("");
  });

  it("is a compact list that asks for a clearly different piece unless the person asks for the same", async () => {
    const { recentOf, recentText } = await import("@/lib/editor/scene/recent");
    const r = recentOf(plan("ج", { idea: "x".repeat(500) }), { here: false, at: new Date().toISOString() })!;
    expect(r.idea).toHaveLength(140);
    const t = recentText([r, r, r, r, r, r]);
    expect(t).toContain("1. «ج» (today)");
    expect(t).toContain("CLEARLY DIFFERENT");
    expect(t).toContain("unless the person explicitly asks for the same");
    // six pieces stay a few hundred tokens
    expect(t.length).toBeLessThan(2600);
    expect(recentOf({ shots: [] })).toBeNull();
  });
});
