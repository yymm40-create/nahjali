import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// The dispatcher of «تنبيهات تجيبك للتطبيق», run against a small in-memory database: who gets what at which minute of their own day.

type Row = Record<string, unknown>;
const sent: { user: string; title: string; body: string; tag: string }[] = [];
const habitData = new Map<string, { habits: unknown[]; logs: Record<string, Record<string, number>> }>();

vi.mock("@/lib/mahdi/server/notify", () => ({
  pushToUser: async (_db: unknown, subs: { user_id: string }[], p: { title: string; body: string; tag: string }) => {
    sent.push({ user: subs[0].user_id, title: p.title, body: p.body, tag: p.tag });
    return 1;
  },
}));
vi.mock("@/lib/mahdi/server/bulk", async (orig) => ({ ...(await orig<object>()), loadHabitData: async (_db: unknown, ids: string[]) => new Map(ids.map((id) => [id, habitData.get(id) ?? { habits: [], logs: {} }])) }));

const PK: Record<string, string[]> = { mahdi_push_log: ["user_id", "kind", "day"] };
function makeDb(tables: Record<string, Row[]>) {
  class Q {
    private f: ((r: Row) => boolean)[] = [];
    private op: "select" | "insert" = "select";
    private row: Row = {};
    private lim: [number, number] | null = null;
    constructor(private t: string) {}
    select() { return this; }
    in(c: string, v: unknown[]) { this.f.push((r) => v.includes(r[c])); return this; }
    gte(c: string, v: string) { this.f.push((r) => String(r[c]) >= v); return this; }
    order() { return this; }
    range(a: number, b: number) { this.lim = [a, b]; return this; }
    insert(r: Row) { this.op = "insert"; this.row = r; return this; }
    then(ok?: (v: { data: Row[] | null; error: { code: string } | null }) => unknown, no?: (e: unknown) => unknown) {
      const rows = (tables[this.t] ??= []);
      if (this.op === "insert") {
        const keys = PK[this.t];
        if (keys && rows.some((r) => keys.every((k) => r[k] === this.row[k]))) return Promise.resolve({ data: null, error: { code: "23505" } }).then(ok, no);
        rows.push({ ...this.row });
        return Promise.resolve({ data: null, error: null }).then(ok, no);
      }
      let out = rows.filter((r) => this.f.every((g) => g(r)));
      if (this.lim) out = out.slice(this.lim[0], this.lim[1] + 1);
      return Promise.resolve({ data: out, error: null }).then(ok, no);
    }
  }
  return { from: (t: string) => new Q(t) } as unknown as SupabaseClient;
}

const U = "u1";
const base = (): Record<string, Row[]> => ({
  mahdi_push_subscriptions: [{ id: "s1", user_id: U, endpoint: "e", p256dh: "p", auth: "a", failures: 0 }],
  mahdi_profiles: [{ user_id: U, time_zone: "Asia/Riyadh", week_start: 6 }],
  mahdi_notification_settings: [],
  mahdi_push_log: [],
  mahdi_review_notes: [],
});
// a daily done / not done habit, done on each of the five days before 2026-10-28
const streakHabit = () => ({
  habits: [{ id: "h1", projectId: "p1", name: "x", icon: "", category: "", notes: "", reminderTime: null, sortOrder: 0, versions: [{ effectiveFrom: "2026-09-01", measure: "check", target: 1, unit: "", freq: "daily", days: [], state: "active" }] }],
  logs: { h1: { "2026-10-23": 1, "2026-10-24": 1, "2026-10-25": 1, "2026-10-26": 1, "2026-10-27": 1 } },
});
// Asia/Riyadh is UTC+3: 16:35Z is 19:35 there
const at = (hhmmZ: string) => new Date(`2026-10-28T${hhmmZ}:00Z`);

beforeEach(() => {
  sent.length = 0;
  habitData.clear();
});

