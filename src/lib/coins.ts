// «النقود الذكية»: balances and charges. Server only (service role).
// Paid film operations reserve coins when they start (from the estimate), settle to the real cost when they
// succeed, and give everything back when they fail — the same reserve → settle → release as film_usage.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { claudeHalalas, coinStr, coinsFor, costHalalas, setPricing, type PriceKind, type Pricing } from "@config/coins";
import type { ClaudeModel } from "@config/claude-models";
import { fullAccessOf, unlimitedFor } from "@/lib/access";

const db = () => createAdminClient();

/** A job made of several kinds (Claude's writing and pictures, say): each kind's share of the cost. */
export type PriceMix = Partial<Record<PriceKind, number>>;
/**
 * A job's kind of price: `true` (the old flag) is Claude's own work, `false` the general margin, or a mix — the cost
 * split by the mix's shares, each share at its own kind's profit.
 */
export type ChargeKind = boolean | PriceKind | PriceMix;
const kindOf = (k: boolean | PriceKind | undefined): PriceKind => (k === true ? "claude" : k === false || k == null ? "other" : k);
export function priceOf(usd: number, k: ChargeKind | undefined, atCost = false): number {
  // a code's «بسعر التكلفة»: what the provider charges us (Claude: its real input + output + cache usage), to the halala,
  // with no profit and no rounding up to the step
  if (atCost) return usd > 0 ? costHalalas(usd) : 0;
  if (k && typeof k === "object") {
    const parts = Object.entries(k).filter(([, v]) => Number(v) > 0) as [PriceKind, number][];
    const all = parts.reduce((s, [, v]) => s + v, 0);
    if (!(all > 0) || !(usd > 0)) return 0;
    return parts.reduce((s, [kind, v]) => s + coinsFor((usd * v) / all, kind), 0);
  }
  return coinsFor(usd, kindOf(k));
}

/** Whether this account entered a code that prices everything at cost (no profit): the email is looked up once in a while. */
const emails = new Map<string, { at: number; email: string | null }>();
export async function atCostFor(userId: string, email?: string | null): Promise<boolean> {
  let mail = email ?? null;
  if (!mail) {
    const hit = emails.get(userId);
    if (hit && Date.now() - hit.at < 300_000) mail = hit.email;
    else {
      const { data } = await db().auth.admin.getUserById(userId).catch(() => ({ data: null }));
      mail = data?.user?.email ?? null;
      emails.set(userId, { at: Date.now(), email: mail });
    }
  }
  if (!mail) return false;
  return (await fullAccessOf(mail).catch(() => null))?.perks.atCost === true;
}

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
const PRICING_KEYS: Record<string, keyof Pricing> = { price_usd_sar_x100: "usdToSar", price_step_halalas: "stepHalalas", price_margin_pct: "marginPct", price_was_margin_pct: "wasMarginPct", price_image_margin_pct: "imageMarginPct", price_video_margin_pct: "videoMarginPct" };
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

/**
 * «مراقبة الأكواد»: an operation that cost the account nothing (an «بلا حدود» code, the owner) is still written down
 * with what it would have cost at the site's prices (migration 0085; without it nothing is kept and nothing breaks).
 */
export async function logFree(userId: string, ref: string, label: string, halalas: number) {
  await db().from("site_free_usage").insert({ user_id: userId, ref, label: label.slice(0, 200), halalas: Math.max(0, Math.round(halalas)) }).then(() => {}, () => {});
}

