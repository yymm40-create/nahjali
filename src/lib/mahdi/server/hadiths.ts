// SERVER ONLY. The sheikh's own library (SQL 0124): loading a book from the open GitHub copy of thaqalayn, searching
// it and reading hadiths by their place. Service role; the routes check who is asking.
import { createAdminClient } from "@/lib/supabase/admin";
import { gradingLine, hadithQuery, hadithRows, HADITHS_SOURCE, type HadithRow, type RawHadith } from "../hadiths";
import { UserError } from "./api";

const notReady = (e: unknown) => ["42P01", "42883", "PGRST205", "PGRST202"].includes((e as { code?: string })?.code ?? "");
export const LIBRARY_NOT_READY = "مكتبة الشيخ ما جهزت: شغّل ملف SQL رقم 0124 في Supabase.";

/** Loads (or refreshes) one book: its file from GitHub, every hadith saved by its place. */
export async function importBook(book: number): Promise<{ book: number; hadiths: number }> {
  const res = await fetch(`${HADITHS_SOURCE}/${book}.json`, { cache: "no-store" });
  if (!res.ok) throw new UserError(`ما قدرت أجيب الكتاب ${book} من GitHub (${res.status}).`, 502);
  const file = (await res.json()) as RawHadith[];
  if (!Array.isArray(file)) throw new UserError(`ملف الكتاب ${book} مو بالشكل المتوقع.`, 502);
  const rows = hadithRows(book, file);
  const db = createAdminClient();
  const now = new Date().toISOString();
  for (let i = 0; i < rows.length; i += 400) {
    const { error } = await db.from("mahdi_hadiths").upsert(rows.slice(i, i + 400).map((r) => ({ ...r, updated_at: now })), { onConflict: "id" });
    if (error) {
      if (notReady(error)) throw new UserError(LIBRARY_NOT_READY, 503);
      throw error;
    }
  }
  return { book, hadiths: rows.length };
}

/** How many hadiths each book has in the library. */
export async function hadithCounts(): Promise<Record<number, number>> {
  const { data, error } = await createAdminClient().rpc("mahdi_hadith_counts");
  if (error) {
    if (notReady(error)) throw new UserError(LIBRARY_NOT_READY, 503);
    throw error;
  }
  return Object.fromEntries(((data ?? []) as { book: number; hadiths: number }[]).map((r) => [r.book, Number(r.hadiths)]));
}

export interface HadithHit {
  id: string;
  book: number;
  volume: number;
  section: string;
  chapter: string;
  n: number;
  arabic: string;
  majlisi: string;
  behbudi: string;
  mohseni: string;
  graded: boolean;
  rank: number;
}

/**
 * A search of the library: hadiths with ALL the words first; when too few, those with ANY of them after them.
 * `books` narrows it to some books.
 */
export async function searchHadiths(text: string, books: number[] | null = null, limit = 10): Promise<HadithHit[]> {
  const db = createAdminClient();
  const run = async (q: string | null) => {
    if (!q) return [] as HadithHit[];
    const { data, error } = await db.rpc("mahdi_hadith_search", { q, books: books?.length ? books : null, lim: limit });
    if (error) {
      if (notReady(error)) throw new UserError(LIBRARY_NOT_READY, 503);
      throw error;
    }
    return (data ?? []) as HadithHit[];
  };
  const all = await run(hadithQuery(text, true));
  if (all.length >= Math.min(limit, 5)) return all;
  const any = await run(hadithQuery(text, false));
  const seen = new Set(all.map((h) => h.id));
  return [...all, ...any.filter((h) => !seen.has(h.id))].slice(0, limit);
}

/** Hadiths by their place (as the search gave them), whole. */
export async function readHadiths(ids: string[]): Promise<HadithRow[]> {
  const clean = [...new Set(ids.filter((id) => typeof id === "string" && /^\d+\/\d+\/\d+\/\d+$/.test(id)))].slice(0, 10);
  if (!clean.length) return [];
  const { data, error } = await createAdminClient().from("mahdi_hadiths").select("*").in("id", clean);
  if (error) {
    if (notReady(error)) throw new UserError(LIBRARY_NOT_READY, 503);
    throw error;
  }
  const rows = (data ?? []) as HadithRow[];
  return clean.map((id) => rows.find((r) => r.id === id)).filter((r): r is HadithRow => !!r);
}

/** A chapter's hadiths in order (the agent reads the chapter around a hadith it found). */
export async function chapterHadiths(id: string, limit = 12): Promise<HadithRow[]> {
  const m = /^(\d+)\/(\d+)\/(\d+)(?:\/\d+)?$/.exec(id);
  if (!m) return [];
  const { data, error } = await createAdminClient()
    .from("mahdi_hadiths")
    .select("*")
    .eq("book", Number(m[1]))
    .eq("section_id", Number(m[2]))
    .eq("chapter_id", Number(m[3]))
    .order("n")
    .limit(limit);
  if (error) {
    if (notReady(error)) throw new UserError(LIBRARY_NOT_READY, 503);
    throw error;
  }
  return (data ?? []) as HadithRow[];
}

export { gradingLine };
