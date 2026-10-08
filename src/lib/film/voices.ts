// The film maker's «الأصوات»: every Arabic line the director wrote for the approved generations (dialogue_ar), a voice
// cast for each speaker (the person's own voices from JAWAD AI's library, or ElevenLabs' ready voices), and each line
// spoken with Eleven v4 into the project's audio files (an Arabic line through «النطق الدقيق» first: the words whose
// sound depends on their vowels, said right). Server only. Charged like the other film operations (reserve → settle on
// success → refund on failure).

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { ANY_VOICE, DICTION_USD_PER_K, ELEVEN_PRICE } from "@config/jawad/generators";
import { mostlyArabic } from "@config/jawad/diction";
import { keyConfigured } from "@/lib/jawad/server/runtime";
import { generatorById } from "@config/jawad/generators";
import { elevenPremadeVoices, elevenSpeech } from "@/lib/jawad/server/providers/elevenlabs";
import { ProviderError } from "@/lib/jawad/server/providers/common";
import { audioDurationMs, resolveVoice } from "@/lib/jawad/server/voices";
import { MINIMAX_PRICE, MINIMAX_READY_VOICES, minimaxReady, minimaxSpeech } from "@/lib/jawad/server/providers/minimax";
import { minimaxFeeling } from "@config/jawad/feelings";
import { prepareSpeech } from "@/lib/jawad/server/diction";
import { directorVersions } from "./director";
import { isAdmin } from "@config/site";
import { failJob, startJob, succeedJob } from "./usage";
import { FILM_BUCKET, projectDir, type FilmAsset, type FilmProject } from "./types";

import { storage } from "@/lib/storage";
const db = () => createAdminClient();
const MODEL = "eleven_v4";
// If the account's ElevenLabs plan does not have the newest model yet, the line is spoken with the one before it
const FALLBACK_MODEL = "eleven_v3";

/**
 * Speaks a line; a 4xx about the model or the language flag (never billed) is tried once more the other way.
 * Anything else is reported as it is.
 */
async function speak(o: { voiceId: string; text: string; languageCode?: string; provider?: "elevenlabs" | "minimax"; feeling?: string }) {
  // a MiniMax voice speaks through MiniMax, with the feeling in MiniMax's way: an emotion, and sounds like (laughs)
  if (o.provider === "minimax") {
    const f = minimaxFeeling(o.feeling ?? "", o.text);
    const r = await minimaxSpeech({ voiceId: o.voiceId, text: f.text, model: "hd", ...(f.emotion ? { emotion: f.emotion } : {}), ...(o.languageCode === "ar" ? { languageBoost: "Arabic" } : {}) });
    return { audio: r.audio, model: "minimax-speech-2.8-hd" };
  }
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
  const links = list.length ? ((await storage.from(FILM_BUCKET).createSignedUrls(list.map((r) => r.storage_path!), 3600)).data ?? []) : [];
  return list.map((r, i) => ({ key: r.ref_key.slice(5), url: links[i]?.signedUrl ?? "", text: String(r.meta?.text ?? ""), voice: String(r.meta?.voice ?? ""), durationMs: Number(r.meta?.durationMs ?? 0) || null, createdAt: r.created_at }));
}

/** The voices to choose from: the person's library, then ElevenLabs' ready voices. */
export async function castChoices(userId: string) {
  const { data } = await db().from("jawad_voices").select("id, name, origin, provider").eq("user_id", userId).order("created_at", { ascending: false });
  const mine = (data ?? []).map((r) => {
    const provider = (r as { provider?: string }).provider === "minimax" ? ("minimax" as const) : ("elevenlabs" as const);
    return { value: `v:${r.id}`, name: `${r.name as string}${provider === "minimax" ? " · MiniMax" : ""}`, group: "mine" as const, provider };
  });
  const ready = await elevenPremadeVoices()
    .then((l) => l.map((v) => ({ value: `p:${v.voiceId}`, name: `${v.name}${v.labels.gender ? ` · ${v.labels.gender === "male" ? "رجل" : v.labels.gender === "female" ? "امرأة" : v.labels.gender}` : ""}`, group: "ready" as const, provider: "elevenlabs" as const })))
    .catch(() => []);
  const minimax = minimaxReady() ? MINIMAX_READY_VOICES.map((v) => ({ value: `x:${v.id}`, name: `${v.name} · ${v.gender === "male" ? "رجل" : "امرأة"} · MiniMax`, group: "minimax" as const, provider: "minimax" as const })) : [];
  return [...mine, ...ready, ...minimax];
}

