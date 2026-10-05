import { notFound } from "next/navigation";
import StudentHome from "@/components/jawad/student/StudentHome";
import { requireJawadUser } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { listProjects } from "@/lib/jawad/student/actions";
import { STUDENT } from "@config/jawad/student";

export const dynamic = "force-dynamic";
export const metadata = { title: "الطالب الذكي" };

/** «الطالب الذكي»: the student's materials and a new one. */
export default async function StudentPage() {
  const [{ user, owner, allowed }, rt] = await Promise.all([requireJawadUser(STUDENT.base), loadRuntime()]);
  const section = rt.sections.find((s) => s.implementation === "student");
  if (!allowed || !section || (!section.enabled && !owner)) notFound();
  const projects = await listProjects(user.id).catch(() => null);
  return <StudentHome name={section.name} projects={projects} />;
}
