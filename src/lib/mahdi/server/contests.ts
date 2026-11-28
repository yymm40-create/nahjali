// SERVER ONLY. «مسابقة الثبات» (SQL 0137): contests, who joined with which projects, the results the organiser checks, the
// draw, and each participant's conversation with the organiser. Every read and write goes through here with the service
// role; the routes check who is asking (the organiser, a participant, or someone holding the join code).
import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CODE_RE,
  CONTEST_MAX_ENTRIES,
  CONTEST_MAX_OWNED,
  CONTEST_MESSAGE_MAX,
  canJoin,
  contestPhase,
  contestWeeks,
  drawWinners,
  entryResult,
  newCode,
  projectsLocked,
  weeksDone,
  type ContestDef,
  type EntryResult,
} from "../contests";
import { addDays, todayFor, todayIn, type ISODate } from "../engine";
import { UserError } from "./api";
import { loadHabitData } from "./bulk";
import { clockOfRow, profilesWithClock } from "./clock";
import { peopleInfo } from "./groups";
import { notify } from "./inbox";

/** The cookie that keeps a contest's code while the visitor signs up or in (a week at most). */
export const CONTEST_JOIN_COOKIE = "mahdi_cjoin";

const CT = "mahdi_contests";
const ET = "mahdi_contest_entries";
const MT = "mahdi_contest_messages";

/** True when the error says the tables of SQL 0137 are not there yet. */
export const contestsMissing = (e: unknown) => ["42P01", "PGRST205", "PGRST204", "42703"].includes((e as { code?: string } | null)?.code ?? "");
export const NOT_READY = "«مسابقة الثبات» تشتغل بعد ما يشغّل صاحب التطبيق ملف 0137. جرّب بعدين.";

interface ContestRow {
  id: string;
  owner_id: string;
  code: string;
  title: string;
  details: string;
  prize: string;
  starts_on: string;
  ends_on: string;
  threshold: number;
  min_habits: number;
  digest_weeks: number;
  end_notified: boolean;
  drawn_at: string | null;
}
export interface EntryRow {
  id: string;
  contest_id: string;
  user_id: string;
  project_ids: string[];
  joined_at: string;
  excluded: boolean;
  winner_rank: number | null;
  prize_sent_at: string | null;
  owner_read_at: string | null;
  member_read_at: string | null;
  last_message_at: string | null;
}

export interface Contest extends ContestDef {
  ownerId: string;
  code: string;
  drawnAt: string | null;
  digestWeeks: number;
  endNotified: boolean;
}

const view = (r: ContestRow): Contest => ({
  id: r.id,
  ownerId: r.owner_id,
  code: r.code,
  title: r.title,
  details: r.details,
  prize: r.prize,
  startsOn: r.starts_on,
  endsOn: r.ends_on,
  threshold: Number(r.threshold),
  minHabits: Number(r.min_habits),
  drawnAt: r.drawn_at,
  digestWeeks: Number(r.digest_weeks),
  endNotified: r.end_notified,
});

function fail(error: unknown): never {
  if (contestsMissing(error)) throw new UserError(NOT_READY, 503);
  throw error;
}

export async function getContest(db: SupabaseClient, id: string): Promise<Contest | null> {
  const { data, error } = await db.from(CT).select("*").eq("id", id).maybeSingle();
  if (error) fail(error);
  return data ? view(data as ContestRow) : null;
}

export async function contestByCode(db: SupabaseClient, code: string): Promise<Contest | null> {
  if (!CODE_RE.test(code)) return null;
  const { data, error } = await db.from(CT).select("*").eq("code", code).maybeSingle();
  if (error) fail(error);
  return data ? view(data as ContestRow) : null;
}

export async function myEntry(db: SupabaseClient, contestId: string, me: string): Promise<EntryRow | null> {
  const { data, error } = await db.from(ET).select("*").eq("contest_id", contestId).eq("user_id", me).maybeSingle();
  if (error) fail(error);
  return (data as EntryRow | null) ?? null;
}

