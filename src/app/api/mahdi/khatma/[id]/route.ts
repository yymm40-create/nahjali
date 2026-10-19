import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { groupMembers, requireGroup } from "@/lib/mahdi/server/groups";
import { claimPortion, dedicate, extendKhatma, freePortion, khatmaView, markPortion, nextKhatma, saveSettings, stopKhatma } from "@/lib/mahdi/server/khatma";
import { cleanLine, oneOf, parseIntIn, parseTimeZone } from "@/lib/mahdi/server/validate";
import { DIVISIONS } from "@/lib/mahdi/khatma/portions";
import { createAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

async function setup(req: Request, params: Ctx["params"]) {
  const { user, profile } = await requireProfile(req);
  const id = requireId((await params).id);
  const db = createAdminClient();
  const { group } = await requireGroup(db, id, user.id);
  const members = await groupMembers(db, id, group.leader_id);
  const activeIds = members.filter((m) => m.status === "active").map((m) => m.userId);
  return { db, id, user, profile, group, isLeader: group.leader_id === user.id, activeIds };
}

/** The group's «الختمة العلوية» as I see it (members only). */
export const GET = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { db, id, user, group, isLeader, activeIds } = await setup(req, params);
  const view = await khatmaView(db, id, user.id, isLeader, activeIds);
  return NextResponse.json({ group: { id: group.id, name: group.name, isLeader }, ...view }, { headers: { "Cache-Control": "private, no-store" } });
});

/**
 * Khatma actions:
 *   members: claim { portion } · done { portion } · undone { portion } · release { portion }
 *   the leader: setup { division, weeks, endDow, endHour, noRepeat } · dedicate { dedicatedTo, forSoulOf } · extend { days }
 *               next (close it at its night, or start the next after a finished one) · stop · free { portion }
 */
export const POST = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { db, id, user, profile, isLeader, activeIds } = await setup(req, params);
  const body = await readJson(req);
  const ok = () => NextResponse.json({ ok: true });
  switch (body.action) {
    case "claim":
      await claimPortion(db, id, user.id, activeIds, body.portion);
      return ok();
    case "done":
    case "undone":
    case "release":
      await markPortion(db, id, user.id, activeIds, body.portion, body.action === "done" ? "done" : body.action === "undone" ? "reading" : "release");
      return ok();
  }
  if (!isLeader) throw new UserError(t.groups.notMember, 403);
  switch (body.action) {
    case "setup":
      await saveSettings(db, id, user.id, activeIds, {
        division: oneOf(body.division, DIVISIONS),
        weeks: parseIntIn(body.weeks, 1, 4),
        endDow: parseIntIn(body.endDow, 0, 6),
        endHour: parseIntIn(body.endHour, 0, 23),
        timeZone: body.timeZone ? parseTimeZone(body.timeZone) : profile.timeZone,
        noRepeat: parseIntIn(body.noRepeat, 0, 20),
        active: true,
      });
      return ok();
    case "dedicate":
      await dedicate(db, id, cleanLine(body.dedicatedTo, 120), cleanLine(body.forSoulOf, 120));
      return ok();
    case "extend":
      await extendKhatma(db, id, activeIds, parseIntIn(body.days, 1, 14));
      return ok();
    case "next":
      await nextKhatma(db, id, activeIds);
      return ok();
    case "stop":
      await stopKhatma(db, id);
      return ok();
    case "free":
      await freePortion(db, id, activeIds, body.portion);
      return ok();
  }
  throw new UserError(t.errors.invalid, 400);
});
