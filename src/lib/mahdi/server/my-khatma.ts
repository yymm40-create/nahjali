// SERVER ONLY. «الختمة العلوية» · «ختمتي»: a person's own khatma (migration 0081). Every function takes the signed-in
// account's id and touches only its rows (the tables are server-only).
import type { SupabaseClient } from "@supabase/supabase-js";
import { UserError } from "./api";
import { QUARTERS } from "../khatma/mine";

const MISSING = ["42P01", "PGRST204", "PGRST205"];

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
}
const COLS = "id, number, days, started_on, status, finished_on, dedicated_to, for_soul_of, habit_id";

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
});

/** My khatma now (the latest one, open or not), what I read in it, and the ones before. undefined = 0081 not run yet. */
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

/** A new khatma (the habit linked to the last one stays linked). Only when none is open. */
export async function startMyKhatma(db: SupabaseClient, me: string, today: string, days: number, dedicatedTo: string, forSoulOf: string) {
  const { data: last, error } = await db.from("mahdi_my_khatmas").select(COLS).eq("user_id", me).order("number", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  const prev = last as MyKhatmaRow | null;
  if (prev?.status === "open") throw new UserError("عندك ختمة مفتوحة. كمّلها أو أنهِها أول.", 409);
  const { error: e2 } = await db.from("mahdi_my_khatmas").insert({
    user_id: me,
    number: (prev?.number ?? 0) + 1,
    days,
    started_on: today,
    dedicated_to: dedicatedTo,
    for_soul_of: forSoulOf,
    habit_id: prev?.habit_id ?? null,
  });
  if (e2?.code === "23505") throw new UserError("بدأت الختمة من قبل.", 409);
  if (e2) throw e2;
}

/** Quarters read today. Those already read stay as they were. Returns the ones newly read (for the habit). */
export async function readQuarters(db: SupabaseClient, me: string, today: string, quarters: number[]) {
  const k = await openKhatma(db, me);
  const { data: had, error } = await db.from("mahdi_my_khatma_reads").select("quarter").eq("khatma_id", k.id).in("quarter", quarters);
  if (error) throw error;
  const old = new Set((had ?? []).map((r) => r.quarter as number));
  const fresh = quarters.filter((q) => !old.has(q));
  if (fresh.length) {
    const { error: e2 } = await db.from("mahdi_my_khatma_reads").insert(fresh.map((quarter) => ({ khatma_id: k.id, user_id: me, quarter, read_on: today })));
    if (e2 && e2.code !== "23505") throw e2;
  }
  const { count } = await db.from("mahdi_my_khatma_reads").select("quarter", { count: "exact", head: true }).eq("khatma_id", k.id);
  const finished = (count ?? 0) >= QUARTERS;
  if (finished) await db.from("mahdi_my_khatmas").update({ status: "done", finished_on: today }).eq("id", k.id).eq("status", "open");
  return { added: fresh, finished };
}

/** A quarter marked by mistake: not read any more. Returns the day it had been read on (to take it back from the habit). */
export async function unreadQuarter(db: SupabaseClient, me: string, quarter: number) {
  const k = await openKhatma(db, me);
  const { data, error } = await db.from("mahdi_my_khatma_reads").delete().eq("khatma_id", k.id).eq("user_id", me).eq("quarter", quarter).select("read_on");
  if (error) throw error;
  return { readOn: (data?.[0]?.read_on as string | undefined) ?? null };
}

/** The open khatma's pace and dedication. */
export async function updateMyKhatma(db: SupabaseClient, me: string, patch: { days?: number; dedicated_to?: string; for_soul_of?: string }) {
  const k = await openKhatma(db, me);
  const { error } = await db.from("mahdi_my_khatmas").update(patch).eq("id", k.id);
  if (error) throw error;
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
