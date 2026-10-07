// SERVER ONLY. Loads everything the app needs for one user (through RLS: only their own rows).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { HISTORY_DAYS } from "@config/mahdi";
import { addDays, todayIn } from "../engine";
import type { Challenge, DayTask, NotificationSettings, Phrase, Profile, Shrine, Snapshot } from "../types";
import { DEFAULT_GOALS, loadReading, loadUsername } from "./reading";
import { habitsFromRows, projectFromRow, shrineFromRow, type HabitRow, type LogRow, type ProjectRow, type ShrineRow, type VersionRow } from "./rows";

const PAGE = 1000; // Supabase returns at most 1000 rows per request

/** Reads every page of a query. */
export async function selectAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

// The shrine catalog is public and changes rarely: keep it for 5 minutes per server instance.
let shrineCache: { at: number; list: Shrine[] } | null = null;
export async function getShrines(): Promise<Shrine[]> {
  if (shrineCache && Date.now() - shrineCache.at < 5 * 60_000) return shrineCache.list;
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.from("mahdi_shrines").select("*").order("sort_order");
  if (error) throw error;
  const list = (data as ShrineRow[]).map(shrineFromRow);
  shrineCache = { at: Date.now(), list };
  return list;
}

/** After the owner changes a shrine (other server instances catch up within the 5 minutes). */
export function forgetShrines() {
  shrineCache = null;
}

/** The shrine to show: the user's choice when it has a picture and is active, else the first active one. */
export function pickShrine(shrines: Shrine[], id: string | null | undefined): Shrine | null {
  const usable = (s: Shrine) => s.active && s.imageUrl;
  return shrines.find((s) => s.id === id && usable(s)) ?? shrines.find(usable) ?? null;
}

export async function loadSnapshot(supabase: SupabaseClient, profile: Profile): Promise<Snapshot> {
  const today = todayIn(profile.timeZone);
  const logsFrom = addDays(today, -HISTORY_DAYS);

  const [shrines, phrases, extra, reading, username, tasks, projects, habits, versions, logs] = await Promise.all([
    getShrines(),
    supabase
      .from("mahdi_phrases")
      .select("id, text, contexts")
      .order("sort_order")
      .then(({ data }) => (data ?? []) as Phrase[]),
    loadExtras(supabase, logsFrom),
    // Reading and usernames arrive with migration 0010; until it runs, the app works without them
    loadReading(supabase, profile.userId).catch(() => ({ library: [], sessions: [], goals: DEFAULT_GOALS })),
    loadUsername(supabase, profile.userId).catch(() => null),
    // «مهام اليوم» arrive with migration 0036; until it runs, the app works without them
    loadTasks(supabase, today).catch(() => null),
    selectAll<ProjectRow>((a, b) => supabase.from("mahdi_projects").select("*").order("sort_order").order("created_at").range(a, b)),
    selectAll<HabitRow>((a, b) => supabase.from("mahdi_habits").select("*").order("sort_order").order("created_at").range(a, b)),
    selectAll<VersionRow>((a, b) =>
      supabase.from("mahdi_habit_versions").select("habit_id,effective_from,measure,target,unit,freq,days,state,reason,prev_state").order("id").range(a, b),
    ),
    selectAll<LogRow>((a, b) =>
      supabase.from("mahdi_logs").select("habit_id,log_date,value").gte("log_date", logsFrom).order("habit_id").order("log_date").range(a, b),
    ),
  ]);

  const byHabit: Snapshot["logs"] = {};
  for (const l of logs) (byHabit[l.habit_id] ??= {})[l.log_date] = Number(l.value);
  // Joined challenges log like habits, under "c:<challenge id>"
  for (const [id, days] of Object.entries(extra.challenges.logs)) byHabit[`c:${id}`] = days;

  return {
    profile,
    shrines,
    phrases,
    ...extra,
    reading,
    username,
    projects: projects.map(projectFromRow),
    habits: habitsFromRows(habits, versions),
    logs: byHabit,
    logsFrom,
    today,
    tasks: tasks ?? [],
    tasksReady: tasks !== null,
  };
}

