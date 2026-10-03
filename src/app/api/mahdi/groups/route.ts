import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { groupCount, listMyGroups, MAX_GROUPS } from "@/lib/mahdi/server/groups";
import { requireName } from "@/lib/mahdi/server/validate";
import { createAdminClient } from "@/lib/supabase/admin";

/** My groups and invitations. */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  return NextResponse.json(await listMyGroups(createAdminClient(), user.id), { headers: { "Cache-Control": "private, no-store" } });
});

/** Creates a group led by me: `{ name }`. Needs a username, so others can see who leads it. */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  const name = requireName((await readJson(req)).name, 40);
  const { data: un } = await supabase.from("site_usernames").select("username").eq("user_id", user.id).maybeSingle();
  if (!un) throw new UserError(t.username.needed, 400);
  const db = createAdminClient();
  if ((await groupCount(db, user.id)) >= MAX_GROUPS) throw new UserError(t.groups.limitGroups, 400);
  const { data: g, error } = await db.from("mahdi_groups").insert({ name, leader_id: user.id }).select("id").single();
  if (error) throw error;
  const { error: e2 } = await db.from("mahdi_group_members").insert({ group_id: g.id, user_id: user.id, status: "active", invited_by: user.id, joined_at: new Date().toISOString() });
  if (e2) {
    await db.from("mahdi_groups").delete().eq("id", g.id);
    throw e2;
  }
  return NextResponse.json({ id: g.id });
});
