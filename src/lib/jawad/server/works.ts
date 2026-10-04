// «الجواد الذكي!» | JAWAD AI — the user's works: their jobs (with saved results) and the pictures and videos of
// their film projects, newest first, page by page. Server only; every link is a short-lived signed URL made after
// checking the owner, so nobody can open another person's files.

import { createAdminClient } from "@/lib/supabase/admin";
import { generatorById } from "@config/jawad/generators";
import { WORKS_PAGE_SIZE } from "@config/jawad/brand";
import { FILM_BUCKET } from "@/lib/film/types";
import type { FilmItemView, JobView, OutputView, WorkItem, WorksFilter } from "../labels";
import { JAWAD_BUCKET, loadRuntime } from "./runtime";
import type { JobRow, OutputRow } from "./jobs";

const db = () => createAdminClient();
const LINK_SECONDS = 6 * 3600;

async function sign(bucket: string, paths: string[]) {
  if (!paths.length) return new Map<string, string>();
  const { data } = await db().storage.from(bucket).createSignedUrls(paths, LINK_SECONDS);
  return new Map((data ?? []).map((d, i) => [paths[i], d.signedUrl ?? ""]));
}

/** Views of jobs with their results (the caller has already checked they belong to the user). */
export async function jobViews(jobs: JobRow[]): Promise<JobView[]> {
  if (!jobs.length) return [];
  const rt = await loadRuntime();
  const { data } = await db().from("jawad_outputs").select("*").in("job_id", jobs.map((j) => j.id)).order("idx");
  const outputs = (data ?? []) as OutputRow[];
  const urls = await sign(JAWAD_BUCKET, outputs.map((o) => o.storage_path));
  return jobs.map((j) => {
    const def = generatorById(j.generator_id);
    const outs: OutputView[] = outputs
      .filter((o) => o.job_id === j.id)
      .map((o) => ({
        id: o.id,
        kind: o.kind,
        url: urls.get(o.storage_path) || null,
        downloadUrl: `/api/jawad/outputs/${o.id}`,
        mime: o.mime,
        width: o.width,
        height: o.height,
        durationMs: o.duration_ms,
      }));
    return {
      type: "job",
      id: j.id,
      createdAt: j.created_at,
      finishedAt: j.finished_at,
      status: j.status,
      providerStatus: j.provider_status,
      progress: j.progress,
      generatorId: j.generator_id,
      generatorName: rt.generators.find((g) => g.id === j.generator_id)?.name ?? def?.name ?? j.generator_id,
      sectionId: j.section_id,
      outputKind: j.output_kind,
      mode: j.mode,
      prompt: j.prompt,
      instructions: j.inputs.instructions ?? "",
      settings: j.inputs.settings ?? {},
      refStyle: j.inputs.refStyle ?? "none",
      refs: j.refs as JobView["refs"],
      modelPrompt: j.inputs.modelPrompt ?? null,
      priceCoins: j.price_coins,
      charged: j.charged,
      chargeState: j.charge_state,
      error: j.status === "failed" || j.status === "cancelled" ? j.error_message ?? "تعذّر التوليد." : null,
      cancellable: def?.api.cancel === "queued-only" && j.status === "running" && j.provider_status === "queued",
      outputs: outs,
    };
  });
}

interface FilmAssetRow {
  id: string;
  project_id: string;
  kind: "image" | "video";
  ref_key: string;
  storage_path: string;
  created_at: string;
}

/** One page of the user's works. `cursor` is the createdAt of the last item of the previous page. */
export async function worksPage(userId: string, filter: WorksFilter, cursor: string | null, base = "/jawad-ai/film"): Promise<{ items: WorkItem[]; next: string | null }> {
  const size = WORKS_PAGE_SIZE;
  const before = cursor && !Number.isNaN(Date.parse(cursor)) ? new Date(cursor).toISOString() : null;

  let jq = db().from("jawad_jobs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(size + 1);
  if (filter !== "all") jq = jq.eq("output_kind", filter);
  if (before) jq = jq.lt("created_at", before);

  // Film pictures and videos (only kinds the film maker makes; no audio yet)
  const filmKinds = filter === "all" ? ["image", "video"] : filter === "audio" ? [] : [filter];
  const { data: projects } = filmKinds.length ? await db().from("film_projects").select("id,title").eq("user_id", userId) : { data: [] };
  const titles = new Map(((projects ?? []) as { id: string; title: string }[]).map((p) => [p.id, p.title]));
  const filmRows = async (): Promise<FilmAssetRow[]> => {
    if (!titles.size) return [];
    let q = db()
      .from("film_assets")
      .select("id,project_id,kind,ref_key,storage_path,created_at")
      .in("project_id", [...titles.keys()])
      .in("kind", filmKinds)
      .in("status", ["generated", "approved"])
      .not("storage_path", "is", null);
    if (before) q = q.lt("created_at", before);
    const { data } = await q.order("created_at", { ascending: false }).limit(size + 1);
    return (data ?? []) as FilmAssetRow[];
  };

  const [jr, film] = await Promise.all([jq, filmRows()]);
  const jobs = (jr.data ?? []) as JobRow[];

  const merged = [
    ...jobs.map((j) => ({ at: j.created_at, job: j as JobRow | null, film: null as FilmAssetRow | null })),
    ...film.map((f) => ({ at: f.created_at, job: null, film: f })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, size + 1);
  const page = merged.slice(0, size);
  const next = merged.length > size ? page[page.length - 1].at : null;

  const views = new Map((await jobViews(page.flatMap((p) => (p.job ? [p.job] : [])))).map((v) => [v.id, v]));
  const filmPaths = page.flatMap((p) => (p.film ? [p.film.storage_path] : []));
  const filmUrls = await sign(FILM_BUCKET, filmPaths);
  const items: WorkItem[] = page.map((p) => {
    if (p.job) return views.get(p.job.id)!;
    const f = p.film!;
    return {
      type: "film",
      id: f.id,
      createdAt: f.created_at,
      kind: f.kind,
      url: filmUrls.get(f.storage_path) || null,
      downloadUrl: `/api/jawad/film-assets/${f.id}`,
      projectId: f.project_id,
      projectTitle: titles.get(f.project_id) ?? "",
      refKey: f.ref_key,
      href: `${base}/${f.project_id}${f.kind === "video" ? "/videos" : "/sheets"}`,
    } satisfies FilmItemView;
  });
  return { items, next };
}
