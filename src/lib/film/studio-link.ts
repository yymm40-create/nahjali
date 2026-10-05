// The film maker ⇄ JAWAD AI's video section.
//   • A film video goes to the video section as a finished work (no charge), so «التعديل الذكي» (and every generator
//     there) can be used on it; its reference pictures go with it.
//   • A video made in the video section can be chosen as the approved video of a film generation.
// Server only; every row is checked to belong to the signed-in user.

import { randomUUID } from "crypto";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatorById } from "@config/jawad/generators";
import { JAWAD_BUCKET, loadRuntime } from "@/lib/jawad/server/runtime";
import { uploadFromBuffer } from "@/lib/jawad/server/uploads";
import { FILM_BUCKET, projectDir, type FilmAsset, type FilmProject } from "./types";

const db = () => createAdminClient();

async function download(bucket: string, path: string) {
  const { data, error } = await db().storage.from(bucket).download(path);
  if (error || !data) throw new UserError("تعذّر قراءة الملف.", 404);
  return Buffer.from(await data.arrayBuffer());
}

/** A film video as a finished work in the video section (the same one if sent before). Returns the work's job id. */
export async function filmVideoToStudio(
  project: FilmProject,
  user: { id: string },
  a: FilmAsset,
  gen: { prompt: string; refs: FilmAsset[]; model: string; durationSec: number; ratio: string; resolution: string; audio: boolean },
) {
  if (!a.storage_path) throw new UserError("هذا الفيديو انحذف من الموقع.", 409);
  const key = `film-${a.id}`.slice(0, 80);
  const { data: existing } = await db().from("jawad_jobs").select("id").eq("user_id", user.id).eq("idempotency_key", key).maybeSingle();
  if (existing) return existing.id as string;

  const def = generatorById(gen.model === "seedance-2.0" ? "byteplus-seedance-2-0" : "byteplus-seedance-2-5")!;
  const rt = await loadRuntime();
  const section = rt.sections.find((s) => s.output === "video") ?? { id: "video" };
  // The film's reference pictures go along (named image1…n in the film's order), so an edit keeps the characters
  const refs: { uploadId: string; kind: "image"; role: "reference"; name: string }[] = [];
  for (const [i, r] of gen.refs.entries()) {
    if (!r.storage_path) continue;
    const up = await uploadFromBuffer(user.id, new Uint8Array(await download(FILM_BUCKET, r.storage_path)), `film-ref-${i + 1}.png`).catch(() => null);
    if (up?.status === "ready") refs.push({ uploadId: up.id, kind: "image", role: "reference", name: `image${i + 1}` });
  }
  const id = randomUUID();
  const file = await download(FILM_BUCKET, a.storage_path);
  const path = `${user.id}/outputs/${id}/0.mp4`;
  const up = await db().storage.from(JAWAD_BUCKET).upload(path, file, { contentType: "video/mp4", upsert: true });
  if (up.error) throw up.error;
  const now = new Date().toISOString();
  const { error } = await db().from("jawad_jobs").insert({
    id,
    user_id: user.id,
    idempotency_key: key,
    section_id: section.id,
    generator_id: def.id,
    provider: def.provider.id,
    model_id: def.model.id,
    mode: refs.length ? "omni_reference" : "text_to_video",
    output_kind: "video",
    prompt: gen.prompt.slice(0, 40000),
    inputs: {
      settings: { ratio: gen.ratio, resolution: gen.resolution, duration: gen.durationSec, audio: gen.audio },
      instructions: "",
      refStyle: refs.length ? "references" : "none",
      origin: "film",
      film: { projectId: project.id, assetId: a.id, genId: a.ref_key, title: project.title },
    },
    refs,
    price_coins: 0,
    price_breakdown: [],
    charged: false,
    charge_state: "none",
    status: "succeeded",
    submit_state: "accepted",
    provider_status: "from film",
    finished_at: now,
  });
  if (error) throw error;
  await db().from("jawad_outputs").insert({ job_id: id, user_id: user.id, kind: "video", idx: 0, storage_path: path, mime: "video/mp4", bytes: file.length, duration_ms: Math.round(gen.durationSec * 1000) });
  return id;
}

