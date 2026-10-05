// «الجواد الذكي!» | JAWAD AI — «الفصل الذكي»: a video's sound as three separate tracks. Server only.
//
//   click ─► createJob refuses «الحوار» for a video with no sound track, and keeps the frames the studio took of the
//            video (with their times) next to the job when music or effects are asked for.
//   run   ─► at the same time: ElevenLabs separates the voices from the video's own sound (الحوار), and Claude watches
//            the frames and plans the music (sections that follow the scenes) and the effects (each at its moment,
//            with one background for the place). Then Eleven Music composes the sections and ElevenLabs makes each
//            effect; music and effects are each cut/mixed to the video's exact length (WAV). Any failure before the
//            tracks are saved refunds every coin.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson, claudeCost, type ClaudePart, type ClaudeUsage } from "@/lib/film/anthropic";
import { ELEVEN_PRICE } from "@config/jawad/generators";
import { STEMS, VIDEO_SFX, type Stem } from "@config/jawad/smart-split";
import { hasSoundTrack, probe, sniff } from "../media";
import { mixTrack, wav, type MixClip } from "./audio-mix";
import { ProviderError } from "./providers/common";
import { elevenIsolateVoice, elevenMusicPcm, elevenSoundPcm, type MusicSection } from "./providers/elevenlabs";
import { JAWAD_BUCKET } from "./runtime";
import { readFrame } from "./smart-edit";
import type { UploadRow } from "./uploads";
import type { JobRow } from "./jobs";

const db = () => createAdminClient();
/** The tracks' sample rate (the video standard). */
const MIX_RATE = 48_000;
/** Requests to ElevenLabs at the same time (it limits concurrent requests per plan; the smallest allows 2–3). */
const PARALLEL = 3;
const MUSIC_MODEL = "music_v2_5";

export interface SoundPlan {
  scene: string;
  music: { styles: string[]; sections: { name: string; seconds: number; styles: string[]; avoid: string[]; direction: string }[] };
  ambience: { description: string; volume: number };
  events: { start: number; duration: number; description: string; volume: number }[];
}

/** What a job keeps about its video: its length, its frames (stored copies, gone once Claude saw them) and the plan. */
export interface VideoInputs {
  durationMs: number;
  frames: { t: number; path: string }[];
  plan?: SoundPlan;
}

// ───────────────────────────── the click ─────────────────────────────

/** Whether a stored video has a sound track to take the dialogue from. */
export async function videoHasSound(path: string) {
  const { data, error } = await db().storage.from(JAWAD_BUCKET).download(path);
  if (error || !data) throw new UserError("تعذّر قراءة الفيديو؛ جرّب مرة ثانية.", 400);
  return hasSoundTrack(new Uint8Array(await data.arrayBuffer()));
}

/** The frames sent with the click: real small JPEGs, in order, at times inside the video; stored next to the job. */
export async function storeFrames(userId: string, key: string, raw: unknown, durationMs: number): Promise<VideoInputs> {
  const list = Array.isArray(raw) ? raw.slice(0, VIDEO_SFX.framesMax + 1) : [];
  if (list.length < 2 || list.length > VIDEO_SFX.framesMax || !durationMs) throw new UserError("تعذّر تجهيز لقطات الفيديو؛ جرّب مرة ثانية.", 400);
  const sec = durationMs / 1000;
  const checked: { t: number; bytes: Buffer }[] = [];
  let prev = -1;
  for (const f of list) {
    const x = (f ?? {}) as { t?: unknown; data?: unknown };
    const t = typeof x.t === "number" && Number.isFinite(x.t) ? x.t : NaN;
    if (!(t >= 0 && t <= sec + 0.1 && t > prev)) throw new UserError("لقطة غير صالحة.", 400);
    prev = t;
    checked.push({ t: Math.round(t * 100) / 100, bytes: await readFrame(x.data, 150_000, 640) });
  }
  const frames = checked.map((c, i) => ({ t: c.t, path: `${userId}/sfx/${key}/f${i}.jpg` }));
  await inBatches(checked, 8, async (c, i) => {
    const up = await db().storage.from(JAWAD_BUCKET).upload(frames[i].path, c.bytes, { contentType: "image/jpeg", upsert: true });
    if (up.error) throw up.error;
  });
  return { durationMs, frames };
}

