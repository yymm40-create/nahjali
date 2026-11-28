import { describe, expect, it } from "vitest";
import { addDays, type Version } from "@/lib/mahdi/engine";
import { canJoin, cleanContest, contestPhase, contestWeeks, drawWinners, entryResult, newCode, CODE_RE, projectsLocked, weeksDone, type ContestHabit } from "@/lib/mahdi/contests";

const daily = (from: string, target = 1, measure: Version["measure"] = "check"): Version => ({ effectiveFrom: from, measure, target, unit: "", freq: "daily", days: [], state: "active" });
const c = { startsOn: "2026-12-01", endsOn: "2026-12-14", threshold: 95, minHabits: 2 };
const habits: ContestHabit[] = [
  { id: "h1", projectId: "worship", name: "الصلاة على محمد وآل محمد 100", versions: [daily("2026-11-01")] },
  { id: "h2", projectId: "worship", name: "قرآن صفحة", versions: [daily("2026-11-01")] },
  { id: "h3", projectId: "health", name: "تمرين", versions: [daily("2026-11-01")] },
];
const every = (from: string, to: string, skip: string[] = []) => {
  const out: Record<string, number> = {};
  for (let d = from; d <= to; d = addDays(d, 1)) if (!skip.includes(d)) out[d] = 1;
  return out;
};

describe("«مسابقة الثبات»", () => {
  it("checks the organiser's form", () => {
    const ok = cleanContest({ title: " مسابقة الحي ", startsOn: "2026-12-01", days: 14, threshold: 95, minHabits: 3, prize: "قسيمة ٥٠ ريال" }, "2026-11-28");
    expect(ok).toEqual({ ok: true, value: { title: "مسابقة الحي", details: "", prize: "قسيمة ٥٠ ريال", startsOn: "2026-12-01", endsOn: "2026-12-14", threshold: 95, minHabits: 3 } });
    expect(cleanContest({ title: "x", startsOn: "2026-11-20", days: 14 }, "2026-11-28").ok).toBe(false);
    expect(cleanContest({ title: "x", startsOn: "2026-12-01", days: 3 }, "2026-11-28").ok).toBe(false);
    expect(cleanContest({ title: "", startsOn: "2026-12-01", days: 14 }, "2026-11-28").ok).toBe(false);
  });

  it("knows its phase, when joining closes and when the projects lock", () => {
    expect(contestPhase(c, "2026-11-30")).toBe("upcoming");
    expect(contestPhase(c, "2026-12-01")).toBe("live");
    expect(contestPhase(c, "2026-12-15")).toBe("over");
    expect(canJoin(c, "2026-12-02")).toBe(true);
    expect(canJoin(c, "2026-12-03")).toBe(false);
    expect(projectsLocked(c, "2026-11-30")).toBe(false);
    expect(projectsLocked(c, "2026-12-01")).toBe(true);
  });

  it("splits it into weeks and counts the finished ones", () => {
    expect(contestWeeks(c)).toEqual([
      { from: "2026-12-01", to: "2026-12-07" },
      { from: "2026-12-08", to: "2026-12-14" },
    ]);
    expect(weeksDone(c, "2026-12-07")).toBe(0);
    expect(weeksDone(c, "2026-12-08")).toBe(1);
    expect(weeksDone(c, "2026-12-15")).toBe(2);
  });

  it("scores only the chosen projects, per habit and per week, against the bar", () => {
    const logs = { h1: every("2026-12-01", "2026-12-14"), h2: every("2026-12-01", "2026-12-14", ["2026-12-09"]), h3: {} };
    const r = entryResult(c, habits, logs, ["worship"], "2026-12-15", 6);
    expect(r.required).toBe(28);
    expect(r.achieved).toBe(27);
    expect(r.score).toBeCloseTo(27 / 28);
    expect(r.qualified).toBe(true);
    expect(r.habitCount).toBe(2);
    expect(r.weeks[0]).toBe(1);
    expect(r.weeks[1]).toBeCloseTo(13 / 14);
    expect(r.habits.map((h) => [h.name, h.achieved, h.required])).toEqual([
      ["الصلاة على محمد وآل محمد 100", 14, 14],
      ["قرآن صفحة", 13, 14],
    ]);
    // the health project was not picked: the missed workouts do not count
    expect(r.habits.some((h) => h.name === "تمرين")).toBe(false);
  });

  it("is under the bar with too many missed days, or too few habits", () => {
    const logs = { h1: every("2026-12-01", "2026-12-14", ["2026-12-02", "2026-12-05"]), h2: every("2026-12-01", "2026-12-14") };
    expect(entryResult(c, habits, logs, ["worship"], "2026-12-15", 6).qualified).toBe(false);
    const one = entryResult(c, habits, { h1: every("2026-12-01", "2026-12-14") }, ["worship"], "2026-12-15", 6);
    expect(entryResult({ ...c, minHabits: 3 }, habits, { h1: every("2026-12-01", "2026-12-14"), h2: every("2026-12-01", "2026-12-14") }, ["worship"], "2026-12-15", 6).qualified).toBe(false);
    expect(one.score).toBeCloseTo(0.5);
  });

  it("counts today only once its goal is reached (in the person's own day)", () => {
    const logs = { h1: every("2026-12-01", "2026-12-03"), h2: every("2026-12-01", "2026-12-02") };
    const r = entryResult(c, habits, logs, ["worship"], "2026-12-03", 6);
    // h2 is not done yet today: it does not pull the score down before the day is over
    expect(r.score).toBe(1);
    expect(r.required).toBe(5);
  });

  it("flags a goal changed after the start", () => {
    const changed: ContestHabit[] = [{ ...habits[0], versions: [daily("2026-11-01", 100, "count"), daily("2026-12-05", 10, "count")] }, habits[1]];
    expect(entryResult(c, changed, {}, ["worship"], "2026-12-10", 6).edited).toBe(true);
    expect(entryResult(c, habits, {}, ["worship"], "2026-12-10", 6).edited).toBe(false);
  });

  it("has nothing to score before the start", () => {
    const r = entryResult(c, habits, {}, ["worship"], "2026-11-29", 6);
    expect(r.score).toBeNull();
    expect(r.habitCount).toBe(2);
    expect(r.qualified).toBe(false);
  });

  it("draws different winners, never more than the pool", () => {
    let k = 0;
    const rand = (n: number) => (k++ * 7) % n;
    const w = drawWinners(["a", "b", "c", "d"], 3, rand);
    expect(new Set(w).size).toBe(3);
    expect(drawWinners(["a", "b"], 5, rand)).toHaveLength(2);
  });

  it("makes readable join codes", () => {
    let k = 0;
    expect(newCode(() => k++ % 32)).toMatch(CODE_RE);
  });
});
