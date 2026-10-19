// SERVER ONLY. «الختمة العلوية» inside a private group: the leader's settings, the current khatma, who reads what, and
// the move to the next khatma. Every function is called after requireGroup (membership checked); leader-only actions
// are checked in the route. The khatma moves on lazily, when someone opens it: a finished khatma gives way to the next
// one at its end night; an unfinished one past its night waits for the leader (extend it or close it).
import type { SupabaseClient } from "@supabase/supabase-js";
import { t } from "../i18n";
import { UserError } from "./api";
import { peopleInfo } from "./groups";
import { parseIntIn } from "./validate";
import {
  cleanRange,
  followingEnd,
  fullRange,
  portionCount,
  inRange,
  isDivision,
  isFull,
  khatmaEnd,
  overlaps,
  portionQuarters,
  portionSpan,
  portionStates,
  quarterSpan,
  rangeSize,
  type Division,
  type PortionRange,
  type PortionState,
  type Schedule,
} from "../khatma/portions";

// a table or (before 0082) a column not there yet
const MISSING = ["42P01", "42703", "PGRST204", "PGRST205"];

export interface KhatmaSettings extends Schedule {
  division: Division;
  /** the stretch of the Quran each khatma covers, in the division's portions (the whole Quran by default) */
  range: PortionRange;
  noRepeat: number;
  active: boolean;
}

interface Round {
  id: string;
  number: number;
  division: Division;
  starts_at: string;
  ends_at: string;
  status: "open" | "done" | "closed";
  finished_at: string | null;
  dedicated_to: string;
  for_soul_of: string;
  range_from: number | null;
  range_to: number | null;
}

/** The stretch a khatma covers (empty = the whole Quran). */
const roundRange = (r: { division: Division; range_from: number | null; range_to: number | null }) => cleanRange(r.division, r.range_from, r.range_to);
/** What is stored for a stretch: nothing for the whole Quran. */
const rangeCols = (d: Division, r: PortionRange) => (isFull(d, r) ? { range_from: null, range_to: null } : { range_from: r.from, range_to: r.to });

interface Claim {
  portion: number;
  from_q: number;
  to_q: number;
  from_v: number | null;
  to_v: number | null;
  user_id: string | null;
  status: "reading" | "done";
  claimed_at: string;
}

const ROUND = "id, number, division, starts_at, ends_at, status, finished_at, dedicated_to, for_soul_of, range_from, range_to";

/** The stretch of the Quran asked for (portion numbers in the division); none = the whole Quran. */
export function parsePart(d: Division, from: unknown, to: unknown): PortionRange {
  if ((from == null || from === "") && (to == null || to === "")) return fullRange(d);
  const f = parseIntIn(from, 1, portionCount(d));
  return { from: f, to: parseIntIn(to, f, portionCount(d)) };
}

/** The group's khatma settings; null = not set up yet; undefined = the tables are not there yet (migration 0080). */
export async function loadSettings(db: SupabaseClient, groupId: string): Promise<KhatmaSettings | null | undefined> {
  const { data, error } = await db.from("mahdi_khatma_settings").select("division, weeks, end_dow, end_hour, time_zone, no_repeat, active, range_from, range_to").eq("group_id", groupId).maybeSingle();
  if (error && MISSING.includes(error.code ?? "")) return undefined;
  if (error) throw error;
  if (!data) return null;
  return { division: data.division, range: cleanRange(data.division, data.range_from, data.range_to), weeks: data.weeks, endDow: data.end_dow, endHour: data.end_hour, timeZone: data.time_zone, noRepeat: data.no_repeat, active: data.active };
}

