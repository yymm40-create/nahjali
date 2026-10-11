import { notFound } from "next/navigation";
import KhateebGate from "@/components/jawad/khateeb/KhateebGate";
import KhateebRun from "@/components/jawad/khateeb/KhateebRun";
import StudentProject from "@/components/jawad/student/StudentProject";
import { UserError } from "@/lib/api";
import { projectState } from "@/lib/jawad/student/actions";
import { enterKhateeb } from "@/lib/khateeb/door";
import { KHATEEB, isKhateeb } from "@config/jawad/khateeb";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const metadata = { title: KHATEEB.name, robots: { index: false, follow: false } };

/** One sermon of the hidden «الخطيب الذكي»: the Sheikh preparing it by himself, then its files. Only its owner can open it. */
export default async function KhateebProjectPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const door = await enterKhateeb(slug, `/${id}`);
  if (door.gate) return <KhateebGate slug={slug} />;
  const state = await projectState(door.user, id).catch((e) => {
    if (e instanceof UserError) return null;
    throw e;
  });
  if (!state || !isKhateeb(state.project.branch)) notFound();
  const initial = JSON.parse(JSON.stringify(state));
  // the Sheikh's own journey (topic and goal given); a sermon begun before it keeps the student's steps
  return state.project.brief.sermon ? <KhateebRun initial={initial} /> : <StudentProject initial={initial} />;
}
