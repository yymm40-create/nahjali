"use client";

// Whether a priority («أولويات اليوم») is done: ticked, or — for one tied to a habit — that habit filled on its day.
// Shared by today's list and the past days' statistics, so both count the same way.

import { useCallback } from "react";
import { dayGoals, versionAt, type ISODate } from "@/lib/mahdi/engine";
import type { DayTask, Habit } from "@/lib/mahdi/types";
import { useMahdi } from "./Provider";

export function usePriorityDone() {
  const { state, timeline } = useMahdi();
  const { snap, logs } = state;
  /** What fills a habit on a day (a tick, or its day target), or null when it can't be told. */
  const want = useCallback(
    (h: Habit, date: ISODate) => {
      const v = versionAt({ ...h, logs: {} }, date);
      const inst = dayGoals(timeline, date).find((i) => i.itemId === h.id && i.kind === "day");
      return v?.measure === "check" ? 1 : inst ? inst.target : null;
    },
    [timeline],
  );
  const habitOf = useCallback((x: DayTask) => (x.habitId ? snap.habits.find((h) => h.id === x.habitId) ?? null : null), [snap.habits]);
  const isDone = useCallback(
    (x: DayTask) => {
      if (x.doneAt) return true;
      const h = habitOf(x);
      if (!h) return false;
      const w = want(h, x.date);
      return w !== null && (logs[h.id]?.[x.date] ?? 0) >= w;
    },
    [habitOf, want, logs],
  );
  return { isDone, want, habitOf };
}
