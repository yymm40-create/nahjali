import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { taskReminderDue } from "@/lib/mahdi/engine";
import { editTouchesUpcoming, lastTaskDay, taskDay, taskEditBody } from "@/lib/mahdi/tasks";
import type { DayTask } from "@/lib/mahdi/types";

const at = (h: number, m = 0) => h * 60 + m;

describe("«مهام اليوم» reminders", () => {
  it("nothing before the task's time", () => {
    expect(taskReminderDue("16:00", 0, at(15, 59))).toBeNull();
  });
  it("«حان وقت مهمتك» at its time, once", () => {
    expect(taskReminderDue("16:00", 0, at(16, 0))).toBe("at");
    expect(taskReminderDue("16:00", 0, at(16, 14))).toBe("at");
    expect(taskReminderDue("16:00", 1, at(16, 30))).toBeNull();
  });
  it("a follow-up an hour later if still open, then nothing more", () => {
    expect(taskReminderDue("16:00", 1, at(17, 0))).toBe("late");
    expect(taskReminderDue("16:00", 2, at(18, 0))).toBeNull();
  });
  it("a time first seen more than an hour late goes straight to the follow-up", () => {
    expect(taskReminderDue("09:00", 0, at(12, 0))).toBe("late");
  });
  it("after midnight still belongs to the same day (the day starts at the person's day start, here Fajr ~4:54)", () => {
    const fajr = at(4, 54);
    expect(taskReminderDue("01:00", 0, at(23, 0), fajr)).toBeNull();
    expect(taskReminderDue("01:00", 0, at(1, 5), fajr)).toBe("at");
    expect(taskReminderDue("23:30", 0, at(0, 40), fajr)).toBe("late");
  });
  it("ignores a broken time", () => {
    expect(taskReminderDue("25:99", 0, at(12))).toBeNull();
  });
});

describe("editing a task (a member's report, 25 November 2026: upcoming tasks couldn't be edited)", () => {
  const today = "2026-11-25";
  const task = (x: Partial<DayTask> = {}): DayTask => ({ id: "t1", date: "2026-11-30", title: "أراجع الدرس", at: null, habitId: null, sortOrder: 0, doneAt: null, ...x });

  it("a task's day: today, a later day up to a year ahead, nothing earlier or further", () => {
    expect(taskDay(undefined, today)).toBe(today);
    expect(taskDay("", today)).toBe(today);
    expect(taskDay(today, today)).toBe(today);
    expect(taskDay("2026-12-01", today)).toBe("2026-12-01");
    expect(taskDay(lastTaskDay(today), today)).toBe("2027-11-25");
    expect(taskDay("2027-11-26", today)).toBeNull();
    expect(taskDay("2026-11-24", today)).toBeNull();
    expect(taskDay("2026-02-30", today)).toBeNull();
    expect(taskDay(20261130, today)).toBeNull();
  });

  it("sends only what changed, and nothing when nothing did", () => {
    expect(taskEditBody(task(), { title: "أراجع الدرس", date: "2026-11-30", at: null })).toBeNull();
    expect(taskEditBody(task(), { title: "  أراجع   الدرس الرابع ", date: "2026-11-30", at: null })).toEqual({ id: "t1", title: "أراجع الدرس الرابع" });
    expect(taskEditBody(task(), { title: "أراجع الدرس", date: today, at: "16:30" })).toEqual({ id: "t1", date: today, at: "16:30" });
    expect(taskEditBody(task({ at: "16:30" }), { title: "أراجع الدرس", date: "2026-11-30", at: null })).toEqual({ id: "t1", at: null });
    // an empty title is never sent (the form doesn't allow it either)
    expect(taskEditBody(task(), { title: "  ", date: "2026-11-30", at: null })).toBeNull();
  });

  it("a priority keeps its day", () => {
    expect(taskEditBody(task({ priority: true, date: today }), { title: "أراجع الدرس", date: "2026-12-01", at: null })).toBeNull();
  });

  it("«المهام القادمة» is read again when the task was or is now on a later day", () => {
    const now = task({ date: today });
    expect(editTouchesUpcoming(now, { id: "t1", title: "x" }, today)).toBe(false);
    expect(editTouchesUpcoming(now, { id: "t1", date: "2026-12-01" }, today)).toBe(true);
    expect(editTouchesUpcoming(task(), { id: "t1", date: today }, today)).toBe(true);
    expect(editTouchesUpcoming(task(), { id: "t1", title: "x" }, today)).toBe(true);
  });

  it("the API moves a task by `date` (not a priority) and remembers its reminder again", () => {
    const route = readFileSync("src/app/api/mahdi/tasks/route.ts", "utf8");
    const patch = route.slice(route.indexOf("export const PATCH"), route.indexOf("export const DELETE"));
    expect(patch).toMatch(/"date" in body/);
    expect(patch).toMatch(/dayOf\(body\.date, today\)/);
    expect(patch).toMatch(/row\.priority \|\| marked\) throw/);
    expect(patch).toMatch(/task_date: day, sort_order: count \?\? 0, notified: 0/);
    expect(patch).toMatch(/upcoming: await upcoming\(supabase, today\)/);
  });

  it("every row of both lists has an edit button", () => {
    const ui = readFileSync("src/components/mahdi/DayTasks.tsx", "utf8");
    expect(ui.match(/onClick=\{\(\) => setEditing\(task\)\}/g)).toHaveLength(2);
    expect(ui).toMatch(/<TaskEdit key=\{editing\.id\}/);
  });
});
