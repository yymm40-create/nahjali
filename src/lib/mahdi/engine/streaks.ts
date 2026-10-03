// Streaks that respect each habit's schedule. Pure functions.
import { addDays, diffDays, eachDay, startOfWeek, type ISODate } from "./dates";
import type { Timeline } from "./schedule";
import { dayScore, weekScore } from "./score";
import type { Item, SlotKind } from "./types";

export interface Streak {
  current: number;
  best: number;
}

/**
 * A habit's streak: consecutive goals fully reached, in the habit's own unit (days for daily or chosen-weekday
 * habits, weeks or months for "X per week/month" habits). Days without a goal (not a chosen weekday, paused)
 * never break it, and an unfinished goal of today / this week is still pending, so it does not break it either.
 */
export function itemStreak(tl: Timeline, itemId: string): Streak & { unit: SlotKind } {
  const list = (tl.byItem.get(itemId) ?? []).filter((i) => i.status !== "future");
  if (!list.length) return { current: 0, best: 0, unit: "day" };
  const unit = list[list.length - 1].kind;

  let current = 0;
  for (let k = list.length - 1; k >= 0; k--) {
    const i = list[k];
    if (i.kind !== unit) break;
    if (i.progress >= 1) current++;
    else if (i.status === "current") continue;
    else break;
  }

  let best = 0;
  let run = 0;
  let kind: SlotKind | null = null;
  for (const i of list) {
    if (i.kind !== kind) {
      run = 0;
      kind = i.kind;
    }
    if (i.progress >= 1) best = Math.max(best, ++run);
    else if (i.status !== "current") run = 0;
  }
  return { current, best: Math.max(best, current), unit };
}

/**
 * Overall consistency in days: consecutive days on which at least `threshold` of the day's goals were reached.
 * Days with nothing due are skipped; today counts once it reaches the threshold and never breaks the streak.
 */
export function dayStreak(tl: Timeline, threshold: number): Streak {
  const asOf = tl.ctx.asOf;
  let current = 0;
  for (let d = asOf; d >= tl.from; d = addDays(d, -1)) {
    const s = dayScore(tl, d).score;
    if (s === null) continue;
    if (s >= threshold) current++;
    else if (d === asOf) continue;
    else break;
  }
  let best = 0;
  let run = 0;
  for (const d of eachDay(tl.from, asOf)) {
    const s = dayScore(tl, d).score;
    if (s === null) continue;
    if (s >= threshold) best = Math.max(best, ++run);
    else if (d !== asOf) run = 0;
  }
  return { current, best: Math.max(best, current) };
}

/** Overall consistency in weeks: consecutive weeks whose score reached `threshold`. The current week never breaks it. */
export function weekStreak(tl: Timeline, threshold: number): Streak & { successful: number } {
  const thisWeek = startOfWeek(tl.ctx.asOf, tl.ctx.weekStart);
  const first = startOfWeek(tl.from, tl.ctx.weekStart);
  let current = 0;
  for (let ws = thisWeek; ws >= first; ws = addDays(ws, -7)) {
    const s = weekScore(tl, ws).score;
    if (s === null) continue;
    if (s >= threshold) current++;
    else if (ws === thisWeek) continue;
    else break;
  }
  let best = 0;
  let run = 0;
  let successful = 0;
  for (let ws = first; ws <= thisWeek; ws = addDays(ws, 7)) {
    const s = weekScore(tl, ws).score;
    if (s === null) continue;
    if (s >= threshold) {
      successful++;
      best = Math.max(best, ++run);
    } else if (ws !== thisWeek) run = 0;
  }
  return { current, best: Math.max(best, current), successful };
}

/** Days since the last day with any logged progress (for "welcome back" messages). Null if nothing was ever logged. */
export function daysSinceLastActivity(items: Item[], asOf: ISODate): number | null {
  let last: ISODate | null = null;
  for (const item of items) {
    for (const [d, v] of Object.entries(item.logs)) if (v > 0 && d <= asOf && (!last || d > last)) last = d;
  }
  return last ? diffDays(asOf, last) : null;
}
