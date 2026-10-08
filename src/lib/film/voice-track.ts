// «الأصوات قبل الفيديو»: the spoken lines of one generation, joined in order into one MP3 that Seedance gets as an
// audio reference (the model lip-syncs the characters to it and keeps it as the dialogue). Server only.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkMp3, joinMp3 } from "@/lib/jawad/student/audio";
import { VIDEO_MODELS, type VideoModel } from "@config/film";
import { FILM_BUCKET, projectDir, type FilmAsset, type FilmProject } from "./types";
import { voiceLines } from "./voices";

import { storage } from "@/lib/storage";
const db = () => createAdminClient();

/** What Seedance accepts as reference audio (config/jawad/generators.ts, verified against ModelArk): 2–30 s on 2.5, 2–15 s on 2.0. */
export const VOICE_TRACK_LIMIT: Record<VideoModel, { minSec: number; maxSec: number }> = {
  "seedance-2.5": { minSec: 2, maxSec: 30 },
  "seedance-2.0": { minSec: 2, maxSec: 15 },
};

/** The spoken lines of a generation and whether each has its (current) audio; for the generation page. */
export async function voiceReadiness(projectId: string) {
  const [lines, { data }] = await Promise.all([
    voiceLines(projectId),
    db().from("film_assets").select("ref_key,meta,created_at").eq("project_id", projectId).eq("kind", "audio").like("ref_key", "line:%").order("created_at", { ascending: true }),
  ]);
  const latest = new Map<string, { text: string }>();
  for (const r of (data ?? []) as { ref_key: string; meta: Record<string, unknown> | null }[]) latest.set(r.ref_key.slice(5), { text: String(r.meta?.text ?? "") });
  return lines.map((l) => ({ key: l.key, genId: l.genId, speaker: l.speaker, line: l.line, spoken: latest.get(l.key)?.text === l.line }));
}

/**
 * Joins this generation's lines into one track and stores it with the project. Throws a clear message when a line
 * has no (current) audio yet or the track is outside what the model accepts.
 */
export async function buildVoiceTrack(project: FilmProject, genId: string, model: VideoModel) {
  const lines = (await voiceLines(project.id)).filter((l) => l.genId === genId);
  if (!lines.length) throw new UserError("ما فيه جمل منطوقة في هذا التوليد؛ ولّد الفيديو بدون أصوات.", 409);
  const { data } = await db().from("film_assets").select("*").eq("project_id", project.id).eq("kind", "audio").like("ref_key", "line:%").order("created_at", { ascending: true });
  const latest = new Map<string, FilmAsset>();
  for (const r of (data ?? []) as FilmAsset[]) latest.set(r.ref_key.slice(5), r);
  const missing = lines.filter((l) => {
    const a = latest.get(l.key);
    return !a?.storage_path || String(a.meta?.text ?? "") !== l.line;
  });
  if (missing.length) throw new UserError(`ولّد أصوات هذي الجمل أول: ${missing.map((l) => `«${l.line.slice(0, 30)}${l.line.length > 30 ? "…" : ""}»`).join("، ")}`, 409);

  const parts: Uint8Array[] = [];
  for (const l of lines) {
    const f = await storage.from(FILM_BUCKET).download(latest.get(l.key)!.storage_path!);
    if (f.error) throw new Error(`storage: ${f.error.message}`);
    parts.push(new Uint8Array(await f.data.arrayBuffer()));
  }
  const track = joinMp3(parts);
  const check = checkMp3(track);
  const lim = VOICE_TRACK_LIMIT[model];
  if (!check.ok) throw new UserError("ملفات الأصوات ما انضمّت بشكل صحيح؛ ولّدها من جديد.", 409);
  if (check.seconds < lim.minSec) throw new UserError(`الحوار أقصر من ${lim.minSec} ثانية، و${VIDEO_MODELS[model].label} ما يقبل مرجعًا صوتيًا أقصر من ذلك. ولّد الفيديو بدون أصوات، أو أطِل الجملة من المخرج.`, 409);
  if (check.seconds > lim.maxSec) throw new UserError(`حوار هذا المقطع ${Math.ceil(check.seconds)} ثانية، و${VIDEO_MODELS[model].label} يقبل حتى ${lim.maxSec} ثانية من الصوت المرجعي. اطلب من المخرج يقسّم المقطع أو يقصّر الحوار.`, 409);

  const path = `${projectDir(project)}/voices/track-${genId}-${Date.now()}.mp3`;
  const up = await storage.from(FILM_BUCKET).upload(path, track, { contentType: "audio/mpeg", upsert: false });
  if (up.error) throw new Error(`storage: ${up.error.message}`);
  return { path, seconds: check.seconds, speakers: [...new Set(lines.map((l) => l.speaker))], lines: lines.map((l) => `${l.speaker}: ${l.line}`) };
}

