import { NextResponse } from "next/server";
import { todayIn } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { check, mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { getChallengeRanking } from "@/lib/mahdi/server/leaderboard";
import { parseBool } from "@/lib/mahdi/server/validate";

type Ctx = { params: Promise<{ id: string }> };

const MAX_ACTIVE = 30;

/** The ranking of one challenge (people who chose to appear in it). */
export const GET = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireProfile(req);
  const id = requireId((await params).id);
  // Through RLS: only published challenges are visible
  const { data: def } = await supabase.from("mahdi_challenges").select("id").eq("id", id).maybeSingle();
  if (!def) throw new UserError(t.errors.notFound, 404);
  const ranking = await getChallengeRanking(id);
  return NextResponse.json(
    {
      entries: ranking.slice(0, 50).map((e) => ({ rank: e.rank, displayName: e.displayName, avatarUrl: e.avatarUrl, frame: e.frame, score: e.score, goals: e.goals, overCount: e.overCount, mine: e.userId === user.id })),
      total: ranking.length,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});

/**
 * `{ action: "join" }` · `{ action: "leave" }` · `{ action: "leaderboard", on: boolean }`.
 * Runs as the user (RLS), so nobody can change another person's membership.
 */
export const POST = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, user, profile } = await requireProfile(req);
  const id = requireId((await params).id);
  const body = await readJson(req);
  const today = todayIn(profile.timeZone);

  const { data: def } = await supabase.from("mahdi_challenges").select("id, ends_on, leaderboard").eq("id", id).maybeSingle();
  if (!def) throw new UserError(t.errors.notFound, 404);
  const { data: member } = await supabase.from("mahdi_challenge_members").select("joined_on, left_on, on_leaderboard").eq("challenge_id", id).maybeSingle();
  const active = Boolean(member && !member.left_on);

  if (body.action === "join") {
    if (active) return NextResponse.json({ ok: true });
    if (def.ends_on && def.ends_on < today) throw new UserError(t.challenges.ended, 400);
    const { count } = await supabase.from("mahdi_challenge_members").select("challenge_id", { count: "exact", head: true }).is("left_on", null);
    if ((count ?? 0) >= MAX_ACTIVE) throw new UserError(t.errors.tooMany, 400);
    // Joining again starts from today: earlier days stay saved but are not counted
    check(await supabase.from("mahdi_challenge_members").upsert({ challenge_id: id, user_id: user.id, joined_on: today, left_on: null, on_leaderboard: false }));
    return NextResponse.json({ ok: true });
  }

  if (body.action === "leave") {
    if (!active) return NextResponse.json({ ok: true });
    check(await supabase.from("mahdi_challenge_members").update({ left_on: today, on_leaderboard: false }).eq("challenge_id", id));
    return NextResponse.json({ ok: true });
  }

  if (body.action === "leaderboard") {
    if (!active) throw new UserError(t.errors.notFound, 404);
    const on = parseBool(body.on);
    if (on) {
      if (!def.leaderboard) throw new UserError(t.challenges.noRanking, 400);
      const { data: privacy } = await supabase.from("mahdi_privacy").select("community").maybeSingle();
      if (!privacy?.community) throw new UserError(t.privacy.needCommunity, 400);
    }
    check(await supabase.from("mahdi_challenge_members").update({ on_leaderboard: on }).eq("challenge_id", id));
    return NextResponse.json({ ok: true });
  }

  throw new UserError(t.errors.invalid, 400);
});

