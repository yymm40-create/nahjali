// JAWAD AI — ElevenLabs adapter: Eleven v4 speech, voice design and cloning, sound effects, Eleven Music. Server only.
// The key stays in the server's environment (PROVIDER_KEYS.elevenlabs). Retries are OFF: a repeated request could be
// generated (and billed) twice; a failure is reported instead.
import { PROVIDER_KEYS } from "../runtime";
import { ProviderError, rejectedMessage } from "./common";

// ELEVENLABS_BASE_URL only for a local test server; production talks to the API directly
const BASE = (process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io").replace(/\/+$/, "");
const FORMAT = "mp3_44100_128";

function apiKey() {
  const k = PROVIDER_KEYS.elevenlabs.map((n) => process.env[n]).find(Boolean);
  if (!k) throw new ProviderError("rejected", "مفتاح ElevenLabs غير مضبوط على الخادم.", "no ElevenLabs key");
  return k;
}

/** Turns ElevenLabs' answer into a ProviderError the user can act on (voice slots full, a rejected reference…). */
async function fail(res: Response, what: string): Promise<never> {
  const text = (await res.text().catch(() => "")).slice(0, 900);
  const t = text.toLowerCase();
  if (/missing_permissions|missing the permission/.test(t)) {
    const perm = (text.match(/permission[^a-z_]*([a-z_]+)/i) || [])[1] ?? "";
    throw new ProviderError("rejected", `مفتاح ElevenLabs ينقصه إذن${perm ? ` «${perm}»` : ""}. فعّل الصلاحيات من إعدادات المفتاح في ElevenLabs. لم يُخصم منك شيء.`, `${what} ${res.status} ${text}`);
  }
  if (res.status === 401) throw new ProviderError("rejected", "مفتاح ElevenLabs غير صحيح أو موقوف. لم يُخصم منك شيء.", `${what} 401 ${text}`);
  if (/quota_exceeded|insufficient|credits/.test(t)) throw new ProviderError("rejected", "رصيد حساب ElevenLabs لا يكفي. لم يُخصم منك شيء.", `${what} ${res.status} ${text}`);
  if (/voice_limit|voice limit|maximum number of voices|custom voices/.test(t)) {
    throw new ProviderError("rejected", "امتلأت خانات الأصوات في حساب ElevenLabs. احذف صوتًا من مكتبتك أو أبلغ الإدارة.", `${what} ${res.status} ${text}`);
  }
  if (/copyright|protected content|bad_prompt.*copyright/.test(t)) {
    throw new ProviderError("rejected", "رفض ElevenLabs المقطع المرجعي لأنه محمي بحقوق نشر. ارفع مقطعًا تملك حقه.", `${what} ${res.status} ${text}`);
  }
  if (/enterprise|not available on your|feature_not_available|upgrade/.test(t)) {
    throw new ProviderError("rejected", "هذه الميزة غير متاحة في خطة ElevenLabs الحالية. لم يُخصم منك شيء.", `${what} ${res.status} ${text}`);
  }
  if (res.status === 422 || res.status === 400) {
    throw new ProviderError("rejected", rejectedMessage(400, text), `${what} ${res.status} ${text}`);
  }
  throw new ProviderError("rejected", rejectedMessage(res.status, text), `${what} ${res.status} ${text}`);
}

async function call(path: string, init: RequestInit & { timeoutMs?: number }, what: string) {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "xi-api-key": apiKey(), ...(init.body instanceof FormData ? {} : { "content-type": "application/json" }), ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(init.timeoutMs ?? 280_000),
    });
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("unknown", "انقطع الاتصال بـ ElevenLabs قبل وصول النتيجة. لم يُخصم منك شيء؛ جرّب مرة ثانية.", `${what}: ${String(e instanceof Error ? e.message : e)}`);
  }
  if (!res.ok) await fail(res, what);
  return res;
}

const audioOf = async (res: Response, what: string) => {
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new ProviderError("rejected", "لم يرجع ElevenLabs أي صوت.", `${what}: empty audio`);
  return buf;
};

// ───────────────────────────── speech ─────────────────────────────

