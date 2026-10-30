// «خانة الطوارئ»: a habit can carry a smaller goal for the days the person cannot do it in full. On such a day (chosen by them)
// the day's goal is the smaller one, so reaching it counts as the day's goal reached — and is shown in its own colour, so it is
// never mistaken for a full day. The week and the month report how many emergency days and emergency habits there were.
// Pure functions.
import { eachDay, startOfMonth, startOfWeek, type ISODate } from "./dates";
import { dayInstance, periodInstances, versionAt } from "./schedule";
import type { EngineContext, Instance, Item } from "./types";

/** The emergency goal of a habit is valid when the habit is a counter or an amount and it is SMALLER than the usual goal. */
export function validEmergencyTarget(measure: string, usualTarget: number, target: unknown): number | null {
  const n = Number(target);
  if (measure === "check" || !Number.isFinite(n) || n <= 0) return null;
  const rounded = measure === "amount" ? Math.round(n * 10) / 10 : Math.round(n);
  return rounded > 0 && rounded < usualTarget ? rounded : null;
}

/** A day goal that was lowered to the emergency one and reached: «تمّت بالطوارئ» (not a full day). */
export const doneByEmergency = (i: Pick<Instance, "emergency" | "progress" | "value" | "fullTarget">) =>
  Boolean(i.emergency) && i.progress >= 1 && i.value < (i.fullTarget ?? Infinity);

/** An emergency day goal that is not reached yet. */
export const openEmergency = (i: Pick<Instance, "emergency" | "progress">) => Boolean(i.emergency) && i.progress < 1;

export interface EmergencyStats {
  /** distinct days on which at least one emergency was chosen */
  days: number;
  /** emergency goals (a habit on a day) chosen */
  habits: number;
  /** how many different habits had one */
  distinctHabits: number;
  /** of those goals, how many were reached (in the emergency colour) */
  reached: number;
  /** the days, oldest first */
  dates: ISODate[];
}

/**
 * What the person chose and reached between two days (inclusive). `days` is the habit → days map of the snapshot; `items` give the
 * goal of each day (a habit whose goal is not lowered that day — paused, or not smaller any more — is not counted).
 */
export function emergencyStats(items: Item[], days: Record<string, ISODate[]> | undefined, from: ISODate, to: ISODate, ctx: EngineContext): EmergencyStats {
  const dates = new Set<ISODate>();
  const habits = new Set<string>();
  let count = 0;
  let reached = 0;
  for (const item of items) {
    const chosen = days?.[item.id];
    if (!chosen?.length) continue;
    for (const d of eachDay(from, to)) {
      if (!chosen.includes(d)) continue;
      const inst = instanceOn(item, d, ctx);
      if (!inst?.emergency) continue;
      dates.add(d);
      habits.add(item.id);
      count++;
      if (inst.progress >= 1) reached++;
    }
  }
  return { days: dates.size, habits: count, distinctHabits: habits.size, reached, dates: [...dates].sort() };
}

/** The goal a day belongs to: the day's own, or the week's / month's for a habit counted per week or per month. */
export function instanceOn(item: Item, d: ISODate, ctx: EngineContext): Instance | null {
  const day = dayInstance(item, d, ctx);
  if (day) return day;
  const v = versionAt(item, d);
  if (!v || v.state !== "active" || (v.freq !== "weekly" && v.freq !== "monthly")) return null;
  const list = v.freq === "weekly" ? periodInstances(item, "week", startOfWeek(d, ctx.weekStart), ctx) : periodInstances(item, "month", startOfMonth(d), ctx);
  return list.find((i) => i.start <= d && d <= i.end) ?? null;
}
