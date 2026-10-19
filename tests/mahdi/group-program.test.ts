import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Version } from "@/lib/mahdi/engine";
import { can, cleanPerms, clipVersions, grantable, GROUP_PERMS, isAbove, memberStats, putVersion, readVersions, type Seat } from "@/lib/mahdi/groups/program";
import { dayProjects, itemHref, projectHref } from "@/lib/mahdi/client/derive";
import type { Snapshot } from "@/lib/mahdi/types";

const seat = (userId: string, role: Seat["role"], perms: Seat["perms"] = [], appointedBy: string | null = null): Seat => ({ userId, role, perms, appointedBy });

describe("إخوة الولاية · who may do what", () => {
  const leader = seat("L", "leader");
  const a = seat("A", "admin", ["admins", "members", "program"], "L");
  const b = seat("B", "admin", ["members"], "A");
  const c = seat("C", "admin", ["stats"], "L");
  const m = seat("M", "member");
  const seats = [leader, a, b, c, m];

  it("the leader holds every permission; an admin what they were given; a member nothing", () => {
    for (const p of GROUP_PERMS) expect(can(leader, p)).toBe(true);
    expect(can(a, "program")).toBe(true);
    expect(can(a, "stats")).toBe(false);
    expect(can(m, "program")).toBe(false);
    expect(can(null, "program")).toBe(false);
  });
  it("admins are managed only from above: the leader, or whoever appointed them up the line", () => {
    expect(isAbove(leader, a, seats)).toBe(true);
    expect(isAbove(leader, b, seats)).toBe(true);
    expect(isAbove(a, b, seats)).toBe(true);
    expect(isAbove(b, a, seats)).toBe(false);
    expect(isAbove(a, c, seats)).toBe(false);
    expect(isAbove(c, a, seats)).toBe(false);
  });
  it("nobody stands above the leader or themselves; a member is under any admin", () => {
    expect(isAbove(a, leader, seats)).toBe(false);
    expect(isAbove(a, a, seats)).toBe(false);
    expect(isAbove(b, m, seats)).toBe(true);
    expect(isAbove(m, b, seats)).toBe(false);
  });
  it("a loop in the appointments never hangs", () => {
    const x = seat("X", "admin", ["admins"], "Y");
    const y = seat("Y", "admin", ["admins"], "X");
    expect(isAbove(seat("Z", "admin", ["admins"]), x, [x, y])).toBe(false);
  });
  it("an admin hands on only what they hold; the leader everything", () => {
    expect(grantable(leader)).toEqual([...GROUP_PERMS]);
    expect(grantable(a)).toEqual(["program", "members", "admins"]);
    expect(grantable(m)).toEqual([]);
  });
  it("permissions are cleaned to the known ones, in their order", () => {
    expect(cleanPerms(["stats", "hack", "program", "stats"])).toEqual(["program", "stats"]);
    expect(cleanPerms("program")).toEqual([]);
  });
});

const v = (effectiveFrom: string, o: Partial<Version> = {}): Version => ({ effectiveFrom, measure: "check", target: 1, unit: "", freq: "daily", days: [], state: "active", ...o });

describe("إخوة الولاية · the program's goal history", () => {
  it("a change replaces the version of the same day, otherwise goes in order", () => {
    const list = [v("2026-10-01"), v("2026-10-10", { state: "paused" })];
    expect(putVersion(list, v("2026-10-10", { measure: "count", target: 3 })).map((x) => [x.effectiveFrom, x.measure])).toEqual([["2026-10-01", "check"], ["2026-10-10", "count"]]);
    expect(putVersion(list, v("2026-10-05")).map((x) => x.effectiveFrom)).toEqual(["2026-10-01", "2026-10-05", "2026-10-10"]);
  });
  it("a member who joined later is measured from the day they joined, with the goal in force then", () => {
    const list = [v("2026-09-01"), v("2026-10-05", { measure: "count", target: 2 }), v("2026-10-20", { state: "paused" })];
    const c = clipVersions(list, "2026-10-08");
    expect(c.map((x) => [x.effectiveFrom, x.measure, x.state])).toEqual([["2026-10-08", "count", "active"], ["2026-10-20", "check", "paused"]]);
    expect(clipVersions(list, "2026-08-01")).toEqual(list);
  });
  it("versions read back from the database drop anything malformed", () => {
    const raw = [{ effectiveFrom: "2026-10-02", measure: "amount", target: "20", unit: "صفحة", freq: "daily", days: [], state: "active" }, { effectiveFrom: "bad" }, { effectiveFrom: "2026-10-01", measure: "nope", freq: "daily" }, null];
    const r = readVersions(raw);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ measure: "amount", target: 20, unit: "صفحة" });
    expect(readVersions("x")).toEqual([]);
  });
});

