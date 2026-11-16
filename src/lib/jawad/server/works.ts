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
import { DEFAULT_VIEW, matchesWorkSearch, normaliseSearch, searchTerms, type WorksView } from "../works-organise";
import { markedPage, withMarks } from "./works-organise";

import { storage } from "@/lib/storage";
const db = () => createAdminClient();
const LINK_SECONDS = 6 * 3600;

async function sign(bucket: string, paths: string[]) {
  if (!paths.length) return new Map<string, string>();
  const { data } = await storage.from(bucket).createSignedUrls(paths, LINK_SECONDS);
  return new Map((data ?? []).map((d, i) => [paths[i], d.signedUrl ?? ""]));
}

/** A result's name from its file (`…/dialogue.mp3` → "dialogue"); results numbered by position have none. */
export const outputName = (path: string) => {
  const base = path.split("/").pop()!.replace(/\.[^.]+$/, "");
  return /^\d+$/.test(base) ? null : base;
};

/** Views of jobs with their results (the caller has already checked they belong to the user). */
/**
 * The views of jobs. A cartoon job's prompts («حولني الى الستايل الكرتوني», written by the website and «المخرج الخارق»)
 * are the site owner's alone: everyone else's views carry none, wherever they are shown (`owner` opens them).
 */
export async function jobViews(jobs: JobRow[], opts: { owner?: boolean } = {}): Promise<JobView[]> {
  if (!jobs.length) return [];
  const rt = await loadRuntime();
  const { data } = await db().from("jawad_outputs").select("*").in("job_id", jobs.map((j) => j.id)).order("idx");
  const outputs = (data ?? []) as OutputRow[];
  const urls = await sign(JAWAD_BUCKET, outputs.map((o) => o.storage_path));
  const hidden = (j: JobRow) => !opts.owner && String(j.idempotency_key ?? "").startsWith("cartoon_");
  return jobs.map((j) => {
    const def = generatorById(j.generator_id);
    const outs: OutputView[] = outputs
      .filter((o) => o.job_id === j.id)
      .map((o) => ({
        id: o.id,
        kind: o.kind,
        url: urls.get(o.storage_path) || null,
        downloadUrl: `/api/jawad/outputs/${o.id}`,
        name: outputName(o.storage_path),
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
      generatorName: rt.generators.find((g) => g.id === j.generator_id)?.name ?? def?.name ?? (j.generator_id === "claude-code" ? "حيدرا ماكس" : j.generator_id),
      sectionId: j.section_id,
      outputKind: j.output_kind,
      mode: j.mode,
      prompt: hidden(j) ? "" : j.prompt,
      instructions: hidden(j) ? "" : j.inputs.instructions ?? "",
      settings: j.inputs.settings ?? {},
      refStyle: j.inputs.refStyle ?? "none",
      refs: j.refs as JobView["refs"],
      modelPrompt: hidden(j) ? null : j.inputs.modelPrompt ?? null,
      ...(j.inputs.taste || j.inputs.brand ? { look: { ...(j.inputs.taste ? { tasteId: j.inputs.taste.id } : {}), ...(j.inputs.brand ? { brand: { logo: j.inputs.brand.logo === true } } : {}) } } : {}),
      diction: j.inputs.diction?.words ?? [],
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

/** A search word as a loose LIKE pattern: the letters «أ/ا», «ة/ه», «ى/ي» match each other (exactness is checked after). */
const likeWord = (t: string) => t.replace(/[^\p{L}\p{N}]/gu, "").replace(/[اهيو]/g, "_");

/**
 * One page of the user's works. `cursor` is the createdAt of the last item of the previous page. `view` («ترتيب أعمالي»):
 * newest or oldest first, a search in the prompts and generator names, and — once migration 0113 has run — one folder's
 * works or the ⭐ ones. Each work carries its folder and ⭐ when that table exists.
 */
export async function worksPage(userId: string, filter: WorksFilter, cursor: string | null, base = "/jawad-ai/film", view: WorksView = DEFAULT_VIEW): Promise<{ items: WorkItem[]; next: string | null }> {
  const size = WORKS_PAGE_SIZE;
  const after = cursor && !Number.isNaN(Date.parse(cursor)) ? new Date(cursor).toISOString() : null;
  const oldest = view.sort === "old";
  const terms = searchTerms(view.q);
  const byTime = (a: { at: string }, b: { at: string }) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0) * (oldest ? -1 : 1);

  // Film pictures and videos (only kinds the film maker makes; no audio yet)
  const filmKinds = filter === "all" ? ["image", "video"] : filter === "audio" ? [] : [filter];
  const { data: projects } = filmKinds.length ? await db().from("film_projects").select("id,title").eq("user_id", userId) : { data: [] };
  const titles = new Map(((projects ?? []) as { id: string; title: string }[]).map((p) => [p.id, p.title]));

  let merged: { at: string; job: JobRow | null; film: FilmAssetRow | null }[];
  const marked = view.folder || view.fav ? await markedPage(userId, view, filter, after, size + 1) : null;
  if (marked) {
    // one folder's works or the favourites: their ids come in order from the database, then the rows themselves
    const jobIds = marked.filter((m) => m.type === "job").map((m) => m.id);
    const filmIds = marked.filter((m) => m.type === "film").map((m) => m.id);
    const [jr, fr] = await Promise.all([
      jobIds.length ? db().from("jawad_jobs").select("*").eq("user_id", userId).in("id", jobIds) : Promise.resolve({ data: [] }),
      filmIds.length && titles.size ? db().from("film_assets").select("id,project_id,kind,ref_key,storage_path,created_at").in("id", filmIds).in("project_id", [...titles.keys()]) : Promise.resolve({ data: [] }),
    ]);
    const jobs = new Map(((jr.data ?? []) as JobRow[]).map((j) => [j.id, j]));
    const film = new Map(((fr.data ?? []) as FilmAssetRow[]).map((f) => [f.id, f]));
    merged = marked.flatMap((m): { at: string; job: JobRow | null; film: FilmAssetRow | null }[] => {
      const job = m.type === "job" ? jobs.get(m.id) : undefined;
      const f = m.type === "film" ? film.get(m.id) : undefined;
      return job ? [{ at: job.created_at, job, film: null }] : f ? [{ at: f.created_at, job: null, film: f }] : [];
    });
  } else {
    let jq = db().from("jawad_jobs").select("*").eq("user_id", userId).order("created_at", { ascending: oldest }).limit(size + 1);
    if (filter !== "all") jq = jq.eq("output_kind", filter);
    if (after) jq = oldest ? jq.gt("created_at", after) : jq.lt("created_at", after);
    if (terms.length) {
      // a loose first pass in the database (the longest word in the prompt, or a generator whose name has it); the exact
      // match of every word is checked on the page below
      const word = [...terms].sort((a, b) => b.length - a.length)[0];
      const rt = await loadRuntime();
      const named = rt.generators.filter((g) => normaliseSearch(`${g.name} ${g.id}`).includes(word)).map((g) => g.id);
      const like = likeWord(word);
      const ors = [like ? `prompt.ilike.%${like}%` : "", named.length ? `generator_id.in.(${named.join(",")})` : ""].filter(Boolean);
      if (ors.length) jq = jq.or(ors.join(","));
    }

    const filmTitles = terms.length ? new Map([...titles].filter(([, t]) => terms.every((w) => normaliseSearch(`${t} الفيلم السينمائي`).includes(w)))) : titles;
    const filmRows = async (): Promise<FilmAssetRow[]> => {
      if (!filmTitles.size) return [];
      let q = db()
        .from("film_assets")
        .select("id,project_id,kind,ref_key,storage_path,created_at")
        .in("project_id", [...filmTitles.keys()])
        .in("kind", filmKinds)
        .in("status", ["generated", "approved"])
        .not("storage_path", "is", null);
      if (after) q = oldest ? q.gt("created_at", after) : q.lt("created_at", after);
      const { data } = await q.order("created_at", { ascending: oldest }).limit(size + 1);
      return (data ?? []) as FilmAssetRow[];
    };

    const [jr, film] = await Promise.all([jq, filmRows()]);
    const jobs = (jr.data ?? []) as JobRow[];
    merged = [
      ...jobs.map((j) => ({ at: j.created_at, job: j as JobRow | null, film: null as FilmAssetRow | null })),
      ...film.map((f) => ({ at: f.created_at, job: null, film: f })),
    ];
  }
  merged = merged.sort(byTime).slice(0, size + 1);
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
  // a search keeps only the works whose shown prompt and generator have every word (a hidden prompt never matches)
  const found = terms.length ? items.filter((it) => matchesWorkSearch(it, view.q)) : items;
  return { items: await withMarks(userId, found), next };
}
