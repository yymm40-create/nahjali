import Link from "next/link";
import { redirect } from "next/navigation";
import { requireFilmUser, requireProject } from "@/lib/film/access";
import { latestJob, runningImageJobs, sheetAssets, sheetVersions } from "@/lib/film/sheets";
import { projectCost } from "@/lib/film/usage";
import { FILM_BUCKET } from "@/lib/film/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { FILM_STYLES } from "@config/film-styles";
import SheetsWorkspace from "./SheetsWorkspace";

export const metadata = { title: "صانع الشيت | نهج علي" };
export const dynamic = "force-dynamic";

export default async function SheetsPage({ params }: PageProps<"/film/[id]/sheets">) {
  const { id } = await params;
  const { user, allowed } = await requireFilmUser(`/film/${id}/sheets`);
  if (!allowed) redirect("/film");
  const project = await requireProject(id, user.id);
  if (project.stage === "screenwriter") redirect(`/film/${id}/script`);

  const [versions, assets, job, imageJobs, cost] = await Promise.all([
    sheetVersions(id),
    sheetAssets(id),
    latestJob(id, "sheets"),
    runningImageJobs(id),
    projectCost(id),
  ]);
  // Short-lived links: every picture stays private
  const paths = assets.filter((a) => a.storage_path).map((a) => a.storage_path!);
  const signed = paths.length ? ((await createAdminClient().storage.from(FILM_BUCKET).createSignedUrls(paths, 3600)).data ?? []) : [];
  const url: Record<string, string> = {};
  signed.forEach((s, i) => s.signedUrl && (url[paths[i]] = s.signedUrl));

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href={`/film/${id}`} className="text-sm font-bold text-muted">→ {project.title}</Link>
        <h1 className="display text-4xl">🎨 صانع الشيت</h1>
        <p className="text-sm font-bold text-muted">
          الفهم وخريطة الشيتات ← أسئلة التصميم ← اختبار الستايل ← الماستر ← شيت لكل شخصية ومكان، وبعدها ينتقل تلقائيًا للمخرج.
          النصوص <span dir="ltr">${(cost.byService.anthropic ?? 0).toFixed(2)}</span> · الصور <span dir="ltr">${(cost.byService.openai_image ?? 0).toFixed(2)}</span>
        </p>
      </header>
      <SheetsWorkspace
        projectId={id}
        stage={project.stage}
        versions={versions}
        assets={assets.map((a) => ({ id: a.id, kind: a.kind, ref_key: a.ref_key, status: a.status, error: a.error, meta: a.meta, url: a.storage_path ? (url[a.storage_path] ?? "") : "", created_at: a.created_at }))}
        job={job ? { status: job.status, error: job.error } : null}
        imagesRunning={imageJobs.length}
        styles={FILM_STYLES.map(({ id, group, name, description, feel, bestFor }) => ({ id, group, name, description, feel, bestFor }))}
      />
    </div>
  );
}
