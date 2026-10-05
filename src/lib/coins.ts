// «النقود الذكية»: balances and charges. Server only (service role).
// Paid film operations reserve coins when they start (from the estimate), settle to the real cost when they
// succeed, and give everything back when they fail — the same reserve → settle → release as film_usage.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { coinsFor } from "@config/coins";
import { isAdmin } from "@config/site";

const db = () => createAdminClient();

/** The user's balance (0 without a wallet, or null if the coin tables don't exist yet). */
export async function coinBalance(userId: string): Promise<number | null> {
  const { data, error } = await db().from("smart_coin_wallets").select("balance").eq("user_id", userId).maybeSingle();
  if (error) return null;
  return data?.balance ?? 0;
}

/** Whether paid operations need coins (the owner's switch on /admin/limits; off during the free trial). */
export async function coinsRequired() {
  const { data } = await db().from("film_limits").select("value").eq("scope", "all").eq("target", "").eq("key", "coins_required").maybeSingle();
  return (data?.value ?? 0) > 0;
}

async function adjust(userId: string, delta: number, reason: string, ref: string, label: string, allowNegative = false) {
  const { data, error } = await db().rpc("adjust_smart_coins", {
    p_user: userId, p_delta: delta, p_reason: reason, p_ref: ref, p_label: label, p_allow_negative: allowNegative,
  });
  if (error) throw error;
  return data as number | null;
}

/** The owner adds (or takes back, with a negative amount) coins for a user. */
export const grantCoins = (userId: string, amount: number, note: string) => adjust(userId, amount, "grant", note, note, true);

/** Before a paid operation starts: holds its estimated coins, or refuses clearly when the balance is short. */
export async function reserveCoins(user: { id: string; email?: string | null }, jobId: string, estimateUsd: number, label: string) {
  if (isAdmin(user.email) || !(await coinsRequired())) return;
  const coins = coinsFor(estimateUsd);
  const left = await adjust(user.id, -coins, "reserve", jobId, label);
  if (left === null) {
    throw new UserError(`رصيدك من النقود الذكية ما يكفي: هذي العملية تحتاج تقريبًا ${coins} نقدة.`, 402);
  }
}

async function reserved(jobId: string) {
  const { data } = await db().from("smart_coin_ledger").select("user_id,delta,label").eq("ref", jobId);
  const rows = (data ?? []) as { user_id: string; delta: number; label: string }[];
  return rows.length ? { userId: rows[0].user_id, label: rows[0].label, held: -rows.reduce((s, r) => s + r.delta, 0) } : null;
}

/** On success: the held coins become the real charge (the difference is given back, or taken). */
export async function settleCoins(jobId: string, costUsd: number) {
  const r = await reserved(jobId);
  if (!r || r.held <= 0) return;
  const diff = r.held - coinsFor(costUsd);
  if (diff !== 0) await adjust(r.userId, diff, "settle", jobId, r.label, true);
}

/** On failure: every held coin goes back (failed operations cost nothing). */
export async function refundCoins(jobId: string) {
  const r = await reserved(jobId);
  if (r && r.held > 0) await adjust(r.userId, r.held, "refund", jobId, r.label, true);
}

/**
 * A fixed price in coins (from a price table the owner can edit), taken before an operation that is not a job: the
 * coins are held at once, or the operation is refused clearly. `releaseCoins` gives them back if it fails.
 */
export async function holdCoins(userId: string, coins: number, ref: string, label: string) {
  if (coins <= 0) return;
  const left = await adjust(userId, -coins, "reserve", ref, label);
  if (left === null) throw new UserError(`رصيدك من النقود الذكية لا يكفي: هذه العملية تحتاج ${coins} نقدة.`, 402);
}
export async function releaseCoins(userId: string, coins: number, ref: string, label: string) {
  if (coins > 0) await adjust(userId, coins, "refund", ref, label, true);
}
