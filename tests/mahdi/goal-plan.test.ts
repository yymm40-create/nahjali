import { describe, expect, it } from "vitest";
import { HABIT_COLORS, habitColorHex } from "@config/mahdi";
import { leadLagAdvice, planHistory, planPeriodOf, planProgress, shiftMonths } from "@/lib/mahdi/engine";
import { goalFromJson } from "@/lib/mahdi/server/rows";
import { parseGoal, parseHabitColor, parseMilestoneTarget } from "@/lib/mahdi/server/validate";

describe("strategic goals: milestone periods", () => {
  it("moves months by the same day, clamped to the month's end", () => {
    expect(shiftMonths("2026-01-15", 1)).toBe("2026-02-15");
    expect(shiftMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftMonths("2026-11-30", 2)).toBe("2027-01-30");
  });

  it("finds the period a day falls in", () => {
    const week = { period: "week" as const, startsOn: "2026-10-01" };
    expect(planPeriodOf(week, "2026-10-01")).toEqual({ index: 0, from: "2026-10-01", to: "2026-10-07" });
    expect(planPeriodOf(week, "2026-10-08")).toEqual({ index: 1, from: "2026-10-08", to: "2026-10-14" });
    const two = { period: "2weeks" as const, startsOn: "2026-10-01" };
    expect(planPeriodOf(two, "2026-10-20").from).toBe("2026-10-15");
    const month = { period: "month" as const, startsOn: "2026-01-31" };
    expect(planPeriodOf(month, "2026-03-05")).toEqual({ index: 1, from: "2026-02-28", to: "2026-03-30" });
    const twoMonths = { period: "2months" as const, startsOn: "2026-01-10" };
    expect(planPeriodOf(twoMonths, "2026-05-09")).toEqual({ index: 1, from: "2026-03-10", to: "2026-05-09" });
    // before the start: the first period
    expect(planPeriodOf(week, "2026-09-20").index).toBe(0);
  });

  it("measures the current period against its target, with the pace", () => {
    const m = { target: 10, period: "week" as const, startsOn: "2026-10-01" };
    const logs = { "2026-09-30": 9, "2026-10-01": 2, "2026-10-03": 3, "2026-10-08": 4 };
    const p = planProgress(m, logs, "2026-10-04");
    expect(p.done).toBe(5);
    expect(p.ratio).toBe(0.5);
    expect(p.daysLeft).toBe(3);
    expect(p.pace).toBe("on");
    expect(planProgress(m, logs, "2026-10-07").pace).toBe("behind");
    expect(planProgress(m, { "2026-10-01": 12 }, "2026-10-02").pace).toBe("ahead");
    expect(planProgress(m, logs, "2026-09-25").pace).toBe("notStarted");
  });

  it("lists past periods hit or missed", () => {
    const m = { target: 3, period: "week" as const, startsOn: "2026-10-01" };
    const h = planHistory(m, { "2026-10-02": 3, "2026-10-09": 1 }, "2026-10-20");
    expect(h.map((x) => x.hit)).toEqual([true, false]);
  });

  it("reads lead and lag (4DX)", () => {
    const behind = planProgress({ target: 10, period: "week", startsOn: "2026-10-01" }, { "2026-10-01": 1 }, "2026-10-06");
    expect(behind.pace).toBe("behind");
    expect(leadLagAdvice(0.9, behind)).toBe("wrongHabits");
    expect(leadLagAdvice(0.3, behind)).toBe("habitsFirst");
    const early = planProgress({ target: 10, period: "week", startsOn: "2026-10-01" }, {}, "2026-10-01");
    expect(leadLagAdvice(0.3, early)).toBeNull();
  });
});

describe("strategic goals: what the browser sends and what is stored", () => {
  it("takes a goal plan and cleans it", () => {
    const g = parseGoal({
      statement: "  أن أكون رفيقًا للقرآن ",
      why: "لأنه الثقل الأكبر",
      horizon: "2028-01-01",
      obstacles: [{ id: "a1<script>", text: "لا وقت" }, { id: "", text: "x" }, "bad"],
      habitScope: "general",
    });
    expect(g.statement).toBe("أن أكون رفيقًا للقرآن");
    expect(g.horizon).toBe("2028-01-01");
    expect(g.obstacles).toEqual([{ id: "a1script", text: "لا وقت" }]);
    expect(g.habitScope).toBe("general");
    expect(() => parseGoal({ statement: "  " })).toThrow();
    expect(() => parseGoal({ statement: "x", horizon: "soon" })).toThrow();
  });

  it("reads a stored goal defensively", () => {
    expect(goalFromJson(null)).toMatchObject({ statement: "", obstacles: [], habitScope: "milestone", horizon: null });
    expect(goalFromJson({ statement: "s", obstacles: [{ id: "1", text: "t" }, { id: 2 }], horizon: "x" })).toMatchObject({ statement: "s", obstacles: [{ id: "1", text: "t" }], horizon: null });
  });

  it("checks milestone targets and habit colours", () => {
    expect(parseMilestoneTarget("4")).toBe(4);
    expect(() => parseMilestoneTarget(0)).toThrow();
    expect(parseHabitColor(null)).toBeNull();
    expect(parseHabitColor("jade")).toBe("jade");
    expect(() => parseHabitColor("#fff")).toThrow();
  });

  it("offers 20 to 25 distinct habit colours", () => {
    expect(HABIT_COLORS.length).toBeGreaterThanOrEqual(20);
    expect(HABIT_COLORS.length).toBeLessThanOrEqual(25);
    expect(new Set(HABIT_COLORS.map((c) => c.key)).size).toBe(HABIT_COLORS.length);
    expect(new Set(HABIT_COLORS.map((c) => c.hex)).size).toBe(HABIT_COLORS.length);
    for (const c of HABIT_COLORS) expect(c.key).toMatch(/^[a-z0-9]{2,16}$/);
    expect(habitColorHex("ruby")).toBe("#e5484d");
    expect(habitColorHex(null)).toBeNull();
  });
});
