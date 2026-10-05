import { notFound } from "next/navigation";
import StudentProject from "@/components/jawad/student/StudentProject";
import { UserError } from "@/lib/api";
import { requireJawadUser } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { projectState } from "@/lib/jawad/student/actions";
import { STUDENT } from "@config/jawad/student";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const metadata = { title: "الطالب الذكي" };

/** One material, from its sources to its outputs. Only its owner can open it. */
export default async function StudentProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ user, owner }, rt] = await Promise.all([requireJawadUser(`${STUDENT.base}/${id}`), loadRuntime()]);
  const section = rt.sections.find((s) => s.implementation === "student");
  if (!section || (!section.enabled && !owner)) notFound();
  const state = await projectState(user, id).catch((e) => {
    if (e instanceof UserError) return null;
    throw e;
  });
  if (!state) notFound();
  return <StudentProject initial={JSON.parse(JSON.stringify(state))} />;
}
