// Periods (a day, a week, a month) and comparisons between two of them. Pure functions.
import { addDays, addMonths, endOfMonth, startOfMonth, startOfWeek, type ISODate } from "./dates";
import type { Timeline } from "./schedule";
import { dayGoals, monthGoals, scoreBy, summarize, weekGoals } from "./score";
import type { Instance, Score } from "./types";

export type PeriodKind = "day" | "week" | "month";

export interface Period {
  kind: PeriodKind;
  start: ISODate;
  end: ISODate;
}

export function periodOf(kind: PeriodKind, d: ISODate, weekStart: number): Period {
  if (kind === "day") return { kind, start: d, end: d };
  if (kind === "week") {
    const s = startOfWeek(d, weekStart);
    return { kind, start: s, end: addDays(s, 6) };
  }
  const s = startOfMonth(d);
  return { kind, start: s, end: endOfMonth(s) };
}

/** The period just before. */
export function previousPeriod(p: Period, weekStart: number): Period {
  if (p.kind === "day") return periodOf("day", addDays(p.start, -1), weekStart);
  if (p.kind === "week") return periodOf("week", addDays(p.start, -7), weekStart);
  return periodOf("month", addMonths(p.start, -1), weekStart);
}

/** The last `n` periods up to (and including) the one containing `today`, newest first. */
export function recentPeriods(kind: PeriodKind, today: ISODate, weekStart: number, n: number): Period[] {
  const out = [periodOf(kind, today, weekStart)];
  while (out.length < n) out.push(previousPeriod(out[out.length - 1], weekStart));
  return out;
}

export function periodGoals(tl: Timeline, p: Period): Instance[] {
  if (p.kind === "day") return dayGoals(tl, p.start);
  if (p.kind === "week") return weekGoals(tl, p.start);
  return monthGoals(tl, p.start);
}

/** A day is always scored whole; weeks and months count goals once their time has passed or they're reached. */
export const periodScore = (tl: Timeline, p: Period) => summarize(periodGoals(tl, p), p.kind === "day" ? "all" : "countable");

export interface Change {
  key: string;
  a: number | null;
  b: number | null;
  /** b − a in percentage points (null when one side has nothing to measure). */
  delta: number | null;
}

function changes(a: Map<string, Score>, b: Map<string, Score>): Change[] {
  const keys = new Set([...a.keys(), ...b.keys()]);
  return [...keys].map((key) => {
    const x = a.get(key)?.score ?? null;
    const y = b.get(key)?.score ?? null;
    return { key, a: x, b: y, delta: x !== null && y !== null ? (y - x) * 100 : null };
  });
}

export interface Comparison {
  a: Period;
  b: Period;
  scoreA: Score;
  scoreB: Score;
  /** Percentage points, B − A. */
  delta: number | null;
  projects: Change[];
  items: Change[];
  mostImproved: Change | null;
  mostDeclined: Change | null;
}

/** Compares period A (usually the earlier) with period B. Each goal counts once and is capped at 100%. */
export function compare(tl: Timeline, a: Period, b: Period): Comparison {
  const mode = a.kind === "day" ? "all" : "countable";
  const ga = periodGoals(tl, a);
  const gb = periodGoals(tl, b);
  const scoreA = summarize(ga, mode);
  const scoreB = summarize(gb, mode);
  const items = changes(scoreBy(ga, (i) => i.itemId, mode), scoreBy(gb, (i) => i.itemId, mode));
  const measured = items.filter((c) => c.delta !== null).sort((x, y) => y.delta! - x.delta!);
  return {
    a,
    b,
    scoreA,
    scoreB,
    delta: scoreA.score !== null && scoreB.score !== null ? (scoreB.score - scoreA.score) * 100 : null,
    projects: changes(scoreBy(ga, (i) => i.projectId, mode), scoreBy(gb, (i) => i.projectId, mode)),
    items,
    mostImproved: measured[0] && measured[0].delta! > 0 ? measured[0] : null,
    mostDeclined: measured.length && measured[measured.length - 1].delta! < 0 ? measured[measured.length - 1] : null,
  };
}

/** Best and weakest item of a period by score (needs at least two goals to count as a pattern). */
export function bestAndWeakest(goals: Instance[]) {
  const byItem = [...scoreBy(goals, (i) => i.itemId)].filter(([, s]) => s.required >= 2 && s.score !== null);
  byItem.sort((x, y) => y[1].score! - x[1].score!);
  if (byItem.length < 2) return { best: byItem[0] ?? null, weakest: null };
  const best = byItem[0];
  const weakest = byItem[byItem.length - 1];
  return { best, weakest: weakest[1].score! < best[1].score! ? weakest : null };
}