export const removeFrames = (v: VideoInputs) =>
  v.frames.length ? db().storage.from(JAWAD_BUCKET).remove(v.frames.map((f) => f.path)).then(() => null, () => null) : Promise.resolve(null);

async function inBatches<T>(items: T[], size: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    }),
  );
}

// ───────────────────────────── Claude's plan ─────────────────────────────

const SYSTEM = `You are the composer and sound designer of the JAWAD AI studio's "Smart Split" tool. You run in the background; the user never sees this exchange. You receive frames of a video in order, each labeled with its exact time, and you return, as JSON, the plan of the parts the message asks for: the music, the sound effects, or both. A part that is not asked for stays empty.

The video's own sound (dialogue) is kept apart; what you plan is played under the video next to it, so it has to fit the picture.

MUSIC — an instrumental score composed by Eleven Music from your sections:
- Split it into sections that follow the video: a new section where the mood, the pace or the scene changes (a calm opening, rising tension, the climax at the big moment, a resolution). Each section lasts at least 3 seconds; together they cover the whole video (1 to ${VIDEO_SFX.musicSectionsMax} sections).
- For each section: a short name (Intro, Build, Climax, Outro…), the English styles to include (genre, instruments, tempo or BPM, energy, mood — e.g. "cinematic", "taiko drums", "120 bpm", "tense"), the styles to avoid, and a one-line direction ("swells into a hard hit at the end").
- "styles" of the music: what holds for the whole piece (the genre and the main instruments).
- No vocals, singing, lyrics or words. When people speak on screen, keep the music light under them.

SOUND EFFECTS — each one generated on its own by ElevenLabs' text-to-sound-effects model from your English description and duration, then placed at your start time:
- Work out what happens between the frames, not only in them. A sound starts at the moment of contact or onset — when the fist lands, the foot touches the ground, the door meets its frame, the glass hits the floor — not when the movement begins. When that moment falls between two frames, estimate it from the motion (to the hundredth of a second). A sound must start before the video ends.
- Include the sounds a viewer expects to hear: impacts, footsteps, cloth and body movement, objects being handled, doors, vehicles, weather, animals, machines, fire, water, whooshes for fast motion. Leave out what nobody would notice. Steps or blows in a steady rhythm can be one entry describing the series; a few strong separate hits each get their own entry.
- ambience: one background for the whole video when the place has a sound (room tone, wind, city traffic, forest, sea, distant crowd); an empty description when the place should be silent between the effects.
- Descriptions are prompts for the generator: English, concrete, under 25 words — the source, the material, the force, the space, the distance (e.g. "heavy punch impact to the body, close, punchy, slight room reverb"). No music, speech, singing or words; a crowd is "indistinct crowd murmur".
- duration: how long the sound rings, 0.5 to 10 seconds (a hit about 0.8–1.5, a car passing 2–4). volume: 0.2 to 1.0, relative loudness (1 for the main hits); ambience 0.2 to 0.6.
- At most ${VIDEO_SFX.eventsMax} entries and ${VIDEO_SFX.eventsTotalSec} seconds of effects in total; never two entries for the same sound.

The user may add a note (often in Arabic, e.g. «عود», «طبول», «هادئة», «بدون خطوات»). Follow it for the parts it concerns.
"scene": one short English line on what happens in the video.`;

const strings = { type: "array", items: { type: "string" } };
const SCHEMA = {
  type: "object",
  properties: {
    scene: { type: "string" },
    music: {
      type: "object",
      properties: {
        styles: strings,
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, seconds: { type: "number" }, styles: strings, avoid: strings, direction: { type: "string" } },
            required: ["name", "seconds", "styles", "avoid", "direction"],
            additionalProperties: false,
          },
        },
      },
      required: ["styles", "sections"],
      additionalProperties: false,
    },
    ambience: { type: "object", properties: { description: { type: "string" }, volume: { type: "number" } }, required: ["description", "volume"], additionalProperties: false },
    events: {
      type: "array",
      items: {
        type: "object",
        properties: { start: { type: "number" }, duration: { type: "number" }, description: { type: "string" }, volume: { type: "number" } },
        required: ["start", "duration", "description", "volume"],
        additionalProperties: false,
      },
    },
  },
  required: ["scene", "music", "ambience", "events"],
  additionalProperties: false,
};

