import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { summarizePriorities } from "@/lib/mahdi/priorities";
import type { DayTask } from "@/lib/mahdi/types";

const task = (o: Partial<DayTask>): DayTask => ({ id: Math.random().toString(36), date: "2026-11-01", title: "t", at: null, habitId: null, sortOrder: 0, doneAt: null, priority: true, ...o });
const read = (p: string) => readFileSync(p, "utf8");

describe("past «أولويات اليوم»", () => {
  const tasks = [
    task({ date: "2026-11-01", title: "أ", doneAt: "x" }),
    task({ date: "2026-11-01", title: "ب" }),
    task({ date: "2026-11-02", title: "ج", doneAt: "x" }),
    task({ date: "2026-11-02", title: "مهمة عادية", priority: false, doneAt: "x" }),
    task({ date: "2026-11-03", title: "عادة", habitId: "h1" }),
  ];
  const s = summarizePriorities(tasks, (t) => Boolean(t.doneAt) || t.habitId === "h1");

  it("counts only priorities, done of total", () => {
    expect(s.total).toBe(4);
    expect(s.done).toBe(3);
    expect(s.share).toBe(0.75);
  });
  it("groups them by day, newest first, with what was done and not", () => {
    expect(s.days.map((d) => d.date)).toEqual(["2026-11-03", "2026-11-02", "2026-11-01"]);
    const first = s.days[2];
    expect(first.items.filter((i) => i.done).map((i) => i.title)).toEqual(["أ"]);
    expect(first.items.filter((i) => !i.done).map((i) => i.title)).toEqual(["ب"]);
    expect(s.fullDays).toBe(2);
  });
  it("is empty without priorities", () => {
    expect(summarizePriorities([], () => true)).toMatchObject({ total: 0, done: 0, share: null, days: [] });
  });
  it("shows in «حاسبوا أنفسكم», the reports, a past day and under today's priorities", () => {
    for (const f of ["src/app/mahdi/(app)/progress/page.tsx", "src/app/mahdi/(app)/progress/week/WeekReport.tsx", "src/app/mahdi/(app)/progress/month/MonthReport.tsx", "src/components/mahdi/DayView.tsx"]) expect(read(f)).toContain("<PriorityHistory");
    expect(read("src/components/mahdi/DayPriorities.tsx")).toContain("<YesterdayPriorities");
  });
});
