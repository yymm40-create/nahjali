// The film maker's costs as people pay them: the site's own coin («¤», shown through <Coined> as the coin's logo), from
// the real cost in dollars of each reply, picture, voice and video (the same rule the wallet is charged by:
// config/coins.ts) — Claude's replies their real cost + 30٪, everything else 60٪. Pure: pages and server alike.

import { coinStr, coinsFor, fmtSar, COIN_MARK, type PriceKind } from "@config/coins";

/** A film job's kind of price, by the service that does it. */
export const serviceKind = (service: string | null | undefined): PriceKind =>
  service === "anthropic" ? "claude" : service === "openai_image" ? "image" : service === "seedance" || service === "lipsync" ? "video" : "other";

/** One cost: «¤2.50» — the site's own coin (pages show it through <Coined>: the coin's logo and the amount, never a currency word). */
export const credits = (usd: number, kind: PriceKind = "other") => coinStr(usd > 0 ? coinsFor(usd, kind) : 0);

/** A range («تقريبًا ¤0.50–4.50»). */
export const creditsRange = (lo: number, hi: number, kind: PriceKind = "other") => `تقريبًا ${COIN_MARK}${fmtSar(coinsFor(lo, kind))}–${fmtSar(coinsFor(hi, kind))}`;

/** A project's spend so far, each service at its own profit (the sum of what was charged). */
export const creditsByService = (byService: Record<string, number>) => {
  const h = Object.entries(byService).reduce((s, [service, usd]) => s + (usd > 0 ? coinsFor(usd, serviceKind(service)) : 0), 0);
  return coinStr(h > 0 ? h : 0);
};