/** Eleven v4 (or another speech model): text → MP3. */
export async function elevenSpeech(o: { voiceId: string; text: string; model: string; stability?: number; languageCode?: string }) {
  const res = await call(
    `/v1/text-to-speech/${encodeURIComponent(o.voiceId)}?output_format=${FORMAT}`,
    {
      method: "POST",
      body: JSON.stringify({
        text: o.text,
        model_id: o.model,
        ...(o.languageCode ? { language_code: o.languageCode } : {}),
        ...(o.stability !== undefined ? { voice_settings: { stability: o.stability } } : {}),
      }),
    },
    "tts",
  );
  return audioOf(res, "tts");
}

export interface ElevenVoice {
  voiceId: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  previewUrl: string | null;
}

let premade: { at: number; list: ElevenVoice[] } | null = null;
/** ElevenLabs' ready voices in the account (remembered for an hour). */
export async function elevenPremadeVoices(): Promise<ElevenVoice[]> {
  if (premade && Date.now() - premade.at < 3600_000) return premade.list;
  const res = await call("/v2/voices?page_size=100&voice_type=default", { method: "GET", timeoutMs: 20_000 }, "voices");
  const body = (await res.json()) as { voices?: { voice_id: string; name: string; category?: string; labels?: Record<string, string>; preview_url?: string | null }[] };
  const list = (body.voices ?? []).map((v) => ({ voiceId: v.voice_id, name: v.name, category: v.category ?? "premade", labels: v.labels ?? {}, previewUrl: v.preview_url ?? null }));
  premade = { at: Date.now(), list };
  return list;
}

// ───────────────────────────── voices: design, save, clone, delete ─────────────────────────────

export interface VoicePreview {
  generatedVoiceId: string;
  audio: Buffer;
  durationSec: number | null;
}

/**
 * Three spoken previews of a voice described in words (eleven_ttv_v3, the newest voice designer). With a reference
 * recording the voice leans on it: `promptStrength` near 0 follows the recording, near 1 the description.
 */
export async function elevenDesignVoice(o: { description: string; text?: string; reference?: Buffer; promptStrength?: number; seed?: number }) {
  const res = await call(
    `/v1/text-to-voice/design?output_format=${FORMAT}`,
    {
      method: "POST",
      body: JSON.stringify({
        voice_description: o.description,
        model_id: "eleven_ttv_v3",
        ...(o.text ? { text: o.text } : { auto_generate_text: true }),
        ...(o.reference ? { reference_audio_base64: o.reference.toString("base64"), prompt_strength: o.promptStrength ?? 0.5 } : {}),
        ...(o.seed !== undefined ? { seed: o.seed } : {}),
      }),
      timeoutMs: 100_000,
    },
    "voice design",
  );
  const body = (await res.json()) as { previews?: { generated_voice_id: string; audio_base_64: string; duration_secs?: number }[]; text?: string };
  const previews: VoicePreview[] = (body.previews ?? []).map((p) => ({ generatedVoiceId: p.generated_voice_id, audio: Buffer.from(p.audio_base_64, "base64"), durationSec: p.duration_secs ?? null }));
  if (!previews.length) throw new ProviderError("rejected", "لم يرجع ElevenLabs أي عينة للصوت. جرّب وصفًا أوضح.", "voice design: no previews");
  return { previews, text: body.text ?? "" };
}

/** Keeps a designed preview as a voice in the account; returns its voice id. */
export async function elevenSaveDesigned(o: { generatedVoiceId: string; name: string; description: string }) {
  const res = await call(
    "/v1/text-to-voice",
    { method: "POST", body: JSON.stringify({ voice_name: o.name, voice_description: o.description, generated_voice_id: o.generatedVoiceId }), timeoutMs: 60_000 },
    "voice create",
  );
  const body = (await res.json()) as { voice_id?: string };
  if (!body.voice_id) throw new ProviderError("rejected", "تعذّر حفظ الصوت.", "voice create: no voice_id");
  return body.voice_id;
}

/** Instant voice cloning: the voice of a recording, as a voice in the account. */
export async function elevenCloneVoice(o: { name: string; description: string; file: Buffer; mime: string; removeNoise: boolean }) {
  const form = new FormData();
  form.append("name", o.name);
  form.append("description", o.description);
  form.append("remove_background_noise", String(o.removeNoise));
  form.append("files", new Blob([new Uint8Array(o.file)], { type: o.mime }), o.mime === "audio/wav" ? "sample.wav" : "sample.mp3");
  const res = await call("/v1/voices/add", { method: "POST", body: form, timeoutMs: 90_000 }, "voice clone");
  const body = (await res.json()) as { voice_id?: string };
  if (!body.voice_id) throw new ProviderError("rejected", "تعذّر نسخ الصوت.", "voice clone: no voice_id");
  return body.voice_id;
}

