// «محمد الخارق» — the files of a conversation: what the person attached (their JAWAD AI uploads, already checked and
// stored by the studio's upload flow). A picture he looks at, a PDF he reads, a video or a sound he only knows the name
// of. Nothing is produced here: a picture or a video he asks for is made by جواد's desk. Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import { JAWAD_BUCKET } from "@/lib/jawad/server/runtime";
import { isUuid, type UploadRow } from "@/lib/jawad/server/uploads";
import { KHARQ } from "@config/kharq";
import type { Attachment } from "./chats";

const db = () => createAdminClient();
const LINK_SECONDS = 6 * 3600;

/** The person's own ready uploads among these ids, as attachments (anything else is dropped). */
export async function attachmentsOf(userId: string, ids: unknown): Promise<Attachment[]> {
  const wanted = (Array.isArray(ids) ? ids : []).filter(isUuid).slice(0, KHARQ.mediaMax * 4);
  if (!wanted.length) return [];
  const { data } = await db().from("jawad_uploads").select("*").in("id", wanted).eq("user_id", userId).eq("status", "ready");
  const byId = new Map(((data ?? []) as UploadRow[]).map((r) => [r.id, r]));
  return wanted.flatMap((id) => {
    const r = byId.get(id);
    return r ? [{ id: r.id, kind: r.kind, name: r.file_name, durationMs: r.duration_ms }] : [];
  });
}

/** Short-lived links of the person's uploads (by id), for the page and for «محمد»'s own eyes. */
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
