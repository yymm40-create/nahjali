// SERVER ONLY. The general ranking and the challenge rankings.
//
// Rules:
//   • Only people who switched on both «الانضمام إلى المجتمع» and «الظهور في الترتيب العام» appear.
//   • The score is the mean of the person's goals, each capped at 100% (the same engine as the reports), so extra work
//     never raises it; `overCount` is shown beside it.
//   • Too few goals (7 in a week, 20 in a month) means no rank yet, so one lucky day can't top the board.
//   • Equal scores (as shown, in whole percent) share a rank: 1, 1, 3.
import { addDays, buildTimeline, monthGoals, startOfMonth, startOfWeek, summarize, todayIn, weekGoals } from "../engine";
import type { Habit } from "../types";
import { challengeAsHabit, toItems } from "../client/derive";
import { createAdminClient } from "@/lib/supabase/admin";
import { addChallenges, challengeFromRow, chunks, loadHabitData, type ChallengeRow, type UserData } from "./bulk";
import { selectAll } from "./snapshot";

export type LeaderboardPeriod = "week" | "month";

/** Fewest goals needed to appear. */
export const MIN_GOALS: Record<LeaderboardPeriod, number> = { week: 7, month: 20 };

/** The week the ranking uses for everyone, so week goals mean the same thing for all (Saturday, the app's default). */
const BOARD_WEEK_START = 6;

export interface BoardEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  frame: string;
  /** 0…1 */
  score: number;
  goals: number;
  overCount: number;
}
export interface RankedEntry extends BoardEntry {
  rank: number;
}

/** Sorts by displayed percent (highest first) and gives equal percents the same rank (1, 1, 3). */
export function rankEntries(entries: BoardEntry[]): RankedEntry[] {
  const pct = (e: BoardEntry) => Math.round(e.score * 100);
  const sorted = [...entries].sort((a, b) => pct(b) - pct(a) || b.goals - a.goals || a.displayName.localeCompare(b.displayName, "ar") || a.userId.localeCompare(b.userId));
  let rank = 0;
  return sorted.map((e, i) => {
    if (i === 0 || pct(e) !== pct(sorted[i - 1])) rank = i + 1;
    return { ...e, rank };
  });
}

/** One person's score for the period, or null when they have too few goals. Pure: used by the route and the tests. */
export function boardScore(habits: Habit[], logs: UserData["logs"], today: string, period: LeaderboardPeriod) {
  const periodStart = period === "week" ? startOfWeek(today, BOARD_WEEK_START) : startOfMonth(today);
  const from = period === "week" ? periodStart : addDays(periodStart, -6); // a month's week goals can start in the month before
  const tl = buildTimeline(toItems(habits, logs), from, today, { asOf: today, weekStart: BOARD_WEEK_START });
  const s = summarize(period === "week" ? weekGoals(tl, periodStart) : monthGoals(tl, periodStart));
  if (s.score === null || s.required < MIN_GOALS[period]) return null;
  return { score: s.score, goals: s.required, overCount: s.overCount };
}

const cache = new Map<LeaderboardPeriod, { at: number; entries: RankedEntry[] }>();
const TTL = 5 * 60_000;

/** The whole board for a period, cached in memory for 5 minutes per server instance. */
export async function getLeaderboard(period: LeaderboardPeriod): Promise<RankedEntry[]> {
  const hit = cache.get(period);
  if (hit && Date.now() - hit.at < TTL) return hit.entries;

  const db = createAdminClient();
  // Both switches must be on right now
  const { data: privacy, error } = await db.from("mahdi_privacy").select("user_id, show_avatar").eq("community", true).eq("leaderboard", true);
  if (error) throw error;
  const ids = (privacy ?? []).map((p) => p.user_id as string);
  const entries: BoardEntry[] = [];

  if (ids.length) {
    const profiles = new Map<string, { tz: string }>();
    const names = new Map<string, { displayName: string; avatarUrl: string | null; frame: string }>();
    for (const part of chunks(ids)) {
      const [pr, pub] = await Promise.all([
        db.from("mahdi_profiles").select("user_id, time_zone").in("user_id", part),
        db.from("mahdi_public_profiles").select("user_id, display_name, avatar_url, frame").in("user_id", part),
      ]);
      for (const p of pr.data ?? []) profiles.set(p.user_id, { tz: p.time_zone });
      for (const p of pub.data ?? []) names.set(p.user_id, { displayName: p.display_name, avatarUrl: p.avatar_url ?? null, frame: p.frame ?? "" });
    }
    const wanted = ids.filter((id) => profiles.has(id) && names.has(id));
    const now = new Date();
    const earliest = addDays(todayIn("Etc/GMT+12", now), -45); // far enough back for a month plus its first partial week
    const data = await loadHabitData(db, wanted, earliest);
    await addChallenges(db, data, earliest);
    for (const id of wanted) {
      const d = data.get(id)!;
      const r = boardScore(d.habits, d.logs, todayIn(profiles.get(id)!.tz, now), period);
      if (r) entries.push({ userId: id, ...names.get(id)!, ...r });
    }
  }

  const ranked = rankEntries(entries);
  cache.set(period, { at: Date.now(), entries: ranked });
  return ranked;
}


