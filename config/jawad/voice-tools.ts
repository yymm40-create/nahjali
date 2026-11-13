// «الجواد الذكي!» | JAWAD AI — «أدوات الصوت» in «الاستوديو الإبداعي» (the «صوت» kind): «دبلجة», «غيّر الصوت» and
// «حرّك الشفايف». The pure part: ids, provider costs, limits, the billed seconds and the provider requests. Shared by
// the studio, the registry (config/jawad/generators.ts) and the server, and checked by tests/jawad/voice-tools.test.ts.
//
// Every cost below is a provider's published price, checked on VOICE_TOOLS_CHECKED (the links are also in each
// generator's `sources`):
//   • ElevenLabs Dubbing (POST /v1/dubbing, the dubbing resource API: num_speakers, drop_background_audio, watermark):
//     «Dubbing v1» $0.50 a minute of source without a watermark ($0.33 with one) — https://elevenlabs.io/pricing/api
//     We send the SOUND only (the video's own audio track, taken out on our server without re-encoding), so there is no
//     video to watermark, and we put the dubbed sound back on the original video ourselves — what ElevenLabs itself
//     advises for production ("download the dubbed audio and use it to replace the audio track on your original video",
//     https://elevenlabs.io/docs/capabilities/dubbing). We still price the dearer no-watermark minute.
//     The newer project API (POST /v1/dubbing/project, https://elevenlabs.io/docs/api-reference/dubbing/create-project)
//     defaults to «Dubbing v2» at $2.20 a minute, returns FLAC only and takes no number of speakers or background choice,
//     so it is not used here.
//   • ElevenLabs Voice Changer (POST /v1/voice-changer/{voice_id}, eleven_multilingual_sts_v2): $0.12 a minute, at most
//     5 minutes a request — https://elevenlabs.io/pricing/api · https://elevenlabs.io/docs/overview/capabilities/voice-changer
//   • Lip sync on fal.ai (a face video + a sound → the mouth follows the sound), cheapest good first:
//       veed/lipsync                       $0.40 a minute     — https://fal.ai/models/veed/lipsync
//       fal-ai/sync-lipsync/v2 (lipsync-2) $3.00 a minute     — https://fal.ai/models/fal-ai/sync-lipsync/v2
//       the same with model lipsync-2-pro  $5.00 a minute     — https://fal.ai/models/fal-ai/sync-lipsync/v2/pro ("≈1.67×")
//     (also looked at: fal-ai/latentsync — $0.20 for anything up to 40 s, then $0.005 a second, dearer than VEED for
//     short clips; fal-ai/sync-lipsync/v3 — $0.1333 a second, beyond what a studio clip needs)
//   • A still photo + a sound → a talking video (fal.ai):
//       fal-ai/kling-video/ai-avatar/v2/standard  $0.0562 a second — https://fal.ai/models/fal-ai/kling-video/ai-avatar/v2/standard
//       fal-ai/bytedance/omnihuman/v1.5 (720p)    $0.16 a second   — https://fal.ai/models/fal-ai/bytedance/omnihuman/v1.5
//     (also looked at: veed/fabric-1.0 $0.08 a second at 480p; fal-ai/infinitalk $0.20 a second, doubled at 720p)

import type { Settings } from "./types";

export const VOICE_TOOLS_CHECKED = "2026-11-12";

export const DUB_ID = "elevenlabs-dubbing";
export const VOICE_CHANGE_ID = "elevenlabs-voice-changer";
export const LIPSYNC_ID = "fal-lipsync";
export const VOICE_TOOL_IDS = [DUB_ID, VOICE_CHANGE_ID, LIPSYNC_ID] as const;
export type VoiceToolId = (typeof VOICE_TOOL_IDS)[number];
export const isVoiceTool = (id: string): id is VoiceToolId => (VOICE_TOOL_IDS as readonly string[]).includes(id);

/** What each tool is tracked as when sent (config/feature-use.ts). */
export const VOICE_TOOL_TRACK = { [DUB_ID]: "studio.dub", [VOICE_CHANGE_ID]: "studio.voice_change", [LIPSYNC_ID]: "studio.lipsync" } as const;

/** USD, from the pages above. */
export const VOICE_TOOL_USD = {
  dubPerMin: 0.5,
  voiceChangePerMin: 0.12,
  lipsync: { veed: 0.4 / 60, sync2: 3 / 60, sync2pro: 5 / 60 },
  talking: { kling: 0.0562, omnihuman: 0.16 },
} as const;

/** The longest input each tool takes (ms). Dubbing: a ceiling of ours (ElevenLabs takes hours); the voice changer: ElevenLabs' 5-minute segment. */
export const VOICE_TOOL_MAX_MS = { dub: 600_000, voiceChange: 300_000, lipsync: 60_000, talking: 60_000 } as const;
export const VOICE_TOOL_MIN_MS = 1_000;

/** The seconds charged for a length: whole seconds, rounded up, at least one. */
export const billedSeconds = (ms: number | null | undefined) => Math.max(1, Math.ceil((ms ?? 0) / 1000 - 1e-9));

// ───────────── «دبلجة» ─────────────

