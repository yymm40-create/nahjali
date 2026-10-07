import { describe, expect, it } from "vitest";
import { taskReminderDue } from "@/lib/mahdi/engine";

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
  it("after midnight still belongs to the same day (the day starts at 6:00)", () => {
    expect(taskReminderDue("01:00", 0, at(23, 0))).toBeNull();
    expect(taskReminderDue("01:00", 0, at(1, 5))).toBe("at");
    expect(taskReminderDue("23:30", 0, at(0, 40))).toBe("late");
  });
  it("ignores a broken time", () => {
    expect(taskReminderDue("25:99", 0, at(12))).toBeNull();
  });
});
