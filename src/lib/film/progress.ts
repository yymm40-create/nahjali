// «العداد»: how far the scene is, as a number that moves — the scene as a whole (what is approved of everything it
// needs) and every piece being made right now (a reply, a picture, a voice, a video) with the time it is expected to
// take. Read by the stage's meter every few seconds while something runs. Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { FILM_STAGES } from "@config/film";
import type { FilmAsset, FilmJob, FilmProject } from "./types";
import { overallPercent, runningPercent, type Progress, type Running, type WorkKind } from "./progress-math";

export type { Progress, Running, WorkKind } from "./progress-math";

const db = () => createAdminClient();

const OPERATION_LABEL: Record<string, { kind: WorkKind; label: string }> = {
  screenwriter: { kind: "reply", label: "السيناريست يكتب" },
  sheets: { kind: "reply", label: "صانع الشيت يكتب" },
  director: { kind: "reply", label: "المخرج يكتب" },
  sajjad: { kind: "reply", label: "سجاد يفكّر" },
  impact: { kind: "impact", label: "سجاد يقارن النسختين" },
  sheet_image: { kind: "image", label: "صورة" },
  director_video: { kind: "video", label: "فيديو" },
  voice: { kind: "voice", label: "صوت" },
  voice_line: { kind: "voice", label: "صوت" },
};

export async function filmProgress(project: FilmProject): Promise<Progress> {
  const [{ data: vers }, { data: assets }, { data: jobs }, { count: msgs }] = await Promise.all([
    db().from("film_versions").select("stage,kind,ref_key,status,data").eq("project_id", project.id),
    db().from("film_assets").select("id,kind,ref_key,status,created_at,meta").eq("project_id", project.id),
    db().from("film_jobs").select("*").eq("project_id", project.id).eq("status", "running"),
    db().from("film_messages").select("id", { count: "exact", head: true }).eq("project_id", project.id),
  ]);
  const V = (vers ?? []) as { stage: string; kind: string; ref_key: string; status: string; data: Record<string, unknown> }[];
  const A = (assets ?? []) as Pick<FilmAsset, "id" | "kind" | "ref_key" | "status" | "created_at" | "meta">[];
  const live = A.filter((a) => !a.ref_key.startsWith("archive:"));
  const rank = FILM_STAGES.findIndex((s) => s.key === project.stage);
  const share = (done: number, of: number) => ({ done, of, percent: of ? Math.round((Math.min(done, of) / of) * 100) : 0 });

  // the story: written
  const story = share(project.story.trim().length >= 10 ? 1 : 0, 1);
  // the screenwriter: understanding, questions, screenplay (handoff counts as done when the stage moved on)
  const scriptKinds = ["understanding", "questions", "screenplay"];
  const scriptDone = scriptKinds.filter((k) => V.some((v) => v.stage === "screenwriter" && v.kind === k && v.status === "approved")).length;
  const script = rank > 0 ? share(scriptKinds.length, scriptKinds.length) : share(scriptDone, scriptKinds.length);
  // the sheets: the map's items, each with an approved picture (the map itself is one more piece)
  const map = (V.find((v) => v.stage === "sheets" && v.kind === "sheet_understanding" && v.status === "approved")?.data.sheet_map as { id: string }[] | undefined) ?? [];
  const approvedPic = new Set(live.filter((a) => (a.kind === "image" || a.kind === "upload") && a.status === "approved").map((a) => a.ref_key));
  const sheets = map.length ? share(1 + map.filter((m) => approvedPic.has(m.id)).length, 1 + map.length) : share(rank > 1 ? 1 : 0, 1);
  // the director: the map, then each shot approved
  const gmap = (V.filter((v) => v.stage === "director" && v.kind === "dir_map" && v.status === "approved").at(-1)?.data.generation_map as { id: string }[] | undefined) ?? [];
  const approvedGen = new Set(V.filter((v) => v.stage === "director" && v.kind === "dir_generation" && v.status === "approved").map((v) => v.ref_key));
  const director = gmap.length ? share(1 + gmap.filter((g) => approvedGen.has(g.id)).length, 1 + gmap.length) : share(rank > 2 ? 1 : 0, 1);
  // the videos: one kept video per shot (approved counts fully, a generated one half)
  const videoOf = (g: string) => live.filter((a) => a.kind === "video" && a.ref_key === g && a.status !== "rejected" && a.status !== "failed");
  const videoScore = gmap.reduce((n, g) => n + (videoOf(g.id).some((v) => v.status === "approved") ? 1 : videoOf(g.id).some((v) => v.status === "generated") ? 0.5 : 0), 0);
  const videos = gmap.length ? share(videoScore, gmap.length) : share(0, 1);
  // the voices: each spoken line of the approved shots
  const lines = V.filter((v) => v.stage === "director" && v.kind === "dir_generation" && v.status === "approved" && gmap.some((g) => g.id === v.ref_key)).reduce((n, v) => n + (((v.data.dialogue_ar as unknown[]) ?? []).length || 0), 0);
  const spoken = new Set(live.filter((a) => a.kind === "audio" && a.ref_key.startsWith("line:")).map((a) => a.ref_key)).size;
  const voices = lines ? share(spoken, lines) : share(rank >= 3 ? 1 : 0, 1);
  // the montage: the successful scene saved
  const edit = share(live.some((a) => a.kind === "video" && a.ref_key === "SCENE" && a.status === "approved") ? 1 : 0, 1);
  const steps = { story, script, sheets, director, videos, voices, edit };

  const now = Date.now();
  const running: Running[] = [];
  for (const j of (jobs ?? []) as FilmJob[]) {
    const meta = OPERATION_LABEL[j.operation] ?? OPERATION_LABEL[j.operation.startsWith("voice") ? "voice" : "sajjad"];
    const asset = j.asset_id ? A.find((a) => a.id === j.asset_id) : null;
    const name = asset?.ref_key ? asset.ref_key.replace(/^line:/, "") : "";
    const p = runningPercent(j.started_at ?? j.created_at, meta.kind, now);
    running.push({ key: j.id, kind: meta.kind, label: name ? `${meta.label} ${name}` : meta.label, startedAt: j.started_at ?? j.created_at, ...p });
  }
  // pictures and videos being made without a running job row we saw (started a moment ago)
  for (const a of live) {
    if (a.status !== "generating" || running.some((r) => r.label.endsWith(a.ref_key))) continue;
    const kind: WorkKind = a.kind === "video" ? "video" : a.kind === "audio" ? "voice" : "image";
    running.push({ key: a.id, kind, label: `${OPERATION_LABEL[kind === "video" ? "director_video" : kind === "voice" ? "voice" : "sheet_image"].label} ${a.ref_key}`, startedAt: a.created_at, ...runningPercent(a.created_at, kind, now) });
  }
  void msgs;
  // what waits for the person: a text to approve or questions to answer, a new picture or video to approve
  const asking = new Set<string>();
  for (const v of V) if (v.status === "awaiting_approval") asking.add(v.stage === "screenwriter" ? "script" : v.stage === "sheets" ? "sheets" : v.stage === "director" ? (v.kind === "dir_questions" && v.ref_key ? "videos" : "director") : "");
  if (live.some((a) => a.kind === "image" && a.status === "generated")) asking.add("sheets");
  if (live.some((a) => a.kind === "video" && a.status === "generated")) asking.add("videos");
  asking.delete("");
  return { percent: overallPercent(steps), asking: [...asking], stage: project.stage, steps, running, at: new Date(now).toISOString() };
}