/** The user's finished videos in the video section (newest first), to choose one for a film generation. */
export async function studioVideos(userId: string) {
  const { data: jobs } = await db().from("jawad_jobs").select("id,prompt,generator_id,inputs,created_at").eq("user_id", userId).eq("output_kind", "video").eq("status", "succeeded").order("created_at", { ascending: false }).limit(40);
  const list = (jobs ?? []) as { id: string; prompt: string; generator_id: string; inputs: Record<string, unknown>; created_at: string }[];
  if (!list.length) return [];
  const { data: outs } = await db().from("jawad_outputs").select("id,job_id,storage_path,duration_ms").in("job_id", list.map((j) => j.id)).eq("idx", 0);
  const byJob = new Map(((outs ?? []) as { id: string; job_id: string; storage_path: string; duration_ms: number | null }[]).map((o) => [o.job_id, o]));
  const paths = list.map((j) => byJob.get(j.id)?.storage_path).filter((p): p is string => Boolean(p));
  const { data: signed } = paths.length ? await db().storage.from(JAWAD_BUCKET).createSignedUrls(paths, 3600) : { data: [] };
  const url = new Map((signed ?? []).map((s, i) => [paths[i], s.signedUrl]));
  return list
    .filter((j) => byJob.has(j.id))
    .map((j) => {
      const o = byJob.get(j.id)!;
      const film = (j.inputs?.film ?? null) as { genId?: string; title?: string } | null;
      return {
        jobId: j.id,
        url: url.get(o.storage_path) ?? "",
        seconds: o.duration_ms ? Math.round(o.duration_ms / 100) / 10 : null,
        generator: generatorById(j.generator_id)?.name ?? j.generator_id,
        prompt: (j.prompt || "").slice(0, 160),
        from: film ? `من الفيلم «${film.title ?? ""}» · ${film.genId ?? ""}` : j.inputs?.edit ? "تعديل ذكي" : "",
        at: j.created_at,
      };
    });
}

/** Copies a video of the video section into the film as a new video of this generation. Returns the new asset id. */
export async function studioVideoToFilm(project: FilmProject, user: { id: string }, genId: string, versionId: string, jobId: string) {
  if (!/^[0-9a-f-]{36}$/.test(jobId)) throw new UserError("طلب غير صحيح.", 400);
  const { data: job } = await db().from("jawad_jobs").select("id,user_id,status,output_kind,generator_id,inputs").eq("id", jobId).eq("user_id", user.id).maybeSingle();
  if (!job || job.status !== "succeeded" || job.output_kind !== "video") throw new UserError("ما لقينا هذا الفيديو في أعمالك.", 404);
  const { data: out } = await db().from("jawad_outputs").select("storage_path,bytes").eq("job_id", job.id).eq("idx", 0).maybeSingle();
  if (!out) throw new UserError("ما لقينا ملف الفيديو.", 404);
  const file = await download(JAWAD_BUCKET, out.storage_path as string);
  const id = randomUUID();
  const path = `${projectDir(project)}/director/${id}.mp4`;
  const up = await db().storage.from(FILM_BUCKET).upload(path, file, { contentType: "video/mp4", upsert: true });
  if (up.error) throw up.error;
  const s = ((job.inputs as Record<string, unknown>)?.settings ?? {}) as Record<string, unknown>;
  const { error } = await db().from("film_assets").insert({
    id,
    project_id: project.id,
    kind: "video",
    ref_key: genId,
    version_id: versionId,
    status: "generated",
    storage_path: path,
    mime: "video/mp4",
    bytes: file.length,
    meta: { source: "jawad", jawadJobId: job.id, model: job.generator_id === "byteplus-seedance-2-0" ? "seedance-2.0" : "seedance-2.5", resolution: s.resolution ?? "", ratio: s.ratio ?? "", durationSec: s.duration ?? null },
  });
  if (error) throw error;
  return id;
}
