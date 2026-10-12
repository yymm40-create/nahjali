import { describe, expect, it } from "vitest";
import { PRIORITY_TITLE_PREFIX, priorityColumnMissing, taskFromRow, type TaskRow } from "@/lib/mahdi/server/snapshot";

const row = (title: string, priority?: boolean): TaskRow => ({
  id: "11111111-1111-4111-8111-111111111111",
  task_date: "2026-10-12",
  title,
  at_time: null,
  habit_id: null,
  sort_order: 0,
  done_at: null,
  priority,
});

describe("Mahdi day priorities", () => {
  it("reads normal priority rows", () => {
    expect(taskFromRow(row("أكمل الفيلم", true))).toMatchObject({ title: "أكمل الفيلم", priority: true });
  });

  it("keeps priorities working before the priority column migration is visible", () => {
    expect(taskFromRow(row(`${PRIORITY_TITLE_PREFIX}أكمل الفيلم`))).toMatchObject({ title: "أكمل الفيلم", priority: true });
    expect(priorityColumnMissing({ code: "42703" })).toBe(true);
    expect(priorityColumnMissing({ code: "PGRST204" })).toBe(true);
    expect(priorityColumnMissing({ message: "Could not find the 'priority' column" })).toBe(true);
    expect(priorityColumnMissing({ code: "23505" })).toBe(false);
  });
});
