import { notFound } from "next/navigation";
import KhateebGate from "@/components/jawad/khateeb/KhateebGate";
import StudentHome from "@/components/jawad/student/StudentHome";
import { listProjects } from "@/lib/jawad/student/actions";
import { enterKhateeb } from "@/lib/khateeb/door";
import { KHATEEB } from "@config/jawad/khateeb";

export const dynamic = "force-dynamic";
export const metadata = { title: KHATEEB.name, robots: { index: false, follow: false } };

/** «الخطيب الذكي»: the hidden branch's home — the sermon materials of this person. Only by the owner's link and password. */
export default async function KhateebPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const door = await enterKhateeb(slug);
  if (door.gate) return <KhateebGate slug={slug} />;
  const projects = await listProjects(door.user.id, KHATEEB.branch).catch(() => null);
  if (!projects) notFound();
  return <StudentHome name={KHATEEB.name} projects={projects} loginHref={null} left={null} />;
}
