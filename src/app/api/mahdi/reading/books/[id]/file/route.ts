import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { pdfReadLink } from "@/lib/mahdi/server/book-files";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * The book's PDF through our own address, part by part (the reader asks for ranges). Only used when the browser can't
 * read the file's private link directly.
 */
export const GET = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase } = await requireProfile(req);
  const id = requireId((await params).id);
  const { data: book } = await supabase.from("mahdi_books").select("pdf_path, hidden_at").eq("id", id).maybeSingle();
  if (!book?.pdf_path || book.hidden_at) throw new UserError(t.errors.notFound, 404);
  const range = req.headers.get("range");
  const res = await fetch(await pdfReadLink(book.pdf_path as string), { headers: range ? { Range: range } : {} });
  if (!res.ok || !res.body) throw new UserError(t.reading.pdf.notReady, 503);
  const headers = new Headers({ "Content-Type": "application/pdf", "Accept-Ranges": "bytes", "Cache-Control": "private, no-store" });
  for (const h of ["content-length", "content-range"]) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(res.body, { status: res.status, headers });
});
