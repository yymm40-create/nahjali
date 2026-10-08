import { credits } from "@/lib/film/credits";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireFilmUser, requireProject } from "@/lib/film/access";
import { checkVideos, directorVersions, directorVideos, purgeOldVideos } from "@/lib/film/director";
import { voiceReadiness } from "@/lib/film/voice-track";
import { voicesReady } from "@/lib/film/voices";
import { projectCost } from "@/lib/film/usage";
import { latestJob } from "@/lib/film/sheets";
import { FILM_BUCKET } from "@/lib/film/types";
import { can } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { dialogueSource, startingMode } from "@/lib/film/dialogue-source";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import VideosWorkspace from "../[id]/videos/VideosWorkspace";


import { storage } from "@/lib/storage";
export default async function VideosView({ id, base }: { id: string; base: string }) {
  const { user, allowed } = await requireFilmUser(`${base}/${id}/videos`);
  if (!allowed) redirect(base);
  const project = await requireProject(id, user.id);
  if (project.stage === "screenwriter") redirect(`${base}/${id}/script`);
  if (project.stage === "sheets") redirect(`${base}/${id}/sheets`);

  await purgeOldVideos(project);
  const videosRunning = await checkVideos(project);
  const [versions, videos, cost, job, spoken, handoff] = await Promise.all([
    directorVersions(id),
    directorVideos(id),
    projectCost(id),
    latestJob(id, "director"),
    voiceReadiness(id).catch(() => []),
    // «مصدر الحوار»: the person's answer to the screenwriter's question, every shot starts on it
    createAdminClient().from("film_versions").select("body").eq("project_id", id).eq("stage", "screenwriter").eq("kind", "handoff").eq("status", "approved").order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const source = dialogueSource((handoff.data as { body?: string } | null)?.body);
  const map = versions.filter((v) => v.kind === "dir_map" && v.status === "approved").at(-1)?.data.generation_map ?? [];
  const approved = versions.filter((v) => v.kind === "dir_generation" && v.status === "approved");
  if (!approved.length) redirect(`${base}/${id}/director`);
  // Generations in the map's order; each with its latest approved version
  const ids = [...new Set([...map.map((g) => g.id), ...approved.map((v) => v.ref_key)])].filter((g) => approved.some((v) => v.ref_key === g));
  const generations = ids.map((g) => {
    const v = approved.filter((x) => x.ref_key === g).at(-1)!;
    // After video notes: the director's understanding as options, then the revised generation awaiting approval
    const q = versions.filter((x) => x.kind === "dir_questions" && x.ref_key === g).at(-1);
    const r = versions.filter((x) => x.kind === "dir_generation" && x.ref_key === g).at(-1);
    return {
      id: g,
      name: map.find((m) => m.id === g)?.name ?? "",
      model: v.data.video_model ?? "seedance-2.5",
      durationSec: v.data.duration_sec ?? 10,
      ratio: v.data.ratio ?? "16:9",
      audio: v.data.generate_audio ?? true,
      // how many reference pictures the director attached (each model takes only so many)
      refs: (v.data.references ?? []).length,
      // «الأصوات قبل الفيديو»: this shot's spoken lines, and whether each one's audio is made
      lines: spoken.filter((l) => l.genId === g).map((l) => ({ key: l.key, speaker: l.speaker, line: l.line, spoken: l.spoken })),
      questions: q?.status === "awaiting_approval" ? { id: q.id, body: q.body, items: q.data.questions ?? [] } : null,
      revision: r?.status === "awaiting_approval" ? { id: r.id, body: r.body } : null,
    };
  });

  // JAWAD AI's video section, when this person may use it (only inside JAWAD AI): «التعديل الذكي» and its videos
  const rt = base.startsWith("/jawad-ai") ? await loadRuntime() : null;
  const videoSection = rt?.sections.find((s) => s.implementation === "studio:video" && s.enabled);
  const studioPath = videoSection && (await can(user.email, "video")) ? videoSection.path : null;

  // Short-lived links: one to watch, one that downloads the file
  const kept = videos.filter((v) => v.storage_path);
  const watch = kept.length ? ((await storage.from(FILM_BUCKET).createSignedUrls(kept.map((v) => v.storage_path!), 3600)).data ?? []) : [];
  const links: Record<string, { url: string; download: string }> = {};
  for (const [i, v] of kept.entries()) {
    const d = await storage.from(FILM_BUCKET).createSignedUrl(v.storage_path!, 3600, { download: `${project.title}-${v.ref_key}.mp4` });
    links[v.id] = { url: watch[i]?.signedUrl ?? "", download: d.data?.signedUrl ?? "" };
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href={`${base}/${id}`} className="text-sm font-bold text-muted">→ {project.title}</Link>
        <h1 className="display text-4xl">🎬 توليد الفيديو</h1>
        <p className="text-sm font-bold text-muted">
          آخر قرار قبل التوليد: ولّد أصوات كل مقطع أول (تروح مع الفيديو مرجعًا فتتحرك الشفاه عليها)، ثم اختر الجودة وولّد. الفيديو حتى الآن <span>{credits(cost.byService.seedance ?? 0)}</span>
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
          note: typeof v.meta?.montage_note === "string" ? (v.meta.montage_note as string) : "",
          edited: Boolean(v.meta?.edited),
        }))}
        videosRunning={videosRunning}
        job={job ? { status: job.status, error: job.error } : null}
        trialVideosLeft={null}
        editsLeft={null}
        studioPath={studioPath}
        voicesOn={voicesReady()}
        dialogueStart={startingMode(source, voicesReady())}
        dialogueSource={source}
      />
      <Link href={`${base}/${id}/edit`} className="card flex items-center gap-3 p-4 font-extrabold">
        <span className="text-2xl" aria-hidden>✂️</span>
        <span className="flex-1">
          الخطوة الأخيرة: المونتاج
          <span className="block text-xs font-bold text-muted">نركّب مقاطعك بترتيب المخرج في نسخة أولى، وتصدّر الفيلم كاملًا.</span>
        </span>
        <span aria-hidden>←</span>
      </Link>
    </div>
  );
}
