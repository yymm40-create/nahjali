// SERVER ONLY. «الختمة العلوية» · «ختمتي»: a person's own khatma (migrations 0081, 0082) — the whole Quran or a stretch
// of it, in pages, juz, hizb, half or quarter hizb. Every function takes the signed-in account's id and touches only its
// rows (the tables are server-only). In the reads, `quarter` is the portion number in the khatma's division.
import type { SupabaseClient } from "@supabase/supabase-js";
import { UserError } from "./api";
import { carriedDay } from "../khatma/mine";
import { cleanRange, inRange, isDivision, isFull, rangeSize, type Division, type PortionRange } from "../khatma/portions";

// a table or (before 0082) a column not there yet
const MISSING = ["42P01", "42703", "PGRST204", "PGRST205"];

export interface MyKhatmaRow {
  id: string;
  number: number;
  days: number;
  started_on: string;
  status: "open" | "done" | "stopped";
  finished_on: string | null;
  dedicated_to: string;
  for_soul_of: string;
  habit_id: string | null;
  unit: string;
  range_from: number | null;
  range_to: number | null;
}
const COLS = "id, number, days, started_on, status, finished_on, dedicated_to, for_soul_of, habit_id, unit, range_from, range_to";

const unitOf = (k: MyKhatmaRow): Division => (isDivision(k.unit) ? k.unit : "quarter");
const rangeOf = (k: MyKhatmaRow) => cleanRange(unitOf(k), k.range_from, k.range_to);
const rangeCols = (u: Division, r: PortionRange) => (isFull(u, r) ? { range_from: null, range_to: null } : { range_from: r.from, range_to: r.to });

const view = (k: MyKhatmaRow) => ({
  id: k.id,
  number: k.number,
  days: k.days,
  startedOn: k.started_on,
  status: k.status,
  finishedOn: k.finished_on,
  dedicatedTo: k.dedicated_to,
  forSoulOf: k.for_soul_of,
  habitId: k.habit_id,
  unit: unitOf(k),
  range: rangeOf(k),
});

/** My khatma now (the latest one, open or not), what I read in it, and the ones before. ready false = 0081/0082 not run yet. */
export async function loadMyKhatma(db: SupabaseClient, me: string) {
  const { data, error } = await db.from("mahdi_my_khatmas").select(COLS).eq("user_id", me).order("number", { ascending: false }).limit(12);
  if (error && MISSING.includes(error.code ?? "")) return { ready: false as const };
  if (error) throw error;
  const rows = (data ?? []) as MyKhatmaRow[];
  const current = rows[0] ?? null;
  let reads: { quarter: number; readOn: string }[] = [];
  if (current) {
    const { data: r, error: e2 } = await db.from("mahdi_my_khatma_reads").select("quarter, read_on").eq("khatma_id", current.id);
    if (e2) throw e2;
    reads = (r ?? []).map((x) => ({ quarter: x.quarter as number, readOn: x.read_on as string })).sort((a, b) => a.quarter - b.quarter);
  }
  return { ready: true as const, current: current ? { ...view(current), reads } : null, history: rows.slice(1).map(view) };
}