/** The languages offered (ISO 639-1, as the dubbing resource API takes them), Arabic and English first. */
export const DUB_LANGS: { code: string; label: string }[] = [
  { code: "ar", label: "العربية" },
  { code: "en", label: "الإنجليزية" },
  { code: "fr", label: "الفرنسية" },
  { code: "es", label: "الإسبانية" },
  { code: "de", label: "الألمانية" },
  { code: "tr", label: "التركية" },
  { code: "ur", label: "الأردية" },
  { code: "hi", label: "الهندية" },
  { code: "id", label: "الإندونيسية" },
  { code: "ru", label: "الروسية" },
  { code: "zh", label: "الصينية" },
  { code: "ja", label: "اليابانية" },
];
export const dubLang = (v: unknown) => (DUB_LANGS.some((l) => l.code === v) ? String(v) : "en");
/** «auto»: ElevenLabs counts the speakers itself (num_speakers 0). */
export const DUB_SPEAKERS = ["auto", "1", "2", "3", "4", "5"] as const;
export const dubSpeakers = (v: unknown) => (v === "auto" || !DUB_SPEAKERS.includes(String(v) as never) ? 0 : Number(v));

/** The dubbing resource API's form (the file goes with it). */
export function dubForm(s: Settings) {
  return {
    target_lang: dubLang(s.lang),
    num_speakers: String(dubSpeakers(s.speakers)),
    // «خلّ الموسيقى والمؤثرات»: the background stays under the new voices unless the person takes it out
    drop_background_audio: String(s.keepBackground === false),
    watermark: "false",
  };
}

// ───────────── «غيّر الصوت» ─────────────

export const VOICE_CHANGE_MODEL = "eleven_multilingual_sts_v2";

// ───────────── «حرّك الشفايف» ─────────────

export const LIPSYNC_ENGINES = ["veed", "sync2", "sync2pro"] as const;
export type LipsyncEngine = (typeof LIPSYNC_ENGINES)[number];
export const TALKING_ENGINES = ["kling", "omnihuman"] as const;
export type TalkingEngine = (typeof TALKING_ENGINES)[number];
export const lipsyncEngine = (v: unknown): LipsyncEngine => (LIPSYNC_ENGINES.includes(v as LipsyncEngine) ? (v as LipsyncEngine) : "veed");
export const talkingEngine = (v: unknown): TalkingEngine => (TALKING_ENGINES.includes(v as TalkingEngine) ? (v as TalkingEngine) : "kling");

export const LIPSYNC_MODELS = {
  veed: "veed/lipsync",
  sync2: "fal-ai/sync-lipsync/v2",
  kling: "fal-ai/kling-video/ai-avatar/v2/standard",
  omnihuman: "fal-ai/bytedance/omnihuman/v1.5",
} as const;

/**
 * The seconds a lip sync is charged for. A face video: the longer of the video and the sound (the providers bill per
 * minute of video, and which of the two lengths they count is not published, so the longer is the ceiling). A photo:
 * the sound's length (the talking video is as long as the sound; OmniHuman says so in its `duration` field).
 */
export function lipsyncSeconds(o: { videoMs?: number | null; audioMs?: number | null; photo: boolean }) {
  return o.photo ? billedSeconds(o.audioMs) : billedSeconds(Math.max(o.videoMs ?? 0, o.audioMs ?? 0));
}

export function lipsyncUsd(o: { videoMs?: number | null; audioMs?: number | null; photo: boolean; settings: Settings }) {
  const sec = lipsyncSeconds(o);
  return sec * (o.photo ? VOICE_TOOL_USD.talking[talkingEngine(o.settings.photoEngine)] : VOICE_TOOL_USD.lipsync[lipsyncEngine(o.settings.engine)]);
}

/** The fal request of a lip sync (pure: the links are made by the server). */
export function lipsyncRequest(o: { settings: Settings; photo: boolean; videoUrl?: string; imageUrl?: string; audioUrl: string; videoMs?: number | null; audioMs?: number | null }): { model: string; input: Record<string, unknown> } {
  if (o.photo) {
    const e = talkingEngine(o.settings.photoEngine);
    if (e === "omnihuman") return { model: LIPSYNC_MODELS.omnihuman, input: { image_url: o.imageUrl, audio_url: o.audioUrl, resolution: "720p" } };
    return { model: LIPSYNC_MODELS.kling, input: { image_url: o.imageUrl, audio_url: o.audioUrl, prompt: "." } };
  }
  const e = lipsyncEngine(o.settings.engine);
  if (e === "veed") return { model: LIPSYNC_MODELS.veed, input: { video_url: o.videoUrl, audio_url: o.audioUrl } };
  // a sound longer than the video: the video goes back and forth so no word is cut; otherwise it ends with the sound
  const longer = (o.audioMs ?? 0) > (o.videoMs ?? 0) + 250;
  return { model: LIPSYNC_MODELS.sync2, input: { video_url: o.videoUrl, audio_url: o.audioUrl, model: e === "sync2pro" ? "lipsync-2-pro" : "lipsync-2", sync_mode: longer ? "bounce" : "cut_off" } };
}

// ───────────── safety ─────────────

/** The permission switch of «غيّر الصوت» and «حرّك الشفايف» (off until the person turns it on). */
export const CONSENT_KEY = "consent";
export const CONSENT_VOICE = "أؤكد إن الصوت لي أو عندي إذن صاحبه";
export const CONSENT_FACE = "أؤكد إن الوجه والصوت لي أو عندي إذن أصحابهم";
export const CONSENT_MISSING = "أكّد إن عندك إذن صاحب الصوت أو الوجه قبل ما تكمل.";
