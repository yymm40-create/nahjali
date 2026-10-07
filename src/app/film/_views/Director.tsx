import { credits } from "@/lib/film/credits";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireFilmUser, requireProject } from "@/lib/film/access";
import { checkVideos, directorVersions, directorVideos, referenceLibrary, superDirectorOn } from "@/lib/film/director";
import { latestJob } from "@/lib/film/sheets";
import { projectCost } from "@/lib/film/usage";
import { FILM_BUCKET } from "@/lib/film/types";
import DirectorWorkspace from "../[id]/director/DirectorWorkspace";


import { storage } from "@/lib/storage";
export default async function DirectorView({ id, base }: { id: string; base: string }) {
  const { user, allowed } = await requireFilmUser(`${base}/${id}/director`);
  if (!allowed) redirect(base);
  const project = await requireProject(id, user.id);
  if (project.stage === "screenwriter") redirect(`${base}/${id}/script`);
  if (project.stage === "sheets") redirect(`${base}/${id}/sheets`);

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
  const signed = paths.length ? ((await storage.from(FILM_BUCKET).createSignedUrls(paths, 3600)).data ?? []) : [];
  const url: Record<string, string> = {};
  signed.forEach((s, i) => s.signedUrl && (url[paths[i]] = s.signedUrl));

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href={`${base}/${id}`} className="text-sm font-bold text-muted">→ {project.title}</Link>
        <h1 className="display text-4xl">🎥 المخرج السينمائي</h1>
        <p className="text-sm font-bold text-muted">
          الفهم ← أسئلة الإخراج ← خريطة التوليدات ← تحليل وبرومبت لكل توليد، والاعتماد يولّد الفيديو.
          النصوص <span>{credits(cost.byService.anthropic ?? 0)}</span> · الفيديو <span>{credits(cost.byService.seedance ?? 0)}</span>
        </p>
      </header>
      <DirectorWorkspace
        editsLeft={null}
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