export async function setCast(project: FilmProject, userId: string, speaker: unknown, voice: unknown) {
  const s = typeof speaker === "string" ? speaker.trim() : "";
  const v = typeof voice === "string" ? voice : "";
  if (!ANY_VOICE.test(v)) throw new UserError("اختر صوتًا.", 400);
  const lines = await voiceLines(project.id);
  if (!lines.some((l) => l.speaker === s)) throw new UserError("هذه الشخصية ليست في جمل الفيلم.", 400);
  const ok = await resolveVoice(userId, v);
  if (!ok.ok) throw new UserError(ok.reason, 400);
  const { error } = await db().from("film_voice_cast").upsert({ project_id: project.id, speaker: s, voice: v, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/**
 * «عدّل النص»: the person corrects a line's words or diacritics before it is spoken. The line is changed in the
 * approved generation itself (so the voice, the video's prompt and the montage all read the same words); its old
 * audio no longer matches and is made again.
 */
export async function editLine(project: FilmProject, key: unknown, text: unknown) {
  const line = String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 1000);
  if (line.length < 1) throw new UserError("اكتب الجملة.", 400);
  const m = /^(GEN-\d{2,3}):(\d{1,3})$/.exec(String(key ?? ""));
  if (!m) throw new UserError("طلب غير صحيح.", 400);
  const versions = await directorVersions(project.id);
  const v = versions.filter((x) => x.kind === "dir_generation" && x.ref_key === m[1] && x.status === "approved").at(-1);
  const list = [...(v?.data.dialogue_ar ?? [])].filter((d) => d.line?.trim());
  const i = Number(m[2]);
  if (!v || !list[i]) throw new UserError("ما لقينا هذه الجملة؛ ربما تغيّر التوليد.", 404);
  const old = list[i].line.trim();
  list[i] = { ...list[i], line };
  // the same words in the video's prompt follow the change
  const prompt = typeof v.data.prompt === "string" ? v.data.prompt.split(old).join(line) : v.data.prompt;
  const { error } = await db().from("film_versions").update({ data: { ...v.data, dialogue_ar: list, prompt } }).eq("id", v.id);
  if (error) throw error;
  return { key: `${m[1]}:${i}`, line };
}

/** Speaks one line with its speaker's voice (Eleven v4) and keeps it with the project. */
/** The feeling asked for, as Eleven v4 reads it: one short word or phrase between [ ] (e.g. [whispers], [excited]). */
export const cleanEmotion = (v: unknown) => String(v ?? "").replace(/[\[\]\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
/** ElevenLabs reads a feeling between [ ]; a MiniMax sound like "(laughs)" isn't a word for it. */
const elevenFeeling = (e: string) => e.replace(/[()]/g, "").trim();

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
    const withFeeling = emotion && !spoken.text.trimStart().startsWith("[") ? `[${elevenFeeling(emotion)}] ${spoken.text}` : spoken.text;
    const { audio, model } = await speak({ voiceId: resolved.voiceId, text: resolved.provider === "minimax" ? spoken.text : withFeeling, languageCode: spoken.languageCode, provider: resolved.provider, feeling: emotion });
    const path = `${projectDir(project)}/voices/${line.genId}-${line.index}-${Date.now()}.mp3`;
    const up = await storage.from(FILM_BUCKET).upload(path, audio, { contentType: "audio/mpeg", upsert: false });
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
    await succeedJob(job.id, { costUsd: (spoken.text.length / 1000) * (resolved.provider === "minimax" ? MINIMAX_PRICE.hdPerKChars : ELEVEN_PRICE.v4PerKChars) + spoken.usd, units: spoken.text.length });
    return { jobId: job.id, status: "succeeded" };
  } catch (e) {
    console.error("film voice line failed", line.key, e);
    await failJob(job.id, e instanceof ProviderError ? e.detail : e);
    throw new UserError(voiceFailure(e, user.email), 502);
  }
}

const DESCRIBE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["description", "sample"],
  properties: {
    description: { type: "string", description: "The voice, in English, 120–600 characters, for ElevenLabs voice design." },
    sample: { type: "string", description: "A sample text in Arabic said by this character, 120–400 characters (the speaker's own lines when long enough)." },
  },
} as const;

/**
 * «✨ صوت جديد بالوصف»: the AI writes the voice of one speaker from the film (who they are in the sheets and the
 * screenplay, and how they speak in their lines), as ElevenLabs' voice design reads it best. The person can edit it.
 */
export async function describeVoice(project: FilmProject, speaker: unknown, hint: unknown) {
  const s = typeof speaker === "string" ? speaker.trim().slice(0, 80) : "";
  const lines = (await voiceLines(project.id)).filter((l) => l.speaker === s);
  if (!lines.length) throw new UserError("هذه الشخصية ليست في جمل الفيلم.", 400);
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("الذكاء الاصطناعي غير مفعّل على الخادم.", 503);
  const { data: vs } = await db().from("film_versions").select("kind,status,body").eq("project_id", project.id).in("kind", ["sheet_understanding", "screenplay"]).order("version", { ascending: true });
  const rows = (vs ?? []) as { kind: string; status: string; body: string }[];
  const last = (k: string) => (rows.filter((r) => r.kind === k && r.status === "approved").at(-1) ?? rows.filter((r) => r.kind === k).at(-1))?.body ?? "";
  const wish = typeof hint === "string" ? hint.trim().slice(0, 600) : "";
  const { callClaudeJson } = await import("./anthropic");
  const r = await callClaudeJson<{ description: string; sample: string }>({
    system:
      "You write a voice for ElevenLabs voice design, for one character of an Arabic film. From what the film says about the character (age, gender, build, personality, role, mood) and how they speak in their lines, describe the voice in English in 120–600 characters: gender, age, accent (Gulf/Khaleeji Arabic unless the film says otherwise), pitch, texture, pace, energy and emotion, recording quality (clean, close, studio). Concrete, no names of real people. Follow the person's wish when given. Also give an Arabic sample text of 120–400 characters in the character's own voice (their lines joined if long enough, else in the same spirit).",
    turns: [{ role: "user", content: `CHARACTER: ${s}\n\nTHEIR LINES:\n${lines.map((l) => `- ${l.line}`).join("\n")}\n\nTHE FILM'S CHARACTERS (sheets):\n${last("sheet_understanding").slice(0, 6000)}\n\nSCREENPLAY:\n${last("screenplay").slice(0, 8000)}${wish ? `\n\nTHE PERSON'S WISH FOR THIS VOICE:\n${wish}` : ""}` }],
    schema: DESCRIBE_SCHEMA,
    maxTokens: 2000,
    effort: "low",
    fallback: true,
  }).catch((e) => {
    console.error("film describe voice", e);
    throw new UserError("ما قدر الذكاء الاصطناعي يكتب الوصف الحين؛ اكتبه بنفسك أو جرّب بعد شوي.", 502);
  });
  const pad = (t: string) => (t.length >= 100 ? t : `${t} ${lines.map((l) => l.line).join(" ")}`.slice(0, 1000));
  return { description: r.data.description.trim().slice(0, 1000), sample: pad(r.data.sample.trim()).slice(0, 1000) };
}
