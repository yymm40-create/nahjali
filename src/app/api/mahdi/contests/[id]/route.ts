import { NextResponse } from "next/server";
import { canJoin, cleanContest, contestDays, contestPhase, contestWeeks, CONTEST_MAX_WINNERS, projectsLocked } from "@/lib/mahdi/contests";
import { todayFor } from "@/lib/mahdi/engine";
import { mahdiRoute, readJson, requireId, requireProfile, UserError, UUID_RE } from "@/lib/mahdi/server/api";
import {
  canSee,
  contestResults,
  deleteContest,
  drawContest,
  entryById,
  getContest,
  joinContest,
  leaveContest,
  myEntry,
  ownerUnread,
  readThread,
  sendMessage,
  setEntryProjects,
  setExcluded,
  setPrizeSent,
  updateContest,
  type Contest,
} from "@/lib/mahdi/server/contests";
import { peopleInfo } from "@/lib/mahdi/server/groups";
import { createAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };
const NO_STORE = { "Cache-Control": "private, no-store" };
const notFound = () => new UserError("ما لقينا هالمسابقة", 404);

async function load(req: Request, params: Ctx["params"]) {
  const session = await requireProfile(req);
  const id = requireId((await params).id);
  const db = createAdminClient();
  const contest = await getContest(db, id);
  if (!contest) throw notFound();
  const entry = await myEntry(db, id, session.user.id);
  const owner = contest.ownerId === session.user.id;
  return { ...session, db, contest, entry, owner, today: todayFor(session.profile) };
}

const publicView = (c: Contest, today: string) => ({
  id: c.id,
  title: c.title,
  details: c.details,
  prize: c.prize,
  startsOn: c.startsOn,
  endsOn: c.endsOn,
  threshold: c.threshold,
  minHabits: c.minHabits,
  days: contestDays(c),
  weeks: contestWeeks(c).length,
  phase: contestPhase(c, today),
  joinOpen: canJoin(c, today),
  locked: projectsLocked(c, today),
  drawn: Boolean(c.drawnAt),
});

/**
 * One contest, as the person asking may see it: the rules for anyone allowed (organiser, participant, or the code from its
 * link); my own result and projects for a participant; everyone's results for the organiser.
 * `?chat=me` (a participant) or `?chat=<entry id>` (the organiser): that conversation.
 */
export const GET = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { db, contest: c, entry, owner, today, user } = await load(req, params);
  const url = new URL(req.url);
  const code = url.searchParams.get("c")?.toUpperCase() ?? null;
  if (!canSee(c, user, entry, code)) throw notFound();

  const chat = url.searchParams.get("chat");
  if (chat) {
    const e = chat === "me" ? entry : owner && UUID_RE.test(chat) ? await entryById(db, c, chat) : null;
    if (!e) throw notFound();
    return NextResponse.json({ messages: await readThread(db, e, owner && chat !== "me") }, { headers: NO_STORE });
  }

  const people = await peopleInfo(db, [c.ownerId]);
  const base = {
    contest: publicView(c, today),
    role: owner ? "owner" : entry ? "member" : "visitor",
    organizer: people.get(c.ownerId)?.displayName ?? "",
  };

  if (owner) {
    const rows = await contestResults(db, c);
    const projectIds = [...new Set(rows.flatMap((r) => r.entry.project_ids))];
    const { data: projects } = projectIds.length ? await db.from("mahdi_projects").select("id, name").in("id", projectIds) : { data: [] };
    const names = new Map((projects ?? []).map((p) => [p.id as string, p.name as string]));
    return NextResponse.json(
      {
        ...base,
        code: c.code,
        rows: rows.map((r) => ({
          key: r.entry.id,
          displayName: r.displayName,
          username: r.username,
          avatarUrl: r.avatarUrl,
          projects: r.entry.project_ids.map((id) => names.get(id)).filter(Boolean),
          ...r.result,
          excluded: r.entry.excluded,
          winnerRank: r.entry.winner_rank,
          prizeSent: Boolean(r.entry.prize_sent_at),
          unread: ownerUnread(r.entry),
          hasMessages: Boolean(r.entry.last_message_at),
        })),
      },
      { headers: NO_STORE },
    );
  }

  // the winners, once drawn, for everyone who can see the contest (joining says your name shows if you win)
  let winners: { rank: number; displayName: string }[] = [];
  if (c.drawnAt) {
    const { data } = await db.from("mahdi_contest_entries").select("user_id, winner_rank").eq("contest_id", c.id).not("winner_rank", "is", null).order("winner_rank");
    const names = await peopleInfo(db, (data ?? []).map((w) => w.user_id as string));
    winners = (data ?? []).map((w) => ({ rank: Number(w.winner_rank), displayName: names.get(w.user_id as string)?.displayName ?? "" }));
  }
  const { count } = await db.from("mahdi_contest_entries").select("id", { count: "exact", head: true }).eq("contest_id", c.id);
  let me = null;
  if (entry) {
    const [mine] = await contestResults(db, c, [user.id]);
    me = {
      projectIds: entry.project_ids,
      result: mine?.result ?? null,
      winnerRank: entry.winner_rank,
      prizeSent: Boolean(entry.prize_sent_at),
      excluded: entry.excluded,
      unread: Boolean(entry.last_message_at && (!entry.member_read_at || entry.last_message_at > entry.member_read_at)),
    };
  }
  return NextResponse.json({ ...base, participants: count ?? 0, winners, me }, { headers: NO_STORE });
});

