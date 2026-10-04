// SERVER ONLY. Books' PDF files: one-time upload links, checking an uploaded file, and short download links.
// The bucket is private; every link is made here after checking the reader.
import { randomUUID } from "node:crypto";
import { BOOK_PDF } from "@config/mahdi";
import { createAdminClient } from "@/lib/supabase/admin";
import { t } from "../i18n";
import { UserError } from "./api";

export const PDF_BUCKET = "mahdi-book-files";
const P = t.reading.pdf;

/** A one-time link to upload one PDF from the browser (`{ path, token }` for supabase-js uploadToSignedUrl). */
export async function pdfUploadLink(userId: string, size: number) {
  if (!Number.isInteger(size) || size < 5) throw new UserError(P.badType, 400);
  if (size > BOOK_PDF.maxBytes) throw new UserError(P.tooBig, 413);
  const db = createAdminClient();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { data: recent, error } = await db.storage.from(PDF_BUCKET).list(userId, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw new UserError(P.notReady, 503);
  if ((recent ?? []).filter((f) => (f.created_at ?? "") >= since).length >= BOOK_PDF.perDay) throw new UserError(P.tooMany, 429);
  const path = `${userId}/${randomUUID()}.pdf`;
  const { data, error: e2 } = await db.storage.from(PDF_BUCKET).createSignedUploadUrl(path);
  if (e2 || !data) throw new UserError(P.notReady, 503);
  return { path, token: data.token };
}

/**
 * Checks a PDF the user uploaded: theirs (their folder), present, within the size limit, and really a PDF
 * (its first bytes). Returns its size. A file that fails the check is deleted.
 */
export async function checkUploadedPdf(userId: string, path: unknown): Promise<{ path: string; size: number }> {
  if (typeof path !== "string" || !new RegExp(`^${userId}/[0-9a-f-]{36}\\.pdf$`).test(path)) throw new UserError(P.failed, 400);
  const db = createAdminClient();
  const name = path.slice(userId.length + 1);
  const { data: list } = await db.storage.from(PDF_BUCKET).list(userId, { search: name, limit: 1 });
  const info = list?.find((f) => f.name === name);
  const size = Number((info?.metadata as { size?: number } | undefined)?.size ?? 0);
  if (!info || !size) throw new UserError(P.failed, 400);
  const bad = async (msg: string, status: number) => {
    await db.storage.from(PDF_BUCKET).remove([path]);
    return new UserError(msg, status);
  };
  if (size > BOOK_PDF.maxBytes) throw await bad(P.tooBig, 413);
  const { data: link } = await db.storage.from(PDF_BUCKET).createSignedUrl(path, 60);
  const head = link ? await fetch(link.signedUrl, { headers: { Range: "bytes=0-1023" } }).then((r) => r.arrayBuffer()).catch(() => null) : null;
  if (!head || !Buffer.from(head).toString("latin1").includes("%PDF-")) throw await bad(P.badType, 415);
  return { path, size };
}

/** A short download link with a readable file name. */
export async function pdfDownloadLink(path: string, title: string) {
  const name = `${title.replace(/[\\/:*?"<>|\p{Cc}]/gu, " ").trim().slice(0, 80) || "book"}.pdf`;
  const { data, error } = await createAdminClient().storage.from(PDF_BUCKET).createSignedUrl(path, 120, { download: name });
  if (error || !data) throw new UserError(P.notReady, 503);
  return data.signedUrl;
}

export async function removePdf(path: string | null) {
  if (path) await createAdminClient().storage.from(PDF_BUCKET).remove([path]);
}
