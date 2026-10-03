import { NextResponse } from "next/server";
import { buildTimeline } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { challengeHabits, toItems } from "@/lib/mahdi/client/derive";
import { buildShare, SHARE_KINDS, type ShareKind } from "@/lib/mahdi/client/share";
import { mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { loadSnapshot } from "@/lib/mahdi/server/snapshot";
import { syncPublicProfile } from "@/lib/mahdi/server/public";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE = 20;

/** The community feed (newest first), with reaction counts and whether I reacted. */
export const GET = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  const before = new URL(req.url).searchParams.get("before");
  let q = supabase.from("mahdi_posts").select("id, user_id, kind, payload, closing, created_at").is("hidden_at", null).order("created_at", { ascending: false }).limit(PAGE);
  if (before) q = q.lt("created_at", before);
  const { data: posts, error } = await q;
  if (error) throw error;
  const ids = (posts ?? []).map((p) => p.id);
  const users = [...new Set((posts ?? []).map((p) => p.user_id))];
  const [{ data: profiles }, { data: reactions }] = await Promise.all([
    users.length ? supabase.from("mahdi_public_profiles").select("user_id, display_name, avatar_url, frame").in("user_id", users) : Promise.resolve({ data: [] as never[] }),
    ids.length ? supabase.from("mahdi_post_reactions").select("post_id, user_id, kind").in("post_id", ids) : Promise.resolve({ data: [] as never[] }),
  ]);
  return NextResponse.json({
    posts: (posts ?? []).map((p) => {
      const pr = (profiles ?? []).find((x) => x.user_id === p.user_id);
      const rs = (reactions ?? []).filter((r) => r.post_id === p.id);
      return {
        id: p.id,
        mine: p.user_id === user.id,
        author: { displayName: pr?.display_name ?? "", avatarUrl: pr?.avatar_url ?? null, frame: pr?.frame ?? "" },
        kind: p.kind,
        payload: p.payload,
        closing: p.closing,
        createdAt: p.created_at,
        reactions: { dua: rs.filter((r) => r.kind === "dua").length, support: rs.filter((r) => r.kind === "support").length },
        reacted: rs.filter((r) => r.user_id === user.id).map((r) => r.kind),
      };
    }),
    more: (posts ?? []).length === PAGE,
  });
});

/** Shares an achievement. The numbers are computed here from the user's real data, never taken from the browser. */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user, profile } = await requireProfile(req);
  const { data: privacy } = await supabase.from("mahdi_privacy").select("community").maybeSingle();
  if (!privacy?.community) throw new UserError(t.share.needCommunity, 403);
  const body = await readJson(req);
  const kind = body.kind as ShareKind;
  if (!SHARE_KINDS.includes(kind)) throw new UserError(t.errors.invalid, 400);
  const closing = typeof body.closing === "string" && (t.share.closings as readonly string[]).includes(body.closing) ? body.closing : "";

  // At most 10 posts a day per person
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await supabase.from("mahdi_posts").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
  if ((count ?? 0) >= 10) throw new UserError(t.errors.rateLimited, 429);

  const snap = await loadSnapshot(supabase, profile);
  const tl = buildTimeline(toItems([...snap.habits, ...challengeHabits(snap)], snap.logs), snap.logsFrom, snap.today, { asOf: snap.today, weekStart: profile.weekStart });
  const payload = buildShare(tl, snap, {
    kind,
    showDelta: body.showDelta === true,
    projectId: typeof body.projectId === "string" ? body.projectId : undefined,
    habitId: typeof body.habitId === "string" ? body.habitId : undefined,
    milestoneId: typeof body.milestoneId === "string" ? body.milestoneId : undefined,
    bookId: typeof body.bookId === "string" ? body.bookId : undefined,
  });
  if (!payload) throw new UserError(t.reports.noData, 400);

  await syncPublicProfile(user.id);
  const { data, error } = await createAdminClient().from("mahdi_posts").insert({ user_id: user.id, kind, payload, closing }).select("id").single();
  if (error) throw error;
  return NextResponse.json({ id: data.id, payload });
});
