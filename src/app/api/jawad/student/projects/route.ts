import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { createProject, listProjects } from "@/lib/jawad/student/actions";

/** «الطالب الذكي» · the student's materials. */
export const GET = handle(async () => {
  const { user } = await requireJawadApiUser();
  return NextResponse.json({ projects: await listProjects(user.id) });
});

/** A new material: `{ title, level, audience }`. */
export const POST = handle(async (req: Request) => {
  const { user } = await requireJawadApiUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json({ id: await createProject(user, b) });
});
