// «لأجل المهدي» · past «أولويات اليوم»: what each day's priorities were, which were done and which not, and the totals.
// Pure: whether a priority is done is passed in (a tick, or its habit filled that day — the screen knows the logs).

import type { ISODate } from "./engine";
import type { DayTask } from "./types";

export interface PriorityItem {
  id: string;
  title: string;
  done: boolean;
  /** tied to one of the person's habits */
  habitId: string | null;
}

export interface PriorityDay {
  date: ISODate;
  done: number;
  total: number;
  items: PriorityItem[];
}

export interface PrioritySummary {
  done: number;
  total: number;
  /** done / total, or null when there were none */
  share: number | null;
  /** the days that had priorities, the newest first */
  days: PriorityDay[];
  /** the days with every priority done */
  fullDays: number;
}

/** The priorities of a stretch of days grouped by day, with what was done. */
export function summarizePriorities(tasks: readonly DayTask[], isDone: (t: DayTask) => boolean): PrioritySummary {
  const byDay = new Map<ISODate, PriorityItem[]>();
  for (const t of tasks) {
    if (!t.priority) continue;
    const list = byDay.get(t.date) ?? byDay.set(t.date, []).get(t.date)!;
    list.push({ id: t.id, title: t.title, done: isDone(t), habitId: t.habitId });
  }
  const days = [...byDay.entries()]
    .map(([date, items]) => ({ date, items, total: items.length, done: items.filter((i) => i.done).length }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = days.reduce((n, d) => n + d.total, 0);
  const done = days.reduce((n, d) => n + d.done, 0);
  return { done, total, share: total ? done / total : null, days, fullDays: days.filter((d) => d.total > 0 && d.done === d.total).length };
}