async function openKhatma(db: SupabaseClient, me: string) {
  const { data, error } = await db.from("mahdi_my_khatmas").select(COLS).eq("user_id", me).order("number", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  const k = data as MyKhatmaRow | null;
  if (!k || k.status !== "open") throw new UserError("ما عندك ختمة مفتوحة الحين. ابدأ ختمة جديدة.", 409);
  return k;
}

async function readsIn(db: SupabaseClient, k: MyKhatmaRow) {
  const { data, error } = await db.from("mahdi_my_khatma_reads").select("quarter").eq("khatma_id", k.id);
  if (error) throw error;
  return (data ?? []).map((r) => r.quarter as number);
}

/** Marks the khatma finished when every portion of its stretch is read. */
async function finishIfRead(db: SupabaseClient, k: MyKhatmaRow, today: string, read: number[]) {
  const r = rangeOf(k);
  const done = new Set(read.filter((n) => inRange(r, n))).size >= rangeSize(r);
  if (done) await db.from("mahdi_my_khatmas").update({ status: "done", finished_on: today }).eq("id", k.id).eq("status", "open");
  return done;
}

export interface NewKhatma {
  days: number;
  unit: Division;
  range: PortionRange;
  dedicatedTo: string;
  forSoulOf: string;
}

/** A new khatma (the habit linked to the last one stays linked). Only when none is open. */
export async function startMyKhatma(db: SupabaseClient, me: string, today: string, k: NewKhatma) {
  const { data: last, error } = await db.from("mahdi_my_khatmas").select(COLS).eq("user_id", me).order("number", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  const prev = last as MyKhatmaRow | null;
  if (prev?.status === "open") throw new UserError("عندك ختمة مفتوحة. كمّلها أو أنهِها أول.", 409);
  const { error: e2 } = await db.from("mahdi_my_khatmas").insert({
    user_id: me,
    number: (prev?.number ?? 0) + 1,
    days: k.days,
    unit: k.unit,
    ...rangeCols(k.unit, k.range),
    started_on: today,
    dedicated_to: k.dedicatedTo,
    for_soul_of: k.forSoulOf,
    habit_id: prev?.habit_id ?? null,
  });
  if (e2?.code === "23505") throw new UserError("بدأت الختمة من قبل.", 409);
  if (e2) throw e2;
}

/** Portions read today. Those already read stay as they were. Returns the ones newly read (for the habit). */
export async function readQuarters(db: SupabaseClient, me: string, today: string, portions: number[]) {
  const k = await openKhatma(db, me);
  const r = rangeOf(k);
  if (portions.some((n) => !inRange(r, n))) throw new UserError("هذا خارج الجزء اللي حددته لختمتك.", 400);
  const old = new Set(await readsIn(db, k));
  const fresh = portions.filter((q) => !old.has(q));
  if (fresh.length) {
    const { error: e2 } = await db.from("mahdi_my_khatma_reads").insert(fresh.map((quarter) => ({ khatma_id: k.id, user_id: me, quarter, read_on: today })));
    if (e2 && e2.code !== "23505") throw e2;
  }
  const finished = await finishIfRead(db, k, today, [...old, ...fresh]);
  return { added: fresh, finished };
}

/**
 * «وين وصلت»: portions the person had already finished before (or outside) the khatma's reading. They count as read, but
 * not as today's, nor for the habit: they are kept with the day before the khatma started. Returns the ones newly marked.
 */
export async function carryQuarters(db: SupabaseClient, me: string, today: string, portions: number[]) {
  const k = await openKhatma(db, me);
  const r = rangeOf(k);
  if (portions.some((n) => !inRange(r, n))) throw new UserError("هذا خارج الجزء اللي حددته لختمتك.", 400);
  const old = new Set(await readsIn(db, k));
  const fresh = portions.filter((q) => !old.has(q));
  if (fresh.length) {
    const day = carriedDay(k.started_on);
    const { error } = await db.from("mahdi_my_khatma_reads").insert(fresh.map((quarter) => ({ khatma_id: k.id, user_id: me, quarter, read_on: day })));
    if (error && error.code !== "23505") throw error;
  }
  const finished = await finishIfRead(db, k, today, [...old, ...fresh]);
  return { added: fresh, finished };
}

/** A portion marked by mistake: not read any more. Returns the day it had been read on (to take it back from the habit). */
export async function unreadQuarter(db: SupabaseClient, me: string, portion: number) {
  const k = await openKhatma(db, me);
  const { data, error } = await db.from("mahdi_my_khatma_reads").delete().eq("khatma_id", k.id).eq("user_id", me).eq("quarter", portion).select("read_on");
  if (error) throw error;
  return { readOn: (data?.[0]?.read_on as string | undefined) ?? null };
}

/**
 * The open khatma's settings: its pace, dedication and the stretch it covers. The way it is cut (pages, juz…) changes
 * only while nothing is read in it (what was read is counted in its own portions).
 */
export async function updateMyKhatma(db: SupabaseClient, me: string, today: string, patch: { days?: number; dedicatedTo?: string; forSoulOf?: string; unit?: Division; range?: PortionRange }) {
  const k = await openKhatma(db, me);
  const read = await readsIn(db, k);
  const unit = patch.unit ?? unitOf(k);
  if (unit !== unitOf(k) && read.length) throw new UserError("بديت تقرأ في هذه الختمة، فما يتغير تقسيمها. أنهِها وابدأ ختمة جديدة بالتقسيم اللي تبيه.", 409);
  const row: Record<string, unknown> = {};
  if (patch.days !== undefined) row.days = patch.days;
  if (patch.dedicatedTo !== undefined) row.dedicated_to = patch.dedicatedTo;
  if (patch.forSoulOf !== undefined) row.for_soul_of = patch.forSoulOf;
  if (patch.unit !== undefined) row.unit = unit;
  if (patch.range !== undefined) Object.assign(row, rangeCols(unit, patch.range));
  const { error } = await db.from("mahdi_my_khatmas").update(row).eq("id", k.id);
  if (error) throw error;
  // a smaller stretch may already be all read
  await finishIfRead(db, { ...k, ...row, unit } as MyKhatmaRow, today, read);
}

/** Ends the open khatma before it is finished (what was read stays in its record). */
export async function stopMyKhatma(db: SupabaseClient, me: string, today: string) {
  const k = await openKhatma(db, me);
  const { error } = await db.from("mahdi_my_khatmas").update({ status: "stopped", finished_on: today }).eq("id", k.id).eq("status", "open");
  if (error) throw error;
}

/** Links the open khatma to one of my habits (checked by the caller), or unlinks it (null). */
export async function linkHabit(db: SupabaseClient, me: string, habitId: string | null) {
  const k = await openKhatma(db, me);
  const { error } = await db.from("mahdi_my_khatmas").update({ habit_id: habitId }).eq("id", k.id).eq("user_id", me);
  if (error) throw error;
}
