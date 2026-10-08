// «صوت الجواد» — JAWAD's own voice engine: open models that copy any voice from a short recording and speak Arabic,
// with no dependence on ElevenLabs, MiniMax or OpenAI. Two engines behind one door:
//   · «حبيبي» (Habibi-TTS, SJTU X-LANCE, 2026): made for Arabic, 12 dialects, zero-shot cloning — runs on the site's
//     own GPU endpoint (a Hugging Face Inference Endpoint with voice-engine/habibi/handler.py; env HABIBI_URL + token).
//   · Chatterbox Multilingual (Resemble AI, MIT): 23 languages with Arabic, hosted on fal (env FAL_KEY), 300
//     characters a request — a long text is spoken in pieces and joined here.
// A voice is a reference recording of the person (kept in storage, 10 s – 2 min) plus the words said in it.
// Server only.

import { ProviderError, rejectedMessage } from "./common";
import { falFile, falReady, falRun, falUrl } from "./fal";
import { joinWavs, readWav, splitForSpeech, writeWav, type HabibiDialect } from "../../voice-text";

export type JawadEngine = "habibi" | "chatterbox";

export const CHATTERBOX_MODEL = "fal-ai/chatterbox/text-to-speech/multilingual";
/** fal's published price: $0.025 per 1,000 characters. */
export const CHATTERBOX_PER_KCHARS = 0.025;
/** What one minute of our own Habibi endpoint costs when it runs (an L4/A10G at about $1/h, ~20 s of speech a minute of GPU). */
export const HABIBI_USD_PER_KCHARS = 0.02;
const CHATTERBOX_MAX = 300;

export const habibiReady = () => Boolean(process.env.HABIBI_URL);
export const chatterboxReady = () => falReady();
export const jawadVoiceReady = () => habibiReady() || chatterboxReady();
/** The engines that can speak now, best for Arabic first. */
export const jawadEngines = (): JawadEngine[] => [...(habibiReady() ? (["habibi"] as const) : []), ...(chatterboxReady() ? (["chatterbox"] as const) : [])];

export interface JawadSpeech {
  /** the reference recording (a short-lived link the engine can fetch) */
  refUrl: string;
  /** the words said in the recording (Habibi needs them; Chatterbox ignores them) */
  refText: string;
  text: string;
  engine?: JawadEngine;
  dialect?: HabibiDialect;
  speed?: number;
}

/** Text → WAV in the reference voice. Falls back from Habibi to Chatterbox when Habibi is not configured. */
export async function jawadSpeak(o: JawadSpeech): Promise<{ audio: Buffer; mime: "audio/wav"; durationMs: number | null; engine: JawadEngine }> {
  const engine: JawadEngine = o.engine === "chatterbox" ? "chatterbox" : habibiReady() ? "habibi" : "chatterbox";
  if (engine === "habibi") {
    const r = await habibiSpeak(o);
    return { ...r, engine };
  }
  const r = await chatterboxSpeak(o);
  return { ...r, engine };
}

// ───────── Habibi: our own endpoint (voice-engine/habibi/handler.py) ─────────

