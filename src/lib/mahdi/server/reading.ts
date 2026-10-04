// SERVER ONLY. My library, reading sessions and goals (through RLS: only my own rows), and the shared catalogue.
import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeRanges, type BookUnit, type PageRange, type ReadingGoals, type ReadingSession } from "../engine";
import type { Book, LibraryEntry, ReadingData } from "../types";
import { selectAll } from "./snapshot";

export const COVER_BUCKET = "mahdi-book-covers";
export const coverUrl = (path: string | null) =>
  path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${COVER_BUCKET}/${path}` : null;

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
});

/** Everything the reading screens need for the signed-in user. */
export async function loadReading(supabase: SupabaseClient, me: string): Promise<ReadingData> {
  const [lib, sessions, goals] = await Promise.all([
    supabase.from("mahdi_user_books").select(`state, added_at, finished_at, book:mahdi_books (${BOOK_COLUMNS})`).order("added_at"),
    selectAll<SessionRow>((a, b) =>
      supabase.from("mahdi_reading_sessions").select("id, book_id, log_date, seconds, ranges, pages_count, note").order("log_date").order("created_at").range(a, b),
    ),
    supabase.from("mahdi_reading_goals").select("*").maybeSingle(),
  ]);
  const g = goals.data;
  const library = ((lib.data ?? []) as unknown as { state: LibraryEntry["state"]; added_at: string; finished_at: string | null; book: BookRow | null }[])
    .filter((r) => r.book)
    .map((r) => ({ book: bookFromRow(r.book!, me), state: r.state, addedAt: r.added_at, finishedAt: r.finished_at }));
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