describe("إخوة الولاية · a member's numbers", () => {
  const today = "2026-10-19"; // a Monday
  const habits = [
    { id: "h1", projectId: "p1", versions: [v("2026-10-01")] },
    { id: "h2", projectId: "p1", versions: [v("2026-10-01", { measure: "count", target: 2 })] },
  ];
  it("every day done: full scores and a streak since joining", () => {
    const logs: Record<string, Record<string, number>> = { h1: {}, h2: {} };
    for (let d = 10; d <= 19; d++) {
      logs.h1[`2026-10-${d}`] = 1;
      logs.h2[`2026-10-${d}`] = 2;
    }
    const s = memberStats("u", habits, logs, "2026-10-10", today, 6);
    expect(s.today).toBe(1);
    expect(s.week).toBe(1);
    expect(s.month).toBe(1);
    expect(s.streak).toBe(10);
    expect(s.habits).toEqual({ h1: 1, h2: 1 });
    expect(s.projects.p1).toBe(1);
    expect(s.days).toHaveLength(30);
    expect(s.days.at(-1)).toEqual({ date: today, score: 1 });
    expect(s.days[0].score).toBeNull();
    expect(s.weeks).toHaveLength(12);
  });
  it("half done: the score is the average progress, nothing before joining counts", () => {
    const logs = { h1: { "2026-10-18": 1 }, h2: { "2026-10-18": 1 } };
    const s = memberStats("u", habits, logs, "2026-10-18", today, 6);
    expect(s.days.at(-2)).toEqual({ date: "2026-10-18", score: 0.75 });
    expect(s.required).toBeGreaterThan(0);
    expect(s.streak).toBe(0);
  });
  it("no program: nothing to measure", () => {
    const s = memberStats("u", [], {}, "2026-10-01", today, 6);
    expect(s.month).toBeNull();
    expect(s.streak).toBe(0);
  });
});

describe("إخوة الولاية · the group's habits in my day", () => {
  const snap = {
    projects: [{ id: "p", name: "عبادات", icon: "", color: "gold", sortOrder: 0, archivedAt: null }, { id: "old", name: "قديم", icon: "", color: "gold", sortOrder: 1, archivedAt: "2026-01-01" }],
    groupPlan: { projects: [{ id: "gp:x", name: "برنامج", icon: "", color: "lapis", sortOrder: 5000, archivedAt: null, groupId: "G1", groupName: "إخوتي" }], habits: [] },
  } as unknown as Snapshot;
  it("my live projects first, then my groups'", () => {
    expect(dayProjects(snap).map((p) => p.id)).toEqual(["p", "gp:x"]);
  });
  it("a group's project and habit lead to the group's program", () => {
    expect(projectHref({ id: "gp:x", groupId: "G1" })).toBe("/mahdi/groups/G1?tab=program");
    expect(projectHref({ id: "p" })).toBe("/mahdi/projects/p");
    expect(projectHref({ id: "challenges" })).toBe("/mahdi/challenges");
    expect(itemHref("g:abc")).toBe("/mahdi/groups/h/abc");
    expect(itemHref("c:abc")).toBe("/mahdi/challenges/abc");
  });
});

describe("إخوة الولاية · wiring", () => {
  const route = readFileSync("src/app/api/mahdi/groups/[id]/route.ts", "utf8");
  it("the new tables are server-only", () => {
    const sql = readFileSync("supabase/migrations/0083_mahdi_group_program.sql", "utf8");
    for (const tbl of ["mahdi_group_projects", "mahdi_group_habits", "mahdi_group_habit_logs"]) expect(sql).toMatch(new RegExp(`revoke all on public\\.${tbl} from anon, authenticated`));
    expect(sql).toMatch(/add column if not exists perms text\[\]/);
  });
  it("every tool asks for its permission, and the leader alone transfers or deletes", () => {
    for (const [action, perm] of [["project_save", "program"], ["habit_save", "program"], ["work_create", "program"], ["invite", "members"], ["approve", "members"], ["remove", "members"], ["admin_set", "admins"], ["rename", "settings"]]) {
      expect(route).toMatch(new RegExp(`case "${action}": \\{\\s*need\\("${perm}"\\)`));
    }
    expect(route).toMatch(/case "transfer": \{\s*if \(!isLeader\)/);
    expect(route).toMatch(/case "delete": \{\s*if \(!isLeader\)/);
    expect(route).toMatch(/wanted\.some\(\(p\) => !mine\.includes\(p\)\)/);
  });
  it("members log the group's habits like their own, and the khatma follows its permission", () => {
    expect(readFileSync("src/app/api/mahdi/logs/route.ts", "utf8")).toMatch(/setGroupLog\(/);
    expect(readFileSync("src/lib/mahdi/server/snapshot.ts", "utf8")).toMatch(/loadGroupPlan\(/);
    expect(readFileSync("src/app/api/mahdi/khatma/[id]/route.ts", "utf8")).toMatch(/isLeader: can\(seat, "khatma"\)/);
  });
});
