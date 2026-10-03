// SERVER ONLY. «إخوة الولاية»: private groups. Every read and write goes through these functions with the
// service role, and each one checks first that the caller belongs to the group (or leads it).
import type { SupabaseClient } from "@supabase/supabase-js";
import { t } from "../i18n";
import { UserError } from "./api";
import { addChallenges, chunks, loadHabitData } from "./bulk";
import { boardScore, rankEntries, rankReading, readingTotalsFor, MIN_GOALS, type LeaderboardPeriod } from "./leaderboard";
import { addDays, todayIn } from "../engine";
import { avatarUrl } from "./rows";

export const MAX_GROUPS = 5;
export const MAX_MEMBERS = 50;

export interface MemberRow {
  group_id: string;
  user_id: string;
  status: "invited" | "active";
  invited_by: string | null;
}

/** Display name, @username and (if they allow it) picture of some users. */
export async function peopleInfo(db: SupabaseClient, ids: string[]) {
  const out = new Map<string, { displayName: string; username: string; avatarUrl: string | null; tz: string }>();
  for (const part of chunks([...new Set(ids)])) {
    const [pr, un, priv] = await Promise.all([
      db.from("mahdi_profiles").select("user_id, display_name, avatar_path, time_zone, frame").in("user_id", part),
      db.from("site_usernames").select("user_id, username").in("user_id", part),
      db.from("mahdi_privacy").select("user_id, show_avatar").in("user_id", part),
    ]);
    for (const p of pr.data ?? []) {
      const showAvatar = Boolean(priv.data?.find((x) => x.user_id === p.user_id)?.show_avatar);
      out.set(p.user_id, {
        displayName: p.display_name,
        username: un.data?.find((x) => x.user_id === p.user_id)?.username ?? "",
        avatarUrl: showAvatar ? avatarUrl(p.avatar_path) : null,
        tz: p.time_zone,
      });
    }
  }
  return out;
}

/** My groups and the invitations waiting for me. */
export async function listMyGroups(db: SupabaseClient, me: string) {
  const { data: rows, error } = await db.from("mahdi_group_members").select("group_id, status, invited_by").eq("user_id", me);
  if (error) throw error;
  const ids = (rows ?? []).map((r) => r.group_id as string);
  if (!ids.length) return { groups: [], invites: [] };
  const [{ data: groups }, { data: members }] = await Promise.all([
    db.from("mahdi_groups").select("id, name, leader_id, created_at").in("id", ids),
    db.from("mahdi_group_members").select("group_id, status").in("group_id", ids),
  ]);
  const people = await peopleInfo(db, [...(groups ?? []).map((g) => g.leader_id), ...(rows ?? []).map((r) => r.invited_by).filter(Boolean)]);
  const view = (g: { id: string; name: string; leader_id: string }) => ({
    id: g.id,
    name: g.name,
    isLeader: g.leader_id === me,
    leaderName: people.get(g.leader_id)?.displayName ?? "",
    members: (members ?? []).filter((m) => m.group_id === g.id && m.status === "active").length,
  });
  const mine = (status: string) => (groups ?? []).filter((g) => rows!.some((r) => r.group_id === g.id && r.status === status));
  return {
    groups: mine("active").map(view),
    invites: mine("invited").map((g) => {
      const by = rows!.find((r) => r.group_id === g.id)?.invited_by;
      return { ...view(g), invitedBy: (by && people.get(by)?.displayName) || view(g).leaderName };
    }),
  };
}

/** The group, if I'm an active member (or, with `allowInvited`, invited). Otherwise a "not available" error. */
export async function requireGroup(db: SupabaseClient, groupId: string, me: string, allowInvited = false) {
  const [{ data: group }, { data: member }] = await Promise.all([
    db.from("mahdi_groups").select("id, name, leader_id").eq("id", groupId).maybeSingle(),
    db.from("mahdi_group_members").select("status").eq("group_id", groupId).eq("user_id", me).maybeSingle(),
  ]);
  if (!group || !member || (member.status !== "active" && !allowInvited)) throw new UserError(t.groups.notMember, 404);
  return { group: group as { id: string; name: string; leader_id: string }, status: member.status as MemberRow["status"] };
}

/** How many groups I am in or invited to. */
export async function groupCount(db: SupabaseClient, userId: string) {
  const { count } = await db.from("mahdi_group_members").select("group_id", { count: "exact", head: true }).eq("user_id", userId);
  return count ?? 0;
}

/** The members (active and invited) with names, for the group page. */
export async function groupMembers(db: SupabaseClient, groupId: string, leaderId: string) {
  const { data } = await db.from("mahdi_group_members").select("user_id, status, joined_at, created_at").eq("group_id", groupId).order("created_at");
  const people = await peopleInfo(db, (data ?? []).map((m) => m.user_id));
  return (data ?? []).map((m) => ({
    userId: m.user_id as string,
    status: m.status as MemberRow["status"],
    leader: m.user_id === leaderId,
    ...(people.get(m.user_id) ?? { displayName: "", username: "", avatarUrl: null, tz: "Asia/Riyadh" }),
  }));
}

/**
 * The group's private ranking among its active members: commitment (same rules as the general ranking, members with
 * too few goals are listed apart) or reading minutes.
 */
export async function groupRanking(db: SupabaseClient, members: Awaited<ReturnType<typeof groupMembers>>, period: LeaderboardPeriod, metric: "score" | "reading", me: string) {
  const active = members.filter((m) => m.status === "active");
  const base = (m: (typeof active)[number]) => ({ userId: m.userId, displayName: m.displayName, avatarUrl: m.avatarUrl, frame: "", username: m.username });
  const now = new Date();
  if (metric === "reading") {
    const totals = await readingTotalsFor(active.map((m) => m.userId), new Map(active.map((m) => [m.userId, m.tz])), period, now);
    const ranked = rankReading(active.map((m) => ({ ...base(m), ...(totals.get(m.userId) ?? { seconds: 0, pages: 0 }) })));
    return { ranked: ranked.map(({ userId, ...e }) => ({ ...e, mine: userId === me })), unranked: [] };
  }
  const earliest = addDays(todayIn("Etc/GMT+12", now), -45);
  const data = await loadHabitData(db, active.map((m) => m.userId), earliest);
  await addChallenges(db, data, earliest);
  const scored = active.map((m) => ({ m, s: boardScore(data.get(m.userId)!.habits, data.get(m.userId)!.logs, todayIn(m.tz, now), period) }));
  const ranked = rankEntries(scored.filter((x) => x.s).map(({ m, s }) => ({ ...base(m), ...s! })));
  return {
    ranked: ranked.map(({ userId, ...e }) => ({ ...e, username: active.find((m) => m.userId === userId)?.username, mine: userId === me })),
    unranked: scored.filter((x) => !x.s).map(({ m }) => ({ displayName: m.displayName, username: m.username, avatarUrl: m.avatarUrl, mine: m.userId === me })),
    min: MIN_GOALS[period],
  };
}