/** A free operation that failed: off the record (it cost nothing). */
export async function dropFree(ref: string) {
  await db().from("site_free_usage").delete().eq("ref", ref).then(() => {}, () => {});
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

/**
 * A gift of coins that can be given only once for the same `ref` (a code's gift for one person): a second call with the
 * same ref changes nothing. Returns whether it was given now.
 */
export async function giftCoinsOnce(userId: string, halalas: number, ref: string, label: string): Promise<boolean> {
  if (!(halalas > 0)) return false;
  const seen = await db().from("smart_coin_ledger").select("id").eq("user_id", userId).eq("ref", ref).limit(1);
  if (seen.data?.length) return false;
  await adjust(userId, halalas, "grant", ref, label, true);
  return true;
}

/** Before a paid operation starts: holds its estimated coins, or refuses clearly when the balance is short. */
/**
 * `kind`: what the job makes — "claude" (or `true`): Claude's usage alone, its real cost + the platform's 10٪;
 * "image" 60٪; "video" 40٪; anything else the general margin (config/coins.ts).
 */
export async function reserveCoins(user: { id: string; email?: string | null }, jobId: string, estimateUsd: number, label: string, claude: ChargeKind = false) {
  if ((await unlimitedFor(user.email)) || !(await coinsRequired())) {
    // free: the job is written down now, and its real value filled in when it is done (settleCoins)
    await logFree(user.id, jobId, label, 0);
    return;
  }
  void estimateUsd;
  void claude;
  // pay after use (the owner, 18 October 2026: «على كل شيء يطلع في النهاية تأخذ الفلوس مباشرة»): nothing is held — the
  // job starts while the wallet has something in it, a zero mark ties the job to the wallet, and `settleCoins` takes
  // what it really cost when it is done (a failed one takes nothing)
  if (((await coinBalance(user.id)) ?? 0) <= 0 || (await adjust(user.id, 0, "reserve", jobId, label)) === null) {
    throw new UserError(SHORT, 402);
  }
}

const SHORT = "رصيدك خلص. اشحن رصيدك من صفحة «اشحن رصيدك» (زر «+ اشحن» جنب رصيدك) وكمّل من نفس المكان.";

async function reserved(jobId: string) {
  const { data } = await db().from("smart_coin_ledger").select("user_id,delta,label").eq("ref", jobId);
  const rows = (data ?? []) as { user_id: string; delta: number; label: string }[];
  return rows.length ? { userId: rows[0].user_id, label: rows[0].label, held: -rows.reduce((s, r) => s + r.delta, 0) } : null;
}

/**
 * Pay after use (the owner's way for «الطالب الذكي», 18 October 2026: «خذ الفلوس مباشرة»): nothing is held before a
 * step; when it is done, what it really cost (at the site's margins) is taken from the wallet at once. The wallet may go
 * below zero by the last step's cost; the next step then waits for a top-up.
 */
export async function chargeAfter(userId: string, jobId: string, costUsd: number, label: string, claude: ChargeKind = false) {
  await loadPricing();
  const coins = priceOf(costUsd, claude, await atCostFor(userId));
  if (coins > 0) await adjust(userId, -coins, "settle", jobId, label, true);
  return coins;
}

/** On success: the held coins become the real charge (the difference is given back, or taken). */
export async function settleCoins(jobId: string, costUsd: number, claude: ChargeKind = false) {
  await loadPricing();
  await settleTeamCoins(jobId, costUsd, claude);
  const r = await reserved(jobId);
  if (!r) {
    // a free account's job: its value at the site's prices goes on the record kept for it
    await db().from("site_free_usage").update({ halalas: priceOf(costUsd, claude) }).eq("ref", jobId).then(() => {}, () => {});
    return;
  }
  // a job marked with nothing held (pay after use) is charged here; one that held its estimate gets the difference back
  if (r.held < 0) return;
  const diff = r.held - priceOf(costUsd, claude, await atCostFor(r.userId));
  if (diff !== 0) await adjust(r.userId, diff, "settle", jobId, r.label, true);
}

/** On failure: every held coin goes back (failed operations cost nothing). */
export async function refundCoins(jobId: string) {
  await refundTeamCoins(jobId);
  // a free account's failed job cost nothing: off the record
  await db().from("site_free_usage").delete().eq("ref", jobId).then(() => {}, () => {});
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
export async function reserveTeamCoins(seriesId: string, who: { id: string }, jobId: string, estimateUsd: number, label: string, claude: ChargeKind = false) {
  if (!(await coinsRequired())) return;
  void estimateUsd;
  void claude;
  // pay after use, like a person's wallet: nothing held, the real cost taken when the job is done
  if ((await teamCoinBalance(seriesId)) <= 0 || (await adjustTeam(seriesId, who.id, 0, "reserve", jobId, label)) === null) {
    throw new UserError("رصيد «نقود الفريق الذكي» خلص. اطلب من صاحب المسلسل يشحن رصيد الفريق.", 402);
  }
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

async function settleTeamCoins(ref: string, costUsd: number, claude: ChargeKind = false) {
  const r = await teamReserved(ref);
  if (!r || r.held < 0) return;
  const diff = r.held - priceOf(costUsd, claude);
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
 * Before a robot answers: the wallet must have something in it (a clear refusal otherwise); after it, `settle(usd)`
 * takes what the reply really cost + 10% (pay after use). Free for the owner and unlimited accounts.
 */
export async function claudeMeter(who: { id: string; email?: string | null; owner?: boolean; team?: string | null }, model: ClaudeModel, label: string): Promise<ClaudeBill> {
  // free: nothing is taken, but the reply's value at the site's price is written down (code monitoring)
  const bill: ClaudeBill = { free: true, charged: 0, settle: async (usd: number) => (await logFree(who.id, `claude:${crypto.randomUUID()}`, label, claudeHalalas(usd)), 0) };
  if (who.owner || (await unlimitedFor(who.email)) || !(await coinsRequired())) return bill;
  await loadPricing();
  // pay after use: a reply starts while the wallet has anything in it, and takes what it really cost after
  const atCost = !who.team && (await atCostFor(who.id, who.email));
  const balance = who.team ? await teamCoinBalance(who.team) : await coinBalance(who.id);
  if (balance !== null && balance <= 0) {
    throw new UserError(`رصيدك خلص. اشحن رصيدك من صفحة «اشحن رصيدك» (زر «+ اشحن» جنب رصيدك) وكمّل المحادثة مع «${model.name}».`, 402);
  }
  const ref = `claude:${crypto.randomUUID()}`;
  return {
    free: false,
    charged: 0,
    settle: async (usd: number) => {
      // a code's «بسعر التكلفة»: the real usage with no +10%
      const coins = atCost ? priceOf(usd, "claude", true) : claudeHalalas(usd);
      if (coins <= 0) return 0;
      if (who.team) await adjustTeam(who.team, who.id, -coins, "settle", ref, label, true);
      else await adjust(who.id, -coins, "settle", ref, label, true);
      bill.charged = coins;
      return coins;
    },
  };
}