/** Frees the voice's slot in the account (a voice already gone counts as deleted). */
export async function elevenDeleteVoice(voiceId: string) {
  try {
    await call(`/v1/voices/${encodeURIComponent(voiceId)}`, { method: "DELETE", timeoutMs: 30_000 }, "voice delete");
  } catch (e) {
    if (e instanceof ProviderError && /\b404\b/.test(e.detail)) return;
    throw e;
  }
}

// ───────────────────────────── sound effects ─────────────────────────────

export async function elevenSoundEffect(o: { text: string; seconds: number; loop: boolean; influence: number }) {
  const res = await call(
    `/v1/sound-generation?output_format=${FORMAT}`,
    { method: "POST", body: JSON.stringify({ text: o.text, duration_seconds: o.seconds, loop: o.loop, prompt_influence: o.influence, model_id: "eleven_text_to_sound_v2" }) },
    "sfx",
  );
  return audioOf(res, "sfx");
}

/** Sample rate of raw sound for mixing: 48 kHz (the video standard) until the account turns it down, then 24 kHz. */
let pcmRate = 48_000;

/**
 * Raw samples for mixing (ElevenLabs' pcm_* formats: 16-bit little-endian mono) from a sound or music endpoint.
 * pcm_44100 is documented as Pro-only; 48 kHz is asked first, and if the account's plan refuses it, every plan's 24 kHz.
 */
async function rawPcm(path: string, body: string, timeoutMs: number, what: string): Promise<{ samples: Float32Array; rate: number }> {
  for (;;) {
    const rate = pcmRate;
    try {
      const res = await call(`${path}?output_format=pcm_${rate}`, { method: "POST", body, timeoutMs }, what);
      const buf = await audioOf(res, what);
      const samples = new Float32Array(buf.length >> 1);
      for (let i = 0; i < samples.length; i++) samples[i] = buf.readInt16LE(i * 2) / 32768;
      return { samples, rate };
    } catch (e) {
      // Refused for the format (not billed): once more at the rate every plan has
      if (rate !== 24_000 && e instanceof ProviderError && /output_format|pcm_|tier|subscription|upgrade|not available/i.test(e.detail)) {
        pcmRate = 24_000;
        continue;
      }
      throw e;
    }
  }
}

/** A sound effect as raw samples for mixing. */
export function elevenSoundPcm(o: { text: string; seconds: number; loop: boolean; influence: number }) {
  const body = JSON.stringify({ text: o.text, duration_seconds: o.seconds, loop: o.loop, prompt_influence: o.influence, model_id: "eleven_text_to_sound_v2" });
  return rawPcm("/v1/sound-generation", body, 90_000, "sfx raw");
}

// ───────────────────────────── voice isolation ─────────────────────────────

/** The voices of a recording or a video (ElevenLabs takes MP4/MOV as they are), without the music and noise around them. */
export async function elevenIsolateVoice(o: { file: Buffer; mime: string; name: string }) {
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(o.file)], { type: o.mime }), o.name);
  form.append("file_format", "other");
  const res = await call("/v1/audio-isolation", { method: "POST", body: form, timeoutMs: 150_000 }, "isolation");
  return audioOf(res, "isolation");
}

// ───────────────────────────── music ─────────────────────────────

interface PlanChunk {
  text: string;
  duration_ms: number;
  positive_styles: string[];
  negative_styles?: string[];
  context_adherence?: string;
  conditioning_ref?: { song_id: string; range: { start_ms: number; end_ms: number } };
  condition_strength?: "low" | "medium" | "high" | "xhigh";
}

export interface MusicSection {
  text: string;
  duration_ms: number;
  positive_styles: string[];
  negative_styles: string[];
}

/** Music in sections of exact lengths (Eleven Music composition plan), as raw samples for trimming to a video. */
export function elevenMusicPcm(o: { sections: MusicSection[]; model: string }) {
  const body = JSON.stringify({ composition_plan: { chunks: o.sections }, model_id: o.model, respect_sections_durations: true });
  return rawPcm("/v1/music", body, 160_000, "music raw");
}

