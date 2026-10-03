import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { check, mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { MAX_READING } from "@/lib/mahdi/server/reading";
import { readingReply } from "@/lib/mahdi/server/reading-write";

/**
 * My library: `{ bookId, action }` with action add · read · pause · finish · remove.
 * At most 3 books are 'reading' at once; pausing keeps the progress, removing deletes it.
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
  } else {
    throw new UserError(t.errors.invalid, 400);
  }
  return NextResponse.json(await readingReply(supabase, profile));
});
