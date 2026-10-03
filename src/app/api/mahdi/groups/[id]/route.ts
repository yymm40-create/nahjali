import { NextResponse } from "next/server";
import { cleanUsername, USERNAME_RE } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { groupCount, groupMembers, groupRanking, MAX_GROUPS, MAX_MEMBERS, requireGroup } from "@/lib/mahdi/server/groups";
import { requireName } from "@/lib/mahdi/server/validate";
import { createAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/** The group (members only): members, and the private ranking `?period=week|month&metric=score|reading`. */
export const GET = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { user } = await requireProfile(req);
  const id = requireId((await params).id);
  const db = createAdminClient();
  const { group } = await requireGroup(db, id, user.id);
  const q = new URL(req.url).searchParams;
  const period = q.get("period") === "month" ? "month" : "week";
  const metric = q.get("metric") === "reading" ? "reading" : "score";
  const members = await groupMembers(db, id, group.leader_id);
  const ranking = await groupRanking(db, members, period, metric, user.id);
  return NextResponse.json(
    {
      group: { id: group.id, name: group.name, isLeader: group.leader_id === user.id },
      members: members.map((m) => ({ displayName: m.displayName, username: m.username, avatarUrl: m.avatarUrl, status: m.status, leader: m.leader, mine: m.userId === user.id })),
      ranking,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});

/**
 * Group actions:
 *   anyone invited: accept · decline
 *   members: leave
 *   the leader: invite { username } · remove { username } · transfer { username } · rename { name } · delete
 */
export const POST = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { user } = await requireProfile(req);
  const id = requireId((await params).id);
  const body = await readJson(req);
  const db = createAdminClient();
  const { group, status } = await requireGroup(db, id, user.id, true);
  const isLeader = group.leader_id === user.id;
  const ok = () => NextResponse.json({ ok: true });

  // The account behind a @username (it must use «لأجل المهدي»)
  const target = async () => {
    const name = cleanUsername(typeof body.username === "string" ? body.username : "");
    if (!USERNAME_RE.test(name)) throw new UserError(t.groups.notFoundUser, 404);
    const { data } = await db.from("site_usernames").select("user_id").eq("username", name).maybeSingle();
    if (!data) throw new UserError(t.groups.notFoundUser, 404);
    const { data: prof } = await db.from("mahdi_profiles").select("user_id").eq("user_id", data.user_id).maybeSingle();
    if (!prof) throw new UserError(t.groups.notFoundUser, 404);
    return data.user_id as string;
  };
  const membership = async (uid: string) => (await db.from("mahdi_group_members").select("status").eq("group_id", id).eq("user_id", uid).maybeSingle()).data;

  switch (body.action) {
    case "accept": {
      if (status !== "invited") return ok();
      if ((await groupCount(db, user.id)) > MAX_GROUPS) throw new UserError(t.groups.limitGroups, 400);
      await db.from("mahdi_group_members").update({ status: "active", joined_at: new Date().toISOString() }).eq("group_id", id).eq("user_id", user.id);
      return ok();
    }
    case "decline":
    case "leave": {
      if (isLeader) throw new UserError(t.groups.leaderLeave, 400);
      await db.from("mahdi_group_members").delete().eq("group_id", id).eq("user_id", user.id);
      return ok();
    }
  }

  // Everything below is for the leader of an active group
  if (status !== "active" || !isLeader) throw new UserError(t.groups.notMember, 403);
  switch (body.action) {
    case "invite": {
      const uid = await target();
      if (uid === user.id) throw new UserError(t.groups.self, 400);
      if (await membership(uid)) throw new UserError(t.groups.already, 400);
      const { count } = await db.from("mahdi_group_members").select("user_id", { count: "exact", head: true }).eq("group_id", id);
      if ((count ?? 0) >= MAX_MEMBERS) throw new UserError(t.groups.limitMembers, 400);
      if ((await groupCount(db, uid)) >= MAX_GROUPS) throw new UserError(t.groups.limitGroups, 400);
      const { error } = await db.from("mahdi_group_members").insert({ group_id: id, user_id: uid, status: "invited", invited_by: user.id });
      if (error) throw error;
      return ok();
    }
    case "remove": {
      const uid = await target();
      if (uid === user.id) throw new UserError(t.groups.leaderLeave, 400);
      await db.from("mahdi_group_members").delete().eq("group_id", id).eq("user_id", uid);
      return ok();
    }
    case "transfer": {
      const uid = await target();
      if ((await membership(uid))?.status !== "active") throw new UserError(t.groups.notFoundUser, 404);
      await db.from("mahdi_groups").update({ leader_id: uid }).eq("id", id);
      return ok();
    }
    case "rename": {
      await db.from("mahdi_groups").update({ name: requireName(body.name, 40) }).eq("id", id);
      return ok();
    }
    case "delete": {
      await db.from("mahdi_groups").delete().eq("id", id);
      return ok();
    }
  }
  throw new UserError(t.errors.invalid, 400);
});
