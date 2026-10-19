import { NextResponse } from "next/server";
import { todayIn } from "@/lib/mahdi/engine";
import { can } from "@/lib/mahdi/groups/program";
import { mahdiRoute, requireId, requireProfile } from "@/lib/mahdi/server/api";
import { programStats } from "@/lib/mahdi/server/group-program";
import { peopleInfo, requireGroup } from "@/lib/mahdi/server/groups";
import { createAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * «الإحصائيات»: every member's commitment to the group's program (today, week, month, streak, each habit and project,
 * the last 12 weeks and 30 days). Those holding «الإحصائيات» (and the leader) see everyone; a member sees their own.
 */
export const GET = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { user, profile } = await requireProfile(req);
  const id = requireId((await params).id);
  const db = createAdminClient();
  const { seat } = await requireGroup(db, id, user.id);
  const all = can(seat, "stats");
  const stats = await programStats(db, id, todayIn(profile.timeZone), profile.weekStart, all ? undefined : [user.id]);
  const people = await peopleInfo(db, stats.members.map((m) => m.userId));
  return NextResponse.json(
    {
      ready: stats.ready,
      all,
      projects: stats.projects.map((p) => ({ id: p.id, name: p.name, icon: p.icon, color: p.color })),
      habits: stats.habits.map((h) => ({ id: h.id, projectId: h.projectId, name: h.name, icon: h.icon })),
      members: stats.members.map((m) => {
        const p = people.get(m.userId);
        // the account id stays on the server: the page tells members apart by a key of its own
        const { userId, ...rest } = m;
        return { ...rest, key: userId === user.id ? "me" : (p?.username || userId.slice(0, 8)), displayName: p?.displayName ?? "", username: p?.username ?? "", avatarUrl: p?.avatarUrl ?? null, mine: userId === user.id };
      }),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
