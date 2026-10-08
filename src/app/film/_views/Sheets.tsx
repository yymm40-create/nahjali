import { credits } from "@/lib/film/credits";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireFilmUser, requireProject } from "@/lib/film/access";
import { latestJob, runningImageJobs, sheetAssets, sheetVersions } from "@/lib/film/sheets";
import { projectCost } from "@/lib/film/usage";
import { FILM_BUCKET } from "@/lib/film/types";
import { FILM_STYLES, styleImage } from "@config/film-styles";
import SheetsWorkspace from "../[id]/sheets/SheetsWorkspace";
import { castLinks, castOf } from "@/lib/film/series-cast";


import { storage } from "@/lib/storage";
export default async function SheetsView({ id, base }: { id: string; base: string }) {
  const { user, allowed } = await requireFilmUser(`${base}/${id}/sheets`);
  if (!allowed) redirect(base);
  const project = await requireProject(id, user.id);
  if (project.stage === "screenwriter") redirect(`${base}/${id}/script`);

  const [versions, assets, job, imageJobs, cost] = await Promise.all([
    sheetVersions(id),
    sheetAssets(id),
    latestJob(id, "sheets"),
    runningImageJobs(id),
    projectCost(id),
  ]);
  // a series' scene: its series' ready characters, places and style, to take as they are on the map
  const series = project.series_id ? (await castOf(project.series_id)).filter((c) => c.status === "ready") : [];
  const seriesLinks = series.length ? await castLinks(series) : {};
  // Short-lived links: every picture stays private
  const paths = assets.filter((a) => a.storage_path).map((a) => a.storage_path!);
  const signed = paths.length ? ((await storage.from(FILM_BUCKET).createSignedUrls(paths, 3600)).data ?? []) : [];
  const url: Record<string, string> = {};
  signed.forEach((s, i) => s.signedUrl && (url[paths[i]] = s.signedUrl));

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        {project.series_id && <Link href={`${base}/${id}`} className="text-sm font-bold text-muted">→ {project.title}</Link>}
        <h1 className={project.series_id ? "display text-4xl" : "display text-2xl"}>🎨 صانع الشيت</h1>
        <p className="text-sm font-bold text-muted">
          خريطة الشيتات ← اختبار الستايل (كل ستايل بصورته) ← بس تعتمد الستايل ينرسم الماستر وكل الشيتات لحالهم ← تعتمد الصور (الكل، المحدد، أو وحدة وحدة)، وبعدها ينتقل تلقائيًا للمخرج.
          النصوص <span>{credits(cost.byService.anthropic ?? 0)}</span> · الصور <span>{credits(cost.byService.openai_image ?? 0)}</span>
        </p>
      </header>
      <SheetsWorkspace
        editsLeft={null}
        projectId={id}
        stage={project.stage}
        versions={versions}
        assets={assets.map((a) => ({ id: a.id, kind: a.kind, ref_key: a.ref_key, status: a.status, error: a.error, meta: a.meta, url: a.storage_path ? (url[a.storage_path] ?? "") : "", created_at: a.created_at, version_id: a.version_id ?? null }))}
        job={job ? { status: job.status, error: job.error } : null}
        imagesRunning={imageJobs.length}
        seriesCast={series.map((c) => ({ id: c.id, kind: c.kind, name: c.name, url: seriesLinks[c.id] ?? "" }))}
        styles={FILM_STYLES.map(({ id, group, name, description, feel, bestFor }) => ({ id, group, name, description, feel, bestFor, image: styleImage(id) }))}
      />
    </div>
  );
}
