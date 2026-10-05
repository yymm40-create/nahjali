import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { outputAction } from "@/lib/jawad/student/actions";

export const maxDuration = 300;

/** «الطالب الذكي» · one output: `{ action, … }` — settings, plan, trial, final, request, approve, quiz answers… */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireJawadApiUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(await outputAction(user, (await ctx.params).id, b));
});
