// «إخوة الولاية» run like their own «لأجل المهدي»: the leaders under the leader and what each may do, the group's own
// projects and habits (shaped like a person's own, so they log, score and chart the same way), and every member's
// numbers worked out from them. Pure functions, shared by the server and the screens.

import {
  addDays,
  buildTimeline,
  dayScore,
  dayStreak,
  maxDate,
  monthGoals,
  scoreBy,
  startOfMonth,
  startOfWeek,
  summarize,
  weekGoals,
  weekSeries,
  type ISODate,
  type Item,
  type Version,
} from "../engine";
import type { Habit, Project } from "../types";

/** What a leader under the leader («مشرف») may be given. The leader holds all of them, and alone transfers or deletes the group. */
export const GROUP_PERMS = ["program", "members", "admins", "stats", "khatma", "settings"] as const;
export type GroupPerm = (typeof GROUP_PERMS)[number];
export type GroupRole = "leader" | "admin" | "member";

export const isGroupPerm = (p: unknown): p is GroupPerm => typeof p === "string" && (GROUP_PERMS as readonly string[]).includes(p);
export const cleanPerms = (list: unknown): GroupPerm[] => (Array.isArray(list) ? GROUP_PERMS.filter((p) => list.includes(p)) : []);

export interface Seat {
  userId: string;
  role: GroupRole;
  perms: GroupPerm[];
  appointedBy: string | null;
}

/** What someone in the group may do: the leader everything, an admin what they were given, a member nothing. */
export const can = (s: Pick<Seat, "role" | "perms"> | null | undefined, p: GroupPerm) => !!s && (s.role === "leader" || (s.role === "admin" && s.perms.includes(p)));

/**
 * Whether `actor` stands above `target`: the leader above everyone; an admin above the admins they appointed and those
 * those appointed, down the line. A member who is not an admin is under any admin who manages members.
 */
export function isAbove(actor: Seat, target: Seat, seats: Seat[]): boolean {
  if (actor.userId === target.userId || target.role === "leader") return false;
  if (actor.role === "leader") return true;
  if (actor.role !== "admin") return false;
  if (target.role === "member") return true;
  const by = new Map(seats.map((s) => [s.userId, s.appointedBy]));
  let up = target.appointedBy;
  for (let k = 0; up && k < 60; k++) {
    if (up === actor.userId) return true;
    up = by.get(up) ?? null;
  }
  return false;
}

/** The permissions `actor` may hand to someone: only what they hold themselves (the leader: all). */
export const grantable = (actor: Seat): GroupPerm[] => (actor.role === "leader" ? [...GROUP_PERMS] : actor.role === "admin" ? GROUP_PERMS.filter((p) => actor.perms.includes(p)) : []);

// The group's habits in a member's own app: "g:<habit>" in a project "gp:<project>", like joined challenges ("c:<id>")
export const GROUP_HABIT = "g:";
export const GROUP_PROJECT = "gp:";
export const isGroupHabitId = (id: string) => id.startsWith(GROUP_HABIT);
export const isGroupProjectId = (id: string) => id.startsWith(GROUP_PROJECT);

/** A group's project as it shows in a member's day: its own colour and icon, with the group's name to tell it apart. */
export interface GroupProject extends Project {
  groupId: string;
  groupName: string;
}

/** The group's program in a member's app (the snapshot): its projects and habits, ready to log like their own. */
export interface GroupPlan {
  projects: GroupProject[];
  habits: Habit[];
}

/** A version for the day it takes effect: it replaces one starting that same day, otherwise it goes in order. */
export function putVersion(versions: Version[], v: Version): Version[] {
  return [...versions.filter((x) => x.effectiveFrom !== v.effectiveFrom), v].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
}

/** A habit's versions as they apply to someone who joined on `from`: nothing before it, the goal in force then starts then. */
export function clipVersions(versions: Version[], from: ISODate): Version[] {
  if (!versions.length || versions[0].effectiveFrom >= from) return versions;
  const before = versions.filter((v) => v.effectiveFrom <= from);
  const after = versions.filter((v) => v.effectiveFrom > from);
  return [{ ...before[before.length - 1], effectiveFrom: from }, ...after];
}

/** Versions read back from the database (anything malformed is dropped). */
export function readVersions(raw: unknown): Version[] {
  if (!Array.isArray(raw)) return [];
  const out: Version[] = [];
  for (const r of raw) {
    const v = r as Partial<Version> | null;
    if (!v || typeof v.effectiveFrom !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.effectiveFrom)) continue;
    if (!["check", "count", "amount"].includes(v.measure as string) || !["daily", "days", "weekly", "monthly"].includes(v.freq as string)) continue;
    out.push({
      effectiveFrom: v.effectiveFrom,
      measure: v.measure!,
      target: Number(v.target) || 1,
      unit: typeof v.unit === "string" ? v.unit : "",
      freq: v.freq!,
      days: Array.isArray(v.days) ? v.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [],
      state: v.state === "paused" || v.state === "archived" ? v.state : "active",
    });
  }
  return out.sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
}

/** One member's numbers in the group's program. Scores are 0…1 (null: nothing was due). */
export interface MemberStats {
  userId: string;
  today: number | null;
  week: number | null;
  month: number | null;
  /** consecutive days on which every goal of the day was reached */
  streak: number;
  best: number;
  /** this month: goals reached of goals counted */
  achieved: number;
  required: number;
  /** this month, each habit's score (the group's habit id, without "g:") */
  habits: Record<string, number | null>;
  /** this month, each project's score */
  projects: Record<string, number | null>;
  /** the last 12 weeks, oldest first */
  weeks: { start: ISODate; score: number | null }[];
  /** the last 30 days, oldest first */
  days: { date: ISODate; score: number | null }[];
}

export const STATS_DAYS = 90;

/**
 * A member's numbers: the group's habits (as they apply from the day the member joined) against what the member logged.
 * `logs`: habit id → day → value.
 */
export function memberStats(
  userId: string,
  habits: { id: string; projectId: string; versions: Version[] }[],
  logs: Record<string, Record<ISODate, number>>,
  joinedOn: ISODate,
  today: ISODate,
  weekStart: number,
): MemberStats {
  const items: Item[] = habits
    .map((h) => ({ id: h.id, projectId: h.projectId, versions: clipVersions(h.versions, joinedOn), logs: logs[h.id] ?? {} }))
    .filter((i) => i.versions.length);
  const from = maxDate(addDays(today, -STATS_DAYS), joinedOn);
  const tl = buildTimeline(items, from, today, { asOf: today, weekStart });
  const month = monthGoals(tl, startOfMonth(today));
  const m = summarize(month);
  const streak = dayStreak(tl, 1);
  const byHabit = scoreBy(month, (i) => i.itemId);
  const byProject = scoreBy(month, (i) => i.projectId);
  return {
    userId,
    today: dayScore(tl, today).score,
    week: summarize(weekGoals(tl, startOfWeek(today, weekStart))).score,
    month: m.score,
    streak: streak.current,
    best: streak.best,
    achieved: m.achieved,
    required: m.required,
    habits: Object.fromEntries(habits.map((h) => [h.id, byHabit.get(h.id)?.score ?? null])),
    projects: Object.fromEntries([...byProject].map(([k, v]) => [k, v.score])),
    weeks: weekSeries(tl, today, 12).map((w) => ({ start: w.weekStart, score: w.weekStart < startOfWeek(from, weekStart) ? null : w.score })),
    days: Array.from({ length: 30 }, (_, k) => {
      const d = addDays(today, k - 29);
      return { date: d, score: d < from ? null : dayScore(tl, d).score };
    }),
  };
}
