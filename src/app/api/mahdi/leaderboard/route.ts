import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { getLeaderboard, getReadingBoard, MIN_GOALS, type LeaderboardPeriod } from "@/lib/mahdi/server/leaderboard";

const SHOWN = 50;

/**
 * The general ranking: `?period=week|month&metric=score|reading`. Only people who chose to appear are in it;
 * account ids are never sent.
 */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const params = new URL(req.url).searchParams;
  const period = params.get("period");
  const metric = params.get("metric") ?? "score";
  if ((period !== "week" && period !== "month") || (metric !== "score" && metric !== "reading")) throw new UserError(t.errors.invalid, 400);
  const p = period as LeaderboardPeriod;
  const all = metric === "reading" ? await getReadingBoard(p) : await getLeaderboard(p);
  const view = (e: (typeof all)[number]) => {
    const { userId, ...rest } = e;
    return { ...rest, mine: userId === user.id };
  };
  const me = all.find((e) => e.userId === user.id);
  return NextResponse.json(
    { period, metric, min: metric === "score" ? MIN_GOALS[p] : 0, total: all.length, entries: all.slice(0, SHOWN).map(view), me: me && me.rank > SHOWN ? view(me) : null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
