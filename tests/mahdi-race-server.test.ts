import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => null }));
vi.mock("@/lib/mahdi/server/session", () => ({ getApiSession: async () => ({}) }));

import { createRace, raceAction, raceById, raceView } from "@/lib/mahdi/server/race";

// A small in-memory stand-in for the database client: only what the race's server code calls.
type Row = Record<string, unknown>;
function fakeDb() {
  const tables: Record<string, Row[]> = { mahdi_races: [], mahdi_race_players: [], mahdi_race_rounds: [], mahdi_race_points: [], mahdi_race_events: [] };
  let seq = 0;
  const from = (name: string) => {
    const rows = tables[name];
    const filters: ((r: Row) => boolean)[] = [];
    let op: "select" | "update" | "delete" | "insert" = "select";
    let patch: Row = {};
    let inserted: Row[] = [];
    let head = false;
    let single = false;
    const q = {
      select: (_c?: string, o?: { head?: boolean }) => { head = !!o?.head; return q; },
      eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return q; },
      in: (k: string, v: unknown[]) => { filters.push((r) => v.includes(r[k])); return q; },
      order: () => q,
      limit: () => q,
      range: () => q,
      maybeSingle: () => { single = true; return q; },
      single: () => { single = true; return q; },
      update: (p: Row) => { op = "update"; patch = p; return q; },
      delete: () => { op = "delete"; return q; },
      insert: (v: Row | Row[]) => {
        op = "insert";
        inserted = (Array.isArray(v) ? v : [v]).map((r) => ({ id: `id${++seq}`, spy: false, missions: [], selfie_v: 0, kid: false, team: null, spies_on: false, revealed: false, winner: null, current_round: null, team_a: "A", team_b: "B", emoji_a: "1", emoji_b: "2", banned: "", ...r }));
        rows.push(...inserted);
        return q;
      },
      then: (res: (v: unknown) => void) => {
        const hit = rows.filter((r) => filters.every((f) => f(r)));
        if (op === "update") hit.forEach((r) => Object.assign(r, patch));
        if (op === "delete") tables[name] = rows.filter((r) => !hit.includes(r));
        if (op === "delete") { rows.length = 0; rows.push(...tables[name]); tables[name] = rows; }
        const data = op === "insert" ? inserted : hit;
        res({ data: head ? null : single ? (data[0] ?? null) : data, error: null, count: data.length });
      },
    };
    return q;
  };
  return { from, tables } as unknown as Parameters<typeof raceById>[0] & { tables: typeof tables };
}

async function setup(players = 6) {
  const db = fakeDb();
  const id = await createRace(db, "owner", "سباق");
  for (let i = 0; i < players; i++) (db as unknown as { tables: Record<string, Row[]> }).tables.mahdi_race_players.push({ race_id: id, user_id: `p${i}`, name: `لاعب ${i}`, selfie_v: 0, team: null, kid: false, spy: false, missions: [] });
  const go = async (b: Record<string, unknown>) => raceAction(db, await raceById(db, id), b);
  const view = async (u: string) => raceView(db, await raceById(db, id), u);
  return { db, id, go, view };
}

describe("the race on the server", () => {
  it("starts with every game and its way of playing", async () => {
    const { view } = await setup();
    const v = await view("owner");
    expect(v.rounds.length).toBeGreaterThanOrEqual(13);
    expect(v.rounds.every((r) => (r as { how: string }).how.length > 0)).toBe(true);
    expect(v.rounds.some((r) => (r as { name: string }).name === "كرة طائرة الماء")).toBe(true);
  });

  it("keeps each spy secret from the other players until the reveal", async () => {
    const { go, view } = await setup();
    await go({ action: "deal" });
    await go({ action: "spies" });
    const leader = await view("owner");
    const spies = leader.players.filter((p) => p.spy);
    expect(spies).toHaveLength(2);
    const plain = leader.players.find((p) => !p.spy)!;
    const seen = await view(plain.id);
    expect(seen.players.every((p) => p.spy === undefined && p.missions === undefined)).toBe(true);
    expect(seen.me?.spy).toBe(false);
    const mine = await view(spies[0].id);
    expect(mine.me?.spy).toBe(true);
    expect(mine.me?.missions).toHaveLength(2);
    expect(mine.players.filter((p) => p.id !== spies[0].id).every((p) => p.spy === undefined)).toBe(true);
    await go({ action: "reveal", revealed: true });
    expect((await view(plain.id)).players.filter((p) => p.spy)).toHaveLength(2);
  });

  it("refuses someone who has not joined", async () => {
    const { view } = await setup();
    await expect(view("stranger")).rejects.toThrow();
  });

  it("gives the leader every control", async () => {
    const { go, view } = await setup();
    await go({ action: "settings", teamA: "الصقور", teamB: "النمور" });
    await go({ action: "points", team: "a", points: 30, reason: "فوز" });
    await go({ action: "points", team: "a", points: -5, reason: "خصم" });
    await go({ action: "points", team: "b", points: 10, reason: "" });
    let v = await view("owner");
    expect(v.race.teamA).toBe("الصقور");
    expect(v.scores).toEqual({ a: 25, b: 10 });
    await go({ action: "undo", point: v.points.find((p) => p.points === 10)!.id });
    expect((await view("owner")).scores.b).toBe(0);
    const n = v.rounds.length;
    await go({ action: "roundAdd", name: "لعبة جديدة", how: "خطوة" });
    v = await view("owner");
    expect(v.rounds).toHaveLength(n + 1);
    await go({ action: "roundDelete", round: (v.rounds.find((r) => (r as { name: string }).name === "لعبة جديدة") as { id: string }).id });
    expect((await view("owner")).rounds).toHaveLength(n);
    await go({ action: "move", user: "p0", team: "b" });
    expect((await view("owner")).players.find((p) => p.id === "p0")?.team).toBe("b");
    await go({ action: "remove", user: "p0" });
    expect((await view("owner")).players).toHaveLength(5);
  });

  it("announces the final winner, and asks on a tie", async () => {
    const { go, view } = await setup();
    await expect(go({ action: "finish" })).rejects.toThrow();
    await go({ action: "finish", winner: "tie" });
    expect((await view("p1")).race.winner).toBe("tie");
    await go({ action: "unfinish" });
    await go({ action: "points", team: "b", points: 5, reason: "" });
    await go({ action: "finish" });
    expect((await view("p1")).race.winner).toBe("b");
  });
});

describe("the day's record", () => {
  it("exports every line in order with seconds from the start", async () => {
    const { db, id } = await setup();
    const { logEvent, raceExport } = await import("@/lib/mahdi/server/race");
    await logEvent(db, id, { id: "owner", name: "القائد" }, "bomb_start", { secs: 30 }, "2026-10-31T10:00:00.000Z");
    await logEvent(db, id, { id: "owner", name: "القائد" }, "bomb_blast", {}, "2026-10-31T10:00:30.500Z");
    const out = await raceExport(db, await raceById(db, id));
    expect(out.events.map((e) => [e.kind, e.sec])).toEqual([["bomb_start", 0], ["bomb_blast", 30.5]]);
    expect(out.rounds.length).toBeGreaterThan(0);
  });
});
