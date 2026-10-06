// «الممنتج الذكي» — captions: what is said in a clip (ElevenLabs Scribe v2) and a poem's verses timed on its recitation
// (ElevenLabs Forced Alignment). Server only. The browser cuts out just the clip's sound, compressed, and uploads it
// to the project's own storage; it is sent on from here and deleted. A transcript is kept with its file, so asking
// again (another look, an undo) costs nothing.

import { randomUUID } from "crypto";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProviderError } from "@/lib/jawad/server/providers/common";
import { elevenAlign, elevenTranscribe } from "@/lib/jawad/server/providers/elevenlabs";
import { EDITOR_BUCKET, isUuid, stillOpen, type AssetRow, type EditorProject } from "./server";

/** Minutes of listening per person per day while everything is free (the owner has none). */
export const SPEECH_DAILY_MINUTES = 120;
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
  const signed = await db().storage.from(EDITOR_BUCKET).createSignedUploadUrl(path);
  if (signed.error) throw signed.error;
  return { path, mime: t.mime, signedUrl: signed.data.signedUrl };
}

async function minutesToday(p: EditorProject) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { data: projects } = await db().from("editor_projects").select("id").eq("user_id", p.user_id);
  const ids = (projects ?? []).map((x) => x.id as string);
  if (!ids.length) return 0;
  const { data } = await db().from("editor_ops").select("label").in("project_id", ids).eq("actor", "speech").gte("created_at", since.toISOString());
  return (data ?? []).reduce((m, r) => m + (Number(r.label) || 0), 0);
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
  const dl = await db().storage.from(EDITOR_BUCKET).download(path);
  await db().storage.from(EDITOR_BUCKET).remove([path]);
  if (dl.error || !dl.data) throw new UserError("ما وصل الصوت؛ جرّب مرة ثانية.", 409);
  return { file: dl.data, name: path.slice(prefix.length) };
}

async function checkAllowance(p: EditorProject, owner: boolean, minutes: number) {
  if (owner) return;
  const used = await minutesToday(p);
  if (used + minutes > SPEECH_DAILY_MINUTES) {
    throw new UserError(`وصلت لحد التفريغ اليومي (${SPEECH_DAILY_MINUTES} دقيقة). باقي لك ${Math.max(0, Math.floor(SPEECH_DAILY_MINUTES - used))} دقيقة اليوم.`, 429);
  }
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
export async function transcribe(p: EditorProject, owner: boolean, b: { assetId?: unknown; from?: unknown; to?: unknown; language?: unknown; path?: unknown }) {
  stillOpen(p);
  const row = await asset(p, b.assetId);
  const { from, to } = range(b, row);
  const lang = LANGS.includes(String(b.language)) ? String(b.language) : null;
  const key = `${from}-${to}-${lang ?? "auto"}`;
  const kept = (row.meta?.transcripts as Record<string, SpokenWord[]> | undefined)?.[key];
  if (kept) return { words: kept, cached: true };
  if (!b.path) return { need: "audio" as const };
  const minutes = (to - from) / 60_000;
  await checkAllowance(p, owner, minutes);
  const piece = await takePiece(p, b.path);
  const heard = await elevenTranscribe({ file: piece.file, name: piece.name, languageCode: lang }).catch(providerError);
  const words: SpokenWord[] = heard.words.map((w) => ({ s: from + Math.round(w.start * 1000), e: from + Math.round(w.end * 1000), w: w.text })).filter((w) => w.s < to);
  await logUse(p, minutes);
  // keep the latest few transcripts with the file
  const all = { ...((row.meta?.transcripts as Record<string, SpokenWord[]>) ?? {}), [key]: words };
  const keys = Object.keys(all).slice(-6);
  await db().from("editor_assets").update({ meta: { ...row.meta, transcripts: Object.fromEntries(keys.map((k) => [k, all[k]])) } }).eq("id", row.id);
  return { words, cached: false, language: heard.language };
}

/** The given text (verses, one per line) timed word by word on the asset's recitation between `from` and `to`. */
export async function align(p: EditorProject, owner: boolean, b: { assetId?: unknown; from?: unknown; to?: unknown; text?: unknown; path?: unknown }) {
  stillOpen(p);
  const row = await asset(p, b.assetId);
  const { from, to } = range(b, row);
  const text = String(b.text ?? "").trim().slice(0, 20_000);
  if (!text) throw new UserError("اكتب الأبيات أول.", 400);
  const minutes = (to - from) / 60_000;
  await checkAllowance(p, owner, minutes);
  const piece = await takePiece(p, b.path);
  const words = await elevenAlign({ file: piece.file, name: piece.name, text }).catch(providerError);
  await logUse(p, minutes);
  return { words: words.map((w) => ({ s: from + Math.round(w.start * 1000), e: from + Math.round(w.end * 1000), w: w.text })) };
}
