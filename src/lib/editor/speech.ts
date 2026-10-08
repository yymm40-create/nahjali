// «حيدرة كت» — captions: what is said in a clip (ElevenLabs Scribe v2) and a poem's verses timed on its recitation
// (ElevenLabs Forced Alignment). Server only. The browser cuts out just the clip's sound, compressed, and uploads it
// to the project's own storage; it is sent on from here and deleted. A transcript is kept with its file, so asking
// again (another look, an undo) costs nothing.

import { randomUUID } from "crypto";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProviderError } from "@/lib/jawad/server/providers/common";
import { elevenAlign, elevenSpeech, elevenTranscribe } from "@/lib/jawad/server/providers/elevenlabs";
import { MINIMAX_READY_VOICES, minimaxReady, minimaxSpeech } from "@/lib/jawad/server/providers/minimax";
import { openaiSpeech } from "@/lib/jawad/server/providers/openai";
import { ELEVEN_DEFAULT_VOICE } from "@config/jawad/generators";
import { charged, type Who } from "./pricing";
import { EDITOR_BUCKET, isUuid, stillOpen, type AssetRow, type EditorProject } from "./server";

import { storage } from "@/lib/storage";
const LANGS = ["ar", "en", "fr", "ur", "fa", "tr"];
const TMP_TYPES: Record<string, { ext: string; mime: string }> = { webm: { ext: "webm", mime: "audio/webm" }, wav: { ext: "wav", mime: "audio/wav" } };

const db = () => createAdminClient();

export interface SpokenWord {
  /** source ms */
  s: number;
  e: number;
  w: string;
}

/** A one-time link to upload the clip's sound (deleted after it is heard). */
export async function signSpeechUpload(p: EditorProject, b: { format?: unknown }) {
  stillOpen(p);
  const t = TMP_TYPES[String(b.format)] ?? TMP_TYPES.webm;
  const path = `${p.user_id}/${p.id}/tmp/${randomUUID()}.${t.ext}`;
  const signed = await storage.from(EDITOR_BUCKET).createSignedUploadUrl(path);
  if (signed.error) throw signed.error;
  return { path, mime: t.mime, signedUrl: signed.data.signedUrl };
}

async function asset(p: EditorProject, id: unknown) {
  if (!isUuid(id)) throw new UserError("ملف غير صحيح.", 400);
  const { data } = await db().from("editor_assets").select("*").eq("id", id).eq("project_id", p.id).maybeSingle();
  const row = data as AssetRow | null;
  if (!row || row.status !== "ready") throw new UserError("ما لقينا الملف.", 404);
  if (row.kind === "image") throw new UserError("الصور ما فيها كلام.", 400);
  return row;
}

const range = (b: { from?: unknown; to?: unknown }, row: AssetRow) => {
  const from = Math.max(0, Math.round(Number(b.from) || 0));
  const to = Math.min(row.duration_ms ?? 24 * 3600_000, Math.round(Number(b.to) || 0));
  if (!(to > from)) throw new UserError("المقطع قصير جدًا.", 400);
  return { from, to };
};

/** The uploaded piece of sound (only from this project's own temporary folder), then deleted. */
async function takePiece(p: EditorProject, path: unknown) {
  const prefix = `${p.user_id}/${p.id}/tmp/`;
  if (typeof path !== "string" || !path.startsWith(prefix) || path.includes("..") || !/^[0-9a-f-]{36}\.(webm|wav)$/.test(path.slice(prefix.length))) throw new UserError("ملف صوت غير صحيح.", 400);
  const dl = await storage.from(EDITOR_BUCKET).download(path);
  await storage.from(EDITOR_BUCKET).remove([path]);
  if (dl.error || !dl.data) throw new UserError("ما وصل الصوت؛ جرّب مرة ثانية.", 409);
  return { file: dl.data, name: path.slice(prefix.length) };
}

/** Listening time is counted in the project's history (actor «speech», the minutes as its label). */
async function logUse(p: EditorProject, minutes: number) {
  await db().from("editor_ops").insert({ project_id: p.id, version: p.version, actor: "speech", label: String(Math.round(minutes * 100) / 100) });
}

