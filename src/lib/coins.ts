// «النقود الذكية»: balances and charges. Server only (service role).
// Paid film operations reserve coins when they start (from the estimate), settle to the real cost when they
// succeed, and give everything back when they fail — the same reserve → settle → release as film_usage.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { claudeHalalas, coinStr, coinsFor, setPricing, type Pricing } from "@config/coins";
import { typicalReplyUsd, type ClaudeModel } from "@config/claude-models";
import { unlimitedFor } from "@/lib/access";

const db = () => createAdminClient();

/** The user's balance (0 without a wallet, or null if the coin tables don't exist yet). */
export async function coinBalance(userId: string): Promise<number | null> {
  const { data, error } = await db().from("smart_coin_wallets").select("balance").eq("user_id", userId).maybeSingle();
  if (error) return null;
  return data?.balance ?? 0;
}

/**
 * Whether paid operations are charged (the owner's switch on /admin/limits). ON unless the owner switched it off;
 * only a site whose coin tables are missing stays free (nothing could be charged there anyway).
 */
export async function coinsRequired() {
  const { data, error } = await db().from("film_limits").select("value").eq("scope", "all").eq("target", "").eq("key", "coins_required").maybeSingle();
  if (error) return false;
  return (data?.value ?? 1) > 0;
}

