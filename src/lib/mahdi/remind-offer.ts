// «أذكّرك بكرة؟»: the ONE time the app asks for notifications (the plan approved 26 November 2026). Never on entry: only
// after the person finishes their first habit or reading, a small sheet offers a reminder tomorrow at a time tied to the
// prayers, and only after «إيه» does the browser / phone show its own permission prompt. Pure: the sheet, the reminders
// page and the tests read it.

import { inQuietHours, toMinutes } from "./engine/reminders";

/** Where this device keeps that the person answered the offer (yes or no): it never comes again. */
export const OFFER_KEY = "mahdi-remind-offer";

export type PrayerSlotId = "fajr" | "dhuhr" | "maghrib";

export interface PrayerSlot {
  id: PrayerSlotId;
  /** «بعد الفجر» */
  label: string;
  /** "HH:MM" local */
  at: string;
}

/** Minutes after the prayer the reminder comes (time to finish the prayer and its ta'qibat). */
export const AFTER_PRAYER_MIN = 30;
/** When a prayer time can't be worked out (far north), these are used. */
const FALLBACK: Record<PrayerSlotId, number> = { fajr: 5 * 60, dhuhr: 12 * 60, maghrib: 18 * 60 };
const LABEL: Record<PrayerSlotId, string> = { fajr: "بعد الفجر", dhuhr: "بعد الظهر", maghrib: "بعد المغرب" };

export const hhmm = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** «بعد الفجر 5:35», «بعد الظهر»…: each prayer's minute plus a little, rounded to 5 minutes. */
export function prayerSlots(p: { fajr: number | null; dhuhr: number | null; maghrib: number | null }): PrayerSlot[] {
  return (["fajr", "dhuhr", "maghrib"] as const).map((id) => {
    const base = p[id] ?? FALLBACK[id];
    return { id, label: LABEL[id], at: hhmm(Math.round((base + AFTER_PRAYER_MIN) / 5) * 5) };
  });
}

/** A clock time as «5:35 م» (Western digits). */
export function clock12(at: string): string {
  const min = toMinutes(at);
  if (min === null) return at;
  const h = Math.floor(min / 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(min % 60).padStart(2, "0")} ${h < 12 ? "ص" : "م"}`;
}

/** The device states (client/push.ts) where asking makes sense: it can get notifications and hasn't said yes or no. */
export const canAsk = (device: string) => device === "off";

/**
 * Should «أذكّرك بكرة؟» open now? Only on a device that can still ask, never answered before, and only once something
 * was finished since the app opened (`doneNow` above `doneAtOpen`: a habit completed or a reading saved).
 */
export function shouldOffer(o: { device: string; answered: boolean; doneAtOpen: number | null; doneNow: number }): boolean {
  return canAsk(o.device) && !o.answered && o.doneAtOpen !== null && o.doneNow > o.doneAtOpen;
}

/** The answer kept on this device: anything saved means it was answered. */
export const answeredOffer = (raw: string | null) => Boolean(raw);

/**
 * The settings saved by «إيه، ذكّرني»: one reminder a day at the chosen time. When that time falls in the quiet hours (a
 * reminder after Fajr at 5:00 with quiet hours until 7:00), the quiet hours end at it — the person picked it on purpose.
 */
export function offerSettings<T extends { mode: string; times: string[]; quietStart: string; quietEnd: string }>(saved: T, at: string): T {
  const min = toMinutes(at);
  const quiet = min !== null && inQuietHours(min, saved.quietStart, saved.quietEnd);
  return { ...saved, mode: "daily", times: [at], ...(quiet ? { quietEnd: at } : {}) };
}

/** Where a reminder opens: the habit itself (not the home), the day for a day's tasks or the day's reminder. */
export function alertUrl(kind: "habit" | "task" | "day", o: { id?: string; date?: string } = {}): string {
  if (kind === "habit" && o.id) return `/mahdi/habits/${encodeURIComponent(o.id)}`;
  if (kind === "task" && o.date) return `/mahdi/day/${o.date}`;
  return "/mahdi";
}
