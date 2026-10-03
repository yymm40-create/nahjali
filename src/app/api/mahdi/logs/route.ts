import { NextResponse } from "next/server";
import { MAHDI_LIMITS } from "@config/mahdi";
import { isISODate, todayIn } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { fromDbError, mahdiRoute, readJson, requireProfile, UserError, UUID_RE } from "@/lib/mahdi/server/api";
import { parseValue } from "@/lib/mahdi/server/validate";

interface Result {
  habitId: string;
  date: string;
  /** The value now stored (a newer edit from another device may have won). */
  value?: number;
  /** Set when this edit was refused; the app drops it and shows the message. */
  error?: string;
}

/**
 * Saves logged values: `{ ops: [{ habitId, date, value, ts }] }`, each "set this day's total to value".
 * Sent right after a tap, or in a batch after being offline. The newest edit (by `ts`) always wins.
 */
export const PUT = mahdiRoute(async (req: Request) => {
  const { supabase, profile } = await requireProfile(req);
  const { ops } = await readJson(req, 256 * 1024);
  if (!Array.isArray(ops) || ops.length === 0 || ops.length > MAHDI_LIMITS.maxLogOps) throw new UserError(t.errors.invalid, 400);

  const today = todayIn(profile.timeZone);
  const now = Date.now();
  const ids = ops.map((o) => (o as { habitId?: unknown })?.habitId).filter((x): x is string => typeof x === "string");
  const habitIds = [...new Set(ids.filter((x) => UUID_RE.test(x)))];
  // Joined challenges come as "c:<id>"; their first day is max(joined, challenge start), last day the end or leave date
  const challengeIds = [...new Set(ids.filter((x) => x.startsWith("c:")).map((x) => x.slice(2)).filter((x) => UUID_RE.test(x)))];
  const challengeWindow = new Map<string, { start: string; end: string | null }>();
  if (challengeIds.length) {
    const [{ data: members }, { data: defs }] = await Promise.all([
      supabase.from("mahdi_challenge_members").select("challenge_id, joined_on, left_on").in("challenge_id", challengeIds),
      supabase.from("mahdi_challenges").select("id, starts_on, ends_on").in("id", challengeIds),
    ]);
    for (const m of members ?? []) {
      const c = (defs ?? []).find((d) => d.id === m.challenge_id);
      if (!c) continue;
      const ends = [m.left_on ? m.left_on : null, c.ends_on].filter(Boolean) as string[];
      challengeWindow.set(`c:${m.challenge_id}`, { start: m.joined_on > c.starts_on ? m.joined_on : c.starts_on, end: ends.length ? ends.sort()[0] : null });
    }
  }

  // First day of each habit (only the user's own habits come back, thanks to RLS)
  const startOf = new Map<string, string>();
  if (habitIds.length) {
    const { data } = await supabase.from("mahdi_habit_versions").select("habit_id, effective_from").in("habit_id", habitIds);
    for (const v of data ?? []) {
      const s = startOf.get(v.habit_id);
      if (!s || v.effective_from < s) startOf.set(v.habit_id, v.effective_from);
    }
  }

  const results: Result[] = [];
  const work = ops.map(async (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const habitId = typeof o.habitId === "string" ? o.habitId : "";
    const date = typeof o.date === "string" ? o.date : "";
    const fail = (error: string) => results.push({ habitId, date, error });
    const isChallenge = habitId.startsWith("c:");
    if ((!isChallenge && !UUID_RE.test(habitId)) || !isISODate(date)) return fail(t.errors.invalid);
    const win = challengeWindow.get(habitId);
    const start = isChallenge ? win?.start : startOf.get(habitId);
    if (!start) return fail(t.errors.notFound);
    if (win?.end && date > win.end) return fail(t.errors.invalid);
    if (date > today) return fail(t.errors.futureDate);
    if (date < start) return fail(t.errors.beforeStart);
    let value: number;
    try {
      value = parseValue(o.value);
    } catch {
      return fail(t.errors.invalid);
    }
    const ts = Number(o.ts);
    // A client clock far in the future would make its edit impossible to correct later
    const clientTs = Number.isFinite(ts) && ts > 1.5e12 && ts < now + 5 * 60_000 ? ts : now;
    const { data, error } = await supabase.rpc(isChallenge ? "mahdi_set_challenge_log" : "mahdi_set_log", {
      ...(isChallenge ? { p_challenge: habitId.slice(2) } : { p_habit: habitId }),
      p_date: date,
      p_value: value,
      p_client_ts: new Date(clientTs).toISOString(),
    });
    if (error) return fail((fromDbError(error) ?? new UserError(t.errors.generic)).message);
    results.push({ habitId, date, value: Number(data) });
  });
  await Promise.all(work);
  return NextResponse.json({ results });
});