/** The contests I run and the ones I joined (a contest is reached only through its link: none is shown to everyone). */
export async function listContests(db: SupabaseClient, me: string, today: ISODate) {
  const [owned, entries] = await Promise.all([
    db.from(CT).select("*").eq("owner_id", me).order("starts_on", { ascending: false }).limit(20),
    db.from(ET).select("contest_id, last_message_at, member_read_at").eq("user_id", me).limit(50),
  ]);
  for (const r of [owned, entries]) if (r.error) fail(r.error);
  const joinedIds = (entries.data ?? []).map((e) => e.contest_id as string);
  const joined = joinedIds.length ? ((await db.from(CT).select("*").in("id", joinedIds)).data ?? []) : [];
  const counts = await entryCounts(db, [...(owned.data ?? []), ...joined].map((r) => r.id as string));
  const card = (r: ContestRow) => {
    const c = view(r);
    const e = (entries.data ?? []).find((x) => x.contest_id === c.id);
    return {
      id: c.id,
      title: c.title,
      prize: c.prize,
      startsOn: c.startsOn,
      endsOn: c.endsOn,
      threshold: c.threshold,
      phase: contestPhase(c, today),
      participants: counts.get(c.id) ?? 0,
      unread: Boolean(e?.last_message_at && (!e.member_read_at || e.last_message_at > e.member_read_at)),
    };
  };
  return {
    owned: ((owned.data ?? []) as ContestRow[]).map(card),
    joined: (joined as ContestRow[]).map(card),
  };
}

async function entryCounts(db: SupabaseClient, ids: string[]) {
  const out = new Map<string, number>();
  const unique = [...new Set(ids)];
  if (!unique.length) return out;
  const { data } = await db.from(ET).select("contest_id").in("contest_id", unique).limit(20000);
  for (const r of data ?? []) out.set(r.contest_id as string, (out.get(r.contest_id as string) ?? 0) + 1);
  return out;
}

export async function createContest(db: SupabaseClient, me: string, v: Omit<ContestDef, "id">, today: ISODate): Promise<string> {
  const { data: mine, error } = await db.from(CT).select("id").eq("owner_id", me).gte("ends_on", today);
  if (error) fail(error);
  if ((mine ?? []).length >= CONTEST_MAX_OWNED) throw new UserError(`عندك ${CONTEST_MAX_OWNED} مسابقات ما خلصت. انتظر وحدة تخلص أو احذفها.`, 400);
  for (let tries = 0; tries < 5; tries++) {
    const row = { owner_id: me, code: newCode(randomInt), title: v.title, details: v.details, prize: v.prize, starts_on: v.startsOn, ends_on: v.endsOn, threshold: v.threshold, min_habits: v.minHabits };
    const res = await db.from(CT).insert(row).select("id").single();
    if (!res.error) return res.data.id as string;
    if ((res.error as { code?: string }).code !== "23505") fail(res.error);
  }
  throw new UserError("ما قدرنا نسوي كود للمسابقة. جرّب مرة ثانية.", 500);
}

/** The organiser edits: the words any time; the days and the bar only before the start. */
export async function updateContest(db: SupabaseClient, c: Contest, v: Omit<ContestDef, "id">, today: ISODate) {
  const started = today >= c.startsOn;
  const words = { title: v.title, details: v.details, prize: v.prize };
  const rules = started ? {} : { starts_on: v.startsOn, ends_on: v.endsOn, threshold: v.threshold, min_habits: v.minHabits };
  const { error } = await db.from(CT).update({ ...words, ...rules }).eq("id", c.id);
  if (error) fail(error);
  return started;
}

export async function deleteContest(db: SupabaseClient, c: Contest) {
  const { error } = await db.from(CT).delete().eq("id", c.id);
  if (error) fail(error);
}

