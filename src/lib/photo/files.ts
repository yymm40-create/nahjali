// «زهراء فوتو ماستر» — the pictures of a project: the base, pictures over it, what جواد made for it, what the person
// exported. They live in the jawad bucket under photo/<user>/<project>/ and are recorded in photo_files. Server only.

import { randomUUID } from "crypto";
import sharp from "sharp";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import { JAWAD_BUCKET } from "@/lib/jawad/server/runtime";
import { isUuid } from "@/lib/jawad/server/uploads";
import { PHOTO } from "@config/photo";

const db = () => createAdminClient();
const LINK_SECONDS = 6 * 3600;

export type PhotoRole = "base" | "layer" | "made" | "export";

export interface PhotoFile {
  id: string;
  path: string;
  name: string;
  role: PhotoRole;
  mime: string;
  width: number;
  height: number;
}

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/**
 * A picture kept with the project. Pictures that will be edited (base, layer, made) are straightened by their EXIF turn,
 * brought inside the working size, and kept as PNG when they have transparency, else as a high-quality JPEG. An export is
 * kept exactly as the browser drew it.
 */
export async function addFile(o: { userId: string; projectId: string; bytes: Buffer; name: string; role: PhotoRole; meta?: Record<string, unknown> }): Promise<PhotoFile> {
  const probe = await sharp(o.bytes, { failOn: "none" }).metadata().catch(() => null);
  if (!probe?.width || !probe.height || !probe.format || !["png", "jpeg", "webp", "gif", "heif", "avif", "tiff"].includes(probe.format)) throw new UserError("الملف ليس صورة صالحة.", 400);
  let bytes = o.bytes;
  let mime = probe.format === "jpeg" ? "image/jpeg" : probe.format === "webp" ? "image/webp" : "image/png";
  let width = probe.width;
  let height = probe.height;
  if (o.role !== "export") {
    const img = sharp(o.bytes, { failOn: "none", animated: false }).rotate().resize({ width: PHOTO.maxSide, height: PHOTO.maxSide, fit: "inside", withoutEnlargement: true });
    const alpha = !!probe.hasAlpha;
    const { data, info } = await (alpha ? img.png() : img.jpeg({ quality: 93, mozjpeg: true })).toBuffer({ resolveWithObject: true });
    bytes = data;
    mime = alpha ? "image/png" : "image/jpeg";
    width = info.width;
    height = info.height;
  }
  const path = `photo/${o.userId}/${o.projectId}/${randomUUID()}.${EXT[mime] ?? "png"}`;
  const up = await storage.from(JAWAD_BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
  if (up.error) throw new UserError("ما قدرنا نحفظ الصورة؛ جرّب مرة ثانية.", 500);
  const { data, error } = await db()
    .from("photo_files")
    .insert({ project_id: o.projectId, user_id: o.userId, role: o.role, bucket: JAWAD_BUCKET, path, name: o.name.slice(0, 200), mime, bytes: bytes.length, width, height, meta: o.meta ?? {} })
    .select("id")
    .single();
  if (error || !data) {
    await storage.from(JAWAD_BUCKET).remove([path]).catch(() => null);
    throw new UserError("ما قدرنا نسجّل الصورة.", 500);
  }
  return { id: data.id as string, path, name: o.name, role: o.role, mime, width, height };
}

export interface FileRow {
  id: string;
  name: string;
  role: PhotoRole;
  mime: string;
  width: number;
  height: number;
}

/** The pictures of a project (not the exports). */
export async function projectFiles(userId: string, projectId: string): Promise<FileRow[]> {
  const { data } = await db().from("photo_files").select("id,name,role,mime,width,height").eq("project_id", projectId).eq("user_id", userId).neq("role", "export").order("created_at");
  return (data ?? []).map((r) => ({ id: r.id as string, name: String(r.name ?? ""), role: r.role as PhotoRole, mime: String(r.mime), width: Number(r.width ?? 0), height: Number(r.height ?? 0) }));
}

/** Short-lived links of a project's pictures (by id); `download` makes them save as files. */
export async function fileLinks(userId: string, projectId: string, download = false): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const { data } = await db().from("photo_files").select("id,path,name,mime").eq("project_id", projectId).eq("user_id", userId);
  const rows = (data ?? []) as { id: string; path: string; name: string; mime: string }[];
  if (!rows.length) return out;
  if (download) {
    await Promise.all(rows.map(async (r) => {
      const s = await storage.from(JAWAD_BUCKET).createSignedUrl(r.path, LINK_SECONDS, { download: `${r.name || "photo"}.${EXT[r.mime] ?? "png"}` });
      if (s.data?.signedUrl) out.set(r.id, s.data.signedUrl);
    }));
    return out;
  }
  const { data: signed } = await storage.from(JAWAD_BUCKET).createSignedUrls(rows.map((r) => r.path), LINK_SECONDS);
  rows.forEach((r, i) => signed?.[i]?.signedUrl && out.set(r.id, signed[i].signedUrl));
  return out;
}

/** The bytes of one of the person's pictures (for the canvas, same-origin, and for جواد). */
export async function fileBytes(userId: string, fileId: string): Promise<{ bytes: Buffer; mime: string; name: string; path: string; projectId: string } | null> {
  if (!isUuid(fileId)) return null;
  const { data } = await db().from("photo_files").select("path,mime,name,project_id").eq("id", fileId).eq("user_id", userId).maybeSingle();
  if (!data?.path) return null;
  const dl = await storage.from(JAWAD_BUCKET).download(data.path as string);
  if (dl.error || !dl.data) return null;
  return { bytes: Buffer.from(await dl.data.arrayBuffer()), mime: String(data.mime), name: String(data.name ?? ""), path: data.path as string, projectId: data.project_id as string };
}

/** The stored paths of a project's pictures (to remove them with the project). */
export async function projectPaths(userId: string, projectId: string): Promise<string[]> {
  const { data } = await db().from("photo_files").select("path").eq("project_id", projectId).eq("user_id", userId);
  return (data ?? []).map((r) => r.path as string);
}
