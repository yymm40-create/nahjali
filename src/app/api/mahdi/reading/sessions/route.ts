import { NextResponse } from "next/server";
import { countPages, isISODate, mergeRanges, todayIn, addDays } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { check, mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { loadReading } from "@/lib/mahdi/server/reading";
import { applyToHabit } from "@/lib/mahdi/server/reading-write";
import { cleanText } from "@/lib/mahdi/server/validate";

/**
 * Saves a reading session: `{ bookId, startedAt?, seconds, ranges: [[from, to], …], note?, date? }`.
 * With the timer, `startedAt` gives the day (in my time zone) and limits the seconds; a manual entry gives `date`.
 * The linked habit (reading goals) is filled at the same time.
 */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user, profile } = await requireProfile(req);
  const body = await readJson(req);
  const bookId = requireId(body.bookId);
  const { data: entry } = await supabase.from("mahdi_user_books").select("book:mahdi_books (pages, unit)").eq("book_id", bookId).maybeSingle();
  const book = (entry as unknown as { book: { pages: number; unit: "page" | "narration" } | null } | null)?.book;
  const pagesInBook = book?.pages;
  if (!pagesInBook) throw new UserError(t.errors.notFound, 404);

  const now = Date.now();
  const today = todayIn(profile.timeZone);
  let date = today;
  let startedAt: string | null = null;
  let seconds = Math.floor(Number(body.seconds) || 0);
  if (seconds < 0 || seconds > 86400) throw new UserError(t.errors.invalid, 400);
  if (typeof body.startedAt === "string") {
    const start = Date.parse(body.startedAt);
    if (!Number.isFinite(start) || start > now + 60_000 || start < now - 3 * 86_400_000) throw new UserError(t.errors.invalid, 400);
    // A session can't be longer than the time since it started (a little slack for clocks)
    seconds = Math.min(seconds, Math.ceil((now - start) / 1000) + 120);
    startedAt = new Date(start).toISOString();
    date = todayIn(profile.timeZone, new Date(start));
  } else if (body.date !== undefined) {
    if (!isISODate(body.date) || body.date > today || body.date < addDays(today, -60)) throw new UserError(t.errors.invalid, 400);
    date = body.date;
  }

  const raw = Array.isArray(body.ranges) ? body.ranges.slice(0, 60) : [];
  const ranges = mergeRanges(raw.map((r) => (Array.isArray(r) ? r.map(Number) : [])), pagesInBook);
  const pages = countPages(ranges);
  if (pages === 0 && seconds < 30) throw new UserError(t.reading.sessionTooShort, 400);

  check(
    await supabase.from("mahdi_reading_sessions").insert({
      user_id: user.id,
      book_id: bookId,
      log_date: date,
      started_at: startedAt,
      seconds,
      ranges,
      pages_count: pages,
      note: cleanText(body.note, 500),
    }),
  );

  const reading = await loadReading(supabase, profile.userId);
  await applyToHabit(supabase, reading.goals, date, seconds, pages, book!.unit === "narration" ? "narration" : "page", 1).catch((e) => console.error("[mahdi reading habit]", e));
  return NextResponse.json({ reading });
});

