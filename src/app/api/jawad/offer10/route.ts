import { NextResponse } from "next/server";
import { handle, requireApiUser } from "@/lib/api";
import { offer10Status, startOffer10 } from "@/lib/jawad/server/offer10";

export const dynamic = "force-dynamic";

/** «عرض الـ١٠ ريال»: POST → { url } of Moyasar's page for 10 riyals (signed in). GET → what this person has of the offer. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  return NextResponse.json(await startOffer10(user, new URL(req.url).origin));
});

export const GET = handle(async () => {
  const user = await requireApiUser();
  return NextResponse.json({ grants: await offer10Status(user.id) });
});
