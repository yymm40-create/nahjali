// The film maker's «الأصوات»: every Arabic line the director wrote for the approved generations (dialogue_ar), a voice
// cast for each speaker (the person's own voices from JAWAD AI's library, or ElevenLabs' ready voices), and each line
// spoken with Eleven v4 into the project's audio files (an Arabic line through «النطق الدقيق» first: the words whose
// sound depends on their vowels, said right). Server only. Charged like the other film operations (reserve → settle on
// success → refund on failure).

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { DICTION_USD_PER_K, ELEVEN_PRICE, ELEVEN_VOICE } from "@config/jawad/generators";
import { mostlyArabic } from "@config/jawad/diction";
import { keyConfigured } from "@/lib/jawad/server/runtime";
import { generatorById } from "@config/jawad/generators";
import { elevenPremadeVoices, elevenSpeech } from "@/lib/jawad/server/providers/elevenlabs";
import { ProviderError } from "@/lib/jawad/server/providers/common";
import { audioDurationMs, resolveVoice } from "@/lib/jawad/server/voices";
import { prepareSpeech } from "@/lib/jawad/server/diction";
import { directorVersions } from "./director";
import { isAdmin } from "@config/site";
import { failJob, startJob, succeedJob } from "./usage";
import { FILM_BUCKET, projectDir, type FilmAsset, type FilmProject } from "./types";

const db = () => createAdminClient();
const MODEL = "eleven_v4";
// If the account's ElevenLabs plan does not have the newest model yet, the line is spoken with the one before it
const FALLBACK_MODEL = "eleven_v3";

/**
 * Speaks a line; a 4xx about the model or the language flag (never billed) is tried once more the other way.
 * Anything else is reported as it is.
 */
async function speak(o: { voiceId: string; text: string; languageCode?: string }) {
  try {
    return { audio: await elevenSpeech({ ...o, model: MODEL, stability: 0.5 }), model: MODEL };
  } catch (e) {
    const d = e instanceof ProviderError ? e.detail.toLowerCase() : "";
    if (/model/.test(d) && /(not found|invalid|does not exist|not available|unknown|unsupported|not allowed)/.test(d)) {
      return { audio: await elevenSpeech({ ...o, model: FALLBACK_MODEL, stability: 0.5 }), model: FALLBACK_MODEL };
    }
    if (/language_code|language/.test(d) && o.languageCode) {
      return { audio: await elevenSpeech({ voiceId: o.voiceId, text: o.text, model: MODEL, stability: 0.5 }), model: MODEL };
    }
    throw e;
  }
}

/** The owner sees what went wrong; everyone else a clean sentence. */
function voiceFailure(e: unknown, email?: string | null) {
  const base = e instanceof ProviderError ? e.userMessage : "تعذّر توليد الصوت الآن. لم يُخصم منك شيء.";
  if (!isAdmin(email)) return base;
  const detail = e instanceof ProviderError ? e.detail : e instanceof Error ? e.message : String(e);
  return `${base} (للمالك: ${detail.slice(0, 400)})`;
}

export interface VoiceLine {
  /** genId:index — stable while the generation's approved version stays the same. */
  key: string;
  genId: string;
  genName: string;
  index: number;
  speaker: string;
  line: string;
}

/** Whether the film maker can speak lines (the ElevenLabs key is on the server). */
export const voicesReady = () => keyConfigured(generatorById("elevenlabs-eleven-v4")!);

