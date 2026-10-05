import { notFound } from "next/navigation";
import StudentHome from "@/components/jawad/student/StudentHome";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { listProjects, materialsMade, MATERIALS_PER_PERSON } from "@/lib/jawad/student/actions";
import { isUnlimited } from "@config/site";
import { STUDENT } from "@config/jawad/student";

export const dynamic = "force-dynamic";
export const metadata = { title: "الطالب الذكي" };

/** «الطالب الذكي»: the student's materials and a new one. */
export default async function StudentPage() {
  // Open to every visitor: browsing needs no account; making something asks to sign in first
  const [{ user, owner }, rt] = await Promise.all([jawadSession(), loadRuntime()]);
  const section = rt.sections.find((s) => s.implementation === "student");
  if (!section || (!section.enabled && !owner)) notFound();
  const projects = user ? await listProjects(user.id).catch(() => null) : [];
  const left = user && !isUnlimited(user.email) ? Math.max(0, MATERIALS_PER_PERSON - materialsMade(user)) : null;
  return <StudentHome name={section.name} projects={projects} loginHref={user ? null : jawadLogin(STUDENT.base)} left={left} />;
}
