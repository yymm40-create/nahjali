import type { ISODate } from "./dates";

/** How a habit is measured: done / not done, a counter (3 times), or an amount with a unit (20 pages). */
export type Measure = "check" | "count" | "amount";

/** daily · on chosen weekdays · X per week · X per month. */
export type Freq = "daily" | "days" | "weekly" | "monthly";

export type HabitState = "active" | "paused" | "archived";

/** The habit's goal and schedule from `effectiveFrom` until the next version. Earlier days keep their own version. */
export interface Version {
  effectiveFrom: ISODate;
  measure: Measure;
  /** Goal per day (daily / days) or per week / month. A done/not-done habit has target 1 per day, or X days per period. */
  target: number;
  unit: string;
  freq: Freq;
  /** Weekdays for freq 'days' (0 = Sunday … 6 = Saturday). */
  days: number[];
  state: HabitState;
}

/** Anything with goals: a personal habit (later also a joined unified challenge). */
export interface Item {
  id: string;
  projectId: string | null;
  /** Sorted by effectiveFrom, oldest first. */
  versions: Version[];
  /** The total logged per day. */
  logs: Record<ISODate, number>;
}

export type SlotKind = "day" | "week" | "month";

/**
 * One goal the user committed to: a habit on one day ("20 pages on Monday"), or a habit over one week or month
 * ("3 times this week"). Every score in the app is the average progress of goal instances, each capped at 100%,
 * so extra repetitions never inflate a percentage; they are reported separately as `over`.
 */
export interface Instance {
  itemId: string;
  projectId: string | null;
  kind: SlotKind;
  key: string;
  /** First and last day this goal covers (equal for a day goal; the active days of a week/month goal). */
  start: ISODate;
  end: ISODate;
  /** The calendar day, week or month the goal belongs to. */
  periodStart: ISODate;
  periodEnd: ISODate;
  measure: Measure;
  unit: string;
  target: number;
  value: number;
  /** 0…1, the share of the goal reached (capped at 1). */
  progress: number;
  /** What was done beyond the goal (e.g. 2 when 5 of 3). */
  over: number;
  /** True when a week/month goal covers only part of the period (habit started, paused or changed mid-period). */
  partial: boolean;
  status: "past" | "current" | "future";
}

export interface EngineContext {
  /** Today in the user's time zone. */
  asOf: ISODate;
  /** 0 = Sunday … 6 = Saturday. */
  weekStart: number;
}

export interface Score {
  /** Average progress 0…1, or null when there was nothing to measure. */
  score: number | null;
  /** Goals counted. */
  required: number;
  /** Goals fully reached. */
  achieved: number;
  /** Goals with extra work beyond the target. */
  overCount: number;
  /** Average extra beyond the target, as a share of the target (0.5 = 50% extra). */
  overRatio: number;
}
