// The film maker's costs as people pay them: «النقود الذكية» (نقدة), from the real cost in dollars of each reply,
// picture, voice and video (the same rate the coins are taken at). Pure: pages and server alike.

import { coinsFor } from "@config/coins";

/** One cost in coins: «🪙 12 نقدة». */
export const credits = (usd: number) => `🪙 ${usd > 0 ? coinsFor(usd) : 0} نقدة`;

/** A range («تقريبًا ٢–١٨ نقدة»). */
export const creditsRange = (lo: number, hi: number) => `🪙 تقريبًا ${coinsFor(lo)}–${coinsFor(hi)} نقدة`;
