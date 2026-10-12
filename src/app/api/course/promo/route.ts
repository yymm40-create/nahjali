import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { loadSettings } from "@/lib/course/settings";
import { offersAt, savingPct } from "@config/course";

export const dynamic = "force-dynamic";

/** «دورة الجواد الذكي» · what the window that opens for every visitor shows: the words and the price in force now (public). */
export const GET = handle(async () => {
  const s = await loadSettings();
  const o = offersAt(s, Date.now());
  const first = o.offers[0] ?? null;
  return NextResponse.json({
    headline: s.headline,
    subhead: s.subhead,
    phase: o.phase,
    offer: first ? { product: first.product, label: first.label, price: first.price, was: first.was, saving: savingPct(first), bonus: first.bonus } : null,
    endsAt: o.endsAt,
    now: Date.now(),
  });
});
