// «لأجل المهدي» · «آية اليوم ورواية اليوم» — one verse and one narration for each day of a year of 365 days, then it
// begins again. The text is shown exactly as it was copied (thaqalayn.com for the narrations, a checked mushaf for the
// verses) with its reference, and nothing is added to it: no explanation, no comment (the owner's rule, 25 October 2026).
// The days arrive in batches (config/mahdi/daily/days-*.json); a day whose batch is not there yet shows nothing.
// Pure: the page and the tests both read it.

import { diffDays, weekday, type ISODate } from "@/lib/mahdi/engine/dates";
import batch001 from "@config/mahdi/daily/days-001-060.json";

/** Day 1 of the cycle (a Sunday): every person starts on the same day, so the whole community reads the same verse. */
export const DAILY_START: ISODate = "2026-10-25";
export const DAILY_DAYS = 365;
/** Every Friday (the 6th day of each week from the start) is about waiting for the Imam by working. */
export const FRIDAY_THEME = "الانتظار بالعمل";

/** The theme of each week from the start (week 53 is the 365th day alone). */
export const WEEK_THEMES: readonly string[] = [
  "الثبات على القليل", "النية والإخلاص", "الصلاة", "القرآن والتدبر", "الذكر والدعاء", "العلم", "الصبر", "الشكر", "حسن الخلق", "بر الوالدين",
  "صلة الرحم", "الصدق", "الأمانة والوفاء بالوعد", "العمل والكسب الحلال", "الوقت واغتنام العمر", "حفظ اللسان", "التوبة والرجوع", "الإحسان للناس", "التوكل", "القناعة",
  "محاسبة النفس", "الأمل ودفع الكسل", "المبادرة إلى الخير", "التواضع", "الحلم وكظم الغيظ", "العفو", "الرفق", "قضاء حوائج الناس", "الأخوة والصحبة الصالحة", "الاستغفار",
  "الحياء والعفة", "الورع وترك المحرمات", "الصدقة والكرم", "اليقين وحسن الظن بالله", "الرضا", "التفكر", "العقل والمشورة", "العدل والإنصاف", "الجار والمجتمع", "مجاهدة النفس",
  "التخفف من الدنيا", "ترك الحسد", "الكلام الحسن", "إدخال السرور", "الأسرة والبيت", "الاعتدال", "الاستعداد للآخرة", "السؤال وطلب الفهم", "الأمر بالمعروف بالرفق", "الثبات على الحق",
  "العمل الدائم وحسن العاقبة", "تجديد العهد", "تجديد العهد",
];

export interface DailyAyah {
  surah: string;
  surah_number: number;
  ayah_number: number;
  text_ar: string;
}
export interface DailyRiwaya {
  book: string;
  volume: string | null;
  chapter_ar: string;
  hadith_number: string;
  speaker: string;
  text_ar: string;
  /** a part of a longer narration, copied without any cut inside it */
  is_excerpt: boolean;
  source_url: string;
}
export interface DailyEntry {
  day: number;
  theme: string;
  ayah: DailyAyah;
  riwaya: DailyRiwaya;
  tags: string[];
}

/** All the days that have arrived, by their number in the cycle. */
export const DAILY: ReadonlyMap<number, DailyEntry> = new Map((batch001 as DailyEntry[]).map((e) => [e.day, e]));

/** The date a day of the cycle falls on, in the first cycle. */
export function dateOfDay(day: number): ISODate {
  const [y, m, d] = DAILY_START.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + day - 1)).toISOString().slice(0, 10);
}

/** Today's number in the cycle (1…365), or null before the start. After day 365 it begins again at 1. */
export function dailyNumber(today: ISODate): number | null {
  const n = diffDays(today, DAILY_START);
  return n < 0 ? null : (n % DAILY_DAYS) + 1;
}

/** The week of a day (1…53) and what that week is about. */
export const weekOfDay = (day: number) => Math.ceil(day / 7);
export const themeOfDay = (day: number) => (weekday(dateOfDay(day)) === 5 ? FRIDAY_THEME : WEEK_THEMES[weekOfDay(day) - 1]);

/** Today's verse and narration: null before the start, or while today's batch has not arrived. */
export function dailyFor(today: ISODate): DailyEntry | null {
  const n = dailyNumber(today);
  return n ? DAILY.get(n) ?? null : null;
}

/** «الكافي، ج٢، باب …، ح٢»: where the narration is from, as the page prints it. */
export function riwayaRef(r: DailyRiwaya) {
  const num = /^\d|^[٠-٩]/.test(r.hadith_number) ? `ح${r.hadith_number}` : r.hadith_number;
  return [r.book, r.volume, r.chapter_ar, num].filter(Boolean).join("، ");
}

const INDIC = "٠١٢٣٤٥٦٧٨٩";
/** «الحجر: ٩٩» (the digits written by hand, so the server and the phone print the same). */
export const ayahRef = (a: DailyAyah) => `${a.surah}: ${String(a.ayah_number).replace(/\d/g, (d) => INDIC[Number(d)])}`;