/** A song from a description (Eleven Music). */
export async function elevenMusic(o: { prompt: string; lengthMs: number; instrumental: boolean; model: string }) {
  const res = await call(
    "/v1/music?output_format=mp3_44100_128",
    { method: "POST", body: JSON.stringify({ prompt: o.prompt, music_length_ms: o.lengthMs, force_instrumental: o.instrumental, model_id: o.model }) },
    "music",
  );
  return { audio: await audioOf(res, "music"), songId: res.headers.get("song-id") };
}

/**
 * A song shaped by a reference recording: the recording is uploaded (song_id), a plan is written from the description,
 * and the plan's first chunk is conditioned on the first seconds of the recording, at the chosen strength.
 */
export async function elevenMusicWithReference(o: { prompt: string; lengthMs: number; instrumental: boolean; model: string; reference: Buffer; mime: string; refMs: number; strength: "low" | "medium" | "high" | "xhigh" }) {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(o.reference)], { type: o.mime }), o.mime === "audio/wav" ? "reference.wav" : "reference.mp3");
  const up = await call("/v1/music/upload", { method: "POST", body: form, timeoutMs: 80_000 }, "music upload");
  const songId = ((await up.json()) as { song_id?: string }).song_id;
  if (!songId) throw new ProviderError("rejected", "تعذّر رفع المقطع المرجعي.", "music upload: no song_id");

  const planRes = await call(
    "/v1/music/plan",
    { method: "POST", body: JSON.stringify({ prompt: o.instrumental ? `${o.prompt}\n\nInstrumental only, no vocals.` : o.prompt, music_length_ms: o.lengthMs, model_id: o.model }), timeoutMs: 50_000 },
    "music plan",
  );
  const plan = (await planRes.json()) as { chunks?: PlanChunk[] };
  if (!plan.chunks?.length) throw new ProviderError("rejected", "تعذّر تجهيز خطة المقطوعة.", "music plan: no chunks");
  plan.chunks[0] = { ...plan.chunks[0], conditioning_ref: { song_id: songId, range: { start_ms: 0, end_ms: o.refMs } }, condition_strength: o.strength };

  // The three calls share the request's 300 s: the song gets what is left
  const res = await call("/v1/music?output_format=mp3_44100_128", { method: "POST", body: JSON.stringify({ composition_plan: { chunks: plan.chunks }, model_id: o.model }), timeoutMs: 150_000 }, "music compose");
  return { audio: await audioOf(res, "music"), songId: res.headers.get("song-id") };
}

// ───────────────────────────── listening ─────────────────────────────

export interface HeardWord {
  text: string;
  /** seconds from the start of the file */
  start: number;
  end: number;
}

/** Scribe v2: what is said in a recording, word by word with times (Arabic included). */
export async function elevenTranscribe(o: { file: Blob; name: string; languageCode?: string | null }) {
  const form = new FormData();
  form.append("model_id", "scribe_v2");
  form.append("file", o.file, o.name);
  form.append("timestamps_granularity", "word");
  form.append("tag_audio_events", "false");
  if (o.languageCode) form.append("language_code", o.languageCode);
  const res = await call("/v1/speech-to-text", { method: "POST", body: form }, "stt");
  const j = (await res.json()) as { language_code?: string; words?: { text: string; type?: string; start?: number | null; end?: number | null }[] };
  const words: HeardWord[] = (j.words ?? [])
    .filter((w) => (w.type ?? "word") === "word" && w.start != null && w.end != null && w.text.trim())
    .map((w) => ({ text: w.text.trim(), start: w.start!, end: w.end! }));
  return { language: j.language_code ?? null, words };
}

/** Forced alignment: the exact text the person gives (a poem), timed word by word on the recording. */
export async function elevenAlign(o: { file: Blob; name: string; text: string }) {
  const form = new FormData();
  form.append("file", o.file, o.name);
  form.append("text", o.text);
  const res = await call("/v1/forced-alignment", { method: "POST", body: form }, "align");
  const j = (await res.json()) as { words?: { text: string; start: number; end: number }[] };
  return (j.words ?? []).filter((w) => w.text.trim()).map((w) => ({ text: w.text.trim(), start: w.start, end: w.end }));
}
