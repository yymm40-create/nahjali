import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { robotTurn } from "@/lib/claude-run";
import { requireFilmApiUser } from "@/lib/film/access";
import { confirmJourneyUpgrade, understandJourney, type JourneyIntakeBody } from "@/lib/film/intake";
import { isFilmJourney, journeyModelId } from "@config/film-journey";

export const maxDuration = 300;

export const POST = handle(async (req: Request) => {
  const user = await requireFilmApiUser();
  const body = (await req.json().catch(() => ({}))) as JourneyIntakeBody;
  if (body.action === "confirm_upgrade") return NextResponse.json(await confirmJourneyUpgrade(user.id, body));
  // a new film's journey («اختر رحلتك») gives سجاد's reading its mind; else the person's model (the page sends it; none =
  // the default), not a hard-coded Opus. A code's ceiling is applied by robotTurn either way
  const journey = (body as { journey?: unknown }).journey;
  const result = await robotTurn(user, isFilmJourney(journey) ? journeyModelId(journey, "intake") : body.model, "سجاد يجهّز رحلة العمل", () => understandJourney(user, body), undefined, { memory: "isolated" });
  return NextResponse.json(result);
});