/** My own live projects among `ids` (a participant can only pick their own, and not the groups' ones). */
async function ownProjects(db: SupabaseClient, me: string, ids: unknown): Promise<string[]> {
  const list = Array.isArray(ids) ? [...new Set(ids.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)))].slice(0, 30) : [];
  if (!list.length) throw new UserError("اختر مشروع واحد على الأقل من مشاريعك العبادية", 400);
  const { data, error } = await db.from("mahdi_projects").select("id").eq("user_id", me).is("archived_at", null).in("id", list);
  if (error) throw error;
  const ok = (data ?? []).map((r) => r.id as string);
  if (!ok.length) throw new UserError("ما لقينا هالمشاريع في حسابك", 400);
  return ok;
}

export async function joinContest(db: SupabaseClient, c: Contest, me: string, projectIds: unknown, today: ISODate) {
  if (c.ownerId === me) throw new UserError("أنت المنظم: ما تدخل مسابقتك", 400);
  if (!canJoin(c, today)) throw new UserError("انتهى وقت الانضمام لهالمسابقة", 400);
  const { count } = await db.from(ET).select("id", { count: "exact", head: true }).eq("contest_id", c.id);
  if ((count ?? 0) >= CONTEST_MAX_ENTRIES) throw new UserError("المسابقة اكتملت", 400);
  const projects = await ownProjects(db, me, projectIds);
  const { error } = await db.from(ET).upsert({ contest_id: c.id, user_id: me, project_ids: projects }, { onConflict: "contest_id,user_id", ignoreDuplicates: true });
  if (error) fail(error);
  const { data: names } = await db.from("mahdi_profiles").select("display_name").eq("user_id", me).maybeSingle();
  await notify([c.ownerId], { kind: "contest_join", title: `مشارك جديد في «${c.title}»`, body: names?.display_name ?? "", url: `/mahdi/contests/${c.id}` });
}

export async function setEntryProjects(db: SupabaseClient, c: Contest, entry: EntryRow, me: string, projectIds: unknown, today: ISODate) {
  if (projectsLocked(c, today)) throw new UserError("بدأت المسابقة: المشاريع ثابتة لين تخلص", 400);
  const projects = await ownProjects(db, me, projectIds);
  const { error } = await db.from(ET).update({ project_ids: projects }).eq("id", entry.id);
  if (error) fail(error);
}

export async function leaveContest(db: SupabaseClient, entry: EntryRow) {
  const { error } = await db.from(ET).delete().eq("id", entry.id);
  if (error) fail(error);
}

/** Everyone's results (or only `only`), each on their own day and week start. */
export async function contestResults(db: SupabaseClient, c: Contest, only?: string[]) {
  let q = db.from(ET).select("*").eq("contest_id", c.id).order("joined_at");
  if (only) q = q.in("user_id", only);
  const { data, error } = await q;
  if (error) fail(error);
  const entries = (data ?? []) as EntryRow[];
  const ids = entries.map((e) => e.user_id);
  const now = new Date();
  const [habitData, profiles, people] = await Promise.all([
    loadHabitData(db, ids, addDays(c.startsOn, -14)),
    ids.length ? profilesWithClock<{ user_id: string; time_zone: string; week_start: number }>(db, "user_id, time_zone, week_start", ids) : Promise.resolve({ data: [], error: null }),
    peopleInfo(db, ids),
  ]);
  const prof = new Map((profiles.data ?? []).map((p) => [p.user_id, p]));
  return entries.map((e) => {
    const p = prof.get(e.user_id);
    const today = p ? todayFor(clockOfRow(p), now) : todayIn("Asia/Riyadh", now);
    const d = habitData.get(e.user_id) ?? { habits: [], logs: {} };
    const result: EntryResult = entryResult(c, d.habits, d.logs, e.project_ids, today, p?.week_start ?? 6);
    const who = people.get(e.user_id);
    return { entry: e, result, displayName: who?.displayName ?? "", username: who?.username ?? "", avatarUrl: who?.avatarUrl ?? null };
  });
}

