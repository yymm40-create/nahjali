// When a reminder is due. Pure functions over minutes of the day in the user's own time zone.

export type ReminderMode = "off" | "daily" | "every_12h" | "every_6h" | "custom";

/** A reminder is sent if its time passed within this many minutes (the scheduler runs every 15). */
export const REMINDER_WINDOW_MIN = 20;

const DAY_MIN = 1440;

/** 'HH:MM' → minutes since midnight, or null when malformed. */
export function toMinutes(hhmm: string | null | undefined): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::\d\d)?$/.exec(hhmm ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** The times of day (in minutes) a mode sends at: one time, every 12 or 6 hours from it, or the custom list. */
export function reminderSlots(mode: ReminderMode, times: string[]): number[] {
  const list = times.map(toMinutes).filter((x): x is number => x !== null);
  if (mode === "off" || list.length === 0) return [];
  const first = list[0];
  const step = mode === "every_12h" ? 720 : mode === "every_6h" ? 360 : 0;
  if (mode === "daily") return [first];
  if (step) return Array.from({ length: DAY_MIN / step }, (_, k) => (first + k * step) % DAY_MIN).sort((a, b) => a - b);
  return [...new Set(list)].sort((a, b) => a - b).slice(0, 6);
}

/** Is this minute inside the quiet hours (which may cross midnight, like 23:00 → 07:00)? Equal start and end means none. */
export function inQuietHours(minute: number, start: string, end: string): boolean {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === null || e === null || s === e) return false;
  return s < e ? minute >= s && minute < e : minute >= s || minute < e;
}

/** Minutes since `slot` passed (0 = this minute). Wraps around midnight. */
export const minutesSince = (nowMin: number, slot: number) => (nowMin - slot + DAY_MIN) % DAY_MIN;

/** The most recent slot that passed within the window, with how long ago it was; null when none. */
export function dueSlot(nowMin: number, slots: number[], windowMin = REMINDER_WINDOW_MIN): { slot: number; ago: number } | null {
  let best: { slot: number; ago: number } | null = null;
  for (const slot of slots) {
    const ago = minutesSince(nowMin, slot);
    if (ago < windowMin && (!best || ago < best.ago)) best = { slot, ago };
  }
  return best;
}

/** Minutes since midnight in a time zone (falls back to UTC for an unknown zone). */
export function minuteOfDayIn(timeZone: string, now: Date = new Date()): number {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  } catch {
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return (get("hour") % 24) * 60 + get("minute");
}

/** Was something sent after the slot passed? `lastSent` is an ISO timestamp, `ago` the minutes since the slot. */
export function alreadySent(lastSent: string | null, ago: number, now: Date = new Date()): boolean {
  if (!lastSent) return false;
  const slotAt = Math.floor(now.getTime() / 60_000) * 60_000 - ago * 60_000;
  return new Date(lastSent).getTime() >= slotAt;
}

