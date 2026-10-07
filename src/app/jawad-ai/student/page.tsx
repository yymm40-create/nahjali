import { notFound } from "next/navigation";
import StudentHome from "@/components/jawad/student/StudentHome";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { listProjects } from "@/lib/jawad/student/actions";
import { can } from "@/lib/access";
import SectionClosed from "@/components/jawad/SectionClosed";
import { STUDENT } from "@config/jawad/student";

export const dynamic = "force-dynamic";
export const metadata = { title: "الطالب الذكي" };

/** «الطالب الذكي»: the student's materials and a new one. */
export default async function StudentPage() {
  // Browsing needs no account; making something asks to sign in, and is for those the dashboard's list lets in
  const [{ user, owner }, rt] = await Promise.all([jawadSession(), loadRuntime()]);
  const section = rt.sections.find((s) => s.implementation === "student");
  if (!section || (!section.enabled && !owner)) notFound();
  if (user && !(await can(user.email, "student"))) return <SectionClosed icon="🎒" name={section.name} />;
  const projects = user ? await listProjects(user.id).catch(() => null) : [];
  return <StudentHome name={section.name} projects={projects} loginHref={user ? null : jawadLogin(STUDENT.base)} left={null} />;
}