/** The spoken lines of the approved generations, in the generation map's order. */
export async function voiceLines(projectId: string): Promise<VoiceLine[]> {
  const versions = await directorVersions(projectId);
  const map = versions.filter((v) => v.kind === "dir_map" && v.status === "approved").at(-1)?.data.generation_map ?? [];
  const approved = versions.filter((v) => v.kind === "dir_generation" && v.status === "approved");
  const ids = [...new Set([...map.map((g) => g.id), ...approved.map((v) => v.ref_key)])].filter((g) => approved.some((v) => v.ref_key === g));
  return ids.flatMap((g) => {
    const v = approved.filter((x) => x.ref_key === g).at(-1)!;
    const name = map.find((m) => m.id === g)?.name ?? "";
    return (v.data.dialogue_ar ?? [])
      .filter((d) => d.line?.trim())
      .map((d, index) => ({ key: `${g}:${index}`, genId: g, genName: name, index, speaker: (d.speaker || "الراوي").trim().slice(0, 80), line: d.line.trim() }));
  });
}

export async function voiceCast(projectId: string): Promise<Record<string, string>> {
  const { data } = await db().from("film_voice_cast").select("speaker, voice").eq("project_id", projectId);
  return Object.fromEntries((data ?? []).map((r) => [r.speaker as string, r.voice as string]));
}

/** The latest spoken file of each line. */
export async function lineAudios(projectId: string) {
  const { data } = await db().from("film_assets").select("*").eq("project_id", projectId).eq("kind", "audio").like("ref_key", "line:%").order("created_at", { ascending: true });
  const rows = (data ?? []) as FilmAsset[];
  const latest = new Map<string, FilmAsset>();
  for (const r of rows) latest.set(r.ref_key.slice(5), r);
  const list = [...latest.values()].filter((r) => r.storage_path);
  const links = list.length ? ((await db().storage.from(FILM_BUCKET).createSignedUrls(list.map((r) => r.storage_path!), 3600)).data ?? []) : [];
  return list.map((r, i) => ({ key: r.ref_key.slice(5), url: links[i]?.signedUrl ?? "", text: String(r.meta?.text ?? ""), voice: String(r.meta?.voice ?? ""), durationMs: Number(r.meta?.durationMs ?? 0) || null, createdAt: r.created_at }));
}

/** The voices to choose from: the person's library, then ElevenLabs' ready voices. */
export async function castChoices(userId: string) {
  const { data } = await db().from("jawad_voices").select("id, name, origin").eq("user_id", userId).order("created_at", { ascending: false });
  const mine = (data ?? []).map((r) => ({ value: `v:${r.id}`, name: r.name as string, group: "mine" as const }));
  const ready = await elevenPremadeVoices()
    .then((l) => l.map((v) => ({ value: `p:${v.voiceId}`, name: `${v.name}${v.labels.gender ? ` · ${v.labels.gender === "male" ? "رجل" : v.labels.gender === "female" ? "امرأة" : v.labels.gender}` : ""}`, group: "ready" as const })))
    .catch(() => []);
  return [...mine, ...ready];
}

