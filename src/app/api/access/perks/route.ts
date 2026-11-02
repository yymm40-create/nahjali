import { NextResponse } from "next/server";
import { handle, requireApiUser } from "@/lib/api";
import { perksOf, unlimitedFor } from "@/lib/access";
import { coinsRequired } from "@/lib/coins";
import { isAdmin } from "@config/site";

/** What the signed-in person's codes give that the pages show: «بسعر الأداة» (orange coin) and the Claude ceiling. Nothing for anyone else. */
export const GET = handle(async () => {
  const user = await requireApiUser().catch(() => null);
  const p = user ? await perksOf(user.email).catch(() => null) : null;
  // the robots' replies cost this person nothing (the owner, an unlimited account, or coins switched off): the picker then
  // shows a conversation's VALUE «مجانية لك», not «أُخذ منك»
  const free = user ? isAdmin(user.email) || (await unlimitedFor(user.email).catch(() => false)) || !(await coinsRequired().catch(() => true)) : false;
  return NextResponse.json({ atCost: p?.atCost === true, claudeModel: p?.claudeModel ?? null, free }, { headers: { "Cache-Control": "private, no-store" } });
});
