// «الصحة العلوية» · the tracker: what the person actually did each day — every set of every exercise (weight × reps),
// cardio minutes, the day's nutrition (calories, protein, water, fruit and vegetables, steps) and the body weight — and
// what follows from it: the best set and the estimated one-rep max of an exercise over time, the suggestion for next
// time (progressive overload), and the hard sets each muscle got this week. Pure.

import { GUIDE } from "@config/mahdi/exercise-guide";
import { REF } from "@config/mahdi/health-research";

export interface SetLog {
  kg: number;
  reps: number;
}

export const FOOD_KEYS = ["kcal", "proteinG", "waterCups", "produce", "steps"] as const;
export type FoodKey = (typeof FOOD_KEYS)[number];
export const MEASUREMENT_KEYS = ["shoulders", "chest", "arm", "forearm", "waist", "hips", "thigh", "calf"] as const;
export type MeasurementKey = (typeof MEASUREMENT_KEYS)[number];
export const MEASUREMENT_NAMES: Record<MeasurementKey, string> = {
  shoulders: "الأكتاف",
  chest: "الصدر",
  arm: "الذراع",
  forearm: "الساعد",
  waist: "الخصر",
  hips: "الحوض",
  thigh: "الفخذ",
  calf: "السمانة",
};

/**
 * «شنو أكلت؟»: one thing eaten that day — the food (from the catalogue, or written by the person and estimated), the
 * household measure and how many, and what it gives. Its calories and protein are added to the day's counters.
 */
export interface MealItem {
  id: string;
  /** the catalogue food (config/mahdi/meal-foods.ts), or null for one estimated from the person's words */
  foodId: string | null;
  name: string;
  /** the measure as said («صحن متوسط», «ملعقة طعام عادية», «بيضة») */
  unit: string;
  qty: number;
  g: number;
  kcal: number;
  p: number;
  c: number;
  f: number;
}
export const MEALS_MAX = 60;

export interface DayLog {
  date: string;
  /** exercise id → its sets, in order */
  sets: Record<string, SetLog[]>;
  cardioMin: number;
  /** the person pressed «خلصت تمرين اليوم» */
  done: boolean;
  food: Partial<Record<FoodKey, number>>;
  /** a weigh-in that day */
  bodyKg: number | null;
  /** optional circumference measurements in centimetres */
  measurements?: Partial<Record<MeasurementKey, number>>;
  /** which day of the plan was trained (its id); the next session suggests the one after it */
  planDay?: number;
  /** the session clock: running since this moment (ms), or not running */
  startedAt?: number | null;
  /** the minutes of training already counted that day (the clock adds to it when it stops) */
  durationMin?: number;
  /** «شنو أكلت؟»: what was eaten, item by item */
  meals?: MealItem[];
}

/** A number as the person typed it: Arabic digits, «٫» or «,» as the decimal point (so 7.5 and ٧٫٥ both work). */
export function parseNum(raw: string): number {
  const t = raw.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0)).replace(/[٫,،]/g, ".").replace(/[^\d.]/g, "");
  const [a, ...rest] = t.split(".");
  const n = Number(rest.length ? `${a}.${rest.join("")}` : a);
  return Number.isFinite(n) ? n : 0;
}

/** The minutes trained that day, with the running clock (now). */
export const sessionMin = (d: Pick<DayLog, "startedAt" | "durationMin">, now = Date.now()) => (d.durationMin ?? 0) + (d.startedAt ? Math.max(0, (now - d.startedAt) / 60000) : 0);

export const emptyDay = (date: string): DayLog => ({ date, sets: {}, cardioMin: 0, done: false, food: {}, bodyKg: null, measurements: {} });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const num = (v: unknown, lo: number, hi: number, step = 1) => {
  const n = Number(v);
  return Number.isFinite(n) ? Number((Math.round(Math.min(hi, Math.max(lo, n)) / step) * step).toFixed(2)) : null;
};

