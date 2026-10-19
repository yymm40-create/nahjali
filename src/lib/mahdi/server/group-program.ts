// SERVER ONLY. «إخوة الولاية» run like their own «لأجل المهدي»: who leads under the leader and with what permissions,
// the group's projects and habits (built with the same form and options as a person's own), the members' logs of them,
// and every member's numbers. Through the service role; the callers check the seat first (see ../groups/program.ts).
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAHDI_LIMITS, PROJECT_COLORS } from "@config/mahdi";
import { addDays, maxDate, type HabitState, type ISODate } from "../engine";
import { t } from "../i18n";
import type { Habit, Project } from "../types";
import {
  clipVersions,
  cleanPerms,
  GROUP_HABIT,
  GROUP_PROJECT,
  memberStats,
  putVersion,
  readVersions,
  STATS_DAYS,
  type GroupPlan,
  type GroupProject,
  type MemberStats,
  type Seat,
} from "../groups/program";
import { UserError } from "./api";
import { chunks } from "./bulk";
import { cleanIcon, cleanLine, cleanText, oneOf, parseConfig, parseDate, parseTime, requireName } from "./validate";

export const MAX_GROUP_PROJECTS = 20;
export const MAX_GROUP_HABITS = 120;

const PT = "mahdi_group_projects";
const HT = "mahdi_group_habits";
const LT = "mahdi_group_habit_logs";

/** The tables or columns of migration 0083 are not there yet. */
export const programMissing = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST204" || e.code === "42703" || /mahdi_group_(projects|habits|habit_logs)|column .*(role|perms|appointed_by)/.test(e.message ?? ""));

const notReady = () => new UserError(t.groups.program.notReady, 503);

/** The day a member's numbers start: the day they joined (or the group was made, for its leader). */
export const joinedDay = (m: { joined_at?: string | null; created_at?: string | null }): ISODate => String(m.joined_at ?? m.created_at ?? new Date().toISOString()).slice(0, 10);

/** Every active member's seat: the leader, the admins with their permissions, the members. */
export async function seatsOf(db: SupabaseClient, groupId: string, leaderId: string): Promise<{ seats: Seat[]; ready: boolean }> {
  let ready = true;
  const read = (cols: string) => db.from("mahdi_group_members").select(cols).eq("group_id", groupId).eq("status", "active");
  let { data, error } = (await read("user_id, status, role, perms, appointed_by")) as { data: unknown[] | null; error: { code?: string; message?: string } | null };
  if (programMissing(error)) {
    ready = false;
    ({ data, error } = (await read("user_id, status")) as { data: unknown[] | null; error: { code?: string; message?: string } | null });
  }
  if (error) throw error;
  const seats = ((data ?? []) as { user_id: string; role?: string; perms?: unknown; appointed_by?: string | null }[]).map(
    (m): Seat => ({
      userId: m.user_id,
      role: m.user_id === leaderId ? "leader" : m.role === "admin" ? "admin" : "member",
      perms: m.user_id === leaderId ? [] : cleanPerms(m.perms),
      appointedBy: m.appointed_by ?? null,
    }),
  );
  return { seats, ready };
}

const projectView = (r: Record<string, unknown>): Project => ({
  id: String(r.id),
  name: String(r.name ?? ""),
  icon: String(r.icon ?? ""),
  color: (PROJECT_COLORS as readonly string[]).includes(String(r.color)) ? (r.color as Project["color"]) : "gold",
  sortOrder: Number(r.sort_order ?? 0),
  archivedAt: (r.archived_at as string | null) ?? null,
});

const habitView = (r: Record<string, unknown>): Habit => ({
  id: String(r.id),
  projectId: String(r.project_id),
  name: String(r.name ?? ""),
  icon: String(r.icon ?? ""),
  category: String(r.category ?? ""),
  notes: String(r.notes ?? ""),
  reminderTime: r.reminder_time ? String(r.reminder_time).slice(0, 5) : null,
  sortOrder: Number(r.sort_order ?? 0),
  versions: readVersions(r.versions),
});

