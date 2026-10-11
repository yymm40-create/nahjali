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
}

export const emptyDay = (date: string): DayLog => ({ date, sets: {}, cardioMin: 0, done: false, food: {}, bodyKg: null });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const num = (v: unknown, lo: number, hi: number, step = 1) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(Math.min(hi, Math.max(lo, n)) / step) * step : null;
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
  return {
    date: o.date,
    sets,
    cardioMin: num(o.cardioMin, 0, 600) ?? 0,
    done: o.done === true,
    food,
    bodyKg: o.bodyKg === null || o.bodyKg === undefined ? null : num(o.bodyKg, 20, 400, 0.1),
  };
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
