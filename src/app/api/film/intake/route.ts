import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { robotTurn } from "@/lib/claude-run";
import { requireFilmApiUser } from "@/lib/film/access";
import { confirmJourneyUpgrade, understandJourney, type JourneyIntakeBody } from "@/lib/film/intake";

export const maxDuration = 120;

export const POST = handle(async (req: Request) => {
  const user = await requireFilmApiUser();
  const body = (await req.json().catch(() => ({}))) as JourneyIntakeBody;
  if (body.action === "confirm_upgrade") return NextResponse.json(await confirmJourneyUpgrade(user.id, body));
  const result = await robotTurn(user, "claude-opus-5-5", "سجاد يجهّز رحلة العمل", () => understandJourney(user, body), undefined, { memory: "isolated" });
  return NextResponse.json(result);
});
