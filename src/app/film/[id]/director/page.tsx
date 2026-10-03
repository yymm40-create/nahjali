import Link from "next/link";
import { redirect } from "next/navigation";
import { requireFilmUser, requireProject } from "@/lib/film/access";
import { checkVideos, directorVersions, directorVideos, referenceLibrary, superDirectorOn } from "@/lib/film/director";
import { latestJob } from "@/lib/film/sheets";
import { projectCost } from "@/lib/film/usage";
import { FILM_BUCKET } from "@/lib/film/types";
import { createAdminClient } from "@/lib/supabase/admin";
import DirectorWorkspace from "./DirectorWorkspace";

export const metadata = { title: "المخرج السينمائي | نهج علي" };
export const dynamic = "force-dynamic";
// Finished videos are copied to storage while the page loads
export const maxDuration = 300;

export default async function DirectorPage({ params }: PageProps<"/film/[id]/director">) {
  const { id } = await params;
  const { user, allowed } = await requireFilmUser(`/film/${id}/director`);
  if (!allowed) redirect("/film");
  const project = await requireProject(id, user.id);
  if (project.stage === "screenwriter") redirect(`/film/${id}/script`);
  if (project.stage === "sheets") redirect(`/film/${id}/sheets`);

  const videosRunning = await checkVideos(project);
  const [versions, videos, library, job, cost] = await Promise.all([
    directorVersions(id),
    directorVideos(id),
    referenceLibrary(id),
    latestJob(id, "director"),
    projectCost(id),
  ]);
  // Short-lived links: every file stays private
  const refs = Object.entries(library);
  const paths = [...videos.filter((v) => v.storage_path).map((v) => v.storage_path!), ...refs.map(([, a]) => a.storage_path!).filter(Boolean)];
  const signed = paths.length ? ((await createAdminClient().storage.from(FILM_BUCKET).createSignedUrls(paths, 3600)).data ?? []) : [];
  const url: Record<string, string> = {};
  signed.forEach((s, i) => s.signedUrl && (url[paths[i]] = s.signedUrl));

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href={`/film/${id}`} className="text-sm font-bold text-muted">→ {project.title}</Link>
        <h1 className="display text-4xl">🎥 المخرج السينمائي</h1>
        <p className="text-sm font-bold text-muted">
          الفهم ← أسئلة الإخراج ← خريطة التوليدات ← تحليل وبرومبت لكل توليد، والاعتماد يولّد الفيديو.
          النصوص <span dir="ltr">${(cost.byService.anthropic ?? 0).toFixed(2)}</span> · الفيديو <span dir="ltr">${(cost.byService.seedance ?? 0).toFixed(2)}</span>
        </p>
      </header>
      <DirectorWorkspace
        projectId={id}
        stage={project.stage}
        versions={versions}
        superDirector={superDirectorOn(versions)}
        videos={videos.map((v) => ({ id: v.id, ref_key: v.ref_key, status: v.status, error: v.error, meta: v.meta, url: v.storage_path ? (url[v.storage_path] ?? "") : "" }))}
        library={refs.map(([name, a]) => ({ name, sheetId: a.ref_key, url: a.storage_path ? (url[a.storage_path] ?? "") : "" }))}
        job={job ? { status: job.status, error: job.error } : null}
        videosRunning={videosRunning}
      />
    </div>
  );
}
