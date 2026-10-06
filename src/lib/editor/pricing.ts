// «حيدر كات»'s limits and prices, set by the owner from /admin/limits (film_limits). Everything is free while
// the prices are 0 or «النقود الذكية مطلوبة» is off; a price is held before the paid call and given back if it fails.

import { coinsRequired, holdCoins, releaseCoins } from "@/lib/coins";
import { getLimit, type LimitKey } from "@/lib/film/limits";

export interface Who {
  id: string;
  email?: string | null;
  owner: boolean;
}

/** One of the editor's daily limits for this person (the owner has none). */
export async function editorLimit(key: Extract<LimitKey, `editor_${string}_daily` | "editor_speech_minutes">, who: Who) {
  return who.owner ? Infinity : getLimit(key, who.email);
}

/**
 * Runs a paid call: its price (coins × units) is held first and given back if the call throws. Free when the owner
 * asks, when coins aren't required, or when the price is 0.
 */
export async function charged<T>(who: Who, price: Extract<LimitKey, `editor_price_${string}`>, units: number, label: string, run: () => Promise<T>) {
  const coins = who.owner || !(await coinsRequired()) ? 0 : Math.ceil((await getLimit(price)) * units);
  const ref = `editor:${price}:${crypto.randomUUID()}`;
  await holdCoins(who.id, coins, ref, label);
  try {
    return await run();
  } catch (e) {
    await releaseCoins(who.id, coins, ref, label).catch(() => {});
    throw e;
  }
}