/** The draw: `n` winners among those who reached the bar (and were not excluded). Done again, it replaces the earlier one. */
export async function drawContest(db: SupabaseClient, c: Contest, n: number) {
  const rows = await contestResults(db, c);
  const pool = rows.filter((r) => r.result.qualified && !r.entry.excluded).map((r) => r.entry.id);
  if (!pool.length) throw new UserError("ما في أحد وصل النسبة المطلوبة", 400);
  const winners = drawWinners(pool, n, randomInt);
  const clear = await db.from(ET).update({ winner_rank: null }).eq("contest_id", c.id);
  if (clear.error) fail(clear.error);
  for (const [k, id] of winners.entries()) {
    const { error } = await db.from(ET).update({ winner_rank: k + 1 }).eq("id", id);
    if (error) fail(error);
  }
  await db.from(CT).update({ drawn_at: new Date().toISOString() }).eq("id", c.id);
  const names = winners.map((id) => rows.find((r) => r.entry.id === id)?.displayName || "مشارك").join("، ");
  const won = rows.filter((r) => winners.includes(r.entry.id)).map((r) => r.entry.user_id);
  await notify(won, { kind: "contest_won", title: `مبروك! فزت في سحب «${c.title}»`, body: "المنظم بيتواصل معك داخل التطبيق ويرسل لك الجائزة.", url: `/mahdi/contests/${c.id}` });
  await notify(
    rows.map((r) => r.entry.user_id).filter((id) => !won.includes(id)),
    { kind: "contest_draw", title: `نتيجة سحب «${c.title}»`, body: `الفايزين: ${names}. الله يتقبل من الجميع.`, url: `/mahdi/contests/${c.id}` },
  );
  return { winners: winners.length, pool: pool.length };
}

export async function setExcluded(db: SupabaseClient, c: Contest, entryId: string, excluded: boolean) {
  const { error } = await db.from(ET).update({ excluded }).eq("id", entryId).eq("contest_id", c.id);
  if (error) fail(error);
}

export async function setPrizeSent(db: SupabaseClient, c: Contest, entryId: string, sent: boolean) {
  const { error } = await db.from(ET).update({ prize_sent_at: sent ? new Date().toISOString() : null }).eq("id", entryId).eq("contest_id", c.id);
  if (error) fail(error);
}

export async function entryById(db: SupabaseClient, c: Contest, entryId: string): Promise<EntryRow | null> {
  const { data, error } = await db.from(ET).select("*").eq("id", entryId).eq("contest_id", c.id).maybeSingle();
  if (error) fail(error);
  return (data as EntryRow | null) ?? null;
}

/** A conversation (oldest first), marked read for whoever reads it. */
export async function readThread(db: SupabaseClient, entry: EntryRow, asOwner: boolean) {
  const { data, error } = await db.from(MT).select("id, from_owner, body, created_at").eq("entry_id", entry.id).order("created_at").limit(300);
  if (error) fail(error);
  await db.from(ET).update(asOwner ? { owner_read_at: new Date().toISOString() } : { member_read_at: new Date().toISOString() }).eq("id", entry.id);
  return (data ?? []).map((m) => ({ id: Number(m.id), mine: Boolean(m.from_owner) === asOwner, fromOwner: Boolean(m.from_owner), body: m.body as string, at: m.created_at as string }));
}