const challengeCache = new Map<string, { at: number; entries: RankedEntry[] }>();
const CHALLENGE_TTL = 2 * 60_000;

/**
 * The ranking of one unified challenge. It is computed from the challenge's own logs only (nothing from personal habits),
 * for members who joined, are still in it, and switched on «أظهرني في ترتيب هذا التحدي» while the community switch is on.
 * Same rules as the general board: every goal capped at 100%, equal percents share a rank.
 */
export async function getChallengeRanking(challengeId: string): Promise<RankedEntry[]> {
  const hit = challengeCache.get(challengeId);
  if (hit && Date.now() - hit.at < CHALLENGE_TTL) return hit.entries;

  const db = createAdminClient();
  const { data: def } = await db.from("mahdi_challenges").select("*").eq("id", challengeId).eq("status", "published").maybeSingle();
  if (!def || !def.leaderboard) return [];
  const challenge = challengeFromRow(def as ChallengeRow);

  const { data: members } = await db
    .from("mahdi_challenge_members")
    .select("user_id, joined_on, left_on")
    .eq("challenge_id", challengeId)
    .eq("on_leaderboard", true)
    .is("left_on", null);
  const entries: BoardEntry[] = [];
  const now = new Date();
  for (const part of chunks((members ?? []).map((m) => m.user_id as string))) {
    const [pr, pub, priv, logs] = await Promise.all([
      db.from("mahdi_profiles").select("user_id, time_zone").in("user_id", part),
      db.from("mahdi_public_profiles").select("user_id, display_name, avatar_url, frame").in("user_id", part),
      db.from("mahdi_privacy").select("user_id").eq("community", true).in("user_id", part),
      selectAll<{ user_id: string; log_date: string; value: number | string }>((a, b) =>
        db.from("mahdi_challenge_logs").select("user_id,log_date,value").eq("challenge_id", challengeId).in("user_id", part).order("user_id").order("log_date").range(a, b),
      ),
    ]);
    const community = new Set((priv.data ?? []).map((p) => p.user_id));
    for (const m of (members ?? []).filter((x) => part.includes(x.user_id) && community.has(x.user_id))) {
      const tz = pr.data?.find((p) => p.user_id === m.user_id)?.time_zone;
      const who = pub.data?.find((p) => p.user_id === m.user_id);
      if (!tz || !who) continue;
      const today = todayIn(tz, now);
      const habit = challengeAsHabit(challenge, { joinedOn: m.joined_on, leftOn: null });
      const first = habit.versions[0].effectiveFrom;
      if (first > today) continue;
      const mine: Record<string, number> = {};
      for (const l of logs) if (l.user_id === m.user_id) mine[l.log_date] = Number(l.value);
      const tl = buildTimeline(toItems([habit], { [habit.id]: mine }), first, today, { asOf: today, weekStart: BOARD_WEEK_START });
      const s = summarize(tl.byItem.get(habit.id) ?? []);
      if (s.score === null) continue;
      entries.push({ userId: m.user_id, displayName: who.display_name, avatarUrl: who.avatar_url ?? null, frame: who.frame ?? "", score: s.score, goals: s.required, overCount: s.overCount });
    }
  }
  const ranked = rankEntries(entries);
  challengeCache.set(challengeId, { at: Date.now(), entries: ranked });
  return ranked;
}

// ───────────────────────── reading ranking ─────────────────────────

export interface ReadingEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  frame: string;
  seconds: number;
  pages: number;
  narrations: number;
}

