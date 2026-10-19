// «الختمة العلوية» · «ختمتي»: a person's own khatma, read hizb quarter by hizb quarter at their own pace. Where they are,
// what today's portion is, whether they are on time, and what a quarter adds to the habit linked to it. Pure.

import { addDays, diffDays, type ISODate } from "../engine/dates";

export const QUARTERS = 240;

/** Quarters a day to finish in `days` days. */
export const dailyQuarters = (days: number) => Math.ceil(QUARTERS / Math.max(1, days));

/** A number of quarters as readers say it: «جزء»، «حزبان»، «نصف حزب»، «٣ أرباع». */
export function quartersText(q: number): string {
  if (q >= 8 && q % 8 === 0) return q === 8 ? "جزء" : q === 16 ? "جزءان" : `${q / 8} أجزاء`;
  if (q >= 4 && q % 4 === 0) return q === 4 ? "حزب" : q === 8 ? "حزبان" : `${q / 4} أحزاب`;
  if (q === 2) return "نصف حزب";
  if (q === 1) return "ربع حزب";
  return `${q} أرباع`;
}

/** The juz a quarter is in (1–30). */
export const juzOf = (q: number) => Math.ceil(q / 8);

/** Where to go on: the first unread quarter after the furthest one read; else the first unread; null when all are read. */
export function nextQuarter(read: Iterable<number>): number | null {
  const set = new Set(read);
  const furthest = Math.max(0, ...set);
  for (let q = furthest + 1; q <= QUARTERS; q++) if (!set.has(q)) return q;
  for (let q = 1; q <= QUARTERS; q++) if (!set.has(q)) return q;
  return null;
}

export interface MyRead {
  quarter: number;
  readOn: ISODate;
}

/** How the khatma stands today. */
export function khatmaStats(reads: MyRead[], startedOn: ISODate, days: number, today: ISODate) {
  const perDay = dailyQuarters(days);
  const read = new Set(reads.map((r) => r.quarter)).size;
  const dayNo = Math.max(1, diffDays(today, startedOn) + 1);
  const todayCount = reads.filter((r) => r.readOn === today).length;
  // where the plan expects them to be by the end of today
  const expected = Math.min(QUARTERS, perDay * dayNo);
  const readDays = new Set(reads.map((r) => r.readOn));
  // the days in a row with reading, up to today (a day not yet read today does not break it)
  let streak = 0;
  for (let d = readDays.has(today) ? today : addDays(today, -1); readDays.has(d); d = addDays(d, -1)) streak++;
  const left = QUARTERS - read;
  return {
    perDay,
    read,
    left,
    todayCount,
    todayLeft: Math.max(0, perDay - todayCount),
    dayNo,
    expected,
    /** quarters behind the plan (0 when on time or ahead) */
    behind: Math.max(0, expected - read),
    ahead: Math.max(0, read - expected),
    streak,
    finishBy: addDays(startedOn, days - 1),
    /** at today's pace (the plan's when nothing is read yet) */
    daysToFinish: left === 0 ? 0 : Math.ceil(left / perDay),
    next: nextQuarter(reads.map((r) => r.quarter)),
  };
}

/**
 * The habit's new value for a day when quarters are read (+n) or taken back (−n): a done/not-done habit becomes done
 * (and stays so when one is taken back), a counted one moves by the number of quarters.
 */
export function habitValueAfter(measure: "check" | "count" | "amount", current: number, n: number): number {
  if (measure === "check") return n > 0 ? 1 : current;
  return Math.max(0, Math.round((current + n) * 100) / 100);
}