export async function setCast(project: FilmProject, userId: string, speaker: unknown, voice: unknown) {
  const s = typeof speaker === "string" ? speaker.trim() : "";
  const v = typeof voice === "string" ? voice : "";
  if (!ELEVEN_VOICE.test(v)) throw new UserError("اختر صوتًا.", 400);
  const lines = await voiceLines(project.id);
  if (!lines.some((l) => l.speaker === s)) throw new UserError("هذه الشخصية ليست في جمل الفيلم.", 400);
  const ok = await resolveVoice(userId, v);
  if (!ok.ok) throw new UserError(ok.reason, 400);
  const { error } = await db().from("film_voice_cast").upsert({ project_id: project.id, speaker: s, voice: v, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Speaks one line with its speaker's voice (Eleven v4) and keeps it with the project. */
/** The feeling asked for, as Eleven v4 reads it: one short word or phrase between [ ] (e.g. [whispers], [excited]). */
export const cleanEmotion = (v: unknown) => String(v ?? "").replace(/[\[\]\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);

export async function speakLine(project: FilmProject, user: { id: string; email?: string | null }, key: unknown, idempotencyKey: unknown, emotionRaw?: unknown) {
  const emotion = cleanEmotion(emotionRaw);
  if (!voicesReady()) throw new UserError("أصوات ElevenLabs غير متاحة حاليًا.", 503);
  const k = String(idempotencyKey ?? "");
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(k)) throw new UserError("طلب غير صحيح.", 400);
  const lines = await voiceLines(project.id);
  const line = lines.find((l) => l.key === key);
  if (!line) throw new UserError("ما لقينا هذه الجملة؛ ربما تغيّر التوليد.", 404);
  const voice = (await voiceCast(project.id))[line.speaker];
  if (!voice) throw new UserError(`اختر صوتًا لـ«${line.speaker}» أولًا.`, 400);
  const resolved = await resolveVoice(user.id, voice);
  if (!resolved.ok) throw new UserError(resolved.reason, 400);

  const arabic = mostlyArabic(line.line);
  // (Claude's check costs about the same for a short line as for 1,000 characters: at least that is held)
  const estimateUsd = (Math.max(1, line.line.length) / 1000) * ELEVEN_PRICE.v4PerKChars + (arabic ? Math.max(1, Math.ceil(line.line.length / 1000)) * DICTION_USD_PER_K : 0);
  const { job, created } = await startJob({ projectId: project.id, user, service: "elevenlabs", operation: "voice_line", idempotencyKey: `voice:${project.id}:${k}`, estimateUsd, units: line.line.length, unit: "character" });
  if (!created) return { jobId: job.id, status: job.status };
  try {
    // Who speaks, and the scene's other lines: Claude tells from them who is addressed (أنتَ or أنتِ)
    const scene = lines.filter((l) => l.genId === line.genId).map((l) => `${l.speaker}: ${l.line}`).join("\n");
    // «النطق الدقيق» helps the voice; if it can't run (Claude busy or a rule broken) the line is still spoken as written
    const spoken = await prepareSpeech(line.line, arabic ? "precise" : "off", `This is one line of a film, said by «${line.speaker}». The scene's lines, in order:\n${scene}`).catch((err) => {
      console.error("film voice diction skipped", err);
      return { text: line.line, languageCode: arabic ? "ar" : undefined, fixes: [], usd: 0 };
    });
    // the feeling goes first, between [ ], where Eleven v4 takes it as a direction (it is never read aloud)
    const withFeeling = emotion && !spoken.text.trimStart().startsWith("[") ? `[${emotion}] ${spoken.text}` : spoken.text;
    const { audio, model } = await speak({ voiceId: resolved.voiceId, text: withFeeling, languageCode: spoken.languageCode });
    const path = `${projectDir(project)}/voices/${line.genId}-${line.index}-${Date.now()}.mp3`;
    const up = await db().storage.from(FILM_BUCKET).upload(path, audio, { contentType: "audio/mpeg", upsert: false });
    if (up.error) throw new Error(`storage: ${up.error.message}`);
    const { error } = await db().from("film_assets").insert({
      project_id: project.id,
      kind: "audio",
      ref_key: `line:${line.key}`,
      storage_path: path,
      file_name: `${line.genId}-${line.index + 1}.mp3`,
      mime: "audio/mpeg",
      bytes: audio.length,
      status: "generated",
      meta: { speaker: line.speaker, text: line.line, voice, ...(emotion ? { emotion } : {}), durationMs: audioDurationMs(audio) ?? null, model, jobId: job.id, ...(spoken.fixes.length ? { spoken: spoken.text, diction: spoken.fixes.map((f) => ({ word: f.word, vocalized: f.vocalized })) } : {}) },
    });
    if (error) throw error;
    await succeedJob(job.id, { costUsd: (spoken.text.length / 1000) * ELEVEN_PRICE.v4PerKChars + spoken.usd, units: spoken.text.length });
    return { jobId: job.id, status: "succeeded" };
  } catch (e) {
    console.error("film voice line failed", line.key, e);
    await failJob(job.id, e instanceof ProviderError ? e.detail : e);
    throw new UserError(voiceFailure(e, user.email), 502);
  }
}
