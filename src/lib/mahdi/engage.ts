// «لأجل المهدي» · notifications that bring people back to the app (on top of the habit reminders). Each kind has its own switch (all on
// until the person turns one off), its hour in the person's own day, and its own text; at most two of them a day, never in quiet
// hours. Pure: the dispatcher (server/engage.ts), the settings page and the tests read it.

import { addDays, weekday, type ISODate } from "./engine/dates";
import { dailyFor } from "./daily";

export const ENGAGE_KINDS = ["morning", "review_day", "review_week", "streak", "comeback"] as const;
export type EngageKind = (typeof ENGAGE_KINDS)[number];
export type EngageSettings = Partial<Record<EngageKind, boolean>>;

export interface EngageDef {
  id: EngageKind;
  /** the name the person reads */
  ar: string;
  /** what it does, one line */
  hint: string;
  /** «HH:MM» in the person's own day */
  at: string;
  /** which comes first when the day's limit is reached (1 = first) */
  priority: number;
}

export const ENGAGE: readonly EngageDef[] = [
  { id: "streak", ar: "سلسلتك في خطر", hint: "إذا سلسلة أيامك المتواصلة باقي لها شي بسيط اليوم", at: "19:30", priority: 1 },
  { id: "review_day", ar: "ملاحظة يومك", hint: "آخر اليوم: «اكتب ملاحظتك على يومك»", at: "21:00", priority: 2 },
  { id: "morning", ar: "آية ورواية الصباح", hint: "كل صباح آية اليوم ورواية اليوم", at: "08:00", priority: 3 },
  { id: "review_week", ar: "ملاحظة أسبوعك", hint: "آخر يوم من أسبوعك: قيّمه واكتب ملاحظتك", at: "20:00", priority: 4 },
  { id: "comeback", ar: "اشتقنالك", hint: "إذا غبت عن التطبيق عدة أيام (مرة في الأسبوع على الأكثر)", at: "11:00", priority: 5 },
];

/** At most this many of these notifications reach a person in one day. */
export const ENGAGE_DAILY_MAX = 2;
/** «اشتقنالك» after this many days with nothing logged, and not more often than every this many days. */
export const COMEBACK_AFTER_DAYS = 3;
export const COMEBACK_EVERY_DAYS = 7;
/** «سلسلتك في خطر» only for a streak of at least this many days. */
export const STREAK_MIN_DAYS = 3;

export const engageDef = (id: EngageKind) => ENGAGE.find((e) => e.id === id)!;

/** Is this kind on? Every kind is on until the person turns it off. */
export const engageOn = (s: EngageSettings | null | undefined, id: EngageKind) => s?.[id] !== false;

/** What the person saved, checked: only known kinds, only booleans, and only the ones switched OFF are kept. */
export function parseEngage(v: unknown): EngageSettings {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out: EngageSettings = {};
  for (const id of ENGAGE_KINDS) if (o[id] === false) out[id] = false;
  return out;
}

/** The last day of the person's week (0 = Sunday … 6 = Saturday), from the day it starts. */
export const weekEndsOn = (weekStart: number) => (weekStart + 6) % 7;

/** The first day of the week that holds `d`. */
export function weekStartOf(d: ISODate, weekStart: number): ISODate {
  return addDays(d, -((weekday(d) - weekStart + 7) % 7));
}

/** Is `kind` allowed on this day for this person? (the week's note only on the week's last day; the morning one only when the day has its verse) */
export function engageDay(kind: EngageKind, today: ISODate, weekStart: number): boolean {
  if (kind === "review_week") return weekday(today) === weekEndsOn(weekStart);
  if (kind === "morning") return Boolean(dailyFor(today));
  return true;
}

export interface EngagePush {
  title: string;
  body: string;
  url: string;
  tag: string;
}

const clip = (s: string, n: number) => {
  const words = s.trim().split(/\s+/);
  let out = "";
  for (const w of words) {
    if ((out + " " + w).trim().length > n) return `${out}…`;
    out = `${out} ${w}`.trim();
  }
  return out;
};

/** The notification's text. `n` / `left` are the streak's days and the habits still open (streak), or the days away (comeback). */
export function engageText(kind: EngageKind, today: ISODate, o: { n?: number; left?: number } = {}): EngagePush {
  switch (kind) {
    case "morning": {
      const e = dailyFor(today);
      const friday = weekday(today) === 5;
      return {
        title: friday ? "جمعة مباركة · آية اليوم ورواية اليوم" : "آية اليوم ورواية اليوم",
        body: e ? `${clip(e.ayah.text_ar, 70)}\nوالرواية بانتظارك في التطبيق.` : "آية ورواية جديدة بانتظارك.",
        url: "/mahdi",
        tag: "mahdi-morning",
      };
    }
    case "review_day":
      return { title: "حاسب نفسك", body: "كيف كان يومك؟ اكتب ملاحظتك في دقيقة.", url: `/mahdi/day/${today}`, tag: "mahdi-review-day" };
    case "review_week":
      return { title: "حاسب نفسك · أسبوعك", body: "خلّص أسبوعك. شوف نتيجتك واكتب ملاحظتك عليه.", url: "/mahdi/progress/week", tag: "mahdi-review-week" };
    case "streak": {
      const n = o.n ?? 0, left = o.left ?? 1;
      return { title: "سلسلتك في خطر", body: `عندك ${n} يوم متواصلة، وباقي ${left === 1 ? "عادة وحدة" : `${left} عادات`} اليوم تحفظها.`, url: "/mahdi", tag: "mahdi-streak" };
    }
    case "comeback":
      return { title: "اشتقنالك", body: `من ${o.n ?? COMEBACK_AFTER_DAYS} أيام ما سجّلت شي. دقيقة وحدة اليوم ترجّعك على الطريق.`, url: "/mahdi", tag: "mahdi-comeback" };
  }
}
