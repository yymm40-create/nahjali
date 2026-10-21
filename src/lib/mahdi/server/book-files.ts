// SERVER ONLY. Books' PDF files: one-time upload links, checking an uploaded file, and short download links.
// The bucket is private; every link is made here after checking the reader.
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { BOOK_PDF } from "@config/mahdi";
import { t } from "../i18n";
import { UserError } from "./api";
import { COVER_BUCKET } from "./reading";

import { storage } from "@/lib/storage";
export const PDF_BUCKET = "mahdi-book-files";
const P = t.reading.pdf;

/** A one-time link to upload one PDF from the browser: `{ path, token }`, the token being the link the browser PUTs to. */
export async function pdfUploadLink(userId: string, size: number) {
  if (!Number.isInteger(size) || size < 5) throw new UserError(P.badType, 400);
  if (size > BOOK_PDF.maxBytes) throw new UserError(P.tooBig, 413);
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { data: recent, error } = await storage.from(PDF_BUCKET).list(userId, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw new UserError(P.notReady, 503);
  if ((recent ?? []).filter((f) => (f.created_at ?? "") >= since).length >= BOOK_PDF.perDay) throw new UserError(P.tooMany, 429);
  const path = `${userId}/${randomUUID()}.pdf`;
  const { data, error: e2 } = await storage.from(PDF_BUCKET).createSignedUploadUrl(path);
  if (e2 || !data) throw new UserError(P.notReady, 503);
  return { path, token: data.token };
}

/**
 * Checks a PDF the user uploaded: theirs (their folder), present, within the size limit, and really a PDF
 * (its first bytes). Returns its size. A file that fails the check is deleted.
 */
export async function checkUploadedPdf(userId: string, path: unknown): Promise<{ path: string; size: number }> {
  if (typeof path !== "string" || !new RegExp(`^${userId}/[0-9a-f-]{36}\\.pdf$`).test(path)) throw new UserError(P.failed, 400);
  const name = path.slice(userId.length + 1);
  const { data: list } = await storage.from(PDF_BUCKET).list(userId, { search: name, limit: 1 });
  const info = list?.find((f) => f.name === name);
  const size = Number((info?.metadata as { size?: number } | undefined)?.size ?? 0);
  if (!info || !size) throw new UserError(P.failed, 400);
  const bad = async (msg: string, status: number) => {
    await storage.from(PDF_BUCKET).remove([path]);
    return new UserError(msg, status);
  };
  if (size > BOOK_PDF.maxBytes) throw await bad(P.tooBig, 413);
  const { data: link } = await storage.from(PDF_BUCKET).createSignedUrl(path, 60);
  const head = link ? await fetch(link.signedUrl, { headers: { Range: "bytes=0-1023" } }).then((r) => r.arrayBuffer()).catch(() => null) : null;
  if (!head || !Buffer.from(head).toString("latin1").includes("%PDF-")) throw await bad(P.badType, 415);
  return { path, size };
}

/** A short download link with a readable file name. */
export async function pdfDownloadLink(path: string, title: string) {
  const name = `${title.replace(/[\\/:*?"<>|\p{Cc}]/gu, " ").trim().slice(0, 80) || "book"}.pdf`;
  const { data, error } = await storage.from(PDF_BUCKET).createSignedUrl(path, 120, { download: name });
  if (error || !data) throw new UserError(P.notReady, 503);
  return data.signedUrl;
}

export async function removePdf(path: string | null) {
  if (path) await storage.from(PDF_BUCKET).remove([path]);
}

const COVER_MAX = 8 * 1024 * 1024;
const COVER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/**
 * Saves a cover photo for the catalogue: re-encoded here to a fixed size as WebP (which also drops location and camera
 * data), under a random name in the user's folder. Returns its storage path.
 */
export async function storeCover(userId: string, cover: File): Promise<string> {
  if (cover.size > COVER_MAX) throw new UserError(t.reading.coverTooBig, 413);
  if (!COVER_TYPES.includes(cover.type)) throw new UserError(t.reading.coverBadType, 415);
  let webp: Buffer;
  try {
    webp = await sharp(Buffer.from(await cover.arrayBuffer()), { limitInputPixels: 50_000_000 })
      .rotate()
      .resize(480, 720, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new UserError(t.reading.coverBadType, 415);
  }
  const path = `${userId}/${randomUUID()}.webp`;
  const up = await storage.from(COVER_BUCKET).upload(path, webp, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (up.error) throw up.error;
  return path;
}

/** Deletes a cover file (nothing when there is none). */
export async function removeCover(path: string | null | undefined) {
  if (path) await storage.from(COVER_BUCKET).remove([path]);
}
