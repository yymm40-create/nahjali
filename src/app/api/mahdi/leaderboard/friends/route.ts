import { NextResponse } from "next/server";
import { mahdiRoute, requireProfile } from "@/lib/mahdi/server/api";
import { getLeaderboard, MIN_GOALS } from "@/lib/mahdi/server/leaderboard";
import { friendIds } from "@/lib/mahdi/server/social";
import { kindBoard } from "@/lib/mahdi/groups/kind";

/**
 * «أنت وأصحابك هالأسبوع»: the week's ranking among my friends only (we follow each other), out of the people who chose
 * to appear in the ranking. Small like every ranking in the app: the first places and my own, never who is at the
 * bottom (the plan of 26 November 2026). Account ids are never sent.
 */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const friends = new Set(await friendIds(user.id));
  friends.add(user.id);
  const board = (await getLeaderboard("week")).filter((e) => friends.has(e.userId));
  // places among the friends only (1, 1, 3 as in the general ranking)
  const pct = (s: number) => Math.round(s * 100);
  let rank = 0;
  const ranked = board.map(({ userId, ...e }, i) => {
    if (i === 0 || pct(e.score) !== pct(board[i - 1].score)) rank = i + 1;
    return { ...e, rank, mine: userId === user.id };
  });
  const small = kindBoard(ranked);
  return NextResponse.json(
    { min: MIN_GOALS.week, friends: friends.size - 1, total: small.total, entries: small.entries, me: small.me },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
