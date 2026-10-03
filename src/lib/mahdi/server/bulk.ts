// SERVER ONLY. Reads the data of many users at once with the service role. Only for work that has to look across users
// (the public ranking, challenge rankings, the notification dispatcher); each caller first narrows down to users who agreed to it.
import type { SupabaseClient } from "@supabase/supabase-js";
import { challengeAsHabit } from "../client/derive";
import type { Challenge, Habit } from "../types";
import { habitsFromRows, type HabitRow, type VersionRow } from "./rows";
import { selectAll } from "./snapshot";

const CHUNK = 40; // keeps `.in(...)` request URLs short

export function chunks<T>(list: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export interface UserData {
  habits: Habit[];
  /** habit id → date → value (challenge entries use "c:<id>") */
  logs: Record<string, Record<string, number>>;
}

type VersionWithUser = VersionRow & { user_id: string };
type HabitWithUser = HabitRow;

/** Personal habits and their logs since `from`, per user. Challenges are added by `addChallenges`. */
export async function loadHabitData(db: SupabaseClient, userIds: string[], from: string): Promise<Map<string, UserData>> {
  const out = new Map<string, UserData>(userIds.map((id) => [id, { habits: [], logs: {} }]));
  for (const ids of chunks(userIds)) {
    const [habits, versions, logs] = await Promise.all([
      selectAll<HabitWithUser>((a, b) => db.from("mahdi_habits").select("*").in("user_id", ids).order("id").range(a, b)),
      selectAll<VersionWithUser>((a, b) =>
        db.from("mahdi_habit_versions").select("user_id,habit_id,effective_from,measure,target,unit,freq,days,state,reason,prev_state").in("user_id", ids).order("id").range(a, b),
      ),
      selectAll<{ user_id: string; habit_id: string; log_date: string; value: number | string }>((a, b) =>
        db.from("mahdi_logs").select("user_id,habit_id,log_date,value").in("user_id", ids).gte("log_date", from).order("habit_id").order("log_date").range(a, b),
      ),
    ]);
    for (const id of ids) {
      const mine = habits.filter((h) => h.user_id === id);
      const mineIds = new Set(mine.map((h) => h.id));
      out.get(id)!.habits = habitsFromRows(mine, versions.filter((v) => mineIds.has(v.habit_id)));
    }
    for (const l of logs) {
      const d = out.get(l.user_id);
      if (d) (d.logs[l.habit_id] ??= {})[l.log_date] = Number(l.value);
    }
  }
  return out;
}

export interface ChallengeRow {
  id: string;
  section_id: string;
  title: string;
  description: string;
  rules: string;
  measure: Challenge["measure"];
  target: number | string;
  unit: string;
  freq: Challenge["freq"];
  starts_on: string;
  ends_on: string | null;
  leaderboard: boolean;
}

export const challengeFromRow = (c: ChallengeRow): Challenge => ({
  id: c.id,
  sectionId: c.section_id,
  title: c.title,
  description: c.description,
  rules: c.rules,
  measure: c.measure,
  target: Number(c.target),
  unit: c.unit,
  freq: c.freq,
  startsOn: c.starts_on,
  endsOn: c.ends_on,
  leaderboard: c.leaderboard,
});

/** Adds each user's joined challenges (as habits) and their challenge logs since `from`. */
export async function addChallenges(db: SupabaseClient, data: Map<string, UserData>, from: string): Promise<void> {
  const { data: defs, error } = await db.from("mahdi_challenges").select("*").eq("status", "published");
  if (error) throw error;
  const byId = new Map((defs as ChallengeRow[]).map((c) => [c.id, challengeFromRow(c)]));
  for (const ids of chunks([...data.keys()])) {
    const [members, logs] = await Promise.all([
      selectAll<{ user_id: string; challenge_id: string; joined_on: string; left_on: string | null }>((a, b) =>
        db.from("mahdi_challenge_members").select("user_id,challenge_id,joined_on,left_on").in("user_id", ids).order("challenge_id").order("user_id").range(a, b),
      ),
      selectAll<{ user_id: string; challenge_id: string; log_date: string; value: number | string }>((a, b) =>
        db.from("mahdi_challenge_logs").select("user_id,challenge_id,log_date,value").in("user_id", ids).gte("log_date", from).order("challenge_id").order("user_id").order("log_date").range(a, b),
      ),
    ]);
    for (const m of members) {
      const c = byId.get(m.challenge_id);
      const d = data.get(m.user_id);
      if (c && d) d.habits.push(challengeAsHabit(c, { joinedOn: m.joined_on, leftOn: m.left_on }));
    }
    for (const l of logs) {
      const d = data.get(l.user_id);
      if (d && byId.has(l.challenge_id)) (d.logs[`c:${l.challenge_id}`] ??= {})[l.log_date] = Number(l.value);
    }
  }
}
