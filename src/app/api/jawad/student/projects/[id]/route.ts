import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireStudentApiUser } from "@/lib/jawad/server/access";
import { projectAction, projectState } from "@/lib/jawad/student/actions";

// Jobs continue after the response (next/server `after`): a run takes up to ~150 s, then the next poll continues it
export const maxDuration = 300;

/** «الطالب الذكي» · a material's full state (and moves its open steps forward). */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireStudentApiUser();
  return NextResponse.json(await projectState(user, (await ctx.params).id));
});

/** «الطالب الذكي» · `{ action, … }`: sources, review, approvals, scope, research, outputs (see lib/jawad/student/actions). */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireStudentApiUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(await projectAction(user, (await ctx.params).id, b));
});
