// «الذكاء الإسلامي» — the library on the server: the sources, reading them (in steps), the index and its search,
// the settings and the answers log. Service role; every caller checks who is asking first.

import { ISLAMIC, ISLAMIC_KV } from "@config/islamic";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserError } from "@/lib/api";
import { almojib } from "./adapters/almojib";
import { aqaed } from "./adapters/aqaed";
import { site } from "./adapters/site";
import { thaqalayn } from "./adapters/thaqalayn";
import type { ReadDoc, Reader } from "./adapters/types";
import { chunkText, hostOf, queryWords, tsQuery } from "./text";

export type Adapter = "thaqalayn" | "almojib" | "aqaed" | "site";
const READERS: Record<Adapter, Reader> = { thaqalayn, almojib, aqaed, site };

export interface Source {
  id: string;
  key: string;
  name: string;
  url: string;
  adapter: Adapter;
  enabled: boolean;
  notes: string;
  cursor: Record<string, unknown>;
  stats: { docs?: number; chunks?: number; lastRunAt?: string; stage?: string; done?: boolean; runs?: number; errors?: number };
  created_at: string;
}

const db = () => createAdminClient();

/** A table that isn't there yet (SQL 0037 not run) reads as a clear message, not a crash. */
const missing = (e: { code?: string; message?: string } | null) => e && (e.code === "42P01" || e.code === "PGRST205" || /relation .* does not exist|Could not find the table/i.test(e.message ?? ""));
export const NOT_READY = "مكتبة «الذكاء الإسلامي» ما تجهّزت بعد: شغّل ملف SQL رقم 0037 في Supabase.";

export async function sources(): Promise<Source[]> {
  const { data, error } = await db().from("islamic_sources").select("*").order("created_at");
  if (error) throw missing(error) ? new UserError(NOT_READY, 503) : error;
  return (data ?? []) as Source[];
}

