import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { normalizeTitle } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { BOOK_COLUMNS, bookFromRow, COVER_BUCKET, MAX_READING, type BookRow } from "@/lib/mahdi/server/reading";
import { readingReply } from "@/lib/mahdi/server/reading-write";
import { checkUploadedPdf, removePdf } from "@/lib/mahdi/server/book-files";
import { cleanLine, cleanText } from "@/lib/mahdi/server/validate";
import { createAdminClient } from "@/lib/supabase/admin";

import { storage } from "@/lib/storage";
export const runtime = "nodejs";

const COVER_MAX = 8 * 1024 * 1024;

/** Searches the shared catalogue: `?q=` (empty → the newest books). */
export const GET = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  const q = normalizeTitle(new URL(req.url).searchParams.get("q") ?? "").replace(/[%_,()\\]/g, " ").trim();
  let query = supabase.from("mahdi_books").select(BOOK_COLUMNS).is("hidden_at", null).order("created_at", { ascending: false }).limit(20);
  if (q) query = query.ilike("title_norm", `%${q}%`);
  const { data, error } = await query;
  if (error) throw error;
  return NextResponse.json({ books: (data as BookRow[]).map((b) => bookFromRow(b, user.id)) });
});

/**
 * Adds a new book to the catalogue and to my library (form data: title, author, pages, unit, description, cover,
 * and `pdf`: the path of a PDF already uploaded with a link from /api/mahdi/reading/pdf).
 * `unit` is "page" or "narration" (books of narrations are followed by narration number).
 * If the same book (same title, count and unit) already exists, that one is added instead, so the catalogue has no copies.
 */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user, profile } = await requireProfile(req);
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
  const pdf = form.get("pdf") ? await checkUploadedPdf(user.id, form.get("pdf")) : null;

  const { count: reading } = await supabase.from("mahdi_user_books").select("book_id", { count: "exact", head: true }).eq("state", "reading");
  if ((reading ?? 0) >= MAX_READING) throw new UserError(t.reading.full, 400);

  const db = createAdminClient();
  const titleNorm = normalizeTitle(title);
  const { data: same } = await db.from("mahdi_books").select("*").eq("title_norm", titleNorm).eq("pages", pages).eq("unit", unit).is("hidden_at", null).limit(1).maybeSingle();
  let bookId = same?.id as string | undefined;
  let duplicate = Boolean(bookId);
  // The same book already exists: my PDF goes to it if it has none, otherwise it isn't needed
  if (same && pdf) {
    if (same.pdf_path) await removePdf(pdf.path);
    else await db.from("mahdi_books").update({ pdf_path: pdf.path, pdf_size: pdf.size, pdf_added_by: user.id }).eq("id", same.id);
  }

  if (!bookId) {
    // At most 10 new books a day per person
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await db.from("mahdi_books").select("id", { count: "exact", head: true }).eq("added_by", user.id).gte("created_at", since);
    if ((count ?? 0) >= 10) throw new UserError(t.reading.dailyLimit, 429);

    let coverPath: string | null = null;
    if (cover instanceof File && cover.size > 0) {
      if (cover.size > COVER_MAX) throw new UserError(t.reading.coverTooBig, 413);
      if (!["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(cover.type)) throw new UserError(t.reading.coverBadType, 415);
      let webp: Buffer;
      try {
        // Re-encoded here: a fixed size, and no location or camera data from the photo
        webp = await sharp(Buffer.from(await cover.arrayBuffer()), { limitInputPixels: 50_000_000 })
          .rotate()
          .resize(480, 720, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
      } catch {
        throw new UserError(t.reading.coverBadType, 415);
      }
      coverPath = `${user.id}/${randomUUID()}.webp`;
      const up = await storage.from(COVER_BUCKET).upload(coverPath, webp, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
      if (up.error) throw up.error;
    }
    const { data: created, error } = await db
      .from("mahdi_books")
      .insert({ title, title_norm: titleNorm, author, pages, unit, description, cover_path: coverPath, added_by: user.id, ...(pdf ? { pdf_path: pdf.path, pdf_size: pdf.size, pdf_added_by: user.id } : {}) })
      .select("id")
      .single();
    if (error) throw error;
    bookId = created.id as string;
    duplicate = false;
  }

  const { data: existing } = await supabase.from("mahdi_user_books").select("state").eq("book_id", bookId).maybeSingle();
  if (existing) {
    if (existing.state !== "reading") await supabase.from("mahdi_user_books").update({ state: "reading", finished_at: null }).eq("book_id", bookId);
  } else {
    const { error } = await supabase.from("mahdi_user_books").insert({ user_id: user.id, book_id: bookId, state: "reading" });
    if (error) throw error;
  }
  return NextResponse.json({ bookId, duplicate, ...(await readingReply(supabase, profile)) });
});

