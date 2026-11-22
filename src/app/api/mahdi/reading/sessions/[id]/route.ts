import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { loadReading } from "@/lib/mahdi/server/reading";
import { addToHabit, applyToHabit, bookHabitOf, readingReply } from "@/lib/mahdi/server/reading-write";

type Ctx = { params: Promise<{ id: string }> };

/** Deletes one of my sessions; what it added to the linked habit is taken back. */
export const DELETE = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, profile } = await requireProfile(req);
  const id = requireId((await params).id);
  let { data, error } = await supabase.from("mahdi_reading_sessions").delete().eq("id", id).select("book_id, log_date, seconds, pages_count, earlier");
  // before SQL 0121 there is no «earlier»: the row is still there, delete it the old way
  if (error && ["42703", "PGRST204"].includes(error.code ?? "")) ({ data, error } = await supabase.from("mahdi_reading_sessions").delete().eq("id", id).select("book_id, log_date, seconds, pages_count"));
  if (error) throw error;
  const s = data?.[0] as { book_id: string; log_date: string; seconds: number; pages_count: number; earlier?: boolean } | undefined;
  if (!s) throw new UserError(t.errors.notFound, 404);
  // pages read before never reached the habit: nothing to take back
  if (s.earlier) return NextResponse.json(await readingReply(supabase, profile));
  const { goals, library } = await loadReading(supabase, profile.userId);
  const unit = library.find((e) => e.book.id === s.book_id)?.book.unit ?? "page";
  await applyToHabit(supabase, goals, s.log_date, s.seconds, s.pages_count, unit, -1).catch((e) => console.error("[mahdi reading habit]", e));
  const bookHabit = await bookHabitOf(supabase, s.book_id);
  if (bookHabit && bookHabit !== goals.habitId) await addToHabit(supabase, bookHabit, s.log_date, s.pages_count, -1).catch((e) => console.error("[mahdi book habit]", e));
  return NextResponse.json(await readingReply(supabase, profile));
});
