// SERVER ONLY. «مسبار القارئ»: my list in the guide, the guide books that have a PDF, and the owner attaching one.
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeTitle } from "../engine";
import { guideBook, isGuideKey, type GuideStatus } from "../guide";
import { t } from "../i18n";
import { UserError } from "./api";
import { checkUploadedPdf, removePdf } from "./book-files";
import { cleanText } from "./validate";
import { createAdminClient } from "@/lib/supabase/admin";

const G = t.reading.guide;

/** The tables of migration 0105 are missing. */
const missing = (e: unknown) => ["42P01", "PGRST205", "PGRST200"].includes((e as { code?: string } | null)?.code ?? "");

export interface GuideState {
  /** false until migration 0105 runs */
  ready: boolean;
  list: Record<string, { s: GuideStatus | null; n: string }>;
  /** guide id → the catalogue book whose PDF opens in the reader */
  pdf: Record<string, { bookId: string; size: number }>;
}

export async function loadGuide(supabase: SupabaseClient): Promise<GuideState> {
  const [list, links] = await Promise.all([
    supabase.from("mahdi_guide_list").select("guide_id, status, note").limit(2000),
    supabase.from("mahdi_guide_books").select("guide_id, book:mahdi_books (id, pdf_path, pdf_size, hidden_at)").limit(2000),
  ]);
  if (list.error || links.error) {
    if (missing(list.error) || missing(links.error)) return { ready: false, list: {}, pdf: {} };
    throw list.error ?? links.error;
  }
  const out: GuideState = { ready: true, list: {}, pdf: {} };
  for (const r of list.data ?? []) out.list[r.guide_id as string] = { s: (r.status as GuideStatus | null) ?? null, n: (r.note as string) ?? "" };
  for (const r of (links.data ?? []) as unknown as { guide_id: string; book: { id: string; pdf_path: string | null; pdf_size: number | null; hidden_at: string | null } | null }[]) {
    if (r.book?.pdf_path && !r.book.hidden_at) out.pdf[r.guide_id] = { bookId: r.book.id, size: r.book.pdf_size ?? 0 };
  }
  return out;
}

/** Sets my status and note on a guide book; neither → the row goes. */
export async function saveGuideEntry(supabase: SupabaseClient, userId: string, body: Record<string, unknown>) {
  const id = body.id;
  if (!isGuideKey(id)) throw new UserError(t.errors.notFound, 404);
  const s = body.status;
  if (s !== null && s !== undefined && s !== "want" && s !== "now" && s !== "read") throw new UserError(t.errors.invalid, 400);
  const note = cleanText(body.note, 1000);
  const res =
    !s && !note
      ? await supabase.from("mahdi_guide_list").delete().eq("guide_id", id)
      : await supabase.from("mahdi_guide_list").upsert({ user_id: userId, guide_id: id, status: s ?? null, note, updated_at: new Date().toISOString() });
  if (res.error) {
    if (missing(res.error)) throw new UserError(G.notReady, 503);
    throw res.error;
  }
}

/**
 * The owner gives a guide book its PDF (already uploaded with a link from /api/mahdi/reading/pdf). The PDF lives on a
 * book of the shared catalogue: the one this guide book already points at (its file is replaced), else a catalogue
 * book of the same title (it keeps its own file if it has one), else a new catalogue book. `pages` is counted in the
 * owner's browser when the file is picked.
 */
export async function attachGuidePdf(userId: string, body: Record<string, unknown>) {
  const id = body.id;
  const gb = isGuideKey(id) ? guideBook(id) : undefined;
  if (!gb) throw new UserError(t.errors.notFound, 404);
  const pages = Number(body.pages);
  if (!Number.isInteger(pages) || pages < 1 || pages > 10000) throw new UserError(t.reading.u.page.totalRequired, 400);
  const pdf = await checkUploadedPdf(userId, body.pdf);
  const db = createAdminClient();
  const fail = async (e: unknown): Promise<never> => {
    await removePdf(pdf.path);
    if (missing(e)) throw new UserError(G.notReady, 503);
    throw e;
  };

  const { data: link, error: e1 } = await db.from("mahdi_guide_books").select("book_id").eq("guide_id", id).maybeSingle();
  if (e1) return fail(e1);
  let bookId = link?.book_id as string | undefined;
  if (bookId) {
    const { data: old } = await db.from("mahdi_books").select("pdf_path").eq("id", bookId).maybeSingle();
    const { error } = await db.from("mahdi_books").update({ pdf_path: pdf.path, pdf_size: pdf.size, pdf_added_by: userId, hidden_at: null }).eq("id", bookId);
    if (error) return fail(error);
    if (old?.pdf_path && old.pdf_path !== pdf.path) await removePdf(old.pdf_path as string);
  } else {
    const titleNorm = normalizeTitle(gb.title);
    const { data: same } = await db.from("mahdi_books").select("id, pdf_path").eq("title_norm", titleNorm).eq("unit", "page").is("hidden_at", null).limit(1).maybeSingle();
    if (same) {
      bookId = same.id as string;
      if (same.pdf_path) await removePdf(pdf.path);
      else await db.from("mahdi_books").update({ pdf_path: pdf.path, pdf_size: pdf.size, pdf_added_by: userId }).eq("id", bookId);
    } else {
      const { data: created, error } = await db
        .from("mahdi_books")
        .insert({
          title: gb.title.slice(0, 120),
          title_norm: titleNorm,
          author: gb.author.slice(0, 80),
          pages,
          unit: "page",
          description: G.bookDescription(gb.field, gb.topic).slice(0, 500),
          added_by: userId,
          pdf_path: pdf.path,
          pdf_size: pdf.size,
          pdf_added_by: userId,
        })
        .select("id")
        .single();
      if (error) return fail(error);
      bookId = created.id as string;
    }
    const { error } = await db.from("mahdi_guide_books").upsert({ guide_id: id, book_id: bookId, linked_by: userId, linked_at: new Date().toISOString() });
    if (error) throw missing(error) ? new UserError(G.notReady, 503) : error;
  }
  return bookId;
}

/** The owner takes a guide book's PDF away (the catalogue book stays, without its file). */
export async function removeGuidePdf(id: unknown) {
  if (!isGuideKey(id)) throw new UserError(t.errors.notFound, 404);
  const db = createAdminClient();
  const { data: link, error } = await db.from("mahdi_guide_books").select("book_id").eq("guide_id", id).maybeSingle();
  if (error) throw missing(error) ? new UserError(G.notReady, 503) : error;
  if (!link) return;
  const { data: book } = await db.from("mahdi_books").select("pdf_path").eq("id", link.book_id).maybeSingle();
  await db.from("mahdi_books").update({ pdf_path: null, pdf_size: null, pdf_added_by: null }).eq("id", link.book_id);
  await removePdf((book?.pdf_path as string | null) ?? null);
  await db.from("mahdi_guide_books").delete().eq("guide_id", id);
}
