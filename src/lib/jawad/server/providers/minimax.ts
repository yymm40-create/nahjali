// MiniMax speech through fal.ai (needs FAL_KEY): Speech 2.8 HD text-to-speech with its ready voices or a voice
// copied from a recording. A copied voice lives in MiniMax's own account (no slot limit published) — it must be
// used for speech at least once within 7 days or MiniMax drops it. Server only.

import { ProviderError } from "./common";
import { falFile, falReady, falRun, falUrl } from "./fal";

export const minimaxReady = falReady;

/** The speech models, as fal names them (HD: the best; Turbo: faster and cheaper). */
export const MINIMAX_SPEECH = { hd: "fal-ai/minimax/speech-2.8-hd", turbo: "fal-ai/minimax/speech-2.8-turbo" } as const;

/** MiniMax's ready voices (a stable, documented subset; ids as the API takes them). */
export const MINIMAX_READY_VOICES: { id: string; name: string; gender: "male" | "female" }[] = [
  { id: "Wise_Woman", name: "Wise Woman", gender: "female" },
  { id: "Friendly_Person", name: "Friendly Person", gender: "male" },
  { id: "Inspirational_girl", name: "Inspirational Girl", gender: "female" },
  { id: "Deep_Voice_Man", name: "Deep Voice Man", gender: "male" },
  { id: "Calm_Woman", name: "Calm Woman", gender: "female" },
  { id: "Casual_Guy", name: "Casual Guy", gender: "male" },
  { id: "Lively_Girl", name: "Lively Girl", gender: "female" },
  { id: "Patient_Man", name: "Patient Man", gender: "male" },
  { id: "Young_Knight", name: "Young Knight", gender: "male" },
  { id: "Determined_Man", name: "Determined Man", gender: "male" },
  { id: "Lovely_Girl", name: "Lovely Girl", gender: "female" },
  { id: "Decent_Boy", name: "Decent Boy", gender: "male" },
  { id: "Imposing_Manner", name: "Imposing Manner", gender: "male" },
  { id: "Elegant_Man", name: "Elegant Man", gender: "male" },
  { id: "Abbess", name: "Abbess", gender: "female" },
  { id: "Sweet_Girl_2", name: "Sweet Girl", gender: "female" },
  { id: "Exuberant_Girl", name: "Exuberant Girl", gender: "female" },
];
export const MINIMAX_DEFAULT_VOICE = "Deep_Voice_Man";

/** Published prices (fal): $100 / 1M characters HD, $60 / 1M Turbo; a copied voice $1.5 (charged on first use). */
export const MINIMAX_PRICE = { hdPerKChars: 0.1, turboPerKChars: 0.06, cloneUsd: 1.5 };

/** Text → MP3 with a MiniMax voice (a ready one, or one copied from a recording: its custom voice id). */
export async function minimaxSpeech(o: { voiceId: string; text: string; model?: "hd" | "turbo"; speed?: number; emotion?: string; languageBoost?: string }) {
  const out = await falRun<Record<string, unknown>>(
    MINIMAX_SPEECH[o.model ?? "hd"],
    {
      prompt: o.text,
      voice_setting: { voice_id: o.voiceId, speed: o.speed ?? 1, vol: 1, pitch: 0, ...(o.emotion ? { emotion: o.emotion } : {}) },
      audio_setting: { format: "mp3", sample_rate: 32000, bitrate: 128000, channel: 1 },
      output_format: "url",
      ...(o.languageBoost ? { language_boost: o.languageBoost } : {}),
    },
    180_000,
  ).catch((e) => {
    throw e instanceof ProviderError ? new ProviderError(e.outcome, "تعذّر توليد الكلام عند MiniMax الآن؛ جرّب مرة ثانية.", e.detail) : e;
  });
  const url = falUrl(out, "audio");
  if (!url) throw new ProviderError("rejected", "ما رجع MiniMax بملف صوت.", `minimax speech keys: ${Object.keys(out).join(",")}`);
  return { audio: await falFile(url), durationMs: Number(out.duration_ms) || null };
}

/**
 * A voice copied from a recording (10 s or more), kept in MiniMax's account: returns its id. The preview is spoken
 * at once with the new voice (so the voice is used and kept, and the person hears it).
 */
export async function minimaxCloneVoice(o: { audioUrl: string; previewText: string; removeNoise?: boolean }) {
  const out = await falRun<Record<string, unknown>>(
    "fal-ai/minimax/voice-clone",
    { audio_url: o.audioUrl, noise_reduction: o.removeNoise === true, need_volume_normalization: true, text: o.previewText, model: "speech-02-hd" },
    240_000,
  ).catch((e) => {
    throw e instanceof ProviderError ? new ProviderError(e.outcome, "تعذّر نسخ الصوت عند MiniMax الآن. أُعيدت لك نقودك؛ جرّب مرة ثانية.", e.detail) : e;
  });
  const voiceId = String(out.custom_voice_id ?? "");
  if (!voiceId) throw new ProviderError("rejected", "ما رجع MiniMax بمعرّف الصوت.", `minimax clone keys: ${Object.keys(out).join(",")}`);
  const previewUrl = falUrl(out, "audio");
  return { voiceId, preview: previewUrl ? await falFile(previewUrl).catch(() => null) : null };
}