/** What the prompt tells the model about the attached dialogue (English, like the rest of the prompt). */
export const voiceTrackNote = (t: { seconds: number; speakers: string[]; lines: string[] }) =>
  `\n\nDIALOGUE AUDIO: the attached reference audio is the complete, final spoken dialogue of this shot (${t.speakers.join(", ")}; ${Math.ceil(t.seconds)} s), in order. Lip-sync the speaking characters to it exactly and keep it as the only speech in the shot: do not generate, replace, translate or add any other voice or words. Ambient sound and music may be added softly under it. No subtitles or written text on screen.`;

// ───────────── «الحوار من جهازي»: the person's own recording of a shot's dialogue ─────────────

/** Seedance takes MP3 and WAV as reference audio, up to 15 MB. */
export const OWN_TRACK = { mimes: { "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav" } as Record<string, string>, maxBytes: 15 * 1024 * 1024 };

/** How long a WAV plays, from its header (null when it isn't a plain PCM WAV). */
export function wavSeconds(b: Uint8Array) {
  if (b.length < 44 || Buffer.from(b.subarray(0, 4)).toString("ascii") !== "RIFF" || Buffer.from(b.subarray(8, 12)).toString("ascii") !== "WAVE") return null;
  const v = Buffer.from(b.buffer, b.byteOffset, b.length);
  // walk the chunks: fmt gives the byte rate, data its length
  let at = 12;
  let byteRate = 0;
  while (at + 8 <= v.length) {
    const id = v.toString("ascii", at, at + 4);
    const len = v.readUInt32LE(at + 4);
    if (id === "fmt ") byteRate = v.readUInt32LE(at + 16);
    if (id === "data") return byteRate > 0 ? Math.round(((Math.min(len, v.length - at - 8) || 0) / byteRate) * 10) / 10 : null;
    at += 8 + len + (len % 2);
  }
  return null;
}

/** The person's own dialogue tracks of this project (one per shot, the latest), with links to hear them. */
export async function ownTracks(projectId: string) {
  const { data } = await db().from("film_assets").select("ref_key,storage_path,file_name,meta,created_at").eq("project_id", projectId).eq("kind", "audio").eq("status", "approved").like("ref_key", "track:%").order("created_at", { ascending: true });
  const rows = (data ?? []) as { ref_key: string; storage_path: string | null; file_name: string | null; meta: Record<string, unknown> | null }[];
  const latest = new Map(rows.map((r) => [r.ref_key.slice(6), r]));
  const list = [...latest.values()].filter((r) => r.storage_path);
  const signed = list.length ? (await storage.from(FILM_BUCKET).createSignedUrls(list.map((r) => r.storage_path!), 3600)).data ?? [] : [];
  return list.map((r, i) => ({ genId: r.ref_key.slice(6), url: signed[i]?.signedUrl ?? null, name: r.file_name ?? "", seconds: Number(r.meta?.seconds) || 0 }));
}

/** The person's own track of a shot as the video's reference audio (checked against the model's limits). */
export async function uploadedVoiceTrack(project: FilmProject, genId: string, model: VideoModel) {
  const { data } = await db().from("film_assets").select("*").eq("project_id", project.id).eq("kind", "audio").eq("ref_key", `track:${genId}`).eq("status", "approved").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const a = data as FilmAsset | null;
  if (!a?.storage_path) throw new UserError("ارفع ملف الحوار من جهازك أول (MP3 أو WAV)، أو اختر «أصنعه هنا».", 409);
  const seconds = Number(a.meta?.seconds) || 0;
  const lim = VOICE_TRACK_LIMIT[model];
  if (seconds && seconds < lim.minSec) throw new UserError(`ملف الحوار أقصر من ${lim.minSec} ثانية، و${VIDEO_MODELS[model].label} ما يقبل مرجعًا صوتيًا أقصر من ذلك.`, 409);
  if (seconds > lim.maxSec) throw new UserError(`ملف الحوار ${Math.ceil(seconds)} ثانية، و${VIDEO_MODELS[model].label} يقبل حتى ${lim.maxSec} ثانية. قصّه أو قسّم المقطع.`, 409);
  const lines = (await voiceLines(project.id)).filter((l) => l.genId === genId);
  return { path: a.storage_path, seconds: seconds || lim.minSec, speakers: [...new Set(lines.map((l) => l.speaker))], lines: lines.map((l) => `${l.speaker}: ${l.line}`) };
}
