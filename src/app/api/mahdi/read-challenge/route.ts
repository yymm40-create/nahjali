import { NextResponse } from "next/server";
import { todayIn } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { readDays, readPhase } from "@/lib/mahdi/read-challenge";
import { mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { currentReadChallenge, isReadMember, joinReadChallenge, readChallengeBoard } from "@/lib/mahdi/server/read-challenge";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** «تحدي القراءة»: the challenge, whether I joined, and (with `?board=1`) the whole list with my place. */
export const GET = mahdiRoute(async (req: Request) => {
  const { user, profile } = await requireProfile(req);
  const today = todayIn(profile.timeZone);
  const challenge = await currentReadChallenge(today);
  if (!challenge) return NextResponse.json({ challenge: null }, { headers: NO_STORE });
  const phase = readPhase(challenge, today);
  const joined = await isReadMember(challenge.id, user.id);
  const base = { challenge, phase, ...readDays(challenge, today), joined };
  if (new URL(req.url).searchParams.get("board") !== "1") return NextResponse.json(base, { headers: NO_STORE });
  const board = await readChallengeBoard(challenge.id);
  return NextResponse.json(
    {
      ...base,
      total: board.length,
      board: board.map((e) => ({ rank: e.rank, displayName: e.displayName, avatarUrl: e.avatarUrl, pages: e.pages, days: e.days, mine: e.userId === user.id })),
    },
    { headers: NO_STORE },
  );
});

/** `{ agree: true }` → joins the current challenge (only while it runs). */
export const POST = mahdiRoute(async (req: Request) => {
  const { user, profile } = await requireProfile(req);
  const body = await readJson(req);
  if (body.agree !== true) throw new UserError(t.readChallenge.agreeRequired, 400);
  const challenge = await currentReadChallenge(todayIn(profile.timeZone));
  if (!challenge) throw new UserError(t.readChallenge.notReady, 503);
  if (readPhase(challenge, todayIn(profile.timeZone)) === "over") throw new UserError(t.readChallenge.over, 400);
  await joinReadChallenge(challenge.id, user.id);
  return NextResponse.json({ ok: true });
});
