// SERVER ONLY. Photos and short videos of the community (posts and stories), in a private bucket.
// The browser uploads straight to storage with a one-time link; the server then checks the file from its bytes,
// re-encodes photos (which drops location and camera data), checks a video's length and blanks its metadata boxes
// (iPhone videos carry the place they were filmed), and moves it to its final name. Only checked files are used.
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { probe, sniff } from "@/lib/jawad/media";
import { t } from "../i18n";
import { UserError } from "./api";

export const MEDIA_BUCKET = "mahdi-media";
export const MEDIA_LIMITS = { maxBytes: 50 * 1024 * 1024, videoMaxMs: 30_500, perDay: 30, photoSide: 1440 } as const;
const S = () => t.social;

const ascii = (b: Uint8Array, at: number) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

/**
 * Blanks the metadata boxes of an MP4/MOV in place: every `udta` and `meta` box inside `moov` and its tracks becomes
 * an empty `free` box of the same size, which players skip. The pictures and sound are untouched.
 */
export function stripVideoMetadata(b: Uint8Array) {
  const walk = (from: number, to: number, depth: number) => {
    let o = from;
    while (o + 8 <= to) {
      let size = u32(b, o);
      let body = o + 8;
      if (size === 1) {
        size = u32(b, o + 8) * 2 ** 32 + u32(b, o + 12);
        body = o + 16;
      } else if (size === 0) size = to - o;
      if (size < 8 || o + size > to) return;
      const type = ascii(b, o + 4);
      if (depth > 0 && (type === "udta" || type === "meta")) {
        // A "free" box of the same size, emptied: nothing of the place or the device is left in the file
        b.set([0x66, 0x72, 0x65, 0x65], o + 4);
        b.fill(0, body, o + size);
      }
      else if (type === "moov" || (depth > 0 && (type === "trak" || type === "mdia" || type === "minf"))) walk(body, o + size, depth + 1);
      o += size;
    }
  };
  walk(0, b.length, 0);
  return b;
}

/** A one-time link to upload one photo or video (`{ path, token }`). */
export async function mediaUploadLink(userId: string, kind: unknown, size: unknown) {
  const k = kind === "video" ? "video" : kind === "image" ? "image" : null;
  const bytes = Number(size);
  if (!k || !Number.isInteger(bytes) || bytes < 100) throw new UserError(S().media.badType, 400);
  if (bytes > MEDIA_LIMITS.maxBytes) throw new UserError(S().media.tooBig, 413);
  const db = createAdminClient();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { data: recent, error } = await db.storage.from(MEDIA_BUCKET).list(`${userId}/incoming`, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw new UserError(S().notReady, 503);
  if ((recent ?? []).filter((f) => (f.created_at ?? "") >= since).length >= MEDIA_LIMITS.perDay) throw new UserError(S().media.tooMany, 429);
  const path = `${userId}/incoming/${randomUUID()}.${k === "video" ? "mp4" : "jpg"}`;
  const { data, error: e2 } = await db.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (e2 || !data) throw new UserError(S().notReady, 503);
  return { path, token: data.token };
}

export interface CheckedMedia {
  path: string;
  kind: "image" | "video";
  width: number | null;
  height: number | null;
  ms: number | null;
}

/** Checks an uploaded file and moves it to its final, private name. A file that fails is deleted. */
export async function checkUploadedMedia(userId: string, path: unknown, want: "image" | "video"): Promise<CheckedMedia> {
  if (typeof path !== "string" || !new RegExp(`^${userId}/incoming/[0-9a-f-]{36}\\.(mp4|jpg)$`).test(path)) throw new UserError(S().media.failed, 400);
  const db = createAdminClient();
  const bucket = db.storage.from(MEDIA_BUCKET);
  const { data: blob, error } = await bucket.download(path);
  if (error || !blob) throw new UserError(S().media.failed, 400);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const drop = async (msg: string, status = 400) => {
    await bucket.remove([path]);
    return new UserError(msg, status);
  };
  if (bytes.length > MEDIA_LIMITS.maxBytes) throw await drop(S().media.tooBig, 413);
  const s = sniff(bytes);
  if (!s || s.kind !== want) throw await drop(S().media.badType, 415);

  const final = `${userId}/media/${randomUUID()}.${want === "image" ? "webp" : s.mime === "video/quicktime" ? "mov" : "mp4"}`;
  let out: Uint8Array;
  let dims: { width: number | null; height: number | null; ms: number | null };
  if (want === "image") {
    try {
      const { data, info } = await sharp(Buffer.from(bytes), { limitInputPixels: 60_000_000 })
        .rotate()
        .resize(MEDIA_LIMITS.photoSide, MEDIA_LIMITS.photoSide, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
      out = new Uint8Array(data);
      dims = { width: info.width, height: info.height, ms: null };
    } catch {
      throw await drop(S().media.badType, 415);
    }
  } else {
    const p = probe(bytes, s);
    if (!p.durationMs) throw await drop(S().media.badType, 415);
    if (p.durationMs > MEDIA_LIMITS.videoMaxMs) throw await drop(S().media.tooLong, 400);
    out = stripVideoMetadata(bytes);
    dims = { width: p.width ?? null, height: p.height ?? null, ms: Math.round(p.durationMs) };
  }
  const up = await bucket.upload(final, out, { contentType: want === "image" ? "image/webp" : s.mime, upsert: false });
  await bucket.remove([path]);
  if (up.error) throw new UserError(S().media.failed, 502);
  return { path: final, kind: want, ...dims };
}

/** Short links for media the reader is allowed to see (the caller has checked). */
export async function signMedia(paths: (string | null | undefined)[], seconds = 3600) {
  const list = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (!list.length) return new Map<string, string>();
  const { data } = await createAdminClient().storage.from(MEDIA_BUCKET).createSignedUrls(list, seconds);
  return new Map((data ?? []).flatMap((d, i) => (d.signedUrl ? [[list[i], d.signedUrl] as const] : [])));
}

export async function removeMedia(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => Boolean(p));
  if (list.length) await createAdminClient().storage.from(MEDIA_BUCKET).remove(list);
}
