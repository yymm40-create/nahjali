// Numbers behind the milestones, computed from the goal timeline. Pure functions.
import { eachDay } from "./dates";
import type { Timeline } from "./schedule";
import { dayScore, isCountable } from "./score";
import { dayStreak, weekStreak } from "./streaks";

export interface MilestoneMetrics {
  fullDays: number;
  bestDayStreak: number;
  goalsAchieved: number;
  successfulWeeks: number;
}

export function milestoneMetrics(tl: Timeline, threshold: number): MilestoneMetrics {
  let fullDays = 0;
  for (const d of eachDay(tl.from, tl.ctx.asOf)) {
    const s = dayScore(tl, d);
    if (s.required > 0 && s.achieved === s.required) fullDays++;
  }
  let goalsAchieved = 0;
  for (const list of tl.byItem.values()) for (const i of list) if (isCountable(i) && i.progress >= 1) goalsAchieved++;
  return {
    fullDays,
    bestDayStreak: dayStreak(tl, threshold).best,
    goalsAchieved,
    successfulWeeks: weekStreak(tl, threshold).successful,
  };
}