const providerError = (err: unknown): never => {
  if (err instanceof ProviderError) {
    console.error("editor speech", err.detail);
    throw new UserError(err.userMessage, 502);
  }
  throw err;
};

/**
 * What is said in an asset between `from` and `to` (source ms). Asked again, the kept transcript comes back; else
 * `{ need: "audio" }` until the browser has uploaded the piece (`path`).
 */
export async function transcribe(p: EditorProject, who: Who, b: { assetId?: unknown; from?: unknown; to?: unknown; language?: unknown; path?: unknown }) {
  stillOpen(p);
  const row = await asset(p, b.assetId);
  const { from, to } = range(b, row);
  const lang = LANGS.includes(String(b.language)) ? String(b.language) : null;
  const key = `${from}-${to}-${lang ?? "auto"}`;
  const kept = (row.meta?.transcripts as Record<string, SpokenWord[]> | undefined)?.[key];
  if (kept) return { words: kept, cached: true };
  if (!b.path) return { need: "audio" as const };
  const minutes = (to - from) / 60_000;
  const piece = await takePiece(p, b.path);
  const heard = await charged(who, "editor_price_caption", Math.ceil(minutes), "كابشن في حيدرة كت", () => elevenTranscribe({ file: piece.file, name: piece.name, languageCode: lang }).catch(providerError));
  const words: SpokenWord[] = heard.words.map((w) => ({ s: from + Math.round(w.start * 1000), e: from + Math.round(w.end * 1000), w: w.text })).filter((w) => w.s < to);
  await logUse(p, minutes);
  // keep the latest few transcripts with the file
  const all = { ...((row.meta?.transcripts as Record<string, SpokenWord[]>) ?? {}), [key]: words };
  const keys = Object.keys(all).slice(-6);
  await db().from("editor_assets").update({ meta: { ...row.meta, transcripts: Object.fromEntries(keys.map((k) => [k, all[k]])) } }).eq("id", row.id);
  return { words, cached: false, language: heard.language };
}

/** The given text (verses, one per line) timed word by word on the asset's recitation between `from` and `to`. */
export async function align(p: EditorProject, who: Who, b: { assetId?: unknown; from?: unknown; to?: unknown; text?: unknown; path?: unknown }) {
  stillOpen(p);
  const row = await asset(p, b.assetId);
  const { from, to } = range(b, row);
  const text = String(b.text ?? "").trim().slice(0, 20_000);
  if (!text) throw new UserError("اكتب الأبيات أول.", 400);
  const minutes = (to - from) / 60_000;
  const piece = await takePiece(p, b.path);
  const words = await charged(who, "editor_price_caption", Math.ceil(minutes), "مزامنة قصيدة في حيدرة كت", () => elevenAlign({ file: piece.file, name: piece.name, text }).catch(providerError));
  await logUse(p, minutes);
  return { words: words.map((w) => ({ s: from + Math.round(w.start * 1000), e: from + Math.round(w.end * 1000), w: w.text })) };
}

// ───────────────────────────── talking with حيدرة ─────────────────────────────

/** A spoken message is short: up to two minutes, sent with the request (no upload). */
const VOICE_MAX_BYTES = 3_000_000;
const VOICE_TYPES: Record<string, string> = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav" };

/** What the person said to حيدرة (ElevenLabs Scribe): `{ audio: base64, mime, seconds }` → `{ text }`. */
export async function voiceIn(p: EditorProject, who: Who, b: { audio?: unknown; mime?: unknown; seconds?: unknown }) {
  stillOpen(p);
  const mime = String(b.mime ?? "").split(";")[0];
  const ext = VOICE_TYPES[mime];
  if (!ext || typeof b.audio !== "string") throw new UserError("صيغة التسجيل غير مقبولة.", 400);
  const buf = Buffer.from(b.audio, "base64");
  if (!buf.length) throw new UserError("ما وصل صوت.", 400);
  if (buf.length > VOICE_MAX_BYTES) throw new UserError("التسجيل طويل؛ خلّه أقل من دقيقتين.", 400);
  const minutes = Math.min(2, Math.max(0.05, Number(b.seconds) / 60 || 0.5));
  const heard = await charged(who, "editor_price_caption", Math.ceil(minutes), "رسالة صوتية لحيدرة", () =>
    elevenTranscribe({ file: new Blob([new Uint8Array(buf)], { type: mime }), name: `voice.${ext}` }).catch(providerError),
  );
  await logUse(p, minutes);
  return { text: heard.words.map((w) => w.text).join(" ").replace(/\s+([،,.؟?!:])/g, "$1").trim() };
}

