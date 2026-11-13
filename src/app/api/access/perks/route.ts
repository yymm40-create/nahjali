import { NextResponse } from "next/server";
import { handle, requireApiUser } from "@/lib/api";
import { fullAccessOf, unlimitedFor } from "@/lib/access";
import { coinsRequired } from "@/lib/coins";
import { isAdmin } from "@config/site";

/** What the signed-in person's codes give that the pages show: «بسعر الأداة» (orange coin; red for the owner's platform's-own-price list) and the Claude ceiling. Nothing for anyone else. */
export const GET = handle(async () => {
  const user = await requireApiUser().catch(() => null);
  const a = user ? await fullAccessOf(user.email).catch(() => null) : null;
  const p = a?.perks ?? null;
  // the robots' replies cost this person nothing (the owner, an unlimited account, or coins switched off): the picker then
  // shows a conversation's VALUE «مجانية لك», not «أُخذ منك»
  const free = user ? isAdmin(user.email) || (await unlimitedFor(user.email).catch(() => false)) || !(await coinsRequired().catch(() => true)) : false;
  // `red`: the owner's platform's-own-price list (the coin is red, not orange)
  return NextResponse.json({ atCost: p?.atCost === true, red: a?.redCoin === true, claudeModel: p?.claudeModel ?? null, free }, { headers: { "Cache-Control": "private, no-store" } });
});
