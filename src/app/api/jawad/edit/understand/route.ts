import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { robotTurn } from "@/lib/claude-run";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { smartEditProjects, smartEditUnderstanding, type SmartUnderstandingBody } from "@/lib/jawad/server/smart-understanding";

export const maxDuration = 120;

export const GET = handle(async () => {
  const { user } = await requireJawadApiUser();
  return NextResponse.json({ projects: await smartEditProjects(user.id) }, { headers: { "cache-control": "no-store" } });
});

export const POST = handle(async (req: Request) => {
  const { user } = await requireJawadApiUser();
  const body = (await req.json().catch(() => ({}))) as SmartUnderstandingBody;
  const result = await robotTurn(user, "claude-opus-5-5", "فهم التعديل الذكي", () => smartEditUnderstanding(user, body), undefined, { memory: "isolated" });
  return NextResponse.json(result);
});
