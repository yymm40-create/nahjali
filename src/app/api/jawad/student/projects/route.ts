import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireStudentApiUser } from "@/lib/jawad/server/access";
import { createProject, listProjects } from "@/lib/jawad/student/actions";

/** «الطالب الذكي» · the student's materials. */
export const GET = handle(async () => {
  const { user } = await requireStudentApiUser();
  return NextResponse.json({ projects: await listProjects(user.id) });
});

/** A new material: `{ title, level, audience }`. */
export const POST = handle(async (req: Request) => {
  const { user } = await requireStudentApiUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json({ id: await createProject(user, b) });
});
