import { NextResponse } from "next/server";
import { isAdmin } from "@config/site";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { normalizeTitle } from "@/lib/mahdi/engine";
import { checkUploadedPdf, removeCover, removePdf, storeCover } from "@/lib/mahdi/server/book-files";
import { readingReply } from "@/lib/mahdi/server/reading-write";
import { cleanLine, cleanText } from "@/lib/mahdi/server/validate";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

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

/**
 * Edits a book of the shared catalogue: its cover and its details (form data: title, author, pages, unit, description,
 * `cover` a new photo, `removeCover` "1"). Only whoever added the book, or the owner. Everyone reading it sees the change,
 * so the count can't go below a page someone already read, and the kind (pages or narrations) only changes while nobody
 * else has the book.
 */
export const PATCH = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, user, profile } = await requireProfile(req);
  const id = requireId((await params).id);
  const E = t.reading.edit;
  const db = createAdminClient();
  const { data: book } = await db.from("mahdi_books").select("*").eq("id", id).maybeSingle();
  if (!book) throw new UserError(t.errors.notFound, 404);
  if (book.added_by !== user.id && !isAdmin(user.email)) throw new UserError(E.notAllowed, 403);

  const form = await req.formData().catch(() => null);
  if (!form) throw new UserError(t.errors.invalid, 400);
  const title = cleanLine(form.get("title"), 120);
  if (!title) throw new UserError(t.reading.titleRequired, 400);
  const unit = form.get("unit") === "narration" ? "narration" : "page";
  const pages = Number(form.get("pages"));
  if (!Number.isInteger(pages) || pages < 1 || pages > 10000) throw new UserError(t.reading.u[unit].totalRequired, 400);
  const author = cleanLine(form.get("author"), 80);
  const description = cleanText(form.get("description"), 500);
  const cover = form.get("cover");
  const dropCover = form.get("removeCover") === "1";

  // The kind changes the meaning of everyone's numbers: only while nobody else has the book
  if (unit !== (book.unit === "narration" ? "narration" : "page")) {
    const { count } = await db.from("mahdi_user_books").select("user_id", { count: "exact", head: true }).eq("book_id", id).neq("user_id", user.id);
    if ((count ?? 0) > 0) throw new UserError(E.unitLocked, 409);
  }
  // Not below the furthest page anyone read in it
  if (pages < book.pages) {
    const { data: rows } = await db.from("mahdi_reading_sessions").select("ranges").eq("book_id", id).limit(5000);
    const furthest = Math.max(0, ...(rows ?? []).flatMap((r) => (Array.isArray(r.ranges) ? (r.ranges as number[][]).map((x) => Number(x?.[1]) || 0) : [])));
    if (pages < furthest) throw new UserError(t.reading.u[unit].editBelowRead(furthest), 409);
  }
  // No second copy of another book in the catalogue
  const titleNorm = normalizeTitle(title);
  const { data: same } = await db.from("mahdi_books").select("id").eq("title_norm", titleNorm).eq("pages", pages).eq("unit", unit).is("hidden_at", null).neq("id", id).limit(1).maybeSingle();
  if (same) throw new UserError(E.duplicate, 409);

  const row: Record<string, unknown> = { title, title_norm: titleNorm, author, pages, unit, description };
  const newCover = cover instanceof File && cover.size > 0 ? await storeCover(user.id, cover) : null;
  if (newCover) row.cover_path = newCover;
  else if (dropCover) row.cover_path = null;
  const { error } = await db.from("mahdi_books").update(row).eq("id", id);
  if (error) {
    await removeCover(newCover);
    throw error;
  }
  if (newCover || dropCover) await removeCover(book.cover_path as string | null);
  return NextResponse.json(await readingReply(supabase, profile));
});
