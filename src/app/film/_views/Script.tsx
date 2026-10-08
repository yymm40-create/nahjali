import { credits } from "@/lib/film/credits";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireFilmUser, requireProject } from "@/lib/film/access";
import { latestScriptJob, scriptVersions } from "@/lib/film/script";
import { projectCost } from "@/lib/film/usage";
import ScriptWorkspace from "../[id]/script/ScriptWorkspace";


export default async function ScriptView({ id, base }: { id: string; base: string }) {
  const { user, allowed } = await requireFilmUser(`${base}/${id}/script`);
  if (!allowed) redirect(base);
  const project = await requireProject(id, user.id);

  const [versions, job, cost] = await Promise.all([scriptVersions(id), latestScriptJob(id), projectCost(id)]);
  const scriptCost = cost.byService.anthropic ?? 0;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href={`${base}/${id}`} className="text-sm font-bold text-muted">→ {project.title}</Link>
        <h1 className="display text-4xl">✍️ السيناريست</h1>
        <p className="text-sm font-bold text-muted">
          يمشي على برومبت «السيناريست الذكي» من الدورة: الفهم ← الأسئلة ← السيناريو (مع القصة المطوّرة فيه)، وبعدها ينتقل تلقائيًا لصانع الشيت.
          تكلفة النصوص إلى الآن: <span>{credits(scriptCost)}</span>
        </p>
      </header>
      <ScriptWorkspace
        editsLeft={null}
        projectId={id}
        hasStory={project.story.trim().length >= 10}
        versions={versions}
        job={job ? { status: job.status, error: job.error } : null}
        stage={project.stage}
      />
    </div>
  );
}
