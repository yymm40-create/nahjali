// «المصمم الذكي» — the files of a conversation: what the person attached (their JAWAD AI uploads, through the same
// flow as the content maker) and what was produced (the artwork, a cut-out, the final PNG), in the jawad bucket.
// Server only.

import { randomUUID } from "crypto";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import { JAWAD_BUCKET } from "@/lib/jawad/server/runtime";
import { isUuid } from "@/lib/jawad/server/uploads";
import type { DeskOutput } from "@/lib/content/jawad";

export { attachmentsOf, uploadLinks } from "@/lib/content/files";

const db = () => createAdminClient();
const LINK_SECONDS = 6 * 3600;

export type FileRole = "artwork" | "cutout" | "final";

export interface DesignFile {
  id: string;
  path: string;
  name: string;
  role: FileRole;
}

/** A produced picture stored with the conversation and recorded. */
export async function addFile(o: { userId: string; chatId: string; bytes: Buffer; name: string; role: FileRole; width: number; height: number; meta?: Record<string, unknown> }): Promise<DesignFile> {
  const path = `designer/${o.userId}/${o.chatId}/${randomUUID()}.png`;
  const up = await storage.from(JAWAD_BUCKET).upload(path, o.bytes, { contentType: "image/png", upsert: false });
  if (up.error) throw new UserError("ما قدرنا نحفظ الصورة؛ جرّب مرة ثانية.", 500);
  const { data, error } = await db()
    .from("designer_files")
    .insert({ chat_id: o.chatId, user_id: o.userId, role: o.role, bucket: JAWAD_BUCKET, path, name: o.name.slice(0, 200), mime: "image/png", bytes: o.bytes.length, width: o.width, height: o.height, meta: o.meta ?? {} })
    .select("id")
    .single();
  if (error || !data) throw new UserError("ما قدرنا نسجّل الصورة.", 500);
  return { id: data.id as string, path, name: o.name, role: o.role };
}

/**
 * A picture جواد made (a JAWAD AI output, already stored in the same bucket), recorded as the conversation's artwork.
 * The file stays جواد's (it is also in «أعمالي»): deleting this record never deletes the stored picture.
 */
export async function addFileFromOutput(o: { userId: string; chatId: string; out: DeskOutput; name: string; meta: Record<string, unknown> }): Promise<DesignFile> {
  const { data, error } = await db()
    .from("designer_files")
    .insert({ chat_id: o.chatId, user_id: o.userId, role: "artwork", bucket: JAWAD_BUCKET, path: o.out.path, name: o.name.slice(0, 200), mime: o.out.mime, bytes: 0, width: o.out.width, height: o.out.height, meta: { ...o.meta, outputId: o.out.outputId, jobId: o.out.jobId } })
    .select("id")
    .single();
  if (error || !data) throw new UserError("ما قدرنا نسجّل الصورة.", 500);
  return { id: data.id as string, path: o.out.path, name: o.name, role: "artwork" };
}

/** Short-lived links of a conversation's produced files (by id); `download` makes them save as files. */
export async function fileLinks(userId: string, chatId: string, download = false): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const { data } = await db().from("designer_files").select("id,path,name").eq("chat_id", chatId).eq("user_id", userId);
  const rows = (data ?? []) as { id: string; path: string; name: string }[];
  if (!rows.length) return out;
  if (download) {
    await Promise.all(rows.map(async (r) => {
      const s = await storage.from(JAWAD_BUCKET).createSignedUrl(r.path, LINK_SECONDS, { download: `${r.name}.png` });
      if (s.data?.signedUrl) out.set(r.id, s.data.signedUrl);
    }));
    return out;
  }
  const { data: signed } = await storage.from(JAWAD_BUCKET).createSignedUrls(rows.map((r) => r.path), LINK_SECONDS);
  rows.forEach((r, i) => signed?.[i]?.signedUrl && out.set(r.id, signed[i].signedUrl));
  return out;
}

/** The bytes of one produced file of the person's. */
export async function fileBytes(userId: string, fileId: string): Promise<Buffer | null> {
  if (!isUuid(fileId)) return null;
  const { data } = await db().from("designer_files").select("path").eq("id", fileId).eq("user_id", userId).maybeSingle();
  if (!data?.path) return null;
  const dl = await storage.from(JAWAD_BUCKET).download(data.path as string);
  if (dl.error || !dl.data) return null;
  return Buffer.from(await dl.data.arrayBuffer());
}

/** The bytes of one of the person's uploads (a picture to split into layers). */
export async function uploadBytes(userId: string, uploadId: string): Promise<{ bytes: Buffer; name: string } | null> {
  if (!isUuid(uploadId)) return null;
  const { data } = await db().from("jawad_uploads").select("storage_path,file_name").eq("id", uploadId).eq("user_id", userId).eq("status", "ready").eq("kind", "image").maybeSingle();
  if (!data?.storage_path) return null;
  const dl = await storage.from(JAWAD_BUCKET).download(data.storage_path as string);
  if (dl.error || !dl.data) return null;
  return { bytes: Buffer.from(await dl.data.arrayBuffer()), name: String(data.file_name ?? "صورة") };
}
