import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { pdfReadLink } from "@/lib/mahdi/server/book-files";

type Ctx = { params: Promise<{ id: string }> };
const PRIVATE = { "Cache-Control": "private, no-store" };

/**
 * Reading a book's PDF inside the platform: a private link to the file (an hour; the reader asks again after that),
 * the page I stopped at, and whether the book is in my library (then the reading timer can run).
 */
export const GET = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase } = await requireProfile(req);
  const id = requireId((await params).id);
  const { data: book } = await supabase.from("mahdi_books").select("*").eq("id", id).maybeSingle();
  if (!book?.pdf_path || book.hidden_at) throw new UserError(t.errors.notFound, 404);
  const [{ data: at }, { data: entry }] = await Promise.all([
    supabase.from("mahdi_pdf_progress").select("page").eq("book_id", id).maybeSingle(),
    supabase.from("mahdi_user_books").select("state").eq("book_id", id).maybeSingle(),
  ]);
  return NextResponse.json(
    {
      url: await pdfReadLink(book.pdf_path as string),
      title: book.title,
      author: book.author,
      page: (at?.page as number | undefined) ?? 1,
      state: (entry?.state as string | undefined) ?? null,
    },
    { headers: PRIVATE },
  );
});

/** `{ page }`: where I stopped (kept for every device). Before migration 0105 nothing is kept. */
export const PUT = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireProfile(req);
  const id = requireId((await params).id);
  const page = Number((await readJson(req)).page);
  if (!Number.isInteger(page) || page < 1 || page > 100000) throw new UserError(t.errors.invalid, 400);
  await supabase.from("mahdi_pdf_progress").upsert({ user_id: user.id, book_id: id, page, updated_at: new Date().toISOString() });
  return NextResponse.json({ ok: true });
});