export async function addSource(name: string, url: string): Promise<Source> {
  const host = hostOf(url);
  if (!/^https?:\/\//.test(url) || !host) throw new UserError("اكتب رابط الموقع كاملًا (يبدأ بـ https://).");
  const key = `${host.replace(/[^a-z0-9.-]/gi, "")}-${Date.now().toString(36)}`;
  const { data, error } = await db()
    .from("islamic_sources")
    .insert({ key, name: name.trim() || host, url: url.trim(), adapter: "site" })
    .select("*")
    .single();
  if (error) throw error;
  return data as Source;
}

export async function updateSource(id: string, patch: { enabled?: boolean; notes?: string; name?: string }) {
  const { error } = await db().from("islamic_sources").update(patch).eq("id", id);
  if (error) throw error;
}

export async function removeSource(id: string) {
  const { error } = await db().from("islamic_sources").delete().eq("id", id);
  if (error) throw error;
}

/** Forgets what was read of a source (its documents and where it stopped), to read it again from the start. */
export async function resetSource(id: string) {
  const d = db();
  const { error } = await d.from("islamic_docs").delete().eq("source_id", id);
  if (error) throw error;
  await d.from("islamic_sources").update({ cursor: {}, stats: {} }).eq("id", id);
}

/** Documents and chunks per source (counted from the tables). */
export async function counts(): Promise<Record<string, { docs: number; chunks: number }>> {
  const d = db();
  const out: Record<string, { docs: number; chunks: number }> = {};
  const { data } = await d.from("islamic_docs").select("source_id");
  for (const r of (data ?? []) as { source_id: string }[]) (out[r.source_id] ??= { docs: 0, chunks: 0 }).docs++;
  const { count } = await d.from("islamic_chunks").select("id", { count: "exact", head: true });
  // chunks are not per source in one cheap query; the total is shown on the page
  out.__all = { docs: Object.values(out).reduce((s, x) => s + x.docs, 0), chunks: count ?? 0 };
  return out;
}

/**
 * One reading run of a source: its reader works until the budget ends, each document read is saved (replacing an
 * older copy of the same address) and cut into searchable chunks, and where it stopped is kept for the next run.
 */
export async function runRead(id: string, budgetMs = ISLAMIC.crawlBudgetMs) {
  const d = db();
  const { data: row, error } = await d.from("islamic_sources").select("*").eq("id", id).maybeSingle();
  if (error) throw missing(error) ? new UserError(NOT_READY, 503) : error;
  const s = row as Source | null;
  if (!s) throw new UserError("ما لقينا هذا المصدر.", 404);
  const reader = READERS[s.adapter] ?? site;
  const deadline = Date.now() + budgetMs;
  let errors = 0;
  let step;
  try {
    step = await reader.step(s, s.cursor ?? {}, deadline);
  } catch (e) {
    console.error("islamic read", s.key, e);
    errors++;
    step = { docs: [], cursor: s.cursor ?? {}, done: false, stage: `خطأ: ${e instanceof Error ? e.message : String(e)}` };
  }
  let saved = 0;
  for (const doc of step.docs) {
    try {
      await saveDoc(s.id, doc);
      saved++;
    } catch (e) {
      console.error("islamic save", doc.url, e);
      errors++;
    }
  }
  const stats = {
    ...(s.stats ?? {}),
    docs: (s.stats?.docs ?? 0) + saved,
    lastRunAt: new Date().toISOString(),
    stage: step.stage,
    done: step.done,
    runs: (s.stats?.runs ?? 0) + 1,
    errors: (s.stats?.errors ?? 0) + errors,
  };
  await d.from("islamic_sources").update({ cursor: step.cursor, stats }).eq("id", s.id);
  return { saved, done: step.done, stage: step.stage, errors };
}

async function saveDoc(sourceId: string, doc: ReadDoc) {
  const d = db();
  const text = doc.text.slice(0, 400_000);
  const title = doc.title.trim().slice(0, 300);
  const { data, error } = await d
    .from("islamic_docs")
    .upsert({ source_id: sourceId, url: doc.url, kind: doc.kind, title, excerpt: text.slice(0, 600), chars: text.length, meta: doc.meta ?? {}, fetched_at: new Date().toISOString() }, { onConflict: "url" })
    .select("id")
    .single();
  if (error) throw error;
  const docId = (data as { id: string }).id;
  await d.from("islamic_chunks").delete().eq("doc_id", docId);
  // every chunk starts with the title, so a search on it finds the document and Claude knows what it reads
  const pieces = chunkText(text, ISLAMIC.chunkChars, ISLAMIC.chunkOverlap).map((p) => (title && !p.startsWith(title) ? `${title}\n${p}` : p));
  for (let i = 0; i < pieces.length; i += 50) {
    const rows = pieces.slice(i, i + 50).map((p, k) => ({ doc_id: docId, n: i + k, text: p }));
    const { error: e2 } = await d.from("islamic_chunks").insert(rows);
    if (e2) throw e2;
  }
}

/** Bytes the library takes in the database (0 when it can't be read). */
export async function librarySize(): Promise<number> {
  const { data, error } = await db().rpc("islamic_size");
  return error ? 0 : Number(data) || 0;
}

export interface Passage {
  chunk_id: number;
  doc_id: string;
  n: number;
  url: string;
  title: string;
  kind: string;
  source_name: string;
  text: string;
  rank: number;
}

/** The passages of the library that best match a question (at most ISLAMIC.perDoc from one document). */
export async function search(question: string, k = ISLAMIC.passages): Promise<{ passages: Passage[]; words: string[] }> {
  const words = queryWords(question);
  if (!words.length) return { passages: [], words };
  const { data, error } = await db().rpc("islamic_search", { q: tsQuery(words), k: k * 3 });
  if (error) {
    if (missing(error) || /function .*islamic_search/i.test(error.message ?? "")) throw new UserError(NOT_READY, 503);
    throw error;
  }
  const perDoc: Record<string, number> = {};
  const out: Passage[] = [];
  for (const p of (data ?? []) as Passage[]) {
    if ((perDoc[p.doc_id] ?? 0) >= ISLAMIC.perDoc) continue;
    perDoc[p.doc_id] = (perDoc[p.doc_id] ?? 0) + 1;
    out.push(p);
    if (out.length >= k) break;
  }
  return { passages: out, words };
}

export async function kvGet(key: string): Promise<string> {
  const { data, error } = await db().from("islamic_kv").select("value").eq("key", key).maybeSingle();
  if (error) return "";
  return (data as { value: string } | null)?.value ?? "";
}

export async function kvAll(): Promise<Record<string, string>> {
  const { data, error } = await db().from("islamic_kv").select("key,value");
  if (error) throw missing(error) ? new UserError(NOT_READY, 503) : error;
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { key: string; value: string }[]) out[r.key] = r.value;
  return out;
}

export async function kvSet(key: string, value: string) {
  if (!Object.values(ISLAMIC_KV).includes(key as (typeof ISLAMIC_KV)[keyof typeof ISLAMIC_KV])) throw new UserError("إعداد غير معروف.");
  const { error } = await db().from("islamic_kv").upsert({ key, value: value.slice(0, 60_000), updated_at: new Date().toISOString() });
  if (error) throw error;
}

export interface AnswerRow {
  id: string;
  user_id: string | null;
  question: string;
  answer: string;
  sources: { url: string; title: string; source: string }[];
  found: boolean;
  usd: number;
  note: string;
  created_at: string;
}

export async function logAnswer(row: Omit<AnswerRow, "id" | "created_at" | "note">) {
  const { error } = await db().from("islamic_answers").insert(row);
  if (error) console.error("islamic log", error.message);
}

export async function answers(limit = 60): Promise<AnswerRow[]> {
  const { data, error } = await db().from("islamic_answers").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw missing(error) ? new UserError(NOT_READY, 503) : error;
  return (data ?? []) as AnswerRow[];
}

export async function noteAnswer(id: string, note: string) {
  const { error } = await db().from("islamic_answers").update({ note: note.slice(0, 8000) }).eq("id", id);
  if (error) throw error;
}
