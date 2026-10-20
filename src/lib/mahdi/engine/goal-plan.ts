// Strategic goals: the numbers behind a milestone («هدف مرحلي»), measured period after period. Pure functions.
import { addDays, daysInMonth, diffDays, type ISODate } from "./dates";

export type PlanPeriod = "week" | "2weeks" | "month" | "2months";

/** What a milestone needs to be measured. */
export interface PlanTarget {
  target: number;
  period: PlanPeriod;
  startsOn: ISODate;
}

export interface PeriodWindow {
  /** 0 = the first period from the start date */
  index: number;
  from: ISODate;
  /** the last day (inclusive) */
  to: ISODate;
}

/** The same day of the month `n` months later (the 31st becomes the month's last day). */
export function shiftMonths(d: ISODate, n: number): ISODate {
  const [y, m, day] = d.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const iso = first.toISOString().slice(0, 10);
  const last = daysInMonth(iso);
  return `${iso.slice(0, 8)}${String(Math.min(day, last)).padStart(2, "0")}`;
}

/** The first day of period `index`. */
export function periodStart(p: Pick<PlanTarget, "period" | "startsOn">, index: number): ISODate {
  if (p.period === "week") return addDays(p.startsOn, 7 * index);
  if (p.period === "2weeks") return addDays(p.startsOn, 14 * index);
  return shiftMonths(p.startsOn, (p.period === "month" ? 1 : 2) * index);
}

/** Period `index` from its first to its last day. */
export function periodAt(p: Pick<PlanTarget, "period" | "startsOn">, index: number): PeriodWindow {
  return { index, from: periodStart(p, index), to: addDays(periodStart(p, index + 1), -1) };
}

/** The period `asOf` falls in (the first one while the milestone has not started). */
export function planPeriodOf(p: Pick<PlanTarget, "period" | "startsOn">, asOf: ISODate): PeriodWindow {
  if (asOf <= p.startsOn) return periodAt(p, 0);
  const days = diffDays(asOf, p.startsOn);
  // a close guess, then step to the right one (months are not all the same length)
  let i = Math.floor(days / (p.period === "week" ? 7 : p.period === "2weeks" ? 14 : p.period === "month" ? 30.44 : 60.88));
  while (i > 0 && periodStart(p, i) > asOf) i--;
  while (periodStart(p, i + 1) <= asOf) i++;
  return periodAt(p, i);
}

/** Everything logged from `from` to `to` (inclusive). */
export function sumBetween(logs: Record<ISODate, number> | undefined, from: ISODate, to: ISODate): number {
  let total = 0;
  for (const [d, v] of Object.entries(logs ?? {})) if (d >= from && d <= to) total += v;
  return total;
}

export interface PlanProgress extends PeriodWindow {
  done: number;
  target: number;
  /** 0…1 (capped) */
  ratio: number;
  /** the share of the period already gone, today included (0…1) */
  elapsed: number;
  /** behind = clearly under the pace the period needs */
  pace: "ahead" | "on" | "behind" | "notStarted";
  daysLeft: number;
}

/** How the current period of a milestone is going. */
export function planProgress(p: PlanTarget, logs: Record<ISODate, number> | undefined, asOf: ISODate): PlanProgress {
  const w = planPeriodOf(p, asOf);
  const done = sumBetween(logs, w.from, w.to);
  const length = diffDays(w.to, w.from) + 1;
  const started = asOf >= p.startsOn;
  const elapsed = started ? Math.min(1, (diffDays(asOf, w.from) + 1) / length) : 0;
  const ratio = p.target > 0 ? Math.min(1, done / p.target) : 0;
  const pace = !started ? "notStarted" : ratio >= 1 || ratio >= elapsed + 0.1 ? "ahead" : ratio >= elapsed - 0.15 ? "on" : "behind";
  return { ...w, done, target: p.target, ratio, elapsed, pace, daysLeft: diffDays(w.to, asOf) };
}

export interface PlanPeriodResult extends PeriodWindow {
  done: number;
  hit: boolean;
}

/** The finished periods before the current one, newest last (at most `count`). */
export function planHistory(p: PlanTarget, logs: Record<ISODate, number> | undefined, asOf: ISODate, count = 6): PlanPeriodResult[] {
  const current = planPeriodOf(p, asOf).index;
  const out: PlanPeriodResult[] = [];
  for (let i = Math.max(0, current - count); i < current; i++) {
    const w = periodAt(p, i);
    const done = sumBetween(logs, w.from, w.to);
    out.push({ ...w, done, hit: done >= p.target });
  }
  return out;
}

/**
 * Lead and lag (4DX): habits are the lead measures, milestones the lag ones. When the habits are kept but the
 * milestone does not move, the habits are probably the wrong ones; when neither moves, the habits come first.
 */
export function leadLagAdvice(habitsScore: number | null, progress: PlanProgress): "wrongHabits" | "habitsFirst" | "onTrack" | null {
  if (progress.pace === "notStarted" || progress.elapsed < 0.4) return null;
  if (progress.pace !== "behind") return "onTrack";
  if (habitsScore === null) return null;
  return habitsScore >= 0.8 ? "wrongHabits" : "habitsFirst";
}
