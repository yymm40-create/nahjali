// «حيدرة كت»'s prices, set by the owner from /admin/limits (film_limits). Everything is free while
// the prices are 0 or «النقود الذكية مطلوبة» is off; a price is held before the paid call and given back if it fails.

import { remembering, type Memo } from "@/lib/claude-run";
import { logFree, dropFree, claudeMeter, coinsRequired, holdCoins, holdTeamCoins, logCostHalalas, refundTeamCoins, releaseCoins } from "@/lib/coins";
import { getLimit, type LimitKey } from "@/lib/film/limits";
import { sellKind, type PriceKind } from "@config/coins";
import { claudeModelOf } from "@config/claude-models";
import { withClaude } from "@/lib/film/claude-model";
import { claudeFor } from "@/lib/access-perks";

export interface Who {
  id: string;
  email?: string | null;
  owner: boolean;
  /** an edit of a team series («المسلسل الذكي»): its «نقود الفريق الذكي» pays */
  team?: string | null;
}

/** The owner's per-unit prices that make a picture (the hook drawn by GPT Image 2) carry GPT Image 2's profit. */
const PRICE_KIND: Partial<Record<LimitKey, PriceKind>> = { editor_price_hook: "image", editor_price_upscale: "video", editor_price_matte: "video" };

/**
 * Runs a paid call: its price (coins × units) is held first and given back if the call throws. Free when the owner
 * asks, when coins aren't required, or when the price is 0.
 */
export async function charged<T>(who: Who, price: Extract<LimitKey, `editor_price_${string}`>, units: number, label: string, run: () => Promise<T>) {
  const cost = (await getLimit(price)) * units;
  const value = sellKind(Math.ceil(cost), PRICE_KIND[price] ?? "other");
  const coins = who.owner || !(await coinsRequired()) ? 0 : value;
  const ref = `editor:${price}:${crypto.randomUUID()}`;
  // free for this account: written down with its value (code monitoring)
  if (!coins && value > 0) await logFree(who.id, ref, label, value);
  if (who.team) await holdTeamCoins(who.team, who, coins, ref, label);
  else await holdCoins(who.id, coins, ref, label);
  try {
    const out = await run();
    await logCostHalalas(who.id, ref, label, cost);
    return out;
  } catch (e) {
    if (who.team) await refundTeamCoins(ref).catch(() => {});
    else await releaseCoins(who.id, coins, ref, label).catch(() => {});
    if (!coins) await dropFree(ref);
    throw e;
  }
}

/**
 * A Claude conversation of حيدرا ماكس: the person's chosen model answers, a balance that covers a typical reply of it is needed
 * first, and afterwards the reply's real usage + its profit is taken (the owner and unlimited accounts pay nothing). A
 * failed call takes nothing. `usdOf` reads the real cost from what `run` returned. `kind` "max": «حيدرا ماكس»'s
 * programs (the cut and colour programs, the motion lab), at their own profit.
 */
export async function claudeCharged<T>(who: Who, modelId: unknown, label: string, run: () => Promise<T>, usdOf: (r: T) => number, memo?: Memo<T>, kind: "claude" | "max" = "claude"): Promise<T & { model: string; coins: number }> {
  // a code may cap the model (the owner's «الأكواد»): a dearer pick is served by the ceiling's model
  const model = claudeModelOf(await claudeFor(who.email, modelId));
  const bill = await claudeMeter(who, model, label, kind);
  // the person's memory («ذاكرتي») is read by حيدرا ماكس too, and learns from the turn
  const out = await withClaude(model.id, () => remembering(who.id, run, memo)).catch(async (e) => {
    await bill.release().catch(() => {});
    throw e;
  });
  const coins = await bill.settle(usdOf(out)).catch((e) => {
    console.error("claude settle failed", e);
    return 0;
  });
  return { ...out, model: model.id, coins };
}