/** Who speaks حيدرة's replies: a provider, or one of the person's own voices («v:<id>», a voiceprint included). */
export type ReplyVoice = "auto" | "openai" | "minimax" | "elevenlabs" | `v:${string}`;

/**
 * حيدرة's reply said aloud: `{ text, voice? }` → `{ audio: base64 mp3, by }`. Claude writes the words but has no voice
 * of its own, so a speech provider reads them: the one chosen (or the person's own voice where it lives), then the
 * others in turn if it fails — never only ElevenLabs. Markdown, code and links are left out.
 */
export async function voiceOut(p: EditorProject, who: Who, b: { text?: unknown; voice?: unknown }) {
  stillOpen(p);
  const spoken = String(b.text ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[*_`#>|]/g, "")
    // emoji, with the invisible marks that build them (variation selectors, joiners, skin tones)
    .replace(/[\p{Extended_Pictographic}\u{FE0E}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);
  if (!spoken) throw new UserError("ما فيه كلام أقرأه.", 400);
  const arabic = /[\u0600-\u06FF]/.test(spoken);
  const want = typeof b.voice === "string" ? b.voice : "auto";
  // the person's own voice (a voiceprint or a designed one): spoken where it lives
  let own: { provider: string; id: string } | null = null;
  if (/^v:/.test(want) && isUuid(want.slice(2))) {
    const { data } = await createAdminClient().from("jawad_voices").select("provider,provider_voice_id").eq("id", want.slice(2)).eq("user_id", p.user_id).maybeSingle();
    if (data) own = { provider: String(data.provider ?? "elevenlabs"), id: String(data.provider_voice_id) };
  }
  const readers: Record<string, () => Promise<Buffer>> = {
    openai: async () => {
      if (!process.env.OPENAI_API_KEY) throw new Error("no OpenAI key");
      return openaiSpeech({ model: "gpt-4o-mini-tts", input: spoken, voice: "marin", format: "mp3", instructions: arabic ? "Speak natural, warm Gulf Arabic, friendly and clear, at a relaxed conversational pace." : "Speak naturally and warmly." });
    },
    minimax: async () => {
      if (!minimaxReady()) throw new Error("no MiniMax");
      const id = own?.provider === "minimax" ? own.id : MINIMAX_READY_VOICES[0].id;
      return (await minimaxSpeech({ voiceId: id, text: spoken, ...(arabic ? { languageBoost: "Arabic" } : {}) })).audio;
    },
    elevenlabs: async () => {
      const voiceId = own?.provider === "elevenlabs" ? own.id : (process.env.EDITOR_VOICE_ID || ELEVEN_DEFAULT_VOICE).replace(/^p:/, "");
      return Buffer.from(await elevenSpeech({ voiceId, text: spoken, model: "eleven_v4", stability: 0.5, ...(arabic ? { languageCode: "ar" } : {}) }));
    },
  };
  const first = own ? own.provider : want === "auto" || !(want in readers) ? "openai" : want;
  const order = [first, ...["openai", "minimax", "elevenlabs"].filter((x) => x !== first)];
  const audio = await charged(who, "editor_price_voice", 1, "رد حيدرة بالصوت", async () => {
    let last: unknown = null;
    for (const name of order) {
      try {
        return { buf: await readers[name](), by: name };
      } catch (e) {
        last = e;
        console.warn("haydara voice", name, e instanceof Error ? e.message : e);
      }
    }
    if (last instanceof ProviderError) providerError(last);
    throw new UserError("ما قدرت أقرأ الرد بصوت الحين (ولا مزوّد صوت رد). الرد مكتوب فوق.", 502);
  });
  return { audio: Buffer.from(audio.buf).toString("base64"), mime: "audio/mpeg", by: audio.by };
}
