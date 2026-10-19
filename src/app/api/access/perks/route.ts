import { NextResponse } from "next/server";
import { handle, requireApiUser } from "@/lib/api";
import { perksOf } from "@/lib/access";

/** What the signed-in person's codes give that the pages show: «بسعر الأداة» (orange coin) and the Claude ceiling. Nothing for anyone else. */
export const GET = handle(async () => {
  const user = await requireApiUser().catch(() => null);
  const p = user ? await perksOf(user.email).catch(() => null) : null;
  return NextResponse.json({ atCost: p?.atCost === true, claudeModel: p?.claudeModel ?? null }, { headers: { "Cache-Control": "private, no-store" } });
});
