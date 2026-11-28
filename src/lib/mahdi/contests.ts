// «لأجل المهدي» · «مسابقة الثبات»: someone (a mosque, a neighbourhood, a family) runs a contest on keeping worship habits
// for one to eight weeks. Each participant picks which of their own projects count; the app measures them the way it
// measures everything else (goals reached, each capped at 100%), and whoever reaches the organiser's bar (95% by
// default) is in the draw for the prize. Pure functions: shared by the server, the pages and the tests.
import { addDays, buildTimeline, diffDays, minDate, rangeGoals, scoreBy, summarize, type ISODate, type Item } from "./engine";

export const CONTEST_MIN_DAYS = 7;
export const CONTEST_MAX_DAYS = 56;
export const CONTEST_MAX_OWNED = 3;
export const CONTEST_MAX_ENTRIES = 500;
export const CONTEST_MAX_WINNERS = 20;
export const CONTEST_MESSAGE_MAX = 1000;
/** Joining stays open this many days after the start (the first days still count: a late joiner has them as missed). */
export const CONTEST_JOIN_GRACE = 1;

export interface ContestDef {
  id: string;
  title: string;
  /** the rules and the prize, in the organiser's words */
  details: string;
  prize: string;
  startsOn: ISODate;
  endsOn: ISODate;
  /** the bar, in percent (50…100) */
  threshold: number;
  /** a participant needs at least this many habits in the projects they picked */
  minHabits: number;
  /** shown to every user of the app (only the site's owner turns this on) */
  listed: boolean;
}

export type ContestPhase = "upcoming" | "live" | "over";

export function contestPhase(c: Pick<ContestDef, "startsOn" | "endsOn">, today: ISODate): ContestPhase {
  if (today < c.startsOn) return "upcoming";
  if (today > c.endsOn) return "over";
  return "live";
}

/** Whether someone can still join on `today` (their own day): before the start, or in the first day(s). */
export const canJoin = (c: Pick<ContestDef, "startsOn" | "endsOn">, today: ISODate) => today <= minDate(addDays(c.startsOn, CONTEST_JOIN_GRACE), c.endsOn);

/** Whether the chosen projects can still be changed: only before the contest starts. */
export const projectsLocked = (c: Pick<ContestDef, "startsOn">, today: ISODate) => today >= c.startsOn;

/** How long it lasts, in days (both ends included). */
export const contestDays = (c: Pick<ContestDef, "startsOn" | "endsOn">) => diffDays(c.endsOn, c.startsOn) + 1;

/** The contest's weeks (the last one may be shorter), each [from, to]. */
export function contestWeeks(c: Pick<ContestDef, "startsOn" | "endsOn">): { from: ISODate; to: ISODate }[] {
  const out: { from: ISODate; to: ISODate }[] = [];
  for (let from = c.startsOn; from <= c.endsOn; from = addDays(from, 7)) out.push({ from, to: minDate(addDays(from, 6), c.endsOn) });
  return out;
}

/** How many of the contest's weeks are over on `today` (the organiser's weekly summary). */
export function weeksDone(c: Pick<ContestDef, "startsOn" | "endsOn">, today: ISODate): number {
  return contestWeeks(c).filter((w) => w.to < today).length;
}

/** The organiser's form, checked. Returns the clean contest or the reason it is refused (in Arabic). */
export function cleanContest(b: Record<string, unknown>, today: ISODate): { ok: true; value: Omit<ContestDef, "id" | "listed"> } | { ok: false; error: string } {
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+\n/g, "\n").slice(0, max) : "");
  const title = text(b.title, 60);
  if (!title) return { ok: false, error: "اكتب اسم المسابقة" };
  const startsOn = typeof b.startsOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.startsOn) ? b.startsOn : "";
  if (!startsOn) return { ok: false, error: "اختر يوم البداية" };
  if (startsOn < today) return { ok: false, error: "يوم البداية لازم يكون اليوم أو بعده" };
  if (startsOn > addDays(today, 60)) return { ok: false, error: "يوم البداية بعيد: خلّه خلال شهرين" };
  const days = Math.round(Number(b.days));
  if (!Number.isFinite(days) || days < CONTEST_MIN_DAYS || days > CONTEST_MAX_DAYS) return { ok: false, error: `المدة من ${CONTEST_MIN_DAYS} إلى ${CONTEST_MAX_DAYS} يوم` };
  const threshold = Math.round(Number(b.threshold ?? 95));
  if (!Number.isFinite(threshold) || threshold < 50 || threshold > 100) return { ok: false, error: "النسبة المطلوبة من ٥٠٪ إلى ١٠٠٪" };
  const minHabits = Math.round(Number(b.minHabits ?? 3));
  if (!Number.isFinite(minHabits) || minHabits < 1 || minHabits > 30) return { ok: false, error: "أقل عدد عادات من ١ إلى ٣٠" };
  return {
    ok: true,
    value: { title, details: text(b.details, 1500), prize: text(b.prize, 200), startsOn, endsOn: addDays(startsOn, days - 1), threshold, minHabits },
  };
}

