import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cleanUsername, USERNAME_RE } from "@/lib/username-rules";
import { t } from "@/lib/mahdi/i18n";
import { todayIn } from "@/lib/mahdi/engine";
import { mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { groupCount, groupMembers, groupRanking, groupWorks, MAX_GROUPS, MAX_GROUP_WORKS, MAX_MEMBERS, requireGroup } from "@/lib/mahdi/server/groups";
import { cleanText, oneOf, parseDate, requireName } from "@/lib/mahdi/server/validate";
import { createAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/** The group (members only): members, and the private ranking `?period=week|month&metric=score|reading`. */
export const GET = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { user, profile } = await requireProfile(req);
  const id = requireId((await params).id);
  const db = createAdminClient();
  const { group } = await requireGroup(db, id, user.id);
  const q = new URL(req.url).searchParams;
  const period = q.get("period") === "month" ? "month" : "week";
  const metric = q.get("metric") === "reading" ? "reading" : "score";
  const members = await groupMembers(db, id, group.leader_id);
  const activeIds = members.filter((member) => member.status === "active").map((member) => member.userId);
  const [ranking, works] = await Promise.all([
    groupRanking(db, members, period, metric, user.id),
    groupWorks(db, id, activeIds, todayIn(profile.timeZone), user.id),
  ]);
  return NextResponse.json(
    {
      group: { id: group.id, name: group.name, isLeader: group.leader_id === user.id },
      // the people who asked to join through the link are for the leader's eyes only
      requests: group.leader_id === user.id ? members.filter((m) => m.status === "requested").map((m) => ({ displayName: m.displayName, username: m.username, avatarUrl: m.avatarUrl })) : [],
      members: members.filter((m) => m.status !== "requested").map((m) => ({ displayName: m.displayName, username: m.username, avatarUrl: m.avatarUrl, status: m.status, leader: m.leader, mine: m.userId === user.id })),
      ranking,
      works: works ?? [],
      worksReady: works !== null,
      today: todayIn(profile.timeZone),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});

/**
 * Group actions:
 *   anyone invited: accept · decline
 *   members: leave
 *   the leader: invite { username } · remove { username } · transfer { username } · rename { name } · delete
 *               link (the join link's token, made when missing) · link_reset (a new one) · approve { username } · reject { username }
 */
export const POST = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { user, profile } = await requireProfile(req);
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
    case "work_toggle": {
      if (status !== "active") throw new UserError(t.groups.notMember, 403);
      const workId = requireId(body.workId);
      const { data: work } = await db.from("mahdi_group_works").select("id, cadence, due_date").eq("id", workId).eq("group_id", id).eq("active", true).maybeSingle();
      if (!work) throw new UserError(t.errors.notFound, 404);
      const workDate = work.cadence === "daily" ? todayIn(profile.timeZone) : work.due_date;
      if (body.done === true) {
        const { error } = await db.from("mahdi_group_work_logs").upsert(
          { work_id: workId, group_id: id, user_id: user.id, work_date: workDate, done_at: new Date().toISOString() },
          { onConflict: "work_id,user_id,work_date" },
        );
        if (error) throw error;
      } else if (body.done === false) {
        const { error } = await db.from("mahdi_group_work_logs").delete().eq("work_id", workId).eq("user_id", user.id).eq("work_date", workDate);
        if (error) throw error;
      } else {
        throw new UserError(t.errors.invalid, 400);
      }
      return ok();
    }
  }

  // Everything below is for the leader of an active group
  if (status !== "active" || !isLeader) throw new UserError(t.groups.notMember, 403);
  switch (body.action) {
    case "work_create": {
      const { count } = await db.from("mahdi_group_works").select("id", { count: "exact", head: true }).eq("group_id", id).eq("active", true);
      if ((count ?? 0) >= MAX_GROUP_WORKS) throw new UserError(t.groups.worksLimit(MAX_GROUP_WORKS), 429);
      const cadence = oneOf(body.cadence, ["daily", "once"] as const);
      const dueDate = cadence === "once" ? parseDate(body.dueDate) : null;
      const today = todayIn(profile.timeZone);
      if (dueDate && dueDate < today) throw new UserError(t.groups.workPastDate, 400);
      const { error } = await db.from("mahdi_group_works").insert({
        group_id: id,
        title: requireName(body.title, 120, t.groups.workBadTitle),
        details: cleanText(body.details, 500),
        cadence,
        due_date: dueDate,
        created_by: user.id,
      });
      if (error) throw error;
      return ok();
    }
    case "work_archive": {
      const workId = requireId(body.workId);
      const { data, error } = await db.from("mahdi_group_works").update({ active: false }).eq("id", workId).eq("group_id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new UserError(t.errors.notFound, 404);
      return ok();
    }
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
    case "link":
    case "link_reset": {
      let token = body.action === "link" ? ((await db.from("mahdi_groups").select("join_token").eq("id", id).maybeSingle()).data?.join_token as string | null) : null;
      if (!token) {
        token = randomBytes(18).toString("base64url");
        await db.from("mahdi_groups").update({ join_token: token }).eq("id", id);
      }
      return NextResponse.json({ token });
    }
    case "approve": {
      const uid = await target();
      if ((await membership(uid))?.status !== "requested") throw new UserError(t.groups.notFoundUser, 404);
      const { count } = await db.from("mahdi_group_members").select("user_id", { count: "exact", head: true }).eq("group_id", id).in("status", ["active", "invited"]);
      if ((count ?? 0) >= MAX_MEMBERS) throw new UserError(t.groups.limitMembers, 400);
      await db.from("mahdi_group_members").update({ status: "active", joined_at: new Date().toISOString(), invited_by: user.id }).eq("group_id", id).eq("user_id", uid);
      return ok();
    }
    case "reject": {
      const uid = await target();
      await db.from("mahdi_group_members").delete().eq("group_id", id).eq("user_id", uid).eq("status", "requested");
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
