import Link from "next/link";
import { redirect } from "next/navigation";
import { filmTrialVideos, requireFilmUser, requireProject } from "@/lib/film/access";
import { isAdmin } from "@config/site";
import { FILM_PUBLIC_TRIAL } from "@config/film";
import { checkVideos, directorVersions, directorVideos, purgeOldVideos } from "@/lib/film/director";
import { projectCost } from "@/lib/film/usage";
import { FILM_BUCKET } from "@/lib/film/types";
import { createAdminClient } from "@/lib/supabase/admin";
import VideosWorkspace from "./VideosWorkspace";

export const metadata = { title: "توليد الفيديو | نهج علي" };
export const dynamic = "force-dynamic";
// Finished videos are copied to storage while the page loads
export const maxDuration = 300;

export default async function VideosPage({ params }: PageProps<"/film/[id]/videos">) {
  const { id } = await params;
  const { user, allowed } = await requireFilmUser(`/film/${id}/videos`);
  if (!allowed) redirect("/film");
  const project = await requireProject(id, user.id);
  if (project.stage === "screenwriter") redirect(`/film/${id}/script`);
  if (project.stage === "sheets") redirect(`/film/${id}/sheets`);

  await purgeOldVideos(project);
  const videosRunning = await checkVideos(project);
  const [versions, videos, cost] = await Promise.all([directorVersions(id), directorVideos(id), projectCost(id)]);
  const map = versions.filter((v) => v.kind === "dir_map" && v.status === "approved").at(-1)?.data.generation_map ?? [];
  const approved = versions.filter((v) => v.kind === "dir_generation" && v.status === "approved");
  if (!approved.length) redirect(`/film/${id}/director`);
  // Generations in the map's order; each with its latest approved version
  const ids = [...new Set([...map.map((g) => g.id), ...approved.map((v) => v.ref_key)])].filter((g) => approved.some((v) => v.ref_key === g));
  const generations = ids.map((g) => {
    const v = approved.filter((x) => x.ref_key === g).at(-1)!;
    return { id: g, name: map.find((m) => m.id === g)?.name ?? "", model: v.data.video_model ?? "seedance-2.5", durationSec: v.data.duration_sec ?? 10, ratio: v.data.ratio ?? "16:9", audio: v.data.generate_audio ?? true };
  });

  // Short-lived links: one to watch, one that downloads the file
  const db = createAdminClient();
  const kept = videos.filter((v) => v.storage_path);
  const watch = kept.length ? ((await db.storage.from(FILM_BUCKET).createSignedUrls(kept.map((v) => v.storage_path!), 3600)).data ?? []) : [];
  const links: Record<string, { url: string; download: string }> = {};
  for (const [i, v] of kept.entries()) {
    const d = await db.storage.from(FILM_BUCKET).createSignedUrl(v.storage_path!, 3600, { download: `${project.title}-${v.ref_key}.mp4` });
    links[v.id] = { url: watch[i]?.signedUrl ?? "", download: d.data?.signedUrl ?? "" };
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href={`/film/${id}`} className="text-sm font-bold text-muted">→ {project.title}</Link>
        <h1 className="display text-4xl">🎬 توليد الفيديو</h1>
        <p className="text-sm font-bold text-muted">
          آخر قرار قبل التوليد: اختر الجودة، وولّد كل توليد معتمد من المخرج. الفيديو حتى الآن <span dir="ltr">${(cost.byService.seedance ?? 0).toFixed(2)}</span>
        </p>
      </header>
      <VideosWorkspace
        projectId={id}
        stage={project.stage}
        generations={generations}
        videos={videos.map((v) => ({
          id: v.id,
          ref_key: v.ref_key,
          status: v.status,
          error: v.error,
          resolution: String(v.meta?.resolution ?? ""),
          ratio: String(v.meta?.ratio ?? ""),
          removed: Boolean(v.meta?.removed_at),
          createdAt: v.created_at,
          url: links[v.id]?.url ?? "",
          download: links[v.id]?.download ?? "",
        }))}
        videosRunning={videosRunning}
        trialVideoUsed={FILM_PUBLIC_TRIAL.open && !isAdmin(user.email) ? (await filmTrialVideos(user.id)).taken > 0 : null}
      />
    </div>
  );
}
