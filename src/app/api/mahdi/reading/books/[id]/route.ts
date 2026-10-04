import { NextResponse } from "next/server";
import { isAdmin } from "@config/site";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { checkUploadedPdf, removePdf } from "@/lib/mahdi/server/book-files";
import { readingReply } from "@/lib/mahdi/server/reading-write";
import { cleanLine } from "@/lib/mahdi/server/validate";
import { createAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * `{ report: "reason" }` reports a book to the admin.
 * `{ pdf: path }` attaches an uploaded PDF to a book that has none (whoever added the book, or the owner).
 */
export const POST = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, user, profile } = await requireProfile(req);
  const id = requireId((await params).id);
  const body = await readJson(req);
  const { data: book } = await supabase.from("mahdi_books").select("*").eq("id", id).maybeSingle();
  if (!book) throw new UserError(t.errors.notFound, 404);

  if ("pdf" in body) {
    const P = t.reading.pdf;
    if (!("pdf_path" in book)) throw new UserError(P.notReady, 503);
    if (book.added_by !== user.id && !isAdmin(user.email)) throw new UserError(P.notAllowed, 403);
    const pdf = await checkUploadedPdf(user.id, body.pdf);
    // Only if it still has none (two uploads at once: the second file is dropped)
    const { data: set, error } = await createAdminClient()
      .from("mahdi_books")
      .update({ pdf_path: pdf.path, pdf_size: pdf.size, pdf_added_by: user.id })
      .eq("id", id)
      .is("pdf_path", null)
      .select("id");
    if (error) throw error;
    if (!set?.length) {
      await removePdf(pdf.path);
      throw new UserError(P.exists, 409);
    }
    return NextResponse.json(await readingReply(supabase, profile));
  }

  if (!("report" in body)) throw new UserError(t.errors.invalid, 400);
  // A plain insert: "ignore if already there" needs a read permission reporters do not have (one report per person)
  const { error } = await supabase.from("mahdi_book_reports").insert({ book_id: id, user_id: user.id, reason: cleanLine(body.report, 300) });
  if (error && error.code !== "23505") throw error;
  return NextResponse.json({ ok: true });
});
