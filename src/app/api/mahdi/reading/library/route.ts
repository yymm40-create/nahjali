import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { check, mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { MAX_READING } from "@/lib/mahdi/server/reading";
import { todayFor } from "@/lib/mahdi/engine";
import { autoBookHabit, createBookHabit, readingReply, removeBookHabit, setBookTarget } from "@/lib/mahdi/server/reading-write";

/**
 * My library: `{ bookId, action }` with action add · read · pause · finish · remove.
 * At most 3 books are 'reading' at once; pausing keeps the progress, removing deletes it.
 * A book added for the first time gets its own habit (pages a day) unless `habit: false`.
 * The book's habit: `habit` (make it, `target`), `habit_target` (`target`), `habit_off` (no habit: it is deleted).
 */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user, profile } = await requireProfile(req);
  const body = await readJson(req);
  const bookId = requireId(body.bookId);
  const action = body.action;
  const { data: entry } = await supabase.from("mahdi_user_books").select("state").eq("book_id", bookId).maybeSingle();

  const countReading = async () => (await supabase.from("mahdi_user_books").select("book_id", { count: "exact", head: true }).eq("state", "reading")).count ?? 0;

  if (action === "add" || action === "read") {
    if (entry?.state === "reading") return NextResponse.json(await readingReply(supabase, profile));
    if ((await countReading()) >= MAX_READING) throw new UserError(t.reading.full, 400);
    if (entry) {
      check(await supabase.from("mahdi_user_books").update({ state: "reading", finished_at: null }).eq("book_id", bookId));
    } else {
      // Only a visible book of the catalogue can be added
      const { data: book } = await supabase.from("mahdi_books").select("id").eq("id", bookId).is("hidden_at", null).maybeSingle();
      if (!book) throw new UserError(t.errors.notFound, 404);
      check(await supabase.from("mahdi_user_books").insert({ user_id: user.id, book_id: bookId, state: "reading" }));
      // a new book becomes a habit too, unless the person said no
      if (body.habit !== false) await autoBookHabit(supabase, user.id, todayFor(profile), bookId);
    }
  } else if (action === "pause" || action === "finish") {
    if (!entry) throw new UserError(t.errors.notFound, 404);
    check(
      await supabase
        .from("mahdi_user_books")
        .update(action === "pause" ? { state: "paused", finished_at: null } : { state: "finished", finished_at: new Date().toISOString() })
        .eq("book_id", bookId),
    );
  } else if (action === "remove") {
    if (!entry) throw new UserError(t.errors.notFound, 404);
    check(await supabase.from("mahdi_user_books").delete().eq("book_id", bookId));
  } else if (action === "habit" || action === "habit_target") {
    if (!entry) throw new UserError(t.errors.notFound, 404);
    const target = Math.round(Number(body.target));
    if (!Number.isInteger(target) || target < 1 || target > 1000) throw new UserError(t.reading.bookHabit.badTarget, 400);
    const today = todayFor(profile);
    if (action === "habit") {
      if (!(await createBookHabit(supabase, user.id, today, bookId, target))) throw new UserError(t.reading.bookHabit.notMade, 409);
    } else await setBookTarget(supabase, user.id, today, bookId, target);
  } else if (action === "habit_off") {
    if (!entry) throw new UserError(t.errors.notFound, 404);
    await removeBookHabit(supabase, bookId);
  } else {
    throw new UserError(t.errors.invalid, 400);
  }
  return NextResponse.json(await readingReply(supabase, profile));
});

