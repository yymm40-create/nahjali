// «صوت الجواد» — JAWAD's own voice engine, now VoiceStudio (open source, github.com/debpalash/VoiceStudio) running on the
// owner's own server, with no dependence on ElevenLabs, MiniMax or OpenAI. The site talks to its OpenAI-compatible
// API (POST /v1/audio/speech) and keeps each person's voice there as a profile (POST /profiles), made from the person's
// reference recording that stays in the site's storage. Env: VOICESTUDIO_URL (the server's address, e.g. https://…:3900),
// VOICESTUDIO_KEY (its OMNIVOICE_API_KEY), and optionally VOICESTUDIO_ENGINE (an engine id such as "voxcpm2"; empty = the
// server's active engine). A voice is a reference recording of the person (10 s – 3 min) plus the words said in it.
// Server only.

import { createHash } from "crypto";
import { ProviderError, rejectedMessage } from "./common";
import { joinWavs, readWav, splitForSpeech, writeWav } from "../../voice-text";

/** What one thousand characters cost on our own server (an L4 at about $1/h, ~20 s of speech a minute of GPU): an estimate. */
export const VOICESTUDIO_PER_KCHARS = 0.02;
/** One call of the server takes at most 4096 characters; longer texts are spoken in pieces and joined here. */
const PIECE_MAX = 3500;

export const jawadVoiceReady = () => Boolean(process.env.VOICESTUDIO_URL);

export interface JawadSpeech {
  /** the reference recording (a short-lived link the server's profile is made from, the first time) */
  refUrl: string;
  /** the words said in the recording */
  refText: string;
  text: string;
  speed?: number;
}

const base = () => (process.env.VOICESTUDIO_URL ?? "").replace(/\/+$/, "");
const headers = (extra: Record<string, string> = {}): Record<string, string> => ({ ...(process.env.VOICESTUDIO_KEY ? { Authorization: `Bearer ${process.env.VOICESTUDIO_KEY}` } : {}), ...extra });

/** The profile name of a voice: stable for the same recording (the link's path, never its token). */
export function profileName(refUrl: string): string {
  let path = refUrl;
  try {
    path = new URL(refUrl).pathname;
  } catch {
    /* a bare path */
  }
  return `jv-${createHash("sha1").update(path).digest("hex").slice(0, 20)}`;
}

const known = new Set<string>();

async function call(path: string, init: RequestInit, what: string, timeoutMs = 280_000): Promise<Response> {
  if (!jawadVoiceReady()) throw new ProviderError("rejected", "محرك «صوت الجواد» غير مفعّل على الخادم (VOICESTUDIO_URL).", "VOICESTUDIO_URL missing");
  try {
    return await fetch(base() + path, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new ProviderError("unknown", "خادم «صوت الجواد» ما رد الآن؛ جرّب بعد دقيقة.", `voicestudio ${what}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Makes sure the voice exists on the server as a profile (made once from the reference recording). */
async function ensureProfile(name: string, o: JawadSpeech) {
  if (known.has(name)) return;
  const list = await call("/profiles", { headers: headers() }, "list profiles", 30_000);
  if (list.ok) {
    const rows = (await list.json().catch(() => [])) as { name?: string }[];
    if (Array.isArray(rows) && rows.some((r) => r?.name === name)) {
      known.add(name);
      return;
    }
  }
  const ref = await fetch(o.refUrl, { signal: AbortSignal.timeout(60_000) }).catch(() => null);
  if (!ref?.ok) throw new ProviderError("rejected", "تسجيل البصمة ما لقيناه؛ خذ بصمة جديدة.", `reference ${ref?.status ?? "unreachable"}`);
  const bytes = new Uint8Array(await ref.arrayBuffer());
  const mime = ref.headers.get("content-type") || "audio/wav";
  const form = new FormData();
  form.set("name", name);
  form.set("kind", "clone");
  form.set("language", "Auto");
  form.set("ref_text", o.refText);
  form.set("ref_audio", new Blob([bytes], { type: mime }), mime.includes("mpeg") ? "ref.mp3" : "ref.wav");
  const made = await call("/profiles", { method: "POST", headers: headers(), body: form }, "create profile", 120_000);
  const body = await made.text();
  if (!made.ok) throw new ProviderError("rejected", rejectedMessage(made.status, body), `voicestudio profile ${made.status} ${body.slice(0, 300)}`);
  known.add(name);
}

async function speakPiece(name: string, text: string, speed: number, arabic: boolean) {
  const res = await call(
    "/v1/audio/speech",
    {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ model: process.env.VOICESTUDIO_ENGINE || "tts-1", input: text, voice: name, response_format: "wav", speed, ...(arabic ? { language: "ar" } : {}) }),
    },
    "speech",
  );
  if (res.status === 503) throw new ProviderError("unknown", "خادم «صوت الجواد» يستيقظ الآن؛ جرّب مرة ثانية بعد دقيقة.", "voicestudio 503");
  if (res.status === 404) known.delete(name);
  if (!res.ok) throw new ProviderError("rejected", rejectedMessage(res.status, await res.text()), `voicestudio speech ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!readWav(bytes)) throw new ProviderError("rejected", "رد خادم «صوت الجواد» بصيغة غير متوقعة.", "voicestudio non-wav");
  return bytes;
}

/** Text → WAV in the reference voice. */
export async function jawadSpeak(o: JawadSpeech): Promise<{ audio: Buffer; mime: "audio/wav"; durationMs: number | null; engine: "voicestudio" }> {
  const pieces = splitForSpeech(o.text, PIECE_MAX);
  if (!pieces.length) throw new ProviderError("rejected", "ما فيه نص أنطقه.", "empty text");
  const name = profileName(o.refUrl);
  await ensureProfile(name, o);
  const arabic = /[؀-ۿ]/.test(o.text);
  const speed = Math.min(4, Math.max(0.25, o.speed ?? 1));
  const wavs: Uint8Array[] = [];
  for (const piece of pieces) wavs.push(await speakPiece(name, piece, speed, arabic));
  if (wavs.length === 1) {
    const w = readWav(wavs[0]);
    return { audio: Buffer.from(wavs[0]), mime: "audio/wav", durationMs: w ? Math.round((w.data.length / ((w.channels * w.bits) / 8) / w.rate) * 1000) : null, engine: "voicestudio" };
  }
  const joined = joinWavs(wavs, 180);
  return { audio: Buffer.from(joined.wav), mime: "audio/wav", durationMs: joined.durationMs, engine: "voicestudio" };
}

/** A silent WAV of `ms` (for tests and previews). */
export const silence = (ms: number, rate = 24000) => Buffer.from(writeWav(new Uint8Array(Math.round((rate * ms) / 1000) * 2), rate, 1));
