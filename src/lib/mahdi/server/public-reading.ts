// SERVER ONLY. «رابط حسابي»: what a person's public link shows of their reading — only when they turned it on
// (mahdi_privacy.share_reading, SQL 0126). Read with the service role; nothing private beyond these numbers.
import { createAdminClient } from "@/lib/supabase/admin";
import { startOfMonth, todayIn } from "../engine";
import { readPhase } from "../read-challenge";
import { currentReadChallenge, isReadMember, readChallengeBoard } from "./read-challenge";
import type { PublicReading } from "../social";

export type { PublicReading };

const missing = (e: unknown) => ["42703", "PGRST204"].includes((e as { code?: string } | null)?.code ?? "");

/** The person's public reading, or null when they keep it private (or before SQL 0126). */
export async function publicReadingOf(userId: string): Promise<PublicReading | null> {
  const db = createAdminClient();
  const { data: privacy, error } = await db.from("mahdi_privacy").select("share_reading").eq("user_id", userId).maybeSingle();
  if (error || !privacy?.share_reading) return null;

  const { data: profile } = await db.from("mahdi_profiles").select("time_zone").eq("user_id", userId).maybeSingle();
  const today = todayIn(profile?.time_zone ?? "Asia/Riyadh");
  const month = startOfMonth(today);

  // sessions in books of pages; pages read before (SQL 0121) are not reading done here
  type S = { book_id: string; log_date: string; pages_count: number; earlier?: boolean };
  let res = await db.from("mahdi_reading_sessions").select("book_id, log_date, pages_count, earlier").eq("user_id", userId).limit(20000);
  if (res.error && missing(res.error)) res = (await db.from("mahdi_reading_sessions").select("book_id, log_date, pages_count").eq("user_id", userId).limit(20000)) as typeof res;
  const sessions = ((res.data ?? []) as S[]).filter((s) => !s.earlier);
  const [{ data: books }, { data: library }] = await Promise.all([
    db.from("mahdi_books").select("id, unit").in("id", [...new Set(sessions.map((s) => s.book_id))].slice(0, 500)),
    db.from("mahdi_user_books").select("state, book:mahdi_books (title)").eq("user_id", userId),
  ]);
  const pageBooks = new Set((books ?? []).filter((b) => b.unit !== "narration").map((b) => b.id as string));
  const pages = sessions.filter((s) => pageBooks.has(s.book_id));
  const lib = (library ?? []) as unknown as { state: string; book: { title: string } | null }[];

  let challenge: PublicReading["challenge"] = null;
  const c = await currentReadChallenge(today).catch(() => null);
  if (c && (await isReadMember(c.id, userId).catch(() => false))) {
    const board = await readChallengeBoard(c.id).catch(() => []);
    const me = board.find((e) => e.userId === userId);
    if (me) challenge = { title: c.title, rank: me.rank, total: board.length, pages: me.pages, over: readPhase(c, today) === "over" };
  }

  return {
    monthPages: pages.filter((s) => s.log_date >= month && s.log_date <= today).reduce((n, s) => n + s.pages_count, 0),
    totalPages: pages.reduce((n, s) => n + s.pages_count, 0),
    finished: lib.filter((e) => e.state === "finished").length,
    now: lib.filter((e) => e.state === "reading" && e.book).map((e) => e.book!.title).slice(0, 3),
    challenge,
  };
}
