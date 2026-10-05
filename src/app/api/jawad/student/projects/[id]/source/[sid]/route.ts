import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireStudentApiUser } from "@/lib/jawad/server/access";
import { sourceFile } from "@/lib/jawad/student/actions";

/** «الطالب الذكي» · a source file of the student's (a short-lived link, after the ownership check). */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string; sid: string }> }) => {
  const { user } = await requireStudentApiUser();
  const { id, sid } = await ctx.params;
  return NextResponse.redirect(await sourceFile(user.id, id, sid));
});
