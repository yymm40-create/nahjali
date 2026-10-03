import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { getLeaderboard, MIN_GOALS, type LeaderboardPeriod } from "@/lib/mahdi/server/leaderboard";

const SHOWN = 50;

/** The general ranking: `?period=week|month`. Only people who chose to appear are in it; ids are never sent. */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const period = new URL(req.url).searchParams.get("period");
  if (period !== "week" && period !== "month") throw new UserError(t.errors.invalid, 400);
  const all = await getLeaderboard(period as LeaderboardPeriod);
  const view = (e: (typeof all)[number]) => ({
    rank: e.rank,
    displayName: e.displayName,
    avatarUrl: e.avatarUrl,
    frame: e.frame,
    score: e.score,
    goals: e.goals,
    overCount: e.overCount,
    mine: e.userId === user.id,
  });
  const me = all.find((e) => e.userId === user.id);
  return NextResponse.json(
    { period, min: MIN_GOALS[period as LeaderboardPeriod], total: all.length, entries: all.slice(0, SHOWN).map(view), me: me && me.rank > SHOWN ? view(me) : null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
