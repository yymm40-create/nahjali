import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireStudentApiUser } from "@/lib/jawad/server/access";
import { createProject, listProjects } from "@/lib/jawad/student/actions";
import { anyDoorOpen } from "@/lib/khateeb/gate";
import { isKhateeb, KHATEEB, STUDENT_BRANCH } from "@config/jawad/khateeb";

/** «الطالب الذكي» · the student's materials (`?branch=khateeb`: those of the hidden «الخطيب الذكي»). */
export const GET = handle(async (req: Request) => {
  const { user } = await requireStudentApiUser();
  const branch = isKhateeb(new URL(req.url).searchParams.get("branch")) ? KHATEEB.branch : STUDENT_BRANCH;
  return NextResponse.json({ projects: await listProjects(user.id, branch) });
});

/** A new material: `{ title, level, audience }`; `branch: "khateeb"` makes it in the hidden branch (only where its password was given). */
export const POST = handle(async (req: Request) => {
  const { user, student } = await requireStudentApiUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const khateeb = isKhateeb(b.branch);
  if (khateeb && !(await anyDoorOpen())) throw new UserError("هذا القسم يحتاج كلمة السر.", 403);
  if (!khateeb && !student) throw new UserError("«الطالب الذكي» مقفل لحسابك حاليًا.", 403);
  return NextResponse.json({ id: await createProject(user, b, khateeb ? KHATEEB.branch : STUDENT_BRANCH) });
});