async function lastRound(db: SupabaseClient, groupId: string): Promise<Round | null> {
  const { data, error } = await db.from("mahdi_khatmas").select(ROUND).eq("group_id", groupId).order("number", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return (data as Round | null) ?? null;
}

async function claimsOf(db: SupabaseClient, khatmaId: string): Promise<Claim[]> {
  const { data, error } = await db.from("mahdi_khatma_claims").select("portion, from_q, to_q, from_v, to_v, user_id, status, claimed_at").eq("khatma_id", khatmaId);
  if (error) throw error;
  return (data ?? []) as Claim[];
}

/** A new khatma after `prev` (or the first). Two people opening it at once make it once (number is unique per group). */
async function startRound(db: SupabaseClient, groupId: string, s: KhatmaSettings, prev: Round | null, startsAt: Date, endsAt: Date) {
  const { error } = await db.from("mahdi_khatmas").insert({
    group_id: groupId,
    number: (prev?.number ?? 0) + 1,
    division: s.division,
    ...rangeCols(s.division, s.range),
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    // the dedication carries on to the next khatma; the leader changes it when they want
    dedicated_to: prev?.dedicated_to ?? "",
    for_soul_of: prev?.for_soul_of ?? "",
  });
  if (error && error.code !== "23505") throw error;
}

/**
 * Brings the group's khatma up to date and returns the current one: marks it read when every portion is read, frees
 * the portions held by people no longer in the group, and after a finished khatma's night starts the next.
 */
export async function syncKhatma(db: SupabaseClient, groupId: string, s: KhatmaSettings, activeIds: string[], now = new Date()) {
  let round = await lastRound(db, groupId);
  if (round?.status === "open") {
    const active = new Set(activeIds);
    const claims = await claimsOf(db, round.id);
    const gone = claims.filter((c) => c.status === "reading" && (!c.user_id || !active.has(c.user_id))).map((c) => c.portion);
    if (gone.length) await db.from("mahdi_khatma_claims").delete().eq("khatma_id", round.id).eq("status", "reading").in("portion", gone);
    const range = roundRange(round);
    const done = claims.filter((c) => c.status === "done" && inRange(range, c.portion)).length;
    if (done >= rangeSize(range)) {
      await db.from("mahdi_khatmas").update({ status: "done", finished_at: now.toISOString() }).eq("id", round.id).eq("status", "open");
      round = { ...round, status: "done", finished_at: now.toISOString() };
    }
  }
  if (s.active && round?.status === "done" && new Date(round.ends_at) <= now) {
    await startRound(db, groupId, s, round, new Date(round.ends_at), followingEnd(new Date(round.ends_at), now, s));
    round = await lastRound(db, groupId);
  }
  return round;
}

/** The verses I finished in the `count` khatmas before khatma number `number`: those may not be taken again yet. */
async function readBefore(db: SupabaseClient, groupId: string, me: string, number: number, count: number) {
  if (count <= 0 || number <= 1) return [];
  const { data: rounds, error } = await db.from("mahdi_khatmas").select("id").eq("group_id", groupId).lt("number", number).gte("number", number - count);
  if (error) throw error;
  if (!rounds?.length) return [];
  const { data, error: e2 } = await db.from("mahdi_khatma_claims").select("from_q, to_q, from_v, to_v").eq("user_id", me).eq("status", "done").in("khatma_id", rounds.map((r) => r.id));
  if (e2) throw e2;
  // claims kept before 0082 have only their quarters
  return (data ?? []).map((c) => (c.from_v && c.to_v ? { fromV: c.from_v as number, toV: c.to_v as number } : quarterSpan(c.from_q as number, c.to_q as number)));
}

/** Everything the khatma page shows to one member (and, for the leader, who reads what). */
export async function khatmaView(db: SupabaseClient, groupId: string, me: string, isLeader: boolean, activeIds: string[]) {
  const settings = await loadSettings(db, groupId);
  if (settings === undefined) return { ready: false as const };
  if (!settings) return { ready: true as const, settings: null, khatma: null, portions: [], history: [] };
  const round = await syncKhatma(db, groupId, settings, activeIds);
  const { data: past } = await db.from("mahdi_khatmas").select(ROUND).eq("group_id", groupId).order("number", { ascending: false }).range(round ? 1 : 0, 6);
  const history = await Promise.all(((past ?? []) as Round[]).map(async (r) => {
    const { count } = await db.from("mahdi_khatma_claims").select("portion", { count: "exact", head: true }).eq("khatma_id", r.id).eq("status", "done");
    return { number: r.number, status: r.status, division: r.division, range: roundRange(r), endsAt: r.ends_at, finishedAt: r.finished_at, done: count ?? 0, total: rangeSize(roundRange(r)), dedicatedTo: r.dedicated_to, forSoulOf: r.for_soul_of };
  }));
  if (!round) return { ready: true as const, settings, khatma: null, portions: [], history };
  const claims = await claimsOf(db, round.id);
  const range = roundRange(round);
  const states: PortionState[] = portionStates(round.division, claims.map((c) => ({ portion: c.portion, userId: c.user_id, status: c.status })), me, await readBefore(db, groupId, me, round.number, settings.noRepeat), range);
  const now = Date.now();
  let readers: { portion: number; name: string; status: "reading" | "done"; claimedAt: string }[] | undefined;
  if (isLeader) {
    const people = await peopleInfo(db, claims.map((c) => c.user_id).filter((x): x is string => !!x));
    readers = claims.sort((a, b) => a.portion - b.portion).map((c) => ({ portion: c.portion, name: (c.user_id && people.get(c.user_id)?.displayName) || "—", status: c.status, claimedAt: c.claimed_at }));
  }
  return {
    ready: true as const,
    settings,
    khatma: {
      id: round.id,
      number: round.number,
      division: round.division,
      range,
      startsAt: round.starts_at,
      endsAt: round.ends_at,
      status: round.status,
      finishedAt: round.finished_at,
      // past its night and not finished: the leader decides (extend or close)
      overdue: round.status === "open" && new Date(round.ends_at).getTime() <= now,
      dedicatedTo: round.dedicated_to,
      forSoulOf: round.for_soul_of,
      done: claims.filter((c) => c.status === "done" && inRange(range, c.portion)).length,
      reading: claims.filter((c) => c.status === "reading" && inRange(range, c.portion)).length,
      total: rangeSize(range),
    },
    portions: states,
    readers,
    history,
  };
}

/** The current khatma, kept up to date, for an action. */
async function current(db: SupabaseClient, groupId: string, activeIds: string[]) {
  const s = await loadSettings(db, groupId);
  if (!s) throw new UserError(t.khatma.notReady, 409);
  const round = await syncKhatma(db, groupId, s, activeIds);
  return { s, round };
}

/** A portion of this khatma (inside the stretch it covers). */
function requirePortion(round: Round, v: unknown) {
  const n = Number(v);
  if (!Number.isInteger(n) || !inRange(roundRange(round), n)) throw new UserError(t.errors.invalid, 400);
  return n;
}

/** A member takes a free portion (not one they read in the khatmas the leader counts back). */
export async function claimPortion(db: SupabaseClient, groupId: string, me: string, activeIds: string[], portion: unknown) {
  const { s, round } = await current(db, groupId, activeIds);
  if (!round || round.status !== "open") throw new UserError(t.khatma.notOpen, 409);
  const n = requirePortion(round, portion);
  const q = portionQuarters(round.division, n);
  const span = portionSpan(round.division, n);
  const before = await readBefore(db, groupId, me, round.number, s.noRepeat);
  if (before.some((r) => overlaps(span, r))) throw new UserError(t.khatma.readBefore(s.noRepeat), 409);
  const { error } = await db.from("mahdi_khatma_claims").insert({ khatma_id: round.id, group_id: groupId, portion: n, from_q: q.fromQ, to_q: q.toQ, from_v: span.fromV, to_v: span.toV, user_id: me, status: "reading" });
  if (error?.code === "23505") throw new UserError(t.khatma.taken, 409);
  if (error) throw error;
}

/** My portion: read (done), not read yet (back to reading), or given back (released — I backed out, read or not). */
export async function markPortion(db: SupabaseClient, groupId: string, me: string, activeIds: string[], portion: unknown, to: "done" | "reading" | "release") {
  const { round } = await current(db, groupId, activeIds);
  if (!round) throw new UserError(t.khatma.notOpen, 409);
  // a finished or closed khatma stays as it was
  if (round.status !== "open") throw new UserError(t.khatma.notOpen, 409);
  const n = requirePortion(round, portion);
  const mine = db.from("mahdi_khatma_claims");
  const { data, error } =
    to === "release"
      ? await mine.delete().eq("khatma_id", round.id).eq("portion", n).eq("user_id", me).select("portion")
      : await mine.update({ status: to, done_at: to === "done" ? new Date().toISOString() : null }).eq("khatma_id", round.id).eq("portion", n).eq("user_id", me).select("portion");
  if (error) throw error;
  if (!data?.length) throw new UserError(t.errors.notFound, 404);
  if (to === "done") await syncKhatma(db, groupId, (await loadSettings(db, groupId))!, activeIds);
}

/** The leader takes a reader off a portion (being read or marked read), so it is free for someone else. */
export async function freePortion(db: SupabaseClient, groupId: string, activeIds: string[], portion: unknown) {
  const { round } = await current(db, groupId, activeIds);
  if (!round || round.status !== "open") throw new UserError(t.khatma.notOpen, 409);
  const n = requirePortion(round, portion);
  const { data, error } = await db.from("mahdi_khatma_claims").delete().eq("khatma_id", round.id).eq("portion", n).select("portion");
  if (error) throw error;
  if (!data?.length) throw new UserError(t.errors.notFound, 404);
}

/**
 * The leader sets the khatma up (or changes it). The first khatma starts now when there is none running. A new way of
 * cutting it, or a new stretch of the Quran, applies to the running khatma only while nobody has taken a portion;
 * otherwise from the next one.
 */
export async function saveSettings(db: SupabaseClient, groupId: string, me: string, activeIds: string[], s: KhatmaSettings) {
  const old = await loadSettings(db, groupId);
  const newNight = !old || old.weeks !== s.weeks || old.endDow !== s.endDow || old.endHour !== s.endHour || old.timeZone !== s.timeZone;
  const { error } = await db.from("mahdi_khatma_settings").upsert(
    { group_id: groupId, division: s.division, ...rangeCols(s.division, s.range), weeks: s.weeks, end_dow: s.endDow, end_hour: s.endHour, time_zone: s.timeZone, no_repeat: s.noRepeat, active: true, created_by: me },
    { onConflict: "group_id" },
  );
  if (error) throw error;
  const round = await lastRound(db, groupId);
  if (!round || round.status === "closed") {
    const now = new Date();
    await startRound(db, groupId, { ...s, active: true }, round, now, khatmaEnd(now, s));
    return;
  }
  if (round.status === "open") {
    const { count } = await db.from("mahdi_khatma_claims").select("portion", { count: "exact", head: true }).eq("khatma_id", round.id);
    const patch: Record<string, string | number | null> = {};
    const r = roundRange(round);
    if (!count && (round.division !== s.division || r.from !== s.range.from || r.to !== s.range.to)) Object.assign(patch, { division: s.division, ...rangeCols(s.division, s.range) });
    // a new night moves the running khatma's end too, while it is still ahead (an end the leader extended stays otherwise)
    const end = khatmaEnd(new Date(round.starts_at), s);
    if (newNight && end.getTime() > Date.now()) patch.ends_at = end.toISOString();
    if (Object.keys(patch).length) await db.from("mahdi_khatmas").update(patch).eq("id", round.id).eq("status", "open");
  }
  await syncKhatma(db, groupId, { ...s, active: true }, activeIds);
}

/** The dedication of the running khatma: «مهداة إلى…» and «إلى روح…». */
export async function dedicate(db: SupabaseClient, groupId: string, dedicatedTo: string, forSoulOf: string) {
  const round = await lastRound(db, groupId);
  if (!round) throw new UserError(t.khatma.notOpen, 409);
  const { error } = await db.from("mahdi_khatmas").update({ dedicated_to: dedicatedTo, for_soul_of: forSoulOf }).eq("id", round.id);
  if (error) throw error;
}

/** Past its night and not finished: the leader gives it more days… */
export async function extendKhatma(db: SupabaseClient, groupId: string, activeIds: string[], days: number) {
  const { round } = await current(db, groupId, activeIds);
  if (!round || round.status !== "open") throw new UserError(t.khatma.notOpen, 409);
  const from = Math.max(Date.now(), new Date(round.ends_at).getTime());
  const { error } = await db.from("mahdi_khatmas").update({ ends_at: new Date(from + days * 86_400_000).toISOString() }).eq("id", round.id).eq("status", "open");
  if (error) throw error;
}

/**
 * …or ends it as it is and starts the next one now (ending on the usual night). Also «ابدأ الختمة التالية الآن» after a
 * finished one, before its night.
 */
export async function nextKhatma(db: SupabaseClient, groupId: string, activeIds: string[]) {
  const { s, round } = await current(db, groupId, activeIds);
  if (!round || !s.active || round.status === "closed") throw new UserError(t.khatma.notOpen, 409);
  const now = new Date();
  // a running khatma is closed only once its night has passed
  if (round.status === "open" && new Date(round.ends_at) > now) throw new UserError(t.khatma.notYet, 409);
  if (round.status === "open") {
    const { error } = await db.from("mahdi_khatmas").update({ status: "closed", finished_at: now.toISOString() }).eq("id", round.id).eq("status", "open");
    if (error) throw error;
  }
  await startRound(db, groupId, s, round, now, followingEnd(new Date(round.ends_at), now, s));
}

/** The leader stops the group's khatma: the running one is closed and no new one starts until it is set up again. */
export async function stopKhatma(db: SupabaseClient, groupId: string) {
  const round = await lastRound(db, groupId);
  if (round?.status === "open") await db.from("mahdi_khatmas").update({ status: "closed", finished_at: new Date().toISOString() }).eq("id", round.id).eq("status", "open");
  const { error } = await db.from("mahdi_khatma_settings").update({ active: false }).eq("group_id", groupId);
  if (error) throw error;
}

/** Frees what a person was reading in the group's running khatma (they left or were removed). What they read stays read. */
export async function releaseReader(db: SupabaseClient, groupId: string, userId: string) {
  const { error } = await db.from("mahdi_khatma_claims").delete().eq("group_id", groupId).eq("user_id", userId).eq("status", "reading");
  if (error && !MISSING.includes(error.code ?? "")) throw error;
}

/** The khatma of each of my groups, for the branch's front page. */
export async function myKhatmas(db: SupabaseClient, me: string, groups: { id: string; name: string; isLeader: boolean }[]) {
  const ids = groups.map((g) => g.id);
  if (!ids.length) return { ready: true, groups: [] as unknown[] };
  const { data: settings, error } = await db.from("mahdi_khatma_settings").select("group_id, active").in("group_id", ids);
  if (error && MISSING.includes(error.code ?? "")) return { ready: false, groups: [] as unknown[] };
  if (error) throw error;
  const { data: rounds, error: e2 } = await db.from("mahdi_khatmas").select("id, group_id, number, division, ends_at, status, range_from, range_to").in("group_id", ids).order("number", { ascending: false });
  if (e2 && MISSING.includes(e2.code ?? "")) return { ready: false, groups: [] as unknown[] };
  if (e2) throw e2;
  const latest = new Map<string, { id: string; number: number; division: Division; ends_at: string; status: string; range_from: number | null; range_to: number | null }>();
  for (const r of rounds ?? []) if (!latest.has(r.group_id)) latest.set(r.group_id, r);
  const out = await Promise.all(groups.map(async (g) => {
    const r = latest.get(g.id);
    const on = settings?.find((x) => x.group_id === g.id)?.active ?? false;
    if (!r || !isDivision(r.division)) return { ...g, active: on, khatma: null };
    const { data: claims } = await db.from("mahdi_khatma_claims").select("user_id, status").eq("khatma_id", r.id);
    return {
      ...g,
      active: on,
      khatma: {
        number: r.number,
        status: r.status,
        endsAt: r.ends_at,
        done: (claims ?? []).filter((c) => c.status === "done").length,
        total: rangeSize(roundRange(r)),
        mine: (claims ?? []).filter((c) => c.user_id === me).length,
      },
    };
  }));
  return { ready: true, groups: out };
}
