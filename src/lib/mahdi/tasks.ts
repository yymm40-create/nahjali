// «مهام اليوم» and «المهام القادمة»: the pure rules shared by the screen and the API (a member's report, 25 November
// 2026: «المهام المستقبلية لايمكن التعديل عليها»). No React, no database.

import { addDays, diffDays, isISODate, type ISODate } from "./engine";
import type { DayTask } from "./types";

/** How far ahead a task can be set. */
export const TASK_AHEAD_DAYS = 365;

/** The day a task is for: empty → today; otherwise today or a later day up to a year ahead; anything else → null. */
export function taskDay(v: unknown, today: ISODate): ISODate | null {
  if (v === null || v === undefined || v === "") return today;
  if (!isISODate(v) || v < today || diffDays(v, today) > TASK_AHEAD_DAYS) return null;
  return v;
}

/** The last day a task can be set for. */
export const lastTaskDay = (today: ISODate) => addDays(today, TASK_AHEAD_DAYS);

/** What the edit form holds: the title, the day (today or later) and the time («HH:MM», or null for none). */
export interface TaskDraft {
  title: string;
  date: ISODate;
  at: string | null;
}

/**
 * The PATCH body for an edit: only what changed (so an unchanged time isn't reminded again), or null when nothing did.
 * A priority keeps its day.
 */
export function taskEditBody(task: DayTask, draft: TaskDraft): Record<string, unknown> | null {
  const body: Record<string, unknown> = { id: task.id };
  const name = draft.title.replace(/\s+/g, " ").trim();
  if (name && name !== task.title) body.title = name;
  const at = draft.at || null;
  if (at !== task.at) body.at = at;
  if (!task.priority && draft.date && draft.date !== task.date) body.date = draft.date;
  return Object.keys(body).length > 1 ? body : null;
}

/** Does this edit touch «المهام القادمة» (the task was or will be on a later day), so that list must be read again? */
export const editTouchesUpcoming = (task: DayTask, body: Record<string, unknown> | null, today: ISODate) =>
  task.date > today || (typeof body?.date === "string" && body.date > today);
