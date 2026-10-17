import { notFound } from "next/navigation";
import { can } from "@/lib/access";
import SectionClosed from "@/components/jawad/SectionClosed";
import StudentDeck from "@/components/jawad/student/StudentDeck";
import { UserError } from "@/lib/api";
import { requireJawadUser } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { getOutput } from "@/lib/jawad/student/db";
import { STUDENT } from "@config/jawad/student";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const metadata = { title: "محرر العرض" };

/** «🎨 محرر العرض»: a deck صادق designed — edit it, show it, take its PDF / PPTX. Only its owner can open it. */
export default async function StudentDeckPage({ params }: { params: Promise<{ oid: string }> }) {
  const { oid } = await params;
  const [{ user, owner }, rt] = await Promise.all([requireJawadUser(`${STUDENT.base}/deck/${oid}`), loadRuntime()]);
  const section = rt.sections.find((s) => s.implementation === "student");
  if (!section || (!section.enabled && !owner)) notFound();
  if (!(await can(user.email, "student"))) return <SectionClosed icon="🎒" name={section.name} />;
  const o = await getOutput(user.id, oid).catch((e) => {
    if (e instanceof UserError) return null;
    throw e;
  });
  if (!o || o.kind !== "slides" || o.settings.render !== "design") notFound();
  return <StudentDeck outputId={o.id} projectId={o.project_id} title={o.title} />;
}