/** A day as the page sent it, kept inside bounds. */
export function cleanDay(v: unknown): DayLog | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.date !== "string" || !DATE_RE.test(o.date)) return null;
  const sets: Record<string, SetLog[]> = {};
  if (o.sets && typeof o.sets === "object") {
    for (const [id, list] of Object.entries(o.sets as Record<string, unknown>).slice(0, 30)) {
      if (!/^[a-z0-9-]{1,40}$/.test(id) || !Array.isArray(list)) continue;
      const clean = list
        .slice(0, 12)
        .map((s: Record<string, unknown>) => ({ kg: num(s?.kg, 0, 600, 0.25) ?? 0, reps: num(s?.reps, 0, 200) ?? 0 }))
        .filter((s) => s.reps > 0 || s.kg > 0);
      if (clean.length) sets[id] = clean;
    }
  }
  const food: Partial<Record<FoodKey, number>> = {};
  const f = (o.food ?? {}) as Record<string, unknown>;
  for (const k of FOOD_KEYS) {
    const n = num(f[k], 0, k === "steps" ? 100000 : 20000);
    if (n !== null && f[k] !== undefined && f[k] !== null) food[k] = n;
  }
  const measurements: Partial<Record<MeasurementKey, number>> = {};
  const rawMeasurements = (o.measurements ?? {}) as Record<string, unknown>;
  for (const key of MEASUREMENT_KEYS) {
    const value = num(rawMeasurements[key], 5, 300, 0.1);
    if (value !== null && rawMeasurements[key] !== undefined && rawMeasurements[key] !== null) measurements[key] = value;
  }
  return {
    date: o.date,
    sets,
    cardioMin: num(o.cardioMin, 0, 600) ?? 0,
    done: o.done === true,
    food,
    bodyKg: o.bodyKg === null || o.bodyKg === undefined ? null : num(o.bodyKg, 20, 400, 0.1),
    measurements,
    ...(Number.isInteger(o.planDay) && (o.planDay as number) >= 0 && (o.planDay as number) <= 6 ? { planDay: o.planDay as number } : {}),
    startedAt: typeof o.startedAt === "number" && o.startedAt > 1.6e12 && o.startedAt < 4e12 ? Math.round(o.startedAt) : null,
    durationMin: num(o.durationMin, 0, 600, 0.1) ?? 0,
    ...(Array.isArray(o.meals) && o.meals.length ? { meals: cleanMeals(o.meals) } : {}),
  };
}

/** The meals as the page sent them, kept inside bounds. */
export function cleanMeals(v: unknown[]): MealItem[] {
  return v
    .slice(0, MEALS_MAX)
    .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
    .map((m) => ({
      id: typeof m.id === "string" && /^[a-z0-9]{4,24}$/i.test(m.id) ? m.id : Math.random().toString(36).slice(2, 12),
      foodId: typeof m.foodId === "string" && /^[a-z0-9-]{1,40}$/.test(m.foodId) ? m.foodId : null,
      name: String(m.name ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 60),
      unit: String(m.unit ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 40),
      qty: num(m.qty, 0, 50, 0.25) ?? 1,
      g: num(m.g, 0, 5000) ?? 0,
      kcal: num(m.kcal, 0, 6000) ?? 0,
      p: num(m.p, 0, 400, 0.1) ?? 0,
      c: num(m.c, 0, 800, 0.1) ?? 0,
      f: num(m.f, 0, 400, 0.1) ?? 0,
    }))
    .filter((m) => m.name);
}

/** What the day's meals add up to. */
export function mealTotals(meals: MealItem[] | undefined) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const m of meals ?? []) {
    t.kcal += m.kcal;
    t.p += m.p;
    t.c += m.c;
    t.f += m.f;
  }
  return { kcal: Math.round(t.kcal), p: Math.round(t.p), c: Math.round(t.c), f: Math.round(t.f) };
}

/** Epley: the weight you could lift once (bodyweight sets count by reps only). */
export const e1rm = (s: SetLog) => (s.kg > 0 ? Math.round(s.kg * (1 + Math.min(s.reps, 15) / 30) * 2) / 2 : 0);

export function bestSet(sets: SetLog[]): SetLog | null {
  let best: SetLog | null = null;
  for (const s of sets) if (s.reps > 0 && (!best || e1rm(s) > e1rm(best) || (e1rm(s) === e1rm(best) && s.reps > best.reps))) best = s;
  return best;
}

export interface ExercisePoint {
  date: string;
  best: SetLog;
  e1rm: number;
  /** kg × reps of all sets (or reps for bodyweight) */
  volume: number;
  sets: number;
}