export async function sendMessage(db: SupabaseClient, c: Contest, entry: EntryRow, asOwner: boolean, body: unknown, senderName: string) {
  const text = typeof body === "string" ? body.trim().slice(0, CONTEST_MESSAGE_MAX) : "";
  if (!text) throw new UserError("اكتب رسالتك", 400);
  // one conversation should not flood: at most 30 messages a day from one side
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await db.from(MT).select("id", { count: "exact", head: true }).eq("entry_id", entry.id).eq("from_owner", asOwner).gte("created_at", since);
  if ((count ?? 0) >= 30) throw new UserError("وصلت حد الرسائل اليوم. كمّل بكرة.", 429);
  const { error } = await db.from(MT).insert({ entry_id: entry.id, from_owner: asOwner, body: text });
  if (error) fail(error);
  const at = new Date().toISOString();
  await db.from(ET).update(asOwner ? { last_message_at: at, owner_read_at: at } : { last_message_at: at, member_read_at: at }).eq("id", entry.id);
  await notify([asOwner ? entry.user_id : c.ownerId], {
    kind: "contest_message",
    title: asOwner ? `رسالة من منظم «${c.title}»` : `رسالة من ${senderName || "مشارك"} في «${c.title}»`,
    body: text.slice(0, 160),
    url: asOwner ? `/mahdi/contests/${c.id}?chat=1` : `/mahdi/contests/${c.id}?chat=${entry.id}`,
  });
}

/** Whether the organiser has messages they have not read, per entry. */
export const ownerUnread = (e: EntryRow) => Boolean(e.last_message_at && (!e.owner_read_at || e.last_message_at > e.owner_read_at));

/** Who may see a contest: its organiser, a participant, or whoever has its code (from its link). Nobody else, the site's owner included. */
export function canSee(c: Contest, me: { id: string }, entry: EntryRow | null, code: string | null) {
  return c.ownerId === me.id || Boolean(entry) || (code !== null && code === c.code);
}

/**
 * Run by the 15-minute dispatcher: at the end of each week of a contest the organiser gets its summary (how many are at
 * the bar), and when the contest is over everyone hears that the results are in. Each is sent once.
 */
export async function dispatchContests(db: SupabaseClient, now = new Date()) {
  const from = addDays(todayIn("Etc/GMT-14", now), -2);
  const { data, error } = await db.from(CT).select("*").gte("ends_on", from).lte("starts_on", todayIn("Etc/GMT-14", now)).limit(200);
  if (error) {
    if (contestsMissing(error)) return { ready: false, sent: 0 };
    throw error;
  }
  let sent = 0;
  for (const row of (data ?? []) as ContestRow[]) {
    const c = view(row);
    const { data: owner } = await profilesWithClock(db, "user_id, time_zone", [c.ownerId]);
    const today = owner?.[0] ? todayFor(clockOfRow(owner[0]), now) : todayIn("Asia/Riyadh", now);
    const done = weeksDone(c, today);
    const over = contestPhase(c, today) === "over";
    if (done <= c.digestWeeks && (!over || c.endNotified)) continue;
    const rows = await contestResults(db, c);
    const at = rows.filter((r) => r.result.qualified && !r.entry.excluded).length;
    if (done > c.digestWeeks) {
      const total = contestWeeks(c).length;
      await notify([c.ownerId], {
        kind: "contest_week",
        title: over ? `خلصت «${c.title}»` : `خلص الأسبوع ${done} من ${total} في «${c.title}»`,
        body: `${at} من ${rows.length} وصلوا ${c.threshold}٪ أو أكثر. افتح النتائج${over ? " وسوّ السحب" : ""}.`,
        url: `/mahdi/contests/${c.id}`,
      });
      sent++;
    }
    if (over && !c.endNotified && rows.length) {
      await notify(rows.map((r) => r.entry.user_id), {
        kind: "contest_over",
        title: `خلصت «${c.title}»`,
        body: "شوف نتيجتك، والمنظم بيعلن الفايزين بالسحب.",
        url: `/mahdi/contests/${c.id}`,
      });
      sent++;
    }
    await db.from(CT).update({ digest_weeks: Math.max(done, c.digestWeeks), end_notified: c.endNotified || over }).eq("id", c.id);
  }
  return { ready: true, sent };
}
