// Scores built from goal instances. Pure functions.
import { addDays, addMonths, eachDay, endOfMonth, startOfMonth, startOfWeek, type ISODate } from "./dates";
import type { Timeline } from "./schedule";
import type { Instance, Score } from "./types";

/**
 * A goal counts towards a period's score once its time has passed, or as soon as it is fully reached.
 * So an unfinished goal of today (or of this week) never pulls the score down before its time is over.
 */
export const isCountable = (i: Instance) => i.status === "past" || (i.status === "current" && i.progress >= 1);

/** Average progress of the given goals. `all` includes unfinished current goals (used for "today so far"). */
export function summarize(instances: Instance[], mode: "countable" | "all" = "countable"): Score {
  const list = instances.filter((i) => i.status !== "future" && (mode === "all" || isCountable(i)));
  let credit = 0;
  let achieved = 0;
  let overCount = 0;
  let overShare = 0;
  for (const i of list) {
    credit += i.progress;
    if (i.progress >= 1) achieved++;
    if (i.over > 0) {
      overCount++;
      overShare += i.over / i.target;
    }
  }
  return {
    score: list.length ? credit / list.length : null,
    required: list.length,
    achieved,
    overCount,
    overRatio: list.length ? overShare / list.length : 0,
  };
}

/** The day's goals (daily and chosen-weekday habits). */
export const dayGoals = (tl: Timeline, d: ISODate) => tl.byDay.get(d) ?? [];

/** Week/month goals whose period contains `d` (shown on that day with their running total). */
export function periodGoalsOn(tl: Timeline, d: ISODate): Instance[] {
  const w = (tl.byWeek.get(startOfWeek(d, tl.ctx.weekStart)) ?? []).filter((i) => i.start <= d && d <= i.end);
  const m = (tl.byMonth.get(startOfMonth(d)) ?? []).filter((i) => i.start <= d && d <= i.end);
  return [...w, ...m];
}

/** A single day: every goal of that day counts, finished or not. */
export const dayScore = (tl: Timeline, d: ISODate) => summarize(dayGoals(tl, d), "all");

/** The goals that make up a week: its day goals and its week goals. */
export function weekGoals(tl: Timeline, weekStart: ISODate): Instance[] {
  const out: Instance[] = [];
  for (const d of eachDay(weekStart, addDays(weekStart, 6))) out.push(...dayGoals(tl, d));
  out.push(...(tl.byWeek.get(weekStart) ?? []));
  return out;
}

/** The goals that make up a month: its day goals, its month goals, and the week goals of weeks ending in it. */
export function monthGoals(tl: Timeline, monthStart: ISODate): Instance[] {
  const end = endOfMonth(monthStart);
  const out: Instance[] = [];
  for (const d of eachDay(monthStart, end)) out.push(...dayGoals(tl, d));
  out.push(...(tl.byMonth.get(monthStart) ?? []));
  for (const [ws, list] of tl.byWeek) {
    const we = addDays(ws, 6);
    if (we >= monthStart && we <= end) out.push(...list);
  }
  return out;
}

/** Goals of any range: day goals inside it, plus week/month goals whose period ends inside it. */
export function rangeGoals(tl: Timeline, from: ISODate, to: ISODate): Instance[] {
  const out: Instance[] = [];
  for (const d of eachDay(from, to)) out.push(...dayGoals(tl, d));
  for (const list of [...tl.byWeek.values(), ...tl.byMonth.values()]) {
    for (const i of list) if (i.periodEnd >= from && i.periodEnd <= to) out.push(i);
  }
  return out;
}

export const weekScore = (tl: Timeline, weekStart: ISODate) => summarize(weekGoals(tl, weekStart));
export const monthScore = (tl: Timeline, monthStart: ISODate) => summarize(monthGoals(tl, monthStart));

/** Scores grouped by a key (project, item…). */
export function scoreBy(instances: Instance[], key: (i: Instance) => string | null, mode: "countable" | "all" = "countable") {
  const groups = new Map<string, Instance[]>();
  for (const i of instances) {
    const k = key(i);
    if (k == null) continue;
    const list = groups.get(k);
    if (list) list.push(i);
    else groups.set(k, [i]);
  }
  return new Map([...groups].map(([k, list]) => [k, summarize(list, mode)]));
}

/** Last `n` days ending on `to`, oldest first, with each day's score (null when nothing was due). */
export function daySeries(tl: Timeline, to: ISODate, n: number) {
  return Array.from({ length: n }, (_, k) => {
    const d = addDays(to, k - n + 1);
    return { date: d, ...dayScore(tl, d) };
  });
}

/** Last `n` weeks ending with the week of `to`, oldest first. */
export function weekSeries(tl: Timeline, to: ISODate, n: number) {
  const last = startOfWeek(to, tl.ctx.weekStart);
  return Array.from({ length: n }, (_, k) => {
    const ws = addDays(last, (k - n + 1) * 7);
    return { weekStart: ws, ...weekScore(tl, ws) };
  });
}

/** Last `n` months ending with the month of `to`, oldest first. */
export function monthSeries(tl: Timeline, to: ISODate, n: number) {
  const last = startOfMonth(to);
  return Array.from({ length: n }, (_, k) => {
    const ms = addMonths(last, k - n + 1);
    return { monthStart: ms, ...monthScore(tl, ms) };
  });
}