describe("dispatchEngagement", () => {
  it("«سلسلتك في خطر» at 19:30 of the person's own day, when a streak of days has one thing left", async () => {
    const { dispatchEngagement } = await import("@/lib/mahdi/server/engage");
    const tables = base();
    habitData.set(U, streakHabit());
    const r = await dispatchEngagement(makeDb(tables), at("16:35"));
    expect(r.sent).toBe(1);
    expect(sent[0]).toMatchObject({ user: U, title: "سلسلتك في خطر", tag: "mahdi-streak" });
    expect(sent[0].body).toContain("5 يوم");
    expect(sent[0].body).toContain("عادة وحدة");
    // the next tick (15 minutes on) finds the claim: nothing twice
    const again = await dispatchEngagement(makeDb(tables), at("16:45"));
    expect(again.sent).toBe(0);
    expect(tables.mahdi_push_log).toHaveLength(1);
  });

  it("sends nothing outside the hour, or when the habit is already done today", async () => {
    const { dispatchEngagement } = await import("@/lib/mahdi/server/engage");
    habitData.set(U, streakHabit());
    expect((await dispatchEngagement(makeDb(base()), at("14:00"))).sent).toBe(0);
    const done = streakHabit() as { habits: unknown[]; logs: Record<string, Record<string, number>> };
    done.logs.h1["2026-10-28"] = 1;
    habitData.set(U, done);
    expect((await dispatchEngagement(makeDb(base()), at("16:35"))).sent).toBe(0);
  });

  it("«ملاحظة يومك» at 21:00 unless the note is already written", async () => {
    const { dispatchEngagement } = await import("@/lib/mahdi/server/engage");
    const open = base();
    expect((await dispatchEngagement(makeDb(open), at("18:05"))).sent).toBe(1);
    expect(sent[0].tag).toBe("mahdi-review-day");
    expect(sent[0].body).toContain("ملاحظتك");
    sent.length = 0;
    const written = base();
    written.mahdi_review_notes.push({ user_id: U, kind: "day", period_start: "2026-10-28" });
    expect((await dispatchEngagement(makeDb(written), at("18:05"))).sent).toBe(0);
  });

  it("«آية اليوم» at 08:00 with the day's verse", async () => {
    const { dispatchEngagement } = await import("@/lib/mahdi/server/engage");
    const r = await dispatchEngagement(makeDb(base()), at("05:05"));
    expect(r.byKind.morning).toBe(1);
    expect(sent[0].title).toContain("آية اليوم");
    expect(sent[0].body.length).toBeGreaterThan(20);
  });

  it("respects the person's switches, and no more than two a day", async () => {
    const { dispatchEngagement } = await import("@/lib/mahdi/server/engage");
    const off = base();
    off.mahdi_notification_settings.push({ user_id: U, quiet_start: "23:00", quiet_end: "07:00", engage: { review_day: false } });
    expect((await dispatchEngagement(makeDb(off), at("18:05"))).sent).toBe(0);
    const full = base();
    full.mahdi_push_log.push({ user_id: U, kind: "morning", day: "2026-10-28" }, { user_id: U, kind: "streak", day: "2026-10-28" });
    expect((await dispatchEngagement(makeDb(full), at("18:05"))).sent).toBe(0);
  });

  it("«اشتقنالك» after three days with nothing logged, and not again within the week", async () => {
    const { dispatchEngagement } = await import("@/lib/mahdi/server/engage");
    // the last log was on the 22nd: six days away
    habitData.set(U, { habits: streakHabit().habits, logs: { h1: { "2026-10-20": 1, "2026-10-22": 1 } } });
    expect((await dispatchEngagement(makeDb(base()), at("08:05"))).byKind.comeback).toBe(1);
    expect(sent[0].body).toContain("6 أيام");
    sent.length = 0;
    const recent = base();
    recent.mahdi_push_log.push({ user_id: U, kind: "comeback", day: "2026-10-25" });
    expect((await dispatchEngagement(makeDb(recent), at("08:05"))).sent).toBe(0);
  });

  it("does nothing for someone with no device, and nothing before migration 0098 (no log table)", async () => {
    const { dispatchEngagement } = await import("@/lib/mahdi/server/engage");
    const none = base();
    none.mahdi_push_subscriptions = [];
    expect((await dispatchEngagement(makeDb(none), at("18:05"))).sent).toBe(0);
    const db = makeDb(base());
    const real = db.from.bind(db);
    (db as unknown as { from: (t: string) => unknown }).from = (t: string) => (t === "mahdi_push_log" ? { select: () => ({ in: () => ({ gte: async () => ({ data: null, error: { code: "42P01" } }) }) }) } : real(t));
    expect((await dispatchEngagement(db, at("18:05"))).sent).toBe(0);
  });
});
