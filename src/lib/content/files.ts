// «صانع المحتوى» — the files of a conversation: what the person attached (their JAWAD AI uploads, checked and stored
// by the studio's upload flow) and what was produced (the carousel's slides, in the jawad bucket). Server only.

import { randomUUID } from "crypto";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import { JAWAD_BUCKET } from "@/lib/jawad/server/runtime";
import { isUuid, type UploadRow } from "@/lib/jawad/server/uploads";
import type { Attachment } from "./chats";

const db = () => createAdminClient();
const LINK_SECONDS = 6 * 3600;

/** The person's own ready uploads among these ids, as attachments (anything else is dropped). */
export async function attachmentsOf(userId: string, ids: unknown): Promise<{ list: Attachment[]; rows: UploadRow[] }> {
  const wanted = (Array.isArray(ids) ? ids : []).filter(isUuid).slice(0, 12);
  if (!wanted.length) return { list: [], rows: [] };
  const { data } = await db().from("jawad_uploads").select("*").in("id", wanted).eq("user_id", userId).eq("status", "ready");
  const rows = (data ?? []) as UploadRow[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const list = wanted.flatMap((id) => {
    const r = byId.get(id);
    return r ? [{ id: r.id, kind: r.kind, name: r.file_name, durationMs: r.duration_ms }] : [];
  });
  return { list, rows: list.map((a) => byId.get(a.id)!) };
}

/** Short-lived links of the person's uploads (by id), for the page and for Claude's eyes. */
export async function uploadLinks(userId: string, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const wanted = [...new Set(ids.filter(isUuid))].slice(0, 200);
  if (!wanted.length) return out;
  const { data } = await db().from("jawad_uploads").select("id,storage_path").in("id", wanted).eq("user_id", userId).eq("status", "ready");
  const rows = (data ?? []) as { id: string; storage_path: string }[];
  if (!rows.length) return out;
  const { data: signed } = await storage.from(JAWAD_BUCKET).createSignedUrls(rows.map((r) => r.storage_path), LINK_SECONDS);
  rows.forEach((r, i) => signed?.[i]?.signedUrl && out.set(r.id, signed[i].signedUrl));
  return out;
}

export interface ProducedFile {
  id: string;
  path: string;
  name: string;
  bytes: number;
}

/** A produced picture stored with the conversation and recorded. */
export async function addProduced(o: { userId: string; chatId: string; bytes: Buffer; name: string; width: number; height: number; meta: Record<string, unknown> }): Promise<ProducedFile> {
  const path = `content/${o.userId}/${o.chatId}/${randomUUID()}.png`;
  const up = await storage.from(JAWAD_BUCKET).upload(path, o.bytes, { contentType: "image/png", upsert: false });
  if (up.error) throw new UserError("ما قدرنا نحفظ الصورة؛ جرّب مرة ثانية.", 500);
  const { data, error } = await db()
    .from("content_files")
    .insert({ chat_id: o.chatId, user_id: o.userId, kind: "image", bucket: JAWAD_BUCKET, path, name: o.name.slice(0, 200), mime: "image/png", bytes: o.bytes.length, width: o.width, height: o.height, meta: o.meta })
    .select("id")
    .single();
  if (error || !data) throw new UserError("ما قدرنا نسجّل الصورة.", 500);
  return { id: data.id as string, path, name: o.name, bytes: o.bytes.length };
}

/** Short-lived links of a conversation's produced files (by id). */
export async function producedLinks(userId: string, chatId: string, download = false): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const { data } = await db().from("content_files").select("id,path,name").eq("chat_id", chatId).eq("user_id", userId);
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

/** The bytes of one produced file of the person's (a slide used as the reference of the next ones). */
export async function producedBytes(userId: string, fileId: string): Promise<Buffer | null> {
  const { data } = await db().from("content_files").select("path").eq("id", fileId).eq("user_id", userId).maybeSingle();
  if (!data?.path) return null;
  const dl = await storage.from(JAWAD_BUCKET).download(data.path as string);
  if (dl.error || !dl.data) return null;
  return Buffer.from(await dl.data.arrayBuffer());
}

/** The record of one produced file of the person's (its meta keeps the slide's prompt, text and style for a retry). */
export async function producedRow(userId: string, fileId: string): Promise<{ id: string; path: string; name: string; meta: Record<string, unknown> } | null> {
  if (!isUuid(fileId)) return null;
  const { data } = await db().from("content_files").select("id,path,name,meta").eq("id", fileId).eq("user_id", userId).maybeSingle();
  return data ? { id: data.id as string, path: data.path as string, name: String(data.name ?? ""), meta: (data.meta as Record<string, unknown>) ?? {} } : null;
}

/** Removes a produced file (the picture and its record), e.g. the old slide that a new one replaced. */
export async function deleteProduced(userId: string, fileId: string) {
  const row = await producedRow(userId, fileId);
  if (!row) return;
  await db().from("content_files").delete().eq("id", fileId).eq("user_id", userId);
  await storage.from(JAWAD_BUCKET).remove([row.path]).catch(() => null);
}
