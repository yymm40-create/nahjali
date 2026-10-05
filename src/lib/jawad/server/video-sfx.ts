// «الجواد الذكي!» | JAWAD AI — «مؤثرات من فيديو». Server only.
//
//   click ─► createJob keeps the frames the studio took of the video (with their times) next to the job.
//   run   ─► Claude watches the frames and returns the sound plan (each effect with its moment, length and loudness,
//            and one background for the whole video); ElevenLabs makes each sound; they are mixed into ONE WAV track
//            with the video's exact length. Any failure before the track is saved refunds every coin.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson, claudeCost, type ClaudePart, type ClaudeUsage } from "@/lib/film/anthropic";
import { ELEVEN_PRICE } from "@config/jawad/generators";
import { VIDEO_SFX } from "@config/jawad/video-sfx";
import { mixTrack, wav, type MixClip } from "./audio-mix";
import { ProviderError } from "./providers/common";
import { elevenSoundPcm } from "./providers/elevenlabs";
import { JAWAD_BUCKET } from "./runtime";
import { readFrame } from "./smart-edit";
import type { JobRow } from "./jobs";

const db = () => createAdminClient();
/** The track's sample rate (the video standard). */
const MIX_RATE = 48_000;
/** Sounds made at the same time (ElevenLabs limits concurrent requests per plan; the smallest allows 2–3). */
const PARALLEL = 3;

export interface SoundPlan {
  scene: string;
  ambience: { description: string; volume: number };
  events: { start: number; duration: number; description: string; volume: number }[];
}

/** What a «من فيديو» job keeps: the video's length, its frames (stored copies) and, once written, Claude's plan. */
export interface VideoSfxInputs {
  durationMs: number;
  frames: { t: number; path: string }[];
  plan?: SoundPlan;
}

// ───────────────────────────── the click ─────────────────────────────

/** The frames sent with the click: real small JPEGs, in order, at times inside the video; stored next to the job. */
export async function storeSfxFrames(userId: string, key: string, raw: unknown, durationMs: number): Promise<VideoSfxInputs> {
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

const SYSTEM = `You are the sound designer (Foley and effects) of the JAWAD AI studio's "sound effects from a video" tool. You run in the background; the user never sees this exchange. You receive frames of a video in order, each labeled with its exact time, and you return the plan of its sound effects as JSON.

Each sound you list is generated on its own by ElevenLabs' text-to-sound-effects model from your English description and duration, then placed in the track at your start time. The track has exactly the video's length and is played under the video, so the timing is what makes it work.

Timing:
- Work out what happens between the frames, not only in them. A sound starts at the moment of contact or onset — when the fist lands, the foot touches the ground, the door meets its frame, the glass hits the floor — not when the movement begins.
- When that moment falls between two frames, estimate it from the motion (to the hundredth of a second).
- A sound must start before the video ends.

What to include:
- The sounds a viewer expects to hear: impacts, footsteps, cloth and body movement, objects being handled, doors, vehicles, weather, animals, machines, fire, water, whooshes for fast motion. Leave out what nobody would notice.
- Repeated steps or blows that follow a steady rhythm can be one entry describing the series ("three heavy footsteps on wood"); a few strong separate hits each get their own entry.
- ambience: one background for the whole video when the place has a sound (room tone, wind, city traffic, forest, sea, distant crowd); an empty description when the place should be silent between the effects.

Descriptions (they are prompts for the sound generator):
- English, concrete, under 25 words: the source, the material, the force, the space and the distance. Example: "heavy punch impact to the body, close, punchy, slight room reverb".
- No music, speech, singing or words — the generator cannot make them, and the tool is for effects only. A crowd is "indistinct crowd murmur".

Numbers:
- duration: how long the sound rings, 0.5 to 10 seconds (a hit about 0.8–1.5, a car passing 2–4).
- volume: 0.2 to 1.0, relative loudness in the mix (1 for the main hits, lower for details). Ambience volume 0.2 to 0.6.
- At most ${VIDEO_SFX.eventsMax} entries and ${VIDEO_SFX.eventsTotalSec} seconds of effects in total; never two entries for the same sound.

The user may add a note (often in Arabic). Follow it: add what they ask for and leave out what they ask to leave out.
"scene": one short English line on what happens in the video.`;

const SCHEMA = {
  type: "object",
  properties: {
    scene: { type: "string" },
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
  required: ["scene", "ambience", "events"],
  additionalProperties: false,
};

const clamp = (v: unknown, lo: number, hi: number, dflt: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt);
const text = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 400) : "");

/** Claude's plan within the limits: sounds inside the video, sensible lengths and loudness, the totals kept. */
export function cleanPlan(p: Partial<SoundPlan>, sec: number): SoundPlan {
  const all = (Array.isArray(p.events) ? p.events : [])
    .map((e) => ({ start: Number(e?.start), duration: Number(e?.duration), description: text(e?.description), volume: e?.volume }))
    .filter((e) => e.description && Number.isFinite(e.start) && e.start >= 0 && e.start < sec - 0.05)
    .sort((a, b) => a.start - b.start);
  const events: SoundPlan["events"] = [];
  let total = 0;
  for (const e of all) {
    if (events.length >= VIDEO_SFX.eventsMax) break;
    // Nothing much is made past the end of the video: it would be cut there anyway
    const want = clamp(e.duration, VIDEO_SFX.eventMinSec, VIDEO_SFX.eventMaxSec, 1.5);
    const duration = Math.round(Math.max(VIDEO_SFX.eventMinSec, Math.min(want, sec - e.start + 0.3)) * 10) / 10;
    if (total + duration > VIDEO_SFX.eventsTotalSec) continue;
    total += duration;
    events.push({ start: Math.round(e.start * 100) / 100, duration, description: e.description, volume: Math.round(clamp(e.volume, 0.1, 1, 0.8) * 100) / 100 });
  }
  const amb = p.ambience;
  return {
    scene: text(p.scene),
    ambience: { description: text(amb?.description), volume: Math.round(clamp(amb?.volume, 0.1, 0.7, 0.35) * 100) / 100 },
    events,
  };
}

