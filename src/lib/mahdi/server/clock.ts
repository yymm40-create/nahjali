// SERVER ONLY. Each person's clock for the dispatchers and the boards: their time zone and their «بداية يومي» (SQL 0128).
// Before 0128 runs the columns are missing: the profiles are read without them and everyone's day starts at the default
// (Fajr of their time zone's main city).
import type { SupabaseClient } from "@supabase/supabase-js";
import { readDayStart, type Clock } from "../engine";

export const DAY_START_COLUMNS = "day_start_mode, day_start_at, day_lat, day_lng, day_city";

const missingColumn = (e: unknown) => ["42703", "PGRST204"].includes((e as { code?: string } | null)?.code ?? "");

type Row = Record<string, unknown> & { user_id: string; time_zone: string };

/** Profiles of `ids` with the columns in `base` (which must include user_id and time_zone) and the day-start ones when there. */
export async function profilesWithClock<R extends Row = Row>(db: SupabaseClient, base: string, ids: string[]): Promise<{ data: R[] | null; error: unknown }> {
  let res: { data: unknown[] | null; error: unknown } = await db.from("mahdi_profiles").select(`${base}, ${DAY_START_COLUMNS}`).in("user_id", ids);
  if (missingColumn(res.error)) res = await db.from("mahdi_profiles").select(base).in("user_id", ids);
  return res as { data: R[] | null; error: unknown };
}

/** One profile's clock (its row may be missing the day-start columns). */
export const clockOfRow = (p: { time_zone: string } & Record<string, unknown>): Clock => ({ timeZone: p.time_zone, dayStart: readDayStart(p) });

/** userId → clock, for many people at once. */
export async function clocksOf(db: SupabaseClient, ids: string[]): Promise<Map<string, Clock>> {
  const out = new Map<string, Clock>();
  if (!ids.length) return out;
  const { data } = await profilesWithClock(db, "user_id, time_zone", ids);
  for (const p of data ?? []) out.set(p.user_id, clockOfRow(p));
  return out;
}