/** Every day the exercise was logged, oldest first. */
export function history(days: DayLog[], exId: string): ExercisePoint[] {
  return days
    .filter((d) => d.sets[exId]?.length)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => {
      const s = d.sets[exId];
      const best = bestSet(s) ?? s[0];
      return { date: d.date, best, e1rm: e1rm(best), volume: s.reduce((t, x) => t + (x.kg > 0 ? x.kg * x.reps : x.reps), 0), sets: s.length };
    });
}

/** The last time before `date` this exercise was done. */
export function lastTime(days: DayLog[], exId: string, date: string): { date: string; sets: SetLog[] } | null {
  const prev = days.filter((d) => d.date < date && d.sets[exId]?.length).sort((a, b) => b.date.localeCompare(a.date))[0];
  return prev ? { date: prev.date, sets: prev.sets[exId] } : null;
}

/** The personal record (best estimated max, or most reps for bodyweight). */
export function record(days: DayLog[], exId: string): SetLog | null {
  return bestSet(days.flatMap((d) => d.sets[exId] ?? []));
}

/** The top of a rep range like «8–12» (or a single «10»); null for timed sets. */
export const repTop = (reps: string) => {
  if (/ث/.test(reps)) return null;
  const n = reps.match(/\d+/g)?.map(Number) ?? [];
  return n.length ? Math.max(...n) : null;
};

/** Progressive overload: every set reached the top of the range → a little more weight next time; else more reps. */
export function suggestion(last: SetLog[] | undefined, reps: string, bodyweight: boolean): string {
  if (!last?.length) return "أول مرة: اختر وزن تقدر تسوي فيه التكرارات بتكنيك نظيف وتبقى عندك 1–3 تكرارات.";
  const top = repTop(reps);
  const all = top !== null && last.every((s) => s.reps >= top);
  const heaviest = Math.max(...last.map((s) => s.kg));
  if (bodyweight || heaviest === 0) return all ? "وصلت أعلى التكرارات: صعّبها (أبطأ في النزول، أو نسخة أصعب، أو مجموعة زيادة)." : "حاول تزيد تكرار واحد على الأقل في كل مجموعة.";
  if (all) return `ممتاز! جرّب ${heaviest + (heaviest >= 40 ? 2.5 : 1)} كغ هالمرة.`;
  return `نفس الوزن ${heaviest} كغ، وحاول توصل ${top ?? "أعلى"} تكرار في كل المجموعات.`;
}

/** Hard sets per detailed muscle (config/mahdi/exercise-guide.ts ids) on the days given: main muscles 1, helping ½. */
export function setsByMuscle(days: DayLog[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of days)
    for (const [id, sets] of Object.entries(d.sets)) {
      const g = GUIDE[id];
      if (!g) continue;
      const n = sets.filter((s) => s.reps > 0).length;
      for (const m of g.primary) out[m] = (out[m] ?? 0) + n;
      for (const m of g.secondary) out[m] = (out[m] ?? 0) + n / 2;
    }
  return out;
}

export const WEEK_TARGET = REF.hypertrophySetsPerMuscle;

/** The dates of the 7 days ending on `date` (oldest first). */
export function weekOf(date: string): string[] {
  const d = new Date(`${date}T12:00:00Z`);
  return Array.from({ length: 7 }, (_, i) => new Date(d.getTime() - (6 - i) * 86400000).toISOString().slice(0, 10));
}

/**
 * What the gym habits of a day must say, from what was really logged that day (and not from the plan's first shape):
 * finishing credits the session actually trained («day-N» by its weekday), the weekly count and each exercise that has
 * sets; taking the finish back clears exactly those — including the session recorded when it was finished, even if the
 * person has since picked another one — so nothing stays ticked from "the previous thing".
 */
export function gymHabitWrites(o: { done: boolean; session: number | null; recorded?: number; sets: DayLog["sets"] }): { key: string; value: number }[] {
  const out = new Map<string, number>();
  const sessions = [...new Set([o.session, o.recorded].filter((x): x is number => typeof x === "number"))];
  if (o.done) {
    if (o.session !== null) out.set(`day-${o.session}`, 1);
    out.set("weekly", 1);
  } else {
    for (const d of sessions) out.set(`day-${d}`, 0);
    out.set("weekly", 0);
  }
  for (const [id, s] of Object.entries(o.sets)) {
    const n = s.filter((x) => x.reps > 0).length;
    out.set(`ex-${id}`, o.done ? n : 0);
  }
  return [...out].map(([key, value]) => ({ key, value }));
}
