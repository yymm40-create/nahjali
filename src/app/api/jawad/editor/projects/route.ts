import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireStudentApiUser } from "@/lib/jawad/server/access";
import { createEditorProject, listEditorProjects } from "@/lib/editor/server";

/** «حيدرة كت» · the person's edits (open to every signed-in person, like «الطالب الذكي»). */
export const GET = handle(async () => {
  const { user } = await requireStudentApiUser();
  return NextResponse.json({ projects: await listEditorProjects(user.id) }, { headers: { "Cache-Control": "no-store" } });
});

/** A new edit: `{ title?, kind: "reel" | "horizontal" | "podcast" | "poem" }`. */
export const POST = handle(async (req: Request) => {
  const { user } = await requireStudentApiUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json({ id: await createEditorProject(user.id, b) });
});
