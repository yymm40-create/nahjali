// Paying for a series' own work (outside any scene): سجاد's replies, the style and the characters' and places' pictures.
// A team series pays from its «نقود الفريق الذكي» (and a member's picture uses one of their attempts); a series of one
// person pays from its owner's «النقود الذكية». Reserved from the estimate, settled to the real cost, given back on
// failure — the same as the film's jobs. Server only.

import { refundCoins, reserveCoins, reserveTeamCoins, settleCoins } from "@/lib/coins";
import { giveAttempt, takeAttempt } from "./team";
import type { FilmSeries } from "./series";

type Who = { id: string; email?: string | null };

export interface SeriesCharge {
  ref: string;
  series: Pick<FilmSeries, "id" | "user_id" | "mode">;
  who: Who;
  took: boolean;
}

/** Holds the estimated cost (and, for a team member's picture, an attempt). Throws a clear message when short. */
export async function reserveSeries(series: Pick<FilmSeries, "id" | "user_id" | "mode">, who: Who, usd: number, label: string, o: { attempt?: boolean } = {}): Promise<SeriesCharge> {
  const ref = `series:${series.id}:${crypto.randomUUID()}`;
  const took = series.mode === "team" && o.attempt ? await takeAttempt(series.id, series.user_id, who.id) : false;
  try {
    if (series.mode === "team") await reserveTeamCoins(series.id, who, ref, usd, label);
    else await reserveCoins(who, ref, usd, label);
  } catch (e) {
    if (took) await giveAttempt(series.id, who.id).catch(() => {});
    throw e;
  }
  return { ref, series, who, took };
}

/** The work is done: its real cost replaces the estimate. */
export const settleSeries = (c: SeriesCharge, usd: number) => settleCoins(c.ref, usd).catch((e) => console.error("series settle failed", e));

/** The work failed: everything held goes back (the attempt too). */
export async function refundSeries(c: SeriesCharge) {
  await refundCoins(c.ref).catch((e) => console.error("series refund failed", e));
  if (c.took) await giveAttempt(c.series.id, c.who.id).catch(() => {});
}

/** Runs a paid piece of work: reserved first, settled to its real cost, given back if it throws. */
export async function seriesPaid<T>(series: Pick<FilmSeries, "id" | "user_id" | "mode">, who: Who, usd: number, label: string, run: () => Promise<{ value: T; usd: number }>, o: { attempt?: boolean } = {}) {
  const c = await reserveSeries(series, who, usd, label, o);
  try {
    const r = await run();
    await settleSeries(c, r.usd);
    return r.value;
  } catch (e) {
    await refundSeries(c);
    throw e;
  }
}
