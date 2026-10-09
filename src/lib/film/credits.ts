// The film maker's costs as people pay them: riyals, from the real cost in dollars of each reply, picture, voice and
// video (the same rule the wallet is charged by: config/coins.ts). Pure: pages and server alike.

import { coinsFor, fmtSar } from "@config/coins";

/** One cost: «💰 2.50» (the coin, never a currency word). */
export const credits = (usd: number) => `💰 ${usd > 0 ? fmtSar(coinsFor(usd)) : 0}`;

/** A range («تقريبًا 0.50–4.50»). */
export const creditsRange = (lo: number, hi: number) => `💰 تقريبًا ${fmtSar(coinsFor(lo))}–${fmtSar(coinsFor(hi))}`;
