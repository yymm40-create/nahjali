import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { pdfDownloadLink } from "@/lib/mahdi/server/book-files";

type Ctx = { params: Promise<{ id: string }> };

/** Downloads the book's PDF (signed-in readers). A book the admin hid has no download. */
export const GET = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase } = await requireProfile(req);
  const id = requireId((await params).id);
  const { data: book } = await supabase.from("mahdi_books").select("*").eq("id", id).maybeSingle();
  if (!book?.pdf_path || book.hidden_at) throw new UserError(t.errors.notFound, 404);
  return NextResponse.redirect(await pdfDownloadLink(book.pdf_path as string, book.title as string), 303);
});
