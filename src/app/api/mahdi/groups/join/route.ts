import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { groupCount, GROUP_JOIN_COOKIE, MAX_GROUPS } from "@/lib/mahdi/server/groups";
import { createAdminClient } from "@/lib/supabase/admin";

const tokenOf = (req: Request) => decodeURIComponent(req.headers.get("cookie")?.match(new RegExp(`(?:^|; )${GROUP_JOIN_COOKIE}=([^;]*)`))?.[1] ?? "");

async function groupOf(token: string) {
  if (!token) throw new UserError(t.groups.linkBad, 404);
  const db = createAdminClient();
  const { data: g } = await db.from("mahdi_groups").select("id, name, leader_id").eq("join_token", token).maybeSingle();
  if (!g) throw new UserError(t.groups.linkBad, 404);
  return { db, g: g as { id: string; name: string; leader_id: string } };
}

/** The group behind the join link the visitor opened (its name, and whether they're in already). */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const { db, g } = await groupOf(tokenOf(req));
  const { data: m } = await db.from("mahdi_group_members").select("status").eq("group_id", g.id).eq("user_id", user.id).maybeSingle();
  return NextResponse.json({ name: g.name, status: (m?.status as string | undefined) ?? null, id: g.id }, { headers: { "Cache-Control": "private, no-store" } });
});

/** Asks to join: the leader sees the request and accepts or declines it. */
export const POST = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const { db, g } = await groupOf(tokenOf(req));
  const { data: m } = await db.from("mahdi_group_members").select("status").eq("group_id", g.id).eq("user_id", user.id).maybeSingle();
  if (!m) {
    if ((await groupCount(db, user.id)) >= MAX_GROUPS) throw new UserError(t.groups.limitGroups, 400);
    const { error } = await db.from("mahdi_group_members").insert({ group_id: g.id, user_id: user.id, status: "requested" });
    if (error) throw error;
  }
  const res = NextResponse.json({ ok: true, status: m?.status ?? "requested", id: g.id });
  res.cookies.delete(GROUP_JOIN_COOKIE);
  return res;
});

/** Not now: forgets the link. */
export const DELETE = mahdiRoute(async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(GROUP_JOIN_COOKIE);
  return res;
});
