"use client";

// «لأجل المهدي» — what every design of the home draws from: today's habits and their progress, the reading goal,
// the streaks, the last days, each habit's week, and the experience points of «شخصية تلعب». One place, so the twenty
// designs show the same numbers in twenty ways.

import { useMemo, useState } from "react";
import { addDays, dayGoals, daySeries, dayScore, dayStreak, goalProgress, startOfWeek, versionAt, weekScore, type Instance } from "@/lib/mahdi/engine";
import { dayProjects } from "@/lib/mahdi/client/derive";
import { t } from "@/lib/mahdi/i18n";
import { CONSISTENCY_THRESHOLD } from "@config/mahdi";
import type { Habit, Project } from "@/lib/mahdi/types";
import { useMahdi } from "../Provider";
import { useReading } from "../useReading";

export interface DayHabit {
  habit: Habit;
  inst: Instance;
  project?: Project;
  /** done on each of the last 7 days, oldest first (today last) */
  week: boolean[];
}

/** Experience points: 15 for each habit day done; a level every 500. */
export const XP_PER = 15;
export const XP_LEVEL = 500;

export function useDay() {
  const { state, timeline, allHabits } = useMahdi();
  const { reading, summary } = useReading();
  const today = state.today;
  return useMemo(() => {
    const projects = dayProjects(state.snap);
    const byId = new Map(allHabits.map((h) => [h.id, h]));
    const day = dayGoals(timeline, today);
    const score = dayScore(timeline, today);
    const done = day.filter((i) => i.progress >= 1).length;
    const days7 = Array.from({ length: 7 }, (_, k) => addDays(today, k - 6));
    const doneOn = days7.map((d) => new Set(dayGoals(timeline, d).filter((i) => i.progress >= 1).map((i) => i.itemId)));
    const habits: DayHabit[] = day
      .map((inst) => ({ inst, habit: byId.get(inst.itemId) }))
      .filter((x): x is { inst: Instance; habit: Habit } => Boolean(x.habit))
      .sort((a, b) => a.habit.sortOrder - b.habit.sortOrder)
      .map(({ inst, habit }) => ({ inst, habit, project: projects.find((p) => p.id === habit.projectId), week: doneOn.map((s) => s.has(habit.id)) }));
    const xp = Object.values(state.logs).reduce((s, byDay) => s + Object.values(byDay).filter((v) => v > 0).length, 0) * XP_PER;
    return {
      today,
      habits,
      score: score.score ?? 0,
      hasGoals: score.required > 0,
      done,
      required: score.required,
      streak: dayStreak(timeline, CONSISTENCY_THRESHOLD).current,
      week: weekScore(timeline, startOfWeek(today, state.snap.profile.weekStart)).score ?? 0,
      series: (n: number) => daySeries(timeline, today, n),
      reading: goalProgress(reading.goals.daily, summary.today),
      readingStreak: summary.streak,
      xp,
      level: Math.floor(xp / XP_LEVEL) + 1,
      levelXp: xp % XP_LEVEL,
    };
  }, [state.snap, state.logs, allHabits, timeline, today, reading.goals.daily, summary]);
}

/** Reading done as words: «٢٠ د من ٣٠ د». */
export const readingText = (g: { metric: string; done: number; target: number } | null) => {
  if (!g) return "حدّد هدفك";
  const u = g.metric === "minutes" ? "د" : g.metric === "narrations" ? "رواية" : "ص";
  return `${g.done} ${u} من ${g.target} ${u}`;
};

/** A habit's one tap: a check done or undone, a count +1, an amount opens the number pad (`open`). */
export function useHabitTap(habit: Habit, inst: Instance, date: string) {
  const { store, state, toast } = useMahdi();
  const [open, setOpen] = useState(false);
  const v = versionAt({ ...habit, logs: {} }, date);
  const dayValue = state.logs[habit.id]?.[date] ?? 0;
  const done = inst.progress >= 1 || (v?.measure === "check" && dayValue >= 1);
  const commit = (value: number) => {
    const prev = store.setLog(habit.id, date, value);
    try {
      navigator.vibrate?.(done ? 6 : [10, 30, 10]);
    } catch {}
    toast(t.habit.logged(habit.name), { label: t.habit.undo, run: () => store.setLog(habit.id, date, prev) }, habit.id);
  };
  const tap = () => {
    if (!v) return;
    if (v.measure === "check") commit(dayValue >= 1 ? 0 : 1);
    else if (v.measure === "count") commit(dayValue + 1);
    else setOpen(true);
  };
  const label = !v ? habit.name : v.measure === "check" ? (done ? t.habit.markUndone(habit.name) : t.habit.markDone(habit.name)) : `${habit.name}: ${inst.value} / ${inst.target}`;
  return { v, done, dayValue, tap, commit, open, setOpen, label };
}
