// BROWSER ONLY. «حاسبوا أنفسكم» on the home: the cards that say «اكتب ملاحظتك على يومك / أسبوعك». The person can put one off for now
// («لاحقًا») or turn it off for good («لا تذكّرني»); it is kept on this device (and turned back on from the notifications page).
import type { ISODate } from "../engine/dates";

const KEY = "mahdi:review-hints";

export interface HintPrefs {
  /** the day's card on; the week's card on */
  day: boolean;
  week: boolean;
  /** put off until the next day / week: the day or the week's first day it was put off on */
  dayLater: ISODate | null;
  weekLater: ISODate | null;
}

export const DEFAULT_HINTS: HintPrefs = { day: true, week: true, dayLater: null, weekLater: null };

export function readHints(): HintPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<HintPrefs>;
    return {
      day: raw.day !== false,
      week: raw.week !== false,
      dayLater: typeof raw.dayLater === "string" ? raw.dayLater : null,
      weekLater: typeof raw.weekLater === "string" ? raw.weekLater : null,
    };
  } catch {
    return { ...DEFAULT_HINTS };
  }
}

export function writeHints(patch: Partial<HintPrefs>): HintPrefs {
  const next = { ...readHints(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  return next;
}
