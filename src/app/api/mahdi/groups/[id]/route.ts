import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cleanUsername, USERNAME_RE } from "@/lib/username-rules";
import { t } from "@/lib/mahdi/i18n";
import { todayIn } from "@/lib/mahdi/engine";
import { mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { groupCount, groupMembers, groupRanking, groupWorks, MAX_GROUPS, MAX_GROUP_WORKS, MAX_MEMBERS, requireGroup } from "@/lib/mahdi/server/groups";
import { archiveProject, deleteHabit, deleteProject, loadProgram, saveHabit, saveProject, seatsOf } from "@/lib/mahdi/server/group-program";
import { can, cleanPerms, grantable, isAbove, type GroupPerm, type Seat } from "@/lib/mahdi/groups/program";
import { releaseReader } from "@/lib/mahdi/server/khatma";
import { cleanText, oneOf, parseDate, requireName } from "@/lib/mahdi/server/validate";
import { createAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/** The group (members only): my seat, members (with their admin seats), the program, and the private ranking `?period=week|month&metric=score|reading`. */
export const GET = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { user, profile } = await requireProfile(req);
  const id = requireId((await params).id);
  const db = createAdminClient();
  const { group, seat } = await requireGroup(db, id, user.id);
  const q = new URL(req.url).searchParams;
  const period = q.get("period") === "month" ? "month" : "week";
  const metric = q.get("metric") === "reading" ? "reading" : "score";
  const members = await groupMembers(db, id, group.leader_id);
  const activeIds = members.filter((member) => member.status === "active").map((member) => member.userId);
  const [ranking, works, { seats, ready: seatsReady }, program] = await Promise.all([
    groupRanking(db, members, period, metric, user.id),
    groupWorks(db, id, activeIds, todayIn(profile.timeZone), user.id),
    seatsOf(db, id, group.leader_id),
    loadProgram(db, id),
  ]);
  const seatOf = new Map(seats.map((x) => [x.userId, x]));
  const nameOf = new Map(members.map((m) => [m.userId, m.displayName]));
  return NextResponse.json(
    {
      group: { id: group.id, name: group.name, isLeader: group.leader_id === user.id },
      // my seat: what I may do here, and what I may hand on to an admin under me
      me: { role: seat.role, perms: seat.role === "leader" ? grantable(seat) : seat.perms, grantable: can(seat, "admins") ? grantable(seat) : [], seatsReady },
      // the people who asked to join through the link are for the eyes of those who manage members
      requests: can(seat, "members") ? members.filter((m) => m.status === "requested").map((m) => ({ displayName: m.displayName, username: m.username, avatarUrl: m.avatarUrl })) : [],
      members: members
        .filter((m) => m.status !== "requested")
        .map((m) => {
          const s = seatOf.get(m.userId);
          const under = s ? isAbove(seat, s, seats) : m.status === "invited" && can(seat, "members");
          return {
            displayName: m.displayName,
            username: m.username,
            avatarUrl: m.avatarUrl,
            status: m.status,
            leader: m.leader,
            mine: m.userId === user.id,
            admin: s?.role === "admin",
            perms: s?.role === "admin" ? s.perms : [],
            appointedBy: s?.role === "admin" && s.appointedBy ? (nameOf.get(s.appointedBy) ?? "") : "",
            // what I may do to them: remove them (members), set their permissions (admins)
            canRemove: under && can(seat, "members"),
            canAdmin: under && can(seat, "admins") && m.status === "active" && seatsReady,
          };
        }),
      program: { ready: program.ready, projects: program.projects, habits: program.habits },
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
 *   with «الأعضاء»: invite { username } · remove { username } · approve { username } · reject { username }
 *               link (the join link's token, made when missing) · link_reset (a new one)
 *   with «البرنامج»: work_create · work_archive · project_save { projectId?, name, icon, color } · project_archive
 *               { projectId, archived } · project_delete { projectId } · habit_save { habitId?, …the habit form } · habit_delete { habitId }
 *   with «المشرفون»: admin_set { username, perms } · admin_remove { username } (only those under them)
 *   with «الإعدادات»: rename { name }
 *   the leader alone: transfer { username } · delete
 */
export const POST = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { user, profile } = await requireProfile(req);
  const id = requireId((await params).id);
  const body = await readJson(req);
  const db = createAdminClient();
  const { group, status, seat } = await requireGroup(db, id, user.id, true);
  const isLeader = group.leader_id === user.id;
  const need = (p: GroupPerm) => {
    if (status !== "active" || !can(seat, p)) throw new UserError(t.groups.admins.notAllowed, 403);
  };
  const today = todayIn(profile.timeZone);
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
      // what they were reading in «الختمة العلوية» goes back to the others (what they read stays read)
      await releaseReader(db, id, user.id);
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

  // Everything below needs a permission (the leader holds them all); some are the leader's alone
  if (status !== "active") throw new UserError(t.groups.notMember, 403);
  // a member's seat, to check that whoever acts on them stands above them
  const seatFor = async (uid: string): Promise<{ seats: Seat[]; target: Seat | null; ready: boolean }> => {
    const { seats, ready } = await seatsOf(db, id, group.leader_id);
    return { seats, ready, target: seats.find((x) => x.userId === uid) ?? null };
  };
  switch (body.action) {
    // the group's own program: projects and habits built like a person's own
    case "project_save": {
      need("program");
      return NextResponse.json({ ok: true, id: await saveProject(db, id, user.id, body) });
    }
    case "project_archive": {
      need("program");
      await archiveProject(db, id, body.projectId, body.archived !== false);
      return ok();
    }
    case "project_delete": {
      need("program");
      await deleteProject(db, id, body.projectId);
      return ok();
    }
    case "habit_save": {
      need("program");
      return NextResponse.json({ ok: true, id: await saveHabit(db, id, user.id, today, body) });
    }
    case "habit_delete": {
      need("program");
      await deleteHabit(db, id, body.habitId);
      return ok();
    }
    // the leaders under the leader: given only what the one appointing them holds, managed only from above
    case "admin_set": {
      need("admins");
      const uid = await target();
      const { seats, ready, target: who } = await seatFor(uid);
      if (!ready) throw new UserError(t.groups.admins.notReady, 503);
      if (!who || uid === user.id || !isAbove(seat, who, seats)) throw new UserError(t.groups.admins.notUnder, 403);
      const wanted = cleanPerms(body.perms);
      if (!wanted.length) throw new UserError(t.groups.admins.none, 400);
      const mine = grantable(seat);
      if (wanted.some((p) => !mine.includes(p))) throw new UserError(t.groups.admins.notAllowed, 403);
      const { error } = await db
        .from("mahdi_group_members")
        .update({ role: "admin", perms: wanted, appointed_by: who.role === "admin" ? (who.appointedBy ?? user.id) : user.id })
        .eq("group_id", id)
        .eq("user_id", uid);
      if (error) throw error;
      return ok();
    }
    case "admin_remove": {
      need("admins");
      const uid = await target();
      const { seats, target: who } = await seatFor(uid);
      if (!who || who.role !== "admin" || !isAbove(seat, who, seats)) throw new UserError(t.groups.admins.notUnder, 403);
      await db.from("mahdi_group_members").update({ role: "member", perms: [], appointed_by: null }).eq("group_id", id).eq("user_id", uid);
      // those they appointed stay admins, now under whoever removed them
      await db.from("mahdi_group_members").update({ appointed_by: user.id }).eq("group_id", id).eq("appointed_by", uid);
      return ok();
    }
  }
  switch (body.action) {
    case "work_create": {
      need("program");
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
      need("program");
      const workId = requireId(body.workId);
      const { data, error } = await db.from("mahdi_group_works").update({ active: false }).eq("id", workId).eq("group_id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new UserError(t.errors.notFound, 404);
      return ok();
    }
    case "invite": {
      need("members");
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
      need("members");
      let token = body.action === "link" ? ((await db.from("mahdi_groups").select("join_token").eq("id", id).maybeSingle()).data?.join_token as string | null) : null;
      if (!token) {
        token = randomBytes(18).toString("base64url");
        await db.from("mahdi_groups").update({ join_token: token }).eq("id", id);
      }
      return NextResponse.json({ token });
    }
    case "approve": {
      need("members");
      const uid = await target();
      if ((await membership(uid))?.status !== "requested") throw new UserError(t.groups.notFoundUser, 404);
      const { count } = await db.from("mahdi_group_members").select("user_id", { count: "exact", head: true }).eq("group_id", id).in("status", ["active", "invited"]);
      if ((count ?? 0) >= MAX_MEMBERS) throw new UserError(t.groups.limitMembers, 400);
      await db.from("mahdi_group_members").update({ status: "active", joined_at: new Date().toISOString(), invited_by: user.id }).eq("group_id", id).eq("user_id", uid);
      return ok();
    }
    case "reject": {
      need("members");
      const uid = await target();
      await db.from("mahdi_group_members").delete().eq("group_id", id).eq("user_id", uid).eq("status", "requested");
      return ok();
    }
    case "remove": {
      need("members");
      const uid = await target();
      if (uid === user.id) throw new UserError(t.groups.leaderLeave, 400);
      // an active member is removed only by someone above them (an admin only by those who appointed them, up the line)
      const { seats, target: who } = await seatFor(uid);
      if (uid === group.leader_id || (who && !isAbove(seat, who, seats))) throw new UserError(t.groups.admins.notUnder, 403);
      await db.from("mahdi_group_members").delete().eq("group_id", id).eq("user_id", uid);
      await releaseReader(db, id, uid);
      return ok();
    }
    case "transfer": {
      if (!isLeader) throw new UserError(t.groups.admins.notAllowed, 403);
      const uid = await target();
      if ((await membership(uid))?.status !== "active") throw new UserError(t.groups.notFoundUser, 404);
      await db.from("mahdi_groups").update({ leader_id: uid }).eq("id", id);
      // the new leader holds everything as leader; the old one stays on as an admin with every permission
      await db.from("mahdi_group_members").update({ role: "member", perms: [], appointed_by: null }).eq("group_id", id).eq("user_id", uid).then(() => null, () => null);
      await db.from("mahdi_group_members").update({ role: "admin", perms: grantable(seat), appointed_by: uid }).eq("group_id", id).eq("user_id", user.id).then(() => null, () => null);
      return ok();
    }
    case "rename": {
      need("settings");
      await db.from("mahdi_groups").update({ name: requireName(body.name, 40) }).eq("id", id);
      return ok();
    }
    case "delete": {
      if (!isLeader) throw new UserError(t.groups.admins.notAllowed, 403);
      await db.from("mahdi_groups").delete().eq("id", id);
      return ok();
    }
  }
  throw new UserError(t.errors.invalid, 400);
});
