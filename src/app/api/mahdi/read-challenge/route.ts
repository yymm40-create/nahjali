import { NextResponse } from "next/server";
import { isAdmin } from "@config/site";
import { todayIn } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { readDays, readPhase } from "@/lib/mahdi/read-challenge";
import { mahdiRoute, readJson, requireProfile, UserError, UUID_RE } from "@/lib/mahdi/server/api";
import { currentReadChallenge, DAY_FLAG, isReadMember, joinReadChallenge, readChallengeBoard, readChallengeDetail, readChallengeFlags, setSessionEarlier } from "@/lib/mahdi/server/read-challenge";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** What the owner should look at for one member, or null. */
const flagOf = (f: { repeats: number; maxDay: number } | undefined) =>
  f && (f.repeats > 0 || f.maxDay > DAY_FLAG) ? { repeats: f.repeats, maxDay: Math.floor(f.maxDay) } : null;

/**
 * «تحدي القراءة»: the challenge, whether I joined, and (with `?board=1`) the whole list with my place.
 * `?detail=me` (or, for the owner, `?detail=<userId>`): every line of that member's count — what was read, from where,
 * how many pages, and what doesn't count and why.
 */
export const GET = mahdiRoute(async (req: Request) => {
  const { user, profile } = await requireProfile(req);
  const today = todayIn(profile.timeZone);
  const challenge = await currentReadChallenge(today);
  if (!challenge) return NextResponse.json({ challenge: null }, { headers: NO_STORE });
  const owner = isAdmin(user.email);
  const detail = new URL(req.url).searchParams.get("detail");
  if (detail) {
    const who = detail === "me" ? user.id : detail;
    if (who !== user.id && (!owner || !UUID_RE.test(who))) throw new UserError(t.errors.notFound, 404);
    const rows = await readChallengeDetail(challenge.id, who);
    if (!rows) throw new UserError(t.readChallenge.detailNotReady, 503);
    return NextResponse.json({ rows, owner }, { headers: NO_STORE });
  }
  const phase = readPhase(challenge, today);
  const joined = await isReadMember(challenge.id, user.id);
  const base = { challenge, phase, ...readDays(challenge, today), joined };
  if (new URL(req.url).searchParams.get("board") !== "1") return NextResponse.json(base, { headers: NO_STORE });
  const board = await readChallengeBoard(challenge.id);
  // the owner sees who to look at: repeated pages, or a very big day
  const flags = owner ? await readChallengeFlags(challenge.id) : null;
  return NextResponse.json(
    {
      ...base,
      total: board.length,
      owner,
      // the owner opens anyone's breakdown; everyone else only their own (no ids of others)
      board: board.map((e) => ({ rank: e.rank, displayName: e.displayName, avatarUrl: e.avatarUrl, pages: e.pages, days: e.days, mine: e.userId === user.id, ...(owner ? { id: e.userId, flag: flagOf(flags?.get(e.userId)) } : {}) })),
    },
    { headers: NO_STORE },
  );
});

/**
 * `{ agree: true }` → joins the current challenge (only while it runs).
 * The owner: `{ session, earlier }` → marks a member's reading session as read before (out of the challenge) or back.
 */
export const POST = mahdiRoute(async (req: Request) => {
  const { user, profile } = await requireProfile(req);
  const body = await readJson(req);
  if ("session" in body) {
    if (!isAdmin(user.email)) throw new UserError(t.errors.notFound, 404);
    const challenge = await currentReadChallenge(todayIn(profile.timeZone));
    if (!challenge || typeof body.session !== "string" || !UUID_RE.test(body.session)) throw new UserError(t.errors.invalid, 400);
    if (!(await setSessionEarlier(challenge.id, body.session, body.earlier === true))) throw new UserError(t.errors.notFound, 404);
    return NextResponse.json({ ok: true });
  }
  if (body.agree !== true) throw new UserError(t.readChallenge.agreeRequired, 400);
  const challenge = await currentReadChallenge(todayIn(profile.timeZone));
  if (!challenge) throw new UserError(t.readChallenge.notReady, 503);
  if (readPhase(challenge, todayIn(profile.timeZone)) === "over") throw new UserError(t.readChallenge.over, 400);
  await joinReadChallenge(challenge.id, user.id);
  return NextResponse.json({ ok: true });
});