async function habibiSpeak(o: JawadSpeech) {
  const url = process.env.HABIBI_URL;
  if (!url) throw new ProviderError("rejected", "محرك «حبيبي» غير مفعّل على الخادم (HABIBI_URL).", "HABIBI_URL missing");
  if (!o.refText.trim()) throw new ProviderError("rejected", "هذا الصوت بلا نصّ مرجعي؛ أعد أخذ البصمة.", "habibi needs ref_text");
  const body = { inputs: { ref_audio_url: o.refUrl, ref_text: o.refText, gen_text: o.text, dialect: o.dialect ?? "UNK", model_type: "Unified", speed: o.speed ?? 1, remove_silence: true } };
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", ...(process.env.HABIBI_TOKEN ? { Authorization: `Bearer ${process.env.HABIBI_TOKEN}` } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(280_000) });
  } catch (e) {
    throw new ProviderError("unknown", "محرك «حبيبي» ما رد الآن (قد يكون يستيقظ؛ جرّب بعد دقيقة).", `habibi fetch: ${e instanceof Error ? e.message : String(e)}`);
  }
  const text = await res.text();
  // a scaled-to-zero endpoint answers 503 while it starts: said plainly, nothing charged
  if (res.status === 503) throw new ProviderError("unknown", "محرك «حبيبي» يستيقظ الآن (دقيقة أو دقيقتين)؛ جرّب مرة ثانية.", `habibi 503 ${text.slice(0, 200)}`);
  if (!res.ok) throw new ProviderError("rejected", rejectedMessage(res.status, text), `habibi ${res.status} ${text.slice(0, 300)}`);
  let out: { audio_base64?: string; sample_rate?: number; error?: string };
  try {
    out = JSON.parse(text);
  } catch {
    throw new ProviderError("rejected", "رد محرك «حبيبي» غير مفهوم.", `habibi body ${text.slice(0, 200)}`);
  }
  if (out.error || !out.audio_base64) throw new ProviderError("rejected", "محرك «حبيبي» ما قدر ينطق هذا النص.", `habibi: ${out.error ?? "no audio"}`);
  const audio = Buffer.from(out.audio_base64, "base64");
  const w = readWav(new Uint8Array(audio));
  return { audio, mime: "audio/wav" as const, durationMs: w ? Math.round((w.data.length / ((w.channels * w.bits) / 8) / w.rate) * 1000) : null };
}

// ───────── Chatterbox on fal: 300 characters a call, spoken in pieces and joined ─────────

async function chatterboxSpeak(o: JawadSpeech) {
  if (!chatterboxReady()) throw new ProviderError("rejected", "محرك Chatterbox غير مفعّل على الخادم (FAL_KEY).", "FAL_KEY missing");
  const pieces = splitForSpeech(o.text, CHATTERBOX_MAX);
  if (!pieces.length) throw new ProviderError("rejected", "ما فيه نص أنطقه.", "empty text");
  const arabic = /[؀-ۿ]/.test(o.text);
  const wavs: Uint8Array[] = [];
  // a few at a time: fal queues them, and the order is kept by index
  const results = await Promise.all(
    pieces.map((text) =>
      falRun<Record<string, unknown>>(CHATTERBOX_MODEL, { text, voice: o.refUrl, custom_audio_language: arabic ? "arabic" : "english", exaggeration: 0.5, temperature: 0.7, cfg_scale: 0.5 }, 240_000).catch((e) => {
        throw e instanceof ProviderError ? new ProviderError(e.outcome, "تعذّر توليد الكلام بمحرك Chatterbox الآن؛ جرّب مرة ثانية.", e.detail) : e;
      }),
    ),
  );
  for (const out of results) {
    const url = falUrl(out, "audio");
    if (!url) throw new ProviderError("rejected", "ما رجع Chatterbox بملف صوت.", `chatterbox keys: ${Object.keys(out).join(",")}`);
    const bytes = new Uint8Array(await falFile(url));
    // fal returns WAV; anything else is wrapped as-is only when alone
    if (!readWav(bytes)) {
      if (results.length === 1) return { audio: Buffer.from(bytes), mime: "audio/wav" as const, durationMs: null };
      throw new ProviderError("rejected", "رد Chatterbox بصيغة غير متوقعة.", "chatterbox non-wav piece");
    }
    wavs.push(bytes);
  }
  const joined = joinWavs(wavs, 180);
  return { audio: Buffer.from(joined.wav), mime: "audio/wav" as const, durationMs: joined.durationMs };
}

/** A silent WAV of `ms` (for tests and previews). */
export const silence = (ms: number, rate = 24000) => Buffer.from(writeWav(new Uint8Array(Math.round((rate * ms) / 1000) * 2), rate, 1));