const clamp = (v: unknown, lo: number, hi: number, dflt: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt);
const text = (v: unknown, max = 400) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const list = (v: unknown, max: number) => [...new Set((Array.isArray(v) ? v : []).map((x) => text(x, 60)).filter(Boolean))].slice(0, max);

/** Claude's plan within the limits: only the parts asked for, sounds inside the video, sensible lengths and loudness. */
export function cleanPlan(p: Partial<SoundPlan>, sec: number, want: { music: boolean; sfx: boolean }): SoundPlan {
  const all = (want.sfx && Array.isArray(p.events) ? p.events : [])
    .map((e) => ({ start: Number(e?.start), duration: Number(e?.duration), description: text(e?.description), volume: e?.volume }))
    .filter((e) => e.description && Number.isFinite(e.start) && e.start >= 0 && e.start < sec - 0.05)
    .sort((a, b) => a.start - b.start);
  const events: SoundPlan["events"] = [];
  let total = 0;
  for (const e of all) {
    if (events.length >= VIDEO_SFX.eventsMax) break;
    // Nothing much is made past the end of the video: it would be cut there anyway
    const wanted = clamp(e.duration, VIDEO_SFX.eventMinSec, VIDEO_SFX.eventMaxSec, 1.5);
    const duration = Math.round(Math.max(VIDEO_SFX.eventMinSec, Math.min(wanted, sec - e.start + 0.3)) * 10) / 10;
    if (total + duration > VIDEO_SFX.eventsTotalSec) continue;
    total += duration;
    events.push({ start: Math.round(e.start * 100) / 100, duration, description: e.description, volume: Math.round(clamp(e.volume, 0.1, 1, 0.8) * 100) / 100 });
  }
  const amb = p.ambience;
  const m = p.music;
  return {
    scene: text(p.scene),
    music: {
      styles: want.music ? list(m?.styles, 12) : [],
      sections: (want.music && Array.isArray(m?.sections) ? m.sections : []).slice(0, VIDEO_SFX.musicSectionsMax).map((x) => ({
        name: text(x?.name, 40),
        seconds: clamp(x?.seconds, 0, 600, 0),
        styles: list(x?.styles, 20),
        avoid: list(x?.avoid, 20),
        direction: text(x?.direction, 200),
      })),
    },
    ambience: { description: want.sfx ? text(amb?.description) : "", volume: Math.round(clamp(amb?.volume, 0.1, 0.7, 0.35) * 100) / 100 },
    events,
  };
}

/**
 * Claude's sections as an Eleven Music plan that covers exactly `totalMs`: lengths scaled to the total, any section
 * under 3 s joined to its neighbour, every section instrumental (styles), the remainder given to the last one.
 */
export function musicSections(m: SoundPlan["music"], totalMs: number): MusicSection[] {
  let secs = m.sections.filter((s) => s.seconds > 0).map((s) => ({ ...s, ms: s.seconds * 1000 }));
  if (!secs.length) secs = [{ name: "Score", seconds: totalMs / 1000, styles: [], avoid: [], direction: "", ms: totalMs }];
  const sum = secs.reduce((t, s) => t + s.ms, 0);
  secs = secs.map((s) => ({ ...s, ms: (s.ms * totalMs) / sum }));
  for (let i = secs.findIndex((s) => s.ms < VIDEO_SFX.musicMinMs); i >= 0 && secs.length > 1; i = secs.findIndex((s) => s.ms < VIDEO_SFX.musicMinMs)) {
    const j = i > 0 ? i - 1 : i + 1;
    const [keep, gone] = secs[j].ms >= secs[i].ms ? [j, i] : [i, j];
    secs[keep] = { ...secs[keep], ms: secs[keep].ms + secs[gone].ms };
    secs.splice(gone, 1);
  }
  const out = secs.map((s) => ({ ...s, ms: Math.floor(s.ms) }));
  out[out.length - 1].ms += totalMs - out.reduce((t, s) => t + s.ms, 0);
  return out.map((s) => ({
    text: `[${s.name || "Section"}]${s.direction ? `\n{${s.direction}}` : ""}`,
    duration_ms: s.ms,
    positive_styles: [...new Set([...m.styles, ...s.styles, "instrumental"])].slice(0, 50),
    negative_styles: [...new Set([...s.avoid, "vocals", "singing", "lyrics", "spoken word"])].slice(0, 50),
  }));
}

