// Small helpers shared by the screens (no React).
import { versionAt, type ISODate, type Item, type Version } from "../engine";
import { fmtNum, joinDays, t } from "../i18n";
import { addDays, maxDate, minDate } from "../engine";
import type { Challenge, Habit, Membership, Phrase, PhraseContext, Snapshot } from "../types";

export const toItems = (habits: Habit[], logs: Snapshot["logs"]): Item[] =>
  habits.map((h) => ({ id: h.id, projectId: h.projectId, versions: h.versions, logs: logs[h.id] ?? {} }));

/** The goal in effect today, or the first one if the habit starts later. */
export function currentVersion(h: Habit, today: ISODate): Version | null {
  return versionAt({ id: h.id, projectId: h.projectId, versions: h.versions, logs: {} }, today) ?? h.versions[0] ?? null;
}

export type HabitStatus = "active" | "paused" | "archived" | "future";

export function habitStatus(h: Habit, today: ISODate): HabitStatus {
  const first = h.versions[0];
  if (!first) return "archived";
  if (first.effectiveFrom > today) return first.state === "active" ? "future" : first.state;
  return currentVersion(h, today)!.state;
}

/** «3 مرات» / «20 صفحة» */
export function quantity(v: Pick<Version, "measure" | "unit">, n: number) {
  if (v.measure === "amount") return `${fmtNum(n)} ${v.unit}`;
  if (v.measure === "count") return t.units.times(n);
  return t.units.days(n);
}

/** «20 صفحة يوميًا» · «3 مرات في الأسبوع» · «أيام السبت والاثنين» */
export function describeGoal(v: Version, weekStart: number): string {
  const d = t.habit.describe;
  const days = joinDays(v.days, weekStart);
  if (v.measure === "check") {
    if (v.freq === "daily") return d.check.daily;
    if (v.freq === "days") return d.check.days(days);
    return v.freq === "weekly" ? d.check.weekly(v.target) : d.check.monthly(v.target);
  }
  if (v.measure === "count") {
    if (v.freq === "daily") return d.count.daily(t.units.times(v.target));
    if (v.freq === "days") return d.count.days(t.units.times(v.target), days);
    return v.freq === "weekly" ? d.count.weekly(t.units.times(v.target)) : d.count.monthly(t.units.times(v.target));
  }
  const q = `${fmtNum(v.target)} ${v.unit}`;
  if (v.freq === "daily") return d.amount.daily(q);
  if (v.freq === "days") return d.amount.days(q, days);
  return v.freq === "weekly" ? d.amount.weekly(q) : d.amount.monthly(q);
}

/** Reads a typed number; accepts Arabic-Indic and Persian digits and the Arabic decimal sign. NaN if not a number. */
export function parseNumberInput(s: string): number {
  const latin = s
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/[٫,]/g, ".")
    .replace(/[^\d.]/g, "");
  return latin ? Number(latin) : NaN;
}

/** A phrase for a context, stable for the whole day (no flicker between visits). */
export function pickPhrase(phrases: Phrase[], context: PhraseContext, seed: string): Phrase | null {
  const list = phrases.filter((p) => p.contexts.includes(context));
  if (!list.length) return null;
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

/** Sort helper: by sortOrder then name. */
export const bySort = <T extends { sortOrder: number; name: string }>(a: T, b: T) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ar");

/** Only same-site paths inside the branch (for ?next= after sign-in). */
export const safeNext = (n: unknown) => (typeof n === "string" && (n === "/mahdi" || n.startsWith("/mahdi/")) && !n.startsWith("//") ? n : "/mahdi");

/** Joined unified challenges, shaped like habits (id "c:<challenge>", group "challenges") so they log and score the same way. */
export const CHALLENGE_GROUP = "challenges";

/** One joined challenge as a habit: it starts when the user joined (or the challenge started) and stops when they leave or it ends. */
export function challengeAsHabit(c: Challenge, m: Pick<Membership, "joinedOn" | "leftOn">, icon = ""): Habit {
  const from = maxDate(m.joinedOn, c.startsOn);
  const base = { measure: c.measure, target: c.target, unit: c.unit, freq: c.freq, days: [] as number[] };
  const versions: Habit["versions"] = [{ effectiveFrom: from, ...base, state: "active" }];
  const stops = [m.leftOn, c.endsOn ? addDays(c.endsOn, 1) : null].filter((x): x is string => Boolean(x));
  if (stops.length) versions.push({ effectiveFrom: maxDate(from, stops.reduce(minDate)), ...base, state: "archived" });
  if (versions.length === 2 && versions[1].effectiveFrom === from) versions.shift();
  return { id: `c:${c.id}`, projectId: CHALLENGE_GROUP, name: c.title, icon, category: "", notes: "", reminderTime: null, sortOrder: 0, versions };
}

export function challengeHabits(snap: Snapshot): Habit[] {
  const out: Habit[] = [];
  for (const m of snap.challenges.memberships) {
    const c = snap.challenges.list.find((x) => x.id === m.challengeId);
    if (c) out.push(challengeAsHabit(c, m, snap.challenges.sections.find((s) => s.id === c.sectionId)?.icon ?? ""));
  }
  return out;
}

/** The details page of a habit, or of a challenge for ids like "c:<id>". */
export const itemHref = (id: string) => (id.startsWith("c:") ? `/mahdi/challenges/${id.slice(2)}` : `/mahdi/habits/${id}`);
