// «لأجل المهدي» · the planner and «تطوّر وازدهر». Pure: types, the rules of what a plan item is, which day it falls
// on (a weekly or monthly plan repeats), and the cleaning of what the person sends.

import { addDays, daysInMonth, diffDays, weekday, type ISODate } from "./engine";

// ───────────────────────── the planner (events and times written in the calendar) ─────────────────────────

export const PLAN_REPEATS = ["none", "weekly", "monthly"] as const;
export type PlanRepeat = (typeof PLAN_REPEATS)[number];
export const PLAN_LIMITS = { titleMax: 80, noteMax: 300, items: 400 } as const;

export interface PlanItem {
  id: string;
  title: string;
  /** the first day (a one-off item: its only day) */
  day: ISODate;
  /** "HH:MM" or null (an event with no time) */
  start: string | null;
  end: string | null;
  /** none: that day only · weekly: every week on that weekday · monthly: every month on that date */
  repeat: PlanRepeat;
  note: string;
}

/** Whether an item lands on a day: one-off on its day; weekly on its weekday from then on; monthly on its date (the month's last day when it has fewer). */
export function occursOn(item: Pick<PlanItem, "day" | "repeat">, d: ISODate): boolean {
  if (d < item.day) return false;
  if (item.repeat === "weekly") return diffDays(d, item.day) % 7 === 0;
  if (item.repeat === "monthly") {
    const want = Number(item.day.slice(8));
    const last = daysInMonth(d);
    return Number(d.slice(8)) === Math.min(want, last);
  }
  return d === item.day;
}

const toMinutes = (t: string | null) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : 24 * 60 + 1);

/** The items of one day, the timed ones first by their hour, then the ones with no time in the order they were made. */
export function itemsOn(items: PlanItem[], d: ISODate): PlanItem[] {
  return items.filter((i) => occursOn(i, d)).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

/** «٩:٣٠» for the squares and lists. */
export function timeText(item: Pick<PlanItem, "start" | "end">): string {
  const ar = (t: string) => {
    const [h, m] = t.split(":");
    return `${Number(h)}:${m}`.replace(/\d/g, (c) => "٠١٢٣٤٥٦٧٨٩"[Number(c)]);
  };
  if (!item.start) return "";
  return item.end ? `${ar(item.start)}–${ar(item.end)}` : ar(item.start);
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const clipText = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const oneTime = (v: unknown): string | null => (typeof v === "string" && TIME_RE.test(v) ? v : null);

/** What the person sent, made safe: null when it cannot be an item (no title, a bad day). */
export function cleanPlanItem(raw: unknown): Omit<PlanItem, "id"> | null {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const title = clipText(o.title, PLAN_LIMITS.titleMax);
  const day = typeof o.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.day) && !Number.isNaN(Date.parse(o.day)) ? o.day : null;
  if (!title || !day) return null;
  const start = oneTime(o.start);
  let end = start ? oneTime(o.end) : null;
  // an end before the start is no end
  if (start && end && end <= start) end = null;
  const repeat = (PLAN_REPEATS as readonly unknown[]).includes(o.repeat) ? (o.repeat as PlanRepeat) : "none";
  return { title, day, start, end, repeat, note: clipText(o.note, PLAN_LIMITS.noteMax) };
}

/** The days of a week from its first day, for the weekly view. */
export const weekDays = (start: ISODate) => Array.from({ length: 7 }, (_, k) => addDays(start, k));

/** The weekday of an item's first day (0 = Sunday), to tell «كل أحد» / «كل ثلاثاء». */
export const repeatDay = (item: Pick<PlanItem, "day">) => weekday(item.day);

// ───────────────────────── «تطوّر وازدهر»: what the person intends to achieve ─────────────────────────

export const GROW_HORIZONS = ["week", "month", "year", "someday"] as const;
export type GrowHorizon = (typeof GROW_HORIZONS)[number];
export const GROW_LIMITS = { titleMax: 120, noteMax: 400, items: 300 } as const;

export interface GrowItem {
  id: string;
  title: string;
  horizon: GrowHorizon;
  note: string;
  /** when it was achieved, or null */
  doneAt: string | null;
  createdAt: string;
}

export function cleanGrowItem(raw: unknown): { title: string; horizon: GrowHorizon; note: string } | null {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const title = clipText(o.title, GROW_LIMITS.titleMax);
  if (!title) return null;
  const horizon = (GROW_HORIZONS as readonly unknown[]).includes(o.horizon) ? (o.horizon as GrowHorizon) : "month";
  return { title, horizon, note: clipText(o.note, GROW_LIMITS.noteMax) };
}

/** Open ones first (the near horizons first), then the achieved ones, the latest first. */
export function sortGrow(items: GrowItem[]): GrowItem[] {
  const rank = (i: GrowItem) => GROW_HORIZONS.indexOf(i.horizon);
  return [...items].sort((a, b) => {
    if (!!a.doneAt !== !!b.doneAt) return a.doneAt ? 1 : -1;
    if (a.doneAt && b.doneAt) return b.doneAt.localeCompare(a.doneAt);
    return rank(a) - rank(b) || a.createdAt.localeCompare(b.createdAt);
  });
}