async function planSounds(sfx: VideoSfxInputs, note: string): Promise<{ plan: SoundPlan; usage: ClaudeUsage }> {
  const sec = sfx.durationMs / 1000;
  const { data } = await db().storage.from(JAWAD_BUCKET).createSignedUrls(sfx.frames.map((f) => f.path), 900);
  const parts: ClaudePart[] = [{ type: "text", text: `Video length: ${sec.toFixed(2)} s. ${sfx.frames.length} frames follow, in order, each labeled with its time.` }];
  sfx.frames.forEach((f, i) => {
    const url = data?.[i]?.signedUrl;
    if (url) parts.push({ type: "text", text: `t = ${f.t.toFixed(2)} s` }, { type: "image", url });
  });
  if (parts.length < 5) throw new Error("frames unreadable");
  parts.push({ type: "text", text: note.trim() ? `The user's note:\n<<<\n${note.trim()}\n>>>` : "No note from the user." });
  const r = await callClaudeJson<SoundPlan>({ system: SYSTEM, turns: [{ role: "user", content: parts }], schema: SCHEMA, maxTokens: 20_000, effort: "high", fallback: true });
  return { plan: cleanPlan(r.data, sec), usage: r.usage };
}

// ───────────────────────────── the track ─────────────────────────────

/** Plans, makes and mixes the sounds of a «من فيديو» job. Throws a ProviderError the user can read on any failure. */
export async function makeVideoSfx(job: JobRow, influence: number) {
  const sfx = job.inputs.sfx;
  if (!sfx?.frames.length) throw new ProviderError("rejected", "لقطات الفيديو غير موجودة. لم يُخصم منك شيء؛ جرّب مرة ثانية.", "video sfx: no frames");
  const sec = sfx.durationMs / 1000;
  const status = (s: string) => db().from("jawad_jobs").update({ provider_status: s }).eq("id", job.id);

  await status("watching");
  let plan: SoundPlan;
  let usage: ClaudeUsage;
  try {
    ({ plan, usage } = await planSounds(sfx, job.prompt));
  } catch (e) {
    throw new ProviderError("rejected", "تعذّر على Claude تحليل الفيديو الآن. أُعيدت لك نقودك؛ جرّب مرة ثانية.", `video sfx plan: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    // Claude has seen the frames (or never will): they are not kept
    void db().storage.from(JAWAD_BUCKET).remove(sfx.frames.map((f) => f.path)).then(() => null, () => null);
  }
  const claudeUsd = claudeCost(usage);

  // The background (looped, the video's length) and each effect at its moment
  const jobs: { kind: "bed" | "event"; text: string; seconds: number; at: number; gain: number }[] = [];
  if (plan.ambience.description) jobs.push({ kind: "bed", text: plan.ambience.description, seconds: Math.min(30, Math.max(0.5, Math.ceil(sec * 10) / 10)), at: 0, gain: plan.ambience.volume });
  for (const ev of plan.events) jobs.push({ kind: "event", text: ev.description, seconds: ev.duration, at: ev.start, gain: ev.volume });
  if (!jobs.length) throw new ProviderError("rejected", "ما وجد Claude أصواتًا لهذا الفيديو. اكتب في «توجيه إضافي» الأصوات التي تريدها وجرّب. أُعيدت لك نقودك.", "video sfx: empty plan");
  await db().from("jawad_jobs").update({ inputs: { ...job.inputs, sfx: { ...sfx, plan } }, provider_status: `sounds 0/${jobs.length}` }).eq("id", job.id);

  const made: (MixClip | null)[] = new Array(jobs.length).fill(null);
  const errors: unknown[] = [];
  let done = 0;
  await inBatches(jobs, PARALLEL, async (j, i) => {
    try {
      const { samples, rate } = await elevenSoundPcm({ text: j.text, seconds: j.seconds, loop: j.kind === "bed", influence });
      made[i] = { samples, rate, at: j.at, gain: j.gain, trimLead: j.kind === "event", loop: j.kind === "bed" };
    } catch (e) {
      errors.push(e);
    }
    await status(`sounds ${++done}/${jobs.length}`);
  });
  const clips = made.filter((c): c is MixClip => c !== null);
  // One odd refusal is dropped; a failure of most of them (key, credits, plan…) fails the job and refunds it
  if (!clips.length || errors.length > clips.length) {
    const first = errors[0];
    throw first instanceof ProviderError ? first : new ProviderError("rejected", "تعذّر صنع المؤثرات الآن. أُعيدت لك نقودك؛ جرّب مرة ثانية.", `video sfx sounds: ${String(first)}`);
  }

  await status("mixing");
  const audio = wav(mixTrack(clips, sfx.durationMs, MIX_RATE), MIX_RATE);
  const seconds = jobs.reduce((s, j, i) => s + (made[i] ? j.seconds : 0), 0);
  return {
    audio,
    durationMs: sfx.durationMs,
    costUsd: claudeUsd + (seconds * ELEVEN_PRICE.sfxPerMin) / 60,
    units: {
      frames: sfx.frames.length,
      effects: plan.events.length,
      ambience: Boolean(plan.ambience.description),
      seconds: Math.round(seconds * 10) / 10,
      skipped: errors.length,
      sampleRate: clips[0].rate,
      claudeUsd: Number(claudeUsd.toFixed(4)),
      claudeTokens: { input: usage.input_tokens, output: usage.output_tokens },
    },
  };
}