async function planVideo(v: VideoInputs, note: string, want: { music: boolean; sfx: boolean }): Promise<{ plan: SoundPlan; usage: ClaudeUsage }> {
  const sec = v.durationMs / 1000;
  const { data } = await db().storage.from(JAWAD_BUCKET).createSignedUrls(v.frames.map((f) => f.path), 900);
  const ask = want.music && want.sfx ? "the music and the sound effects" : want.music ? "the music only (leave the events empty and the ambience description empty)" : "the sound effects only (leave the music sections empty)";
  const parts: ClaudePart[] = [{ type: "text", text: `Plan: ${ask}.\nVideo length: ${sec.toFixed(2)} s. ${v.frames.length} frames follow, in order, each labeled with its time.` }];
  v.frames.forEach((f, i) => {
    const url = data?.[i]?.signedUrl;
    if (url) parts.push({ type: "text", text: `t = ${f.t.toFixed(2)} s` }, { type: "image", url });
  });
  if (parts.length < 5) throw new Error("frames unreadable");
  parts.push({ type: "text", text: note.trim() ? `The user's note:\n<<<\n${note.trim()}\n>>>` : "No note from the user." });
  const r = await callClaudeJson<SoundPlan>({ system: SYSTEM, turns: [{ role: "user", content: parts }], schema: SCHEMA, maxTokens: 20_000, effort: "high", fallback: true });
  return { plan: cleanPlan(r.data, sec, want), usage: r.usage };
}

// ───────────────────────────── the tracks ─────────────────────────────

export interface SplitFile {
  stem: Stem;
  audio: Buffer;
  mime: string;
  ext: string;
  durationMs: number;
}

/** الحوار: the voices of the video's own sound (the video is sent as it is). */
async function dialogueTrack(video: UploadRow | undefined, durationMs: number): Promise<SplitFile & { usd: number }> {
  if (!video) throw new ProviderError("rejected", "الفيديو حُذف قبل الفصل. أُعيدت لك نقودك.", "dialogue: no video");
  const { data, error } = await db().storage.from(JAWAD_BUCKET).download(video.storage_path);
  if (error || !data) throw new ProviderError("rejected", "تعذّر قراءة الفيديو. أُعيدت لك نقودك؛ جرّب مرة ثانية.", `dialogue download: ${error?.message}`);
  const file = Buffer.from(await data.arrayBuffer());
  if (!hasSoundTrack(new Uint8Array(file))) throw new ProviderError("rejected", "الفيديو بلا صوت، فلا يوجد حوار لفصله. أُعيدت لك نقودك.", "dialogue: no sound track");
  const mime = video.mime ?? "video/mp4";
  const audio = await elevenIsolateVoice({ file, mime, name: mime === "video/quicktime" ? "video.mov" : "video.mp4" });
  const bytes = new Uint8Array(audio);
  const sn = sniff(bytes);
  const ogg = String.fromCharCode(...bytes.subarray(0, 4)) === "OggS";
  const outMime = sn?.kind === "audio" ? sn.mime : ogg ? "audio/ogg" : "audio/mpeg";
  return {
    stem: "dialogue",
    audio,
    mime: outMime,
    ext: outMime === "audio/wav" ? "wav" : outMime === "audio/ogg" ? "ogg" : "mp3",
    durationMs: (sn ? probe(bytes, sn).durationMs : undefined) ?? durationMs,
    usd: ((durationMs / 1000) * ELEVEN_PRICE.isolatorPerMin) / 60,
  };
}