/** The group's program as its leaders edit it: projects (archived too) and habits with their goal history. */
export async function loadProgram(db: SupabaseClient, groupId: string): Promise<{ ready: boolean; projects: Project[]; habits: Habit[] }> {
  const [p, h] = await Promise.all([
    db.from(PT).select("*").eq("group_id", groupId).order("sort_order").order("created_at"),
    db.from(HT).select("*").eq("group_id", groupId).order("sort_order").order("created_at"),
  ]);
  if (programMissing(p.error) || programMissing(h.error)) return { ready: false, projects: [], habits: [] };
  if (p.error) throw p.error;
  if (h.error) throw h.error;
  return { ready: true, projects: (p.data ?? []).map(projectView), habits: (h.data ?? []).map(habitView) };
}

async function ownProject(db: SupabaseClient, groupId: string, id: unknown) {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new UserError(t.errors.notFound, 404);
  const { data, error } = await db.from(PT).select("id, archived_at").eq("id", id).eq("group_id", groupId).maybeSingle();
  if (programMissing(error)) throw notReady();
  if (!data) throw new UserError(t.errors.notFound, 404);
  return data as { id: string; archived_at: string | null };
}

async function ownHabit(db: SupabaseClient, groupId: string, id: unknown) {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new UserError(t.errors.notFound, 404);
  const { data, error } = await db.from(HT).select("id, project_id, versions").eq("id", id).eq("group_id", groupId).maybeSingle();
  if (programMissing(error)) throw notReady();
  if (!data) throw new UserError(t.errors.notFound, 404);
  return data as { id: string; project_id: string; versions: unknown };
}

