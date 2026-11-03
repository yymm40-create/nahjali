// «أُخذ منك بالضبط في هذي المحادثة»: a tiny, shared add-on for every saved robot conversation (content, kharq,
// islamic, designer, games, booklet, سجاد, مختبر الموشن, الممنتج الذكي). Each of those tables keeps `spent_halalas`
// (migration 0101): a running total of what was REALLY taken from the wallet, turn by turn — not the `usd` some of
// them also keep (the provider's raw cost before margin and rounding, for profit accounting), and not an estimate.
// Called once per turn, right after the turn's bill settles (robotTurn's `coins`, or `bill.settle`'s own return),
// with the chat's row already loaded (so no extra read): adds `coins` to what that row already held and saves it.
// Server only.

import { createAdminClient } from "@/lib/supabase/admin";

/** Adds `coins` (halalas; 0 or less is a no-op) to a chat row's running total and returns the new total. */
export async function addChatSpent(table: string, idCol: string, id: string, before: number, coins: number): Promise<number> {
  const add = Math.max(0, Math.round(coins) || 0);
  const next = Math.max(0, Math.round(before) || 0) + add;
  if (add <= 0) return next;
  await createAdminClient()
    .from(table)
    .update({ spent_halalas: next })
    .eq(idCol, id)
    .then(() => {}, () => {});
  return next;
}
