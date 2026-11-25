import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { cleanVisibility, visibilityMissing } from "@/lib/mahdi/groups/privacy";
import { groupCount, listMyGroups, MAX_GROUPS, visibilityReadyIn } from "@/lib/mahdi/server/groups";
import { requireName } from "@/lib/mahdi/server/validate";
import { createAdminClient } from "@/lib/supabase/admin";

/** My groups and invitations, and whether a new group can be made private yet (SQL 0129). */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const db = createAdminClient();
  const [list, privacyReady] = await Promise.all([listMyGroups(db, user.id), visibilityReadyIn(db)]);
  return NextResponse.json({ ...list, privacyReady }, { headers: { "Cache-Control": "private, no-store" } });
});

/**
 * Creates a group led by me: `{ name, visibility? }` — who sees each member's progress: 'all' (everyone, the default)
 * or 'leaders' (each member their own, the leaders everyone's). Needs a username, so others can see who leads it.
 */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  const body = await readJson(req);
  const name = requireName(body.name, 40);
  const visibility = cleanVisibility(body.visibility);
  const { data: un } = await supabase.from("site_usernames").select("username").eq("user_id", user.id).maybeSingle();
  if (!un) throw new UserError(t.username.needed, 400);
  const db = createAdminClient();
  if ((await groupCount(db, user.id)) >= MAX_GROUPS) throw new UserError(t.groups.limitGroups, 400);
  let created = await db.from("mahdi_groups").insert({ name, leader_id: user.id, progress_visibility: visibility }).select("id").single();
  // before SQL 0129 the choice is not kept: the group is made open, as every group was
  let privacyKept = true;
  if (visibilityMissing(created.error)) {
    privacyKept = visibility === "all";
    created = await db.from("mahdi_groups").insert({ name, leader_id: user.id }).select("id").single();
  }
  const { data: g, error } = created;
  if (error) throw error;
  const { error: e2 } = await db.from("mahdi_group_members").insert({ group_id: g.id, user_id: user.id, status: "active", invited_by: user.id, joined_at: new Date().toISOString() });
  if (e2) {
    await db.from("mahdi_groups").delete().eq("id", g.id);
    throw e2;
  }
  return NextResponse.json({ id: g.id, privacyKept });
});