// ── the pricing in force: the owner's settings (film_limits) over the defaults, read once a minute
let pricingAt = 0;
const PRICING_KEYS: Record<string, keyof Pricing> = { price_usd_sar_x100: "usdToSar", price_step_halalas: "stepHalalas", price_margin_pct: "marginPct", price_was_margin_pct: "wasMarginPct" };
export async function loadPricing(force = false): Promise<Pricing> {
  if (!force && Date.now() - pricingAt < 60_000) return (await import("@config/coins")).getPricing();
  const { data } = await db().from("film_limits").select("key,value").eq("scope", "all").eq("target", "").in("key", Object.keys(PRICING_KEYS));
  const p: Partial<Pricing> = {};
  for (const r of (data ?? []) as { key: string; value: number }[]) {
    const k = PRICING_KEYS[r.key];
    if (k === "usdToSar") p.usdToSar = r.value / 100;
    else if (k) p[k] = r.value;
  }
  setPricing(p);
  pricingAt = Date.now();
  return (await import("@config/coins")).getPricing();
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
/** `claude`: the job is Claude's usage alone — priced at the real cost plus the platform's 10% (config/coins.ts `claudeHalalas`). */
export async function reserveCoins(user: { id: string; email?: string | null }, jobId: string, estimateUsd: number, label: string, claude = false) {
  if ((await unlimitedFor(user.email)) || !(await coinsRequired())) return;
  await loadPricing();
  const coins = (claude ? claudeHalalas : coinsFor)(estimateUsd);
  const left = await adjust(user.id, -coins, "reserve", jobId, label);
  if (left === null) {
    throw new UserError(`رصيدك ما يكفي: هذي العملية تحتاج تقريبًا ${coinStr(coins)}. اشحن رصيدك من صفحة «اشحن رصيدك» (زر «+ اشحن» جنب رصيدك).`, 402);
  }
}

async function reserved(jobId: string) {
  const { data } = await db().from("smart_coin_ledger").select("user_id,delta,label").eq("ref", jobId);
  const rows = (data ?? []) as { user_id: string; delta: number; label: string }[];
  return rows.length ? { userId: rows[0].user_id, label: rows[0].label, held: -rows.reduce((s, r) => s + r.delta, 0) } : null;
}

/** On success: the held coins become the real charge (the difference is given back, or taken). */
export async function settleCoins(jobId: string, costUsd: number, claude = false) {
  await loadPricing();
  await settleTeamCoins(jobId, costUsd, claude);
  const r = await reserved(jobId);
  if (!r || r.held <= 0) return;
  const diff = r.held - (claude ? claudeHalalas : coinsFor)(costUsd);
  if (diff !== 0) await adjust(r.userId, diff, "settle", jobId, r.label, true);
}

/** On failure: every held coin goes back (failed operations cost nothing). */
export async function refundCoins(jobId: string) {
  await refundTeamCoins(jobId);
  const r = await reserved(jobId);
  if (r && r.held > 0) await adjust(r.userId, r.held, "refund", jobId, r.label, true);
}

// ───────────── «نقود الفريق الذكي»: a team series' own wallet (migration 0033) ─────────────

async function adjustTeam(seriesId: string, userId: string | null, delta: number, reason: string, ref: string, label: string, allowNegative = false) {
  const { data, error } = await db().rpc("adjust_team_coins", {
    p_series: seriesId, p_user: userId, p_delta: delta, p_reason: reason, p_ref: ref, p_label: label, p_allow_negative: allowNegative,
  });
  if (error) throw new UserError("«نقود الفريق الذكي» تحتاج تجهيز قاعدة البيانات أول (ملف 0033).", 503);
  return data as number | null;
}

/** The team's balance (0 before anything was put in). */
export async function teamCoinBalance(seriesId: string): Promise<number> {
  const { data } = await db().from("team_coin_wallets").select("balance").eq("series_id", seriesId).maybeSingle();
  return (data?.balance as number | undefined) ?? 0;
}

const SHORT_TEAM = (coins: number) => `رصيد «نقود الفريق الذكي» ما يكفي: هذي العملية تحتاج تقريبًا ${coinStr(coins)}. اطلب من صاحب المسلسل يشحن رصيد الفريق.`;

/** A team series' paid job: holds its estimated coins from the team's wallet (`who` pressed it). */
export async function reserveTeamCoins(seriesId: string, who: { id: string }, jobId: string, estimateUsd: number, label: string, claude = false) {
  if (!(await coinsRequired())) return;
  await loadPricing();
  const coins = (claude ? claudeHalalas : coinsFor)(estimateUsd);
  if ((await adjustTeam(seriesId, who.id, -coins, "reserve", jobId, label)) === null) throw new UserError(SHORT_TEAM(coins), 402);
}

/** A fixed price in coins taken from the team's wallet (the editor's prices, a «اصنع لي» generation). */
export async function holdTeamCoins(seriesId: string, who: { id: string }, coins: number, ref: string, label: string) {
  if (coins <= 0) return;
  if ((await adjustTeam(seriesId, who.id, -coins, "reserve", ref, label)) === null) throw new UserError(SHORT_TEAM(coins), 402);
}

async function teamReserved(ref: string) {
  const { data, error } = await db().from("team_coin_ledger").select("series_id,user_id,delta,label").eq("ref", ref);
  if (error) return null;
  const rows = (data ?? []) as { series_id: string; user_id: string | null; delta: number; label: string }[];
  return rows.length ? { seriesId: rows[0].series_id, userId: rows[0].user_id, label: rows[0].label, held: -rows.reduce((s, r) => s + r.delta, 0) } : null;
}

async function settleTeamCoins(ref: string, costUsd: number, claude = false) {
  const r = await teamReserved(ref);
  if (!r || r.held <= 0) return;
  const diff = r.held - (claude ? claudeHalalas : coinsFor)(costUsd);
  if (diff !== 0) await adjustTeam(r.seriesId, r.userId, diff, "settle", ref, r.label, true);
}

/** Gives back what the team's wallet holds for this job (failed ones cost nothing). Returns who it was held for. */
export async function refundTeamCoins(ref: string) {
  const r = await teamReserved(ref);
  if (r && r.held > 0) await adjustTeam(r.seriesId, r.userId, r.held, "refund", ref, r.label, true);
  return r;
}

/** The series' owner moves coins from their own «النقود الذكية» into the team's wallet. */
export async function fundTeam(owner: { id: string; email?: string | null }, seriesId: string, coins: number) {
  if (!Number.isInteger(coins) || coins <= 0 || coins > 100000) throw new UserError("اكتب عدد نقود صحيح.", 400);
  const ref = `team-fund:${seriesId}:${crypto.randomUUID()}`;
  // the site's owner (unlimited) fills the team without taking from a balance
  const free = await unlimitedFor(owner.email);
  if (!free) {
    const left = await adjust(owner.id, -coins, "reserve", ref, "تحويل إلى نقود الفريق الذكي");
    if (left === null) throw new UserError(`رصيدك من النقود الذكية ما يكفي لتحويل ${coinStr(coins)}.`, 402);
  }
  try {
    return await adjustTeam(seriesId, owner.id, coins, "fund", ref, "تحويل من صاحب المسلسل", true);
  } catch (e) {
    if (!free) await adjust(owner.id, coins, "refund", ref, "تحويل إلى نقود الفريق الذكي", true);
    throw e;
  }
}

/** The series' owner takes coins back from the team's wallet into their own. */
export async function withdrawTeam(owner: { id: string; email?: string | null }, seriesId: string, coins: number) {
  if (!Number.isInteger(coins) || coins <= 0 || coins > 100000) throw new UserError("اكتب عدد نقود صحيح.", 400);
  const ref = `team-withdraw:${seriesId}:${crypto.randomUUID()}`;
  if ((await adjustTeam(seriesId, owner.id, -coins, "withdraw", ref, "رجعت لمحفظة صاحب المسلسل")) === null) throw new UserError("رصيد الفريق أقل من هذا العدد.", 400);
  if (!(await unlimitedFor(owner.email))) await adjust(owner.id, coins, "refund", ref, "رجوع من نقود الفريق الذكي", true);
}

/** The site's owner adds (or takes back) team coins. */
export const grantTeamCoins = (seriesId: string, amount: number, note: string) => adjustTeam(seriesId, null, amount, "grant", note, note, true);

/**
 * A fixed price in coins (from a price table the owner can edit), taken before an operation that is not a job: the
 * coins are held at once, or the operation is refused clearly. `releaseCoins` gives them back if it fails.
 */
export async function holdCoins(userId: string, coins: number, ref: string, label: string) {
  if (coins <= 0) return;
  const left = await adjust(userId, -coins, "reserve", ref, label);
  if (left === null) throw new UserError(`رصيدك من النقود الذكية لا يكفي: هذه العملية تحتاج ${coinStr(coins)}.`, 402);
}
export async function releaseCoins(userId: string, coins: number, ref: string, label: string) {
  if (coins > 0) await adjust(userId, coins, "refund", ref, label, true);
}

// ───────────── a robot's conversation: Claude's real usage + 10% ─────────────

export interface ClaudeBill {
  /** nothing is charged (the owner, an unlimited account, or coins not required) */
  free: boolean;
  /** halalas charged after `settle` */
  charged: number;
  /** after the reply: takes the real usage (USD) at the platform's 10% — never throws over a short balance */
  settle: (usd: number) => Promise<number>;
}

/**
 * Before a robot answers: the balance must cover a typical reply of the chosen model (a clear refusal otherwise); after
 * it, `settle(usd)` takes what the reply really cost + 10%. Free for the owner and unlimited accounts.
 */
export async function claudeMeter(who: { id: string; email?: string | null; owner?: boolean; team?: string | null }, model: ClaudeModel, label: string): Promise<ClaudeBill> {
  const bill: ClaudeBill = { free: true, charged: 0, settle: async () => 0 };
  if (who.owner || (await unlimitedFor(who.email)) || !(await coinsRequired())) return bill;
  await loadPricing();
  const need = claudeHalalas(typicalReplyUsd(model));
  const balance = who.team ? await teamCoinBalance(who.team) : await coinBalance(who.id);
  if (balance !== null && balance < need) {
    throw new UserError(`رصيدك ما يكفي للمحادثة مع «${model.name}»: الرد الواحد يحتاج تقريبًا ${coinStr(need)}. اشحن رصيدك من صفحة «اشحن رصيدك» (زر «+ اشحن» جنب رصيدك)، أو اختر موديل أرخص.`, 402);
  }
  const ref = `claude:${crypto.randomUUID()}`;
  return {
    free: false,
    charged: 0,
    settle: async (usd: number) => {
      const coins = claudeHalalas(usd);
      if (coins <= 0) return 0;
      if (who.team) await adjustTeam(who.team, who.id, -coins, "settle", ref, label, true);
      else await adjust(who.id, -coins, "settle", ref, label, true);
      bill.charged = coins;
      return coins;
    },
  };
}