/** By whole minutes read (most first); equal minutes share a rank. */
export function rankReading(entries: ReadingEntry[]): (ReadingEntry & { rank: number })[] {
  const min = (e: ReadingEntry) => Math.floor(e.seconds / 60);
  const sorted = [...entries].sort((a, b) => min(b) - min(a) || b.pages + b.narrations - (a.pages + a.narrations) || a.displayName.localeCompare(b.displayName, "ar") || a.userId.localeCompare(b.userId));
  let rank = 0;
  return sorted.map((e, i) => {
    if (i === 0 || min(e) !== min(sorted[i - 1])) rank = i + 1;
    return { ...e, rank };
  });
}

/** The first day of the board's week or month for someone, in their own time zone. */
export const periodStartFor = (tz: string, period: LeaderboardPeriod, now = new Date()) => {
  const today = todayIn(tz, now);
  return { today, start: period === "week" ? startOfWeek(today, BOARD_WEEK_START) : startOfMonth(today) };
};

/** Minutes, pages and narrations read in the period by each of the given users (read with the service role). */
export async function readingTotalsFor(userIds: string[], tzOf: Map<string, string>, period: LeaderboardPeriod, now = new Date()) {
  const db = createAdminClient();
  const out = new Map<string, { seconds: number; pages: number; narrations: number }>();
  const earliest = addDays(todayIn("Etc/GMT+12", now), -32);
  for (const part of chunks(userIds)) {
    const rows = await selectAll<{ user_id: string; book_id: string; log_date: string; seconds: number; pages_count: number }>((a, b) =>
      db.from("mahdi_reading_sessions").select("user_id, book_id, log_date, seconds, pages_count").in("user_id", part).gte("log_date", earliest).order("id").range(a, b),
    );
    // Books counted by narrations add to narrations, the others to pages
    const narrationBooks = new Set<string>();
    for (const ids of chunks([...new Set(rows.map((r) => r.book_id))])) {
      const { data } = await db.from("mahdi_books").select("id").in("id", ids).eq("unit", "narration");
      for (const b of data ?? []) narrationBooks.add(b.id);
    }
    for (const r of rows) {
      const { today, start } = periodStartFor(tzOf.get(r.user_id) ?? "Asia/Riyadh", period, now);
      if (r.log_date < start || r.log_date > today) continue;
      const cur = out.get(r.user_id) ?? { seconds: 0, pages: 0, narrations: 0 };
      const isNarration = narrationBooks.has(r.book_id);
      out.set(r.user_id, {
        seconds: cur.seconds + r.seconds,
        pages: cur.pages + (isNarration ? 0 : r.pages_count),
        narrations: cur.narrations + (isNarration ? r.pages_count : 0),
      });
    }
  }
  return out;
}

const readingCache = new Map<LeaderboardPeriod, { at: number; entries: (ReadingEntry & { rank: number })[] }>();

/** The general reading ranking: people who chose to appear in the ranking, with at least one minute read. */
export async function getReadingBoard(period: LeaderboardPeriod) {
  const hit = readingCache.get(period);
  if (hit && Date.now() - hit.at < TTL) return hit.entries;
  const db = createAdminClient();
  const { data: privacy, error } = await db.from("mahdi_privacy").select("user_id").eq("community", true).eq("leaderboard", true);
  if (error) throw error;
  const ids = (privacy ?? []).map((p) => p.user_id as string);
  const tzOf = new Map<string, string>();
  const names = new Map<string, { displayName: string; avatarUrl: string | null; frame: string }>();
  for (const part of chunks(ids)) {
    const [pr, pub] = await Promise.all([
      db.from("mahdi_profiles").select("user_id, time_zone").in("user_id", part),
      db.from("mahdi_public_profiles").select("user_id, display_name, avatar_url, frame").in("user_id", part),
    ]);
    for (const p of pr.data ?? []) tzOf.set(p.user_id, p.time_zone);
    for (const p of pub.data ?? []) names.set(p.user_id, { displayName: p.display_name, avatarUrl: p.avatar_url ?? null, frame: p.frame ?? "" });
  }
  const wanted = ids.filter((id) => tzOf.has(id) && names.has(id));
  const totals = wanted.length ? await readingTotalsFor(wanted, tzOf, period) : new Map();
  const entries: ReadingEntry[] = [];
  for (const id of wanted) {
    const r = totals.get(id);
    if (r && r.seconds >= 60) entries.push({ userId: id, ...names.get(id)!, ...r });
  }
  const ranked = rankReading(entries);
  readingCache.set(period, { at: Date.now(), entries: ranked });
  return ranked;
}