/** A project of the group: new, or its name, icon and colour changed. Returns its id. */
export async function saveProject(db: SupabaseClient, groupId: string, me: string, b: Record<string, unknown>): Promise<string> {
  const row = { name: requireName(b.name, MAHDI_LIMITS.projectNameMax), icon: cleanIcon(b.icon), color: oneOf(b.color ?? "gold", PROJECT_COLORS) };
  if (b.projectId) {
    const p = await ownProject(db, groupId, b.projectId);
    const { error } = await db.from(PT).update({ ...row, updated_at: new Date().toISOString() }).eq("id", p.id);
    if (error) throw error;
    return p.id;
  }
  const { count, error: e1 } = await db.from(PT).select("id", { count: "exact", head: true }).eq("group_id", groupId).is("archived_at", null);
  if (programMissing(e1)) throw notReady();
  if ((count ?? 0) >= MAX_GROUP_PROJECTS) throw new UserError(t.groups.program.projectsLimit(MAX_GROUP_PROJECTS), 429);
  const { data, error } = await db.from(PT).insert({ ...row, group_id: groupId, created_by: me, sort_order: count ?? 0 }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

/** A project put aside (its habits stop showing to the members; their history stays) or brought back. */
export async function archiveProject(db: SupabaseClient, groupId: string, id: unknown, archived: boolean) {
  const p = await ownProject(db, groupId, id);
  const { error } = await db.from(PT).update({ archived_at: archived ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", p.id);
  if (error) throw error;
}

/** A project and its habits gone for good, with every member's logs of them. */
export async function deleteProject(db: SupabaseClient, groupId: string, id: unknown) {
  const p = await ownProject(db, groupId, id);
  const { error } = await db.from(PT).delete().eq("id", p.id);
  if (error) throw error;
}

/**
 * A habit of the group, with the same choices as a person's own: new (from its start date), or its details changed in
 * place, moved to another project, and its goal (measure, target, unit, frequency, days) or state (active, paused,
 * archived) changed from `today` on, so the days before keep the goal they had.
 */
export async function saveHabit(db: SupabaseClient, groupId: string, me: string, today: ISODate, b: Record<string, unknown>): Promise<string> {
  const details: Record<string, unknown> = {};
  if ("name" in b || !b.habitId) details.name = requireName(b.name, MAHDI_LIMITS.habitNameMax);
  if ("icon" in b) details.icon = cleanIcon(b.icon);
  if ("category" in b) details.category = cleanLine(b.category, MAHDI_LIMITS.categoryMax);
  if ("notes" in b) details.notes = cleanText(b.notes, MAHDI_LIMITS.notesMax);
  if ("reminderTime" in b) details.reminder_time = parseTime(b.reminderTime);

  if (!b.habitId) {
    const project = await ownProject(db, groupId, b.projectId);
    if (project.archived_at) throw new UserError(t.errors.archivedProject, 409);
    const { count } = await db.from(HT).select("id", { count: "exact", head: true }).eq("group_id", groupId);
    if ((count ?? 0) >= MAX_GROUP_HABITS) throw new UserError(t.groups.program.habitsLimit(MAX_GROUP_HABITS), 429);
    const start = b.startDate ? parseDate(b.startDate) : today;
    const versions = [{ effectiveFrom: start, ...parseConfig(b), state: "active" as HabitState }];
    const { data, error } = await db
      .from(HT)
      .insert({ ...details, group_id: groupId, project_id: project.id, versions, created_by: me, sort_order: count ?? 0 })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  const habit = await ownHabit(db, groupId, b.habitId);
  if ("projectId" in b && b.projectId !== habit.project_id) {
    const target = await ownProject(db, groupId, b.projectId);
    if (target.archived_at) throw new UserError(t.errors.archivedProject, 409);
    details.project_id = target.id;
  }
  if ("config" in b || "state" in b) {
    const versions = readVersions(habit.versions);
    const latest = versions[versions.length - 1];
    if (!latest) throw new UserError(t.errors.notFound, 404);
    const config = b.config && typeof b.config === "object" ? parseConfig(b.config as Record<string, unknown>) : { measure: latest.measure, target: latest.target, unit: latest.unit, freq: latest.freq, days: latest.days };
    const state: HabitState = "state" in b ? oneOf(b.state, ["active", "paused", "archived"] as const) : latest.state;
    details.versions = putVersion(versions, { effectiveFrom: maxDate(today, versions[0].effectiveFrom), ...config, state });
  }
  if (Object.keys(details).length) {
    const { error } = await db.from(HT).update({ ...details, updated_at: new Date().toISOString() }).eq("id", habit.id);
    if (error) throw error;
  }
  return habit.id;
}

/** A habit gone for good, with every member's logs of it. */
export async function deleteHabit(db: SupabaseClient, groupId: string, id: unknown) {
  const h = await ownHabit(db, groupId, id);
  const { error } = await db.from(HT).delete().eq("id", h.id);
  if (error) throw error;
}

/** The group's habits (live projects only) and every member's logs of them from `from` on: habit → user → day → value. */
async function programLogs(db: SupabaseClient, groupId: string, from: ISODate) {
  const out = new Map<string, Record<string, Record<ISODate, number>>>();
  for (let a = 0; a < 200_000; a += 1000) {
    const { data, error } = await db.from(LT).select("habit_id, user_id, log_date, value").eq("group_id", groupId).gte("log_date", from).order("log_date").range(a, a + 999);
    if (error) break;
    for (const l of data ?? []) {
      const byUser = out.get(l.user_id) ?? {};
      (byUser[l.habit_id] ??= {})[l.log_date] = Number(l.value);
      out.set(l.user_id, byUser);
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** The members' numbers in the group's program (those of `only`, or everyone active). */
export async function programStats(
  db: SupabaseClient,
  groupId: string,
  today: ISODate,
  weekStart: number,
  only?: string[],
): Promise<{ ready: boolean; projects: Project[]; habits: Habit[]; members: MemberStats[] }> {
  const program = await loadProgram(db, groupId);
  if (!program.ready) return { ready: false, projects: [], habits: [], members: [] };
  const live = new Set(program.projects.filter((p) => !p.archivedAt).map((p) => p.id));
  const habits = program.habits.filter((h) => live.has(h.projectId));
  let q = db.from("mahdi_group_members").select("user_id, joined_at, created_at").eq("group_id", groupId).eq("status", "active");
  if (only) q = q.in("user_id", only);
  const { data: members } = await q;
  const logs = await programLogs(db, groupId, addDays(today, -STATS_DAYS - 7));
  return {
    ready: true,
    projects: program.projects.filter((p) => live.has(p.id)),
    habits,
    members: (members ?? []).map((m) => memberStats(m.user_id as string, habits, logs.get(m.user_id as string) ?? {}, joinedDay(m), today, weekStart)),
  };
}

/**
 * My groups' programs in my own app (the snapshot): their live projects as «gp:<id>», their habits as «g:<id>» starting
 * the day I joined, and my logs of them. Null when there is nothing (or migration 0083 is not there yet).
 */
export async function loadGroupPlan(db: SupabaseClient, me: string, logsFrom: ISODate): Promise<{ plan: GroupPlan; logs: Record<string, Record<ISODate, number>> } | null> {
  const { data: rows } = await db.from("mahdi_group_members").select("group_id, joined_at, created_at").eq("user_id", me).eq("status", "active");
  if (!rows?.length) return null;
  const groupIds = rows.map((r) => r.group_id as string);
  const [g, p, h] = await Promise.all([
    db.from("mahdi_groups").select("id, name").in("id", groupIds),
    db.from(PT).select("*").in("group_id", groupIds).is("archived_at", null).order("sort_order").order("created_at"),
    db.from(HT).select("*").in("group_id", groupIds).order("sort_order").order("created_at"),
  ]);
  if (programMissing(p.error) || programMissing(h.error) || !p.data?.length) return null;
  const names = new Map((g.data ?? []).map((x) => [x.id as string, x.name as string]));
  const joined = new Map(rows.map((r) => [r.group_id as string, joinedDay(r)]));
  const projects: GroupProject[] = p.data.map((r, k) => ({ ...projectView(r), id: `${GROUP_PROJECT}${r.id}`, sortOrder: 5000 + k, groupId: r.group_id as string, groupName: names.get(r.group_id as string) ?? "" }));
  const live = new Set(p.data.map((r) => r.id as string));
  const habits: Habit[] = [];
  for (const r of h.data ?? []) {
    if (!live.has(r.project_id as string)) continue;
    const v = habitView(r);
    const versions = clipVersions(v.versions, joined.get(r.group_id as string) ?? logsFrom);
    if (versions.length) habits.push({ ...v, id: `${GROUP_HABIT}${v.id}`, projectId: `${GROUP_PROJECT}${v.projectId}`, versions });
  }
  const logs: Record<string, Record<ISODate, number>> = {};
  const ids = habits.map((x) => x.id.slice(GROUP_HABIT.length));
  for (const part of chunks(ids)) {
    const { data } = await db.from(LT).select("habit_id, log_date, value").eq("user_id", me).in("habit_id", part).gte("log_date", logsFrom).limit(20000);
    for (const l of data ?? []) (logs[`${GROUP_HABIT}${l.habit_id}`] ??= {})[l.log_date] = Number(l.value);
  }
  return { plan: { projects, habits }, logs };
}

/** When each of these group habits starts for me (the day I joined, at the earliest), and its group; only groups I'm active in. */
export async function groupHabitWindows(db: SupabaseClient, me: string, habitIds: string[]) {
  const out = new Map<string, { groupId: string; start: ISODate }>();
  if (!habitIds.length) return out;
  const { data: habits, error } = await db.from(HT).select("id, group_id, project_id, versions").in("id", habitIds);
  if (error || !habits?.length) return out;
  const groupIds = [...new Set(habits.map((x) => x.group_id as string))];
  const { data: rows } = await db.from("mahdi_group_members").select("group_id, joined_at, created_at").eq("user_id", me).eq("status", "active").in("group_id", groupIds);
  const joined = new Map((rows ?? []).map((r) => [r.group_id as string, joinedDay(r)]));
  for (const x of habits) {
    const j = joined.get(x.group_id as string);
    if (!j) continue;
    const v = clipVersions(readVersions(x.versions), j);
    if (v.length) out.set(x.id as string, { groupId: x.group_id as string, start: v[0].effectiveFrom });
  }
  return out;
}

/** A member's log of a group habit: the day's total; a newer edit already saved (by its client time) wins. Returns what is kept. */
export async function setGroupLog(db: SupabaseClient, habitId: string, groupId: string, me: string, date: ISODate, value: number, clientTs: string): Promise<number> {
  const { data: cur } = await db.from(LT).select("value, client_updated_at").eq("habit_id", habitId).eq("user_id", me).eq("log_date", date).maybeSingle();
  if (cur && new Date(String(cur.client_updated_at)).getTime() > new Date(clientTs).getTime()) return Number(cur.value);
  const { error } = await db.from(LT).upsert(
    { habit_id: habitId, group_id: groupId, user_id: me, log_date: date, value, client_updated_at: clientTs, updated_at: new Date().toISOString() },
    { onConflict: "habit_id,user_id,log_date" },
  );
  if (error) throw error;
  return value;
}