/** What a participant or the organiser does: `{ action, … }`. */
export const POST = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { db, contest: c, entry, owner, today, user, profile } = await load(req, params);
  const b = await readJson(req);
  const code = typeof b.code === "string" ? b.code.toUpperCase() : null;
  if (!canSee(c, user, entry, code)) throw notFound();
  const ownerOnly = () => {
    if (!owner) throw notFound();
  };
  const theirEntry = async () => {
    const e = typeof b.entry === "string" && UUID_RE.test(b.entry) ? await entryById(db, c, b.entry) : null;
    if (!e) throw notFound();
    return e;
  };

  switch (b.action) {
    case "join":
      if (entry) throw new UserError("أنت منضم من قبل", 400);
      if (b.agree !== true) throw new UserError("وافق على الشروط أول", 400);
      await joinContest(db, c, user.id, b.projects, today);
      break;
    case "projects":
      if (!entry) throw notFound();
      await setEntryProjects(db, c, entry, user.id, b.projects, today);
      break;
    case "leave":
      if (!entry) throw notFound();
      await leaveContest(db, entry);
      break;
    case "send":
      if (owner) await sendMessage(db, c, await theirEntry(), true, b.body, profile.displayName);
      else if (entry) await sendMessage(db, c, entry, false, b.body, profile.displayName);
      else throw new UserError("انضم للمسابقة عشان تراسل المنظم", 400);
      break;
    case "update": {
      ownerOnly();
      const v = cleanContest({ ...b, startsOn: today >= c.startsOn ? today : b.startsOn }, today);
      if (!v.ok) throw new UserError(v.error, 400);
      const locked = await updateContest(db, c, v.value, today);
      return NextResponse.json({ ok: true, locked });
    }
    case "delete":
      ownerOnly();
      await deleteContest(db, c);
      break;
    case "draw": {
      ownerOnly();
      if (contestPhase(c, today) !== "over") throw new UserError("السحب بعد ما تخلص المسابقة", 400);
      const n = Math.round(Number(b.count));
      if (!Number.isFinite(n) || n < 1 || n > CONTEST_MAX_WINNERS) throw new UserError(`عدد الفايزين من ١ إلى ${CONTEST_MAX_WINNERS}`, 400);
      return NextResponse.json({ ok: true, ...(await drawContest(db, c, n)) });
    }
    case "exclude":
      ownerOnly();
      await setExcluded(db, c, (await theirEntry()).id, b.excluded === true);
      break;
    case "prize":
      ownerOnly();
      await setPrizeSent(db, c, (await theirEntry()).id, b.sent === true);
      break;
    default:
      throw new UserError("طلب غير معروف", 400);
  }
  return NextResponse.json({ ok: true });
});