/** A habit as the contest needs it (the participant's own, from their projects). */
export interface ContestHabit {
  id: string;
  projectId: string;
  name: string;
  versions: Item["versions"];
}

export interface HabitResult {
  name: string;
  achieved: number;
  required: number;
  /** 0…1, null when nothing was due yet */
  score: number | null;
}

export interface EntryResult {
  /** 0…1 over the whole contest so far (goals whose time has passed, and those already reached) */
  score: number | null;
  achieved: number;
  required: number;
  /** each week of the contest (null: not started, or nothing due) */
  weeks: (number | null)[];
  habits: HabitResult[];
  /** habits in the chosen projects that have goals inside the contest */
  habitCount: number;
  /** a goal was changed, or a habit added, after the start: the organiser takes a look */
  edited: boolean;
  /** reached the bar with enough habits (at the end, this is who enters the draw) */
  qualified: boolean;
}

/**
 * A participant's result: their habits in the projects they picked, from the contest's first day to `today` (their own
 * day) or its last day. Their own clock decides «today», so a goal counts once its day (or week) is over in their day.
 */
export function entryResult(
  c: Pick<ContestDef, "startsOn" | "endsOn" | "threshold" | "minHabits">,
  habits: readonly ContestHabit[],
  logs: Record<string, Record<ISODate, number>>,
  projectIds: readonly string[],
  today: ISODate,
  weekStart: number,
): EntryResult {
  const chosen = habits.filter((h) => projectIds.includes(h.projectId) && h.versions.length);
  const to = minDate(today, c.endsOn);
  const weeks = contestWeeks(c);
  if (today < c.startsOn) {
    const habitCount = chosen.filter((h) => h.versions.some((v) => v.state === "active")).length;
    return { score: null, achieved: 0, required: 0, weeks: weeks.map(() => null), habits: [], habitCount, edited: false, qualified: false };
  }
  const items: Item[] = chosen.map((h) => ({ id: h.id, projectId: h.projectId, versions: h.versions, logs: logs[h.id] ?? {} }));
  // a week goal of the first week can begin before the contest: the timeline starts a week early, the range decides
  const tl = buildTimeline(items, addDays(c.startsOn, -7), c.endsOn, { asOf: today, weekStart });
  const goals = rangeGoals(tl, c.startsOn, to);
  const all = summarize(goals);
  const byHabit = scoreBy(goals, (i) => i.itemId);
  const counted = chosen.filter((h) => tl.byItem.get(h.id)?.some((i) => i.periodEnd >= c.startsOn && i.start <= c.endsOn));
  const edited = chosen.some((h) => h.versions.some((v) => v.effectiveFrom > c.startsOn && v.effectiveFrom <= to));
  const score = all.score;
  return {
    score,
    achieved: all.achieved,
    required: all.required,
    weeks: weeks.map((w) => (w.from > to ? null : summarize(rangeGoals(tl, w.from, minDate(w.to, to))).score)),
    habits: counted
      .map((h) => {
        const s = byHabit.get(h.id);
        return { name: h.name, achieved: s?.achieved ?? 0, required: s?.required ?? 0, score: s?.score ?? null };
      })
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
    habitCount: counted.length,
    edited,
    qualified: score !== null && counted.length >= c.minHabits && score * 100 >= c.threshold - 1e-9,
  };
}

/** Draws `n` different winners from `ids`, with `rand(k)` giving a whole number in [0, k) (the server passes crypto). */
export function drawWinners<T>(ids: readonly T[], n: number, rand: (k: number) => number): T[] {
  const pool = [...ids];
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(rand(pool.length), 1)[0]);
  return out;
}

/** A join code: 8 letters and digits without the ones that look alike. */
export const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;
export function newCode(rand: (k: number) => number): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => abc[rand(abc.length)]).join("");
}