export interface TaskRow {
  id: string;
  task_date: string;
  title: string;
  at_time: string | null;
  habit_id: string | null;
  sort_order: number;
  done_at: string | null;
}
export const taskFromRow = (r: TaskRow): DayTask => ({ id: r.id, date: r.task_date, title: r.title, at: r.at_time ? r.at_time.slice(0, 5) : null, habitId: r.habit_id, sortOrder: r.sort_order, doneAt: r.done_at });

/** One day's tasks (through RLS: the user's own), timed ones first by time, then in the order they were added. */
export async function loadTasks(supabase: SupabaseClient, date: string): Promise<DayTask[]> {
  const { data, error } = await supabase.from("mahdi_day_tasks").select("id,task_date,title,at_time,habit_id,sort_order,done_at").eq("task_date", date).order("sort_order").order("created_at").limit(200);
  if (error) throw error;
  return (data as TaskRow[]).map(taskFromRow);
}

const DEFAULT_NOTIFICATIONS: NotificationSettings = { mode: "off", times: ["20:00"], quietStart: "23:00", quietEnd: "07:00", habitReminders: true };

/** Rewards, privacy, challenges and notification settings (all through RLS). */
async function loadExtras(supabase: SupabaseClient, logsFrom: string): Promise<Pick<Snapshot, "rewards" | "privacy" | "challenges" | "notifications">> {
  const [rewards, privacy, sections, list, members, clogs, notif] = await Promise.all([
    supabase.from("mahdi_user_rewards").select("milestone_id, unlocked_at, seen_at"),
    supabase.from("mahdi_privacy").select("*").maybeSingle(),
    supabase.from("mahdi_challenge_sections").select("id, name, description, icon").order("sort_order"),
    supabase.from("mahdi_challenges").select("*").order("starts_on", { ascending: false }),
    supabase.from("mahdi_challenge_members").select("challenge_id, joined_on, left_on, on_leaderboard"),
    supabase.from("mahdi_challenge_logs").select("challenge_id, log_date, value").gte("log_date", logsFrom).limit(10000),
    supabase.from("mahdi_notification_settings").select("*").maybeSingle(),
  ]);
  const logs: Record<string, Record<string, number>> = {};
  for (const l of clogs.data ?? []) (logs[l.challenge_id] ??= {})[l.log_date] = Number(l.value);
  const n = notif.data;
  return {
    rewards: (rewards.data ?? []).map((r) => ({ milestoneId: r.milestone_id, unlockedAt: r.unlocked_at, seenAt: r.seen_at })),
    privacy: {
      community: Boolean(privacy.data?.community),
      leaderboard: Boolean(privacy.data?.leaderboard),
      showAvatar: Boolean(privacy.data?.show_avatar),
      privateAccount: Boolean(privacy.data?.private_account),
      storiesInFeed: privacy.data?.stories_in_feed !== false,
    },
    challenges: {
      sections: sections.data ?? [],
      list: (list.data ?? []).map(
        (c): Challenge => ({
          id: c.id, sectionId: c.section_id, title: c.title, description: c.description, rules: c.rules, measure: c.measure,
          target: Number(c.target), unit: c.unit, freq: c.freq, startsOn: c.starts_on, endsOn: c.ends_on, leaderboard: c.leaderboard,
        }),
      ),
      memberships: (members.data ?? []).map((m) => ({ challengeId: m.challenge_id, joinedOn: m.joined_on, leftOn: m.left_on, onLeaderboard: m.on_leaderboard })),
      logs,
    },
    notifications: n
      ? { mode: n.mode, times: n.times, quietStart: n.quiet_start, quietEnd: n.quiet_end, habitReminders: n.habit_reminders }
      : DEFAULT_NOTIFICATIONS,
  };
}
