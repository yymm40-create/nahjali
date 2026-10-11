import { notFound } from "next/navigation";
import KhateebGate from "@/components/jawad/khateeb/KhateebGate";
import KhateebHome from "@/components/jawad/khateeb/KhateebHome";
import { listProjects } from "@/lib/jawad/student/actions";
import { enterKhateeb } from "@/lib/khateeb/door";
import { readyRefs } from "@/lib/khateeb/reference";
import { KHATEEB } from "@config/jawad/khateeb";

export const dynamic = "force-dynamic";
export const metadata = { title: KHATEEB.name, robots: { index: false, follow: false } };

/** «الخطيب الذكي»: the hidden branch's home — the preacher's request (topic and goal) and his sermons. Only by the owner's link. */
export default async function KhateebPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const door = await enterKhateeb(slug);
  if (door.gate) return <KhateebGate slug={slug} />;
  const [projects, refs] = await Promise.all([listProjects(door.user.id, KHATEEB.branch).catch(() => null), readyRefs().catch(() => [])]);
  if (!projects) notFound();
  return <KhateebHome projects={projects} refs={{ poetry: refs.filter((r) => r.kind === "poetry").length, sources: refs.filter((r) => r.kind === "source").length }} />;
}
