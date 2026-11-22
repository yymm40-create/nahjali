// SERVER ONLY. My library, reading sessions and goals (through RLS: only my own rows), and the shared catalogue.
import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeRanges, type BookUnit, type PageRange, type ReadingGoals, type ReadingSession } from "../engine";
import type { Book, LibraryEntry, ReadingData } from "../types";
import { selectAll } from "./snapshot";
import { publicFileUrl } from "@/lib/storage/public";

export const COVER_BUCKET = "mahdi-book-covers";
export const coverUrl = (path: string | null) =>
  path ? publicFileUrl(COVER_BUCKET, path) : null;

/** Most books a person can be reading at once. */
export const MAX_READING = 3;

export interface BookRow {
  id: string;
  title: string;
  author: string;
  pages: number;
  unit: BookUnit;
  description: string;
  cover_path: string | null;
  added_by: string | null;
  hidden_at: string | null;
  /** From migration 0019 (absent before it runs). */
  pdf_path?: string | null;
  pdf_size?: number | null;
}

/** Every column, so the optional ones of later migrations come along once they exist. */
export const BOOK_COLUMNS = "*";

export const bookFromRow = (r: BookRow, me: string): Book => ({
  id: r.id,
  title: r.title,
  author: r.author,
  pages: r.pages,
  unit: r.unit === "narration" ? "narration" : "page",
  description: r.description,
  coverUrl: coverUrl(r.cover_path),
  addedByMe: r.added_by === me,
  hidden: Boolean(r.hidden_at),
  pdfSize: r.pdf_path ? (r.pdf_size ?? 0) : null,
});

export const DEFAULT_GOALS: ReadingGoals = { daily: null, weekly: null, habitId: null, habitMetric: "minutes" };

interface SessionRow {
  id: string;
  book_id: string;
  log_date: string;
  seconds: number;
  ranges: unknown;
  pages_count: number;
  note: string;
  earlier?: boolean;
}

export const sessionFromRow = (r: SessionRow, unit: BookUnit = "page"): ReadingSession => ({
  id: r.id,
  bookId: r.book_id,
  unit,
  date: r.log_date,
  seconds: r.seconds,
  ranges: mergeRanges(Array.isArray(r.ranges) ? (r.ranges as PageRange[]) : []),
  pages: r.pages_count,
  note: r.note,
  ...(r.earlier ? { earlier: true } : {}),
});

const SESSION_COLS = "id, book_id, log_date, seconds, ranges, pages_count, note";
/** My sessions, with «earlier» (SQL 0121) when the column is there. */
async function loadSessions(supabase: SupabaseClient): Promise<SessionRow[]> {
  const read = (cols: string) =>
    selectAll<SessionRow>((a, b) => supabase.from("mahdi_reading_sessions").select(cols).order("log_date").order("created_at").range(a, b) as unknown as PromiseLike<{ data: SessionRow[] | null; error: unknown }>);
  try {
    return await read(`${SESSION_COLS}, earlier`);
  } catch (e) {
    if (["42703", "PGRST204"].includes((e as { code?: string })?.code ?? "")) return read(SESSION_COLS);
    throw e;
  }
}

/** My library, with each book's habit and daily target (SQL 0125) when the columns are there. */
async function loadLibrary(supabase: SupabaseClient) {
  const read = (extra: string) => supabase.from("mahdi_user_books").select(`state, added_at, finished_at${extra}, book:mahdi_books (${BOOK_COLUMNS})`).order("added_at");
  const res = await read(", habit_id, daily_target");
  if (res.error && ["42703", "PGRST204"].includes(res.error.code ?? "")) return read("");
  return res;
}

/** Everything the reading screens need for the signed-in user. */
export async function loadReading(supabase: SupabaseClient, me: string): Promise<ReadingData> {
  const [lib, sessions, goals] = await Promise.all([
    loadLibrary(supabase),
    loadSessions(supabase),
    supabase.from("mahdi_reading_goals").select("*").maybeSingle(),
  ]);
  const g = goals.data;
  const library = ((lib.data ?? []) as unknown as { state: LibraryEntry["state"]; added_at: string; finished_at: string | null; habit_id?: string | null; daily_target?: number | null; book: BookRow | null }[])
    .filter((r) => r.book)
    .map((r) => ({ book: bookFromRow(r.book!, me), state: r.state, addedAt: r.added_at, finishedAt: r.finished_at, habitId: r.habit_id ?? null, dailyTarget: r.daily_target ?? null }));
  const unitOf = new Map(library.map((e) => [e.book.id, e.book.unit]));
  return {
    library,
    sessions: sessions.map((s) => sessionFromRow(s, unitOf.get(s.book_id))),
    goals: g
      ? {
          daily: g.daily_metric ? { metric: g.daily_metric, target: g.daily_target } : null,
          weekly: g.weekly_metric ? { metric: g.weekly_metric, target: g.weekly_target } : null,
          habitId: g.habit_id,
          habitMetric: g.habit_metric,
        }
      : DEFAULT_GOALS,
  };
}

/** The site-wide @username of the signed-in user, or null. */
export async function loadUsername(supabase: SupabaseClient, me: string): Promise<string | null> {
  const { data } = await supabase.from("site_usernames").select("username").eq("user_id", me).maybeSingle();
  return data?.username ?? null;
}
