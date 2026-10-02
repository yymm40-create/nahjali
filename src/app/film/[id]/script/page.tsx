import Link from "next/link";
import { redirect } from "next/navigation";
import { requireFilmUser, requireProject } from "@/lib/film/access";
import { latestScriptJob, scriptVersions } from "@/lib/film/script";
import { projectCost } from "@/lib/film/usage";
import ScriptWorkspace from "./ScriptWorkspace";

export const metadata = { title: "السيناريست | نهج علي" };
export const dynamic = "force-dynamic";

export default async function ScriptPage({ params }: PageProps<"/film/[id]/script">) {
  const { id } = await params;
  const { user, allowed } = await requireFilmUser(`/film/${id}/script`);
  if (!allowed) redirect("/film");
  const project = await requireProject(id, user.id);

  const [versions, job, cost] = await Promise.all([scriptVersions(id), latestScriptJob(id), projectCost(id)]);
  const scriptCost = cost.byService.anthropic ?? 0;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href={`/film/${id}`} className="text-sm font-bold text-muted">→ {project.title}</Link>
        <h1 className="display text-4xl">✍️ السيناريست</h1>
        <p className="text-sm font-bold text-muted">
          يمشي على برومبت «السيناريست الذكي» من الدورة: الفهم ← الأسئلة ← القصة المطوّرة ← السيناريو، وبعدها ينتقل تلقائيًا لصانع الشيت.
          تكلفة النصوص إلى الآن: <span dir="ltr">${scriptCost.toFixed(2)}</span>
        </p>
      </header>
      <ScriptWorkspace
        projectId={id}
        hasStory={project.story.trim().length >= 10}
        versions={versions}
        job={job ? { status: job.status, error: job.error } : null}
        stage={project.stage}
      />
    </div>
  );
}