/** الموسيقى والمؤثرات: Claude's plan, then the music and every effect (3 requests at a time), each cut/mixed to length. */
async function madeTracks(job: JobRow, v: VideoInputs, want: { music: boolean; sfx: boolean }, influence: number, status: (s: string) => PromiseLike<unknown>) {
  const sec = v.durationMs / 1000;
  let plan: SoundPlan;
  let usage: ClaudeUsage;
  try {
    ({ plan, usage } = await planVideo(v, job.prompt, want));
  } catch (e) {
    throw new ProviderError("rejected", "تعذّر على Claude تحليل الفيديو الآن. أُعيدت لك نقودك؛ جرّب مرة ثانية.", `smart split plan: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    // Claude has seen the frames (or never will): they are not kept
    void removeFrames(v);
  }
  const claudeUsd = claudeCost(usage);

  // The music first, then the background (looped, the video's length) and each effect at its moment
  type Task = { kind: "music" | "bed" | "event"; text: string; seconds: number; at: number; gain: number };
  const tasks: Task[] = [];
  const musicMs = Math.max(VIDEO_SFX.musicMinMs, v.durationMs);
  const sections = want.music ? musicSections(plan.music, musicMs) : [];
  if (want.music) tasks.push({ kind: "music", text: "", seconds: musicMs / 1000, at: 0, gain: 1 });
  if (want.sfx) {
    if (plan.ambience.description) tasks.push({ kind: "bed", text: plan.ambience.description, seconds: Math.min(30, Math.max(0.5, Math.ceil(sec * 10) / 10)), at: 0, gain: plan.ambience.volume });
    for (const ev of plan.events) tasks.push({ kind: "event", text: ev.description, seconds: ev.duration, at: ev.start, gain: ev.volume });
    if (!tasks.some((t) => t.kind !== "music")) throw new ProviderError("rejected", "ما وجد Claude مؤثرات لهذا الفيديو. اكتب في «توجيه إضافي» الأصوات التي تريدها، أو ألغِ «المؤثرات». أُعيدت لك نقودك.", "smart split: no effects");
  }
  await db().from("jawad_jobs").update({ inputs: { ...job.inputs, video: { ...v, frames: [], plan } }, provider_status: `sounds 0/${tasks.length}` }).eq("id", job.id);

  const made: (MixClip | null)[] = new Array(tasks.length).fill(null);
  const errors: { kind: Task["kind"]; e: unknown }[] = [];
  let done = 0;
  await inBatches(tasks, PARALLEL, async (t, i) => {
    try {
      if (t.kind === "music") {
        const { samples, rate } = await elevenMusicPcm({ sections, model: MUSIC_MODEL });
        made[i] = { samples, rate, at: 0, gain: 1, fadeOut: 0.8 };
      } else {
        const { samples, rate } = await elevenSoundPcm({ text: t.text, seconds: t.seconds, loop: t.kind === "bed", influence });
        made[i] = { samples, rate, at: t.at, gain: t.gain, trimLead: t.kind === "event", loop: t.kind === "bed" };
      }
    } catch (e) {
      errors.push({ kind: t.kind, e });
    }
    await status(`sounds ${++done}/${tasks.length}`);
  });
  const fail = (e: unknown, what: string) =>
    e instanceof ProviderError ? e : new ProviderError("rejected", `تعذّر صنع ${what} الآن. أُعيدت لك نقودك؛ جرّب مرة ثانية.`, `smart split ${what}: ${String(e)}`);
  // The music must come; one odd refused effect is dropped, but most of them failing (key, credits…) fails the job
  const musicError = errors.find((x) => x.kind === "music");
  if (musicError) throw fail(musicError.e, "الموسيقى");
  const fx = tasks.map((t, i) => (t.kind === "music" ? null : made[i])).filter((c): c is MixClip => c !== null);
  const fxErrors = errors.filter((x) => x.kind !== "music");
  if (want.sfx && (!fx.length || fxErrors.length > fx.length)) throw fail(fxErrors[0]?.e, "المؤثرات");

  await status("mixing");
  const files: SplitFile[] = [];
  const musicClip = made[tasks.findIndex((t) => t.kind === "music")];
  if (want.music && musicClip) files.push({ stem: "music", audio: wav(mixTrack([musicClip], v.durationMs, MIX_RATE), MIX_RATE), mime: "audio/wav", ext: "wav", durationMs: v.durationMs });
  if (want.sfx) files.push({ stem: "sfx", audio: wav(mixTrack(fx, v.durationMs, MIX_RATE), MIX_RATE), mime: "audio/wav", ext: "wav", durationMs: v.durationMs });
  const fxSeconds = tasks.reduce((s, t, i) => s + (t.kind !== "music" && made[i] ? t.seconds : 0), 0);
  return {
    files,
    usd: claudeUsd + (want.music ? ((musicMs / 1000) * ELEVEN_PRICE.musicPerMin) / 60 : 0) + (fxSeconds * ELEVEN_PRICE.sfxPerMin) / 60,
    units: {
      frames: v.frames.length,
      claudeUsd: Number(claudeUsd.toFixed(4)),
      claudeTokens: { input: usage.input_tokens, output: usage.output_tokens },
      ...(want.music ? { music: { sections: sections.length, ms: musicMs } } : {}),
      ...(want.sfx ? { effects: plan.events.length, ambience: Boolean(plan.ambience.description), seconds: Math.round(fxSeconds * 10) / 10, skipped: fxErrors.length } : {}),
      sampleRate: fx[0]?.rate ?? musicClip?.rate ?? null,
    },
  };
}

/** Makes the asked tracks of a «الفصل الذكي» job, in STEMS order. Throws a ProviderError the user can read on any failure. */
export async function makeSmartSplit(job: JobRow, stems: Stem[], video: UploadRow | undefined, influence = 0.3) {
  // Jobs made before «الفصل الذكي» (effects only) kept their video as `sfx`
  const v = job.inputs.video ?? job.inputs.sfx ?? { durationMs: video?.duration_ms ?? 0, frames: [] };
  if (!v.durationMs) throw new ProviderError("rejected", "تعذّر قراءة مدة الفيديو. أُعيدت لك نقودك.", "smart split: no duration");
  const want = { dialogue: stems.includes("dialogue"), music: stems.includes("music"), sfx: stems.includes("sfx") };
  if ((want.music || want.sfx) && v.frames.length < 2) throw new ProviderError("rejected", "لقطات الفيديو غير موجودة. أُعيدت لك نقودك؛ جرّب مرة ثانية.", "smart split: no frames");
  const status = (s: string) => db().from("jawad_jobs").update({ provider_status: s }).eq("id", job.id);
  await status(want.music || want.sfx ? "watching" : "isolating");

  // Both at once; both are waited for (nothing keeps running and billing after a failure)
  const [d, m] = await Promise.allSettled([
    want.dialogue ? dialogueTrack(video, v.durationMs) : Promise.resolve(null),
    want.music || want.sfx ? madeTracks(job, v, want, influence, status) : Promise.resolve(null),
  ]);
  for (const r of [d, m]) if (r.status === "rejected") throw r.reason instanceof ProviderError ? r.reason : new ProviderError("rejected", "صار خطأ أثناء الفصل. أُعيدت لك نقودك؛ جرّب مرة ثانية.", String(r.reason));
  const dialogue = d.status === "fulfilled" ? d.value : null;
  const made = m.status === "fulfilled" ? m.value : null;
  const files = [...(dialogue ? [dialogue] : []), ...(made?.files ?? [])].sort((a, b) => STEMS.indexOf(a.stem) - STEMS.indexOf(b.stem));
  return {
    files,
    costUsd: (dialogue?.usd ?? 0) + (made?.usd ?? 0),
    units: { stems, ...(dialogue ? { dialogue: { bytes: dialogue.audio.length, mime: dialogue.mime, ms: dialogue.durationMs } } : {}), ...(made?.units ?? {}) },
  };
}
