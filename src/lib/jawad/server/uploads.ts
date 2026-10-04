// «الجواد الذكي!» | JAWAD AI — the user's reference files. Server only.
// The browser uploads straight to private storage with a one-time URL (Vercel limits request bodies), then the server
// downloads the file and checks what it really is (magic bytes), its size, pixels, duration and frame rate before it
// can be used. A file that fails is deleted and marked rejected.

import { randomUUID } from "crypto";
import sharp from "sharp";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RefKind, RefMeta, RefRole } from "@config/jawad/types";
import { MAX_UPLOAD_BYTES, probe, sniff, UPLOAD_EXT, UPLOAD_MIMES } from "../media";
import { FILM_BUCKET } from "@/lib/film/types";
import { JAWAD_BUCKET } from "./runtime";

export interface UploadRow {
  id: string;
  user_id: string;
  kind: RefKind;
  storage_path: string;
  file_name: string;
  mime: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  fps: number | null;
  status: "pending" | "ready" | "rejected";
  error: string | null;
  created_at: string;
}

export interface UploadView {
  id: string;
  kind: RefKind;
  fileName: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  fps: number | null;
  status: UploadRow["status"];
  error: string | null;
  url: string | null;
}

const db = () => createAdminClient();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);
const MAX_PENDING = 20;

/** Step 1: a pending record and a one-time upload URL. The browser's type is only a first filter. */
export async function signUpload(userId: string, b: { kind?: unknown; mime?: unknown; bytes?: unknown; fileName?: unknown }) {
  const mime = String(b.mime ?? "");
  const bytes = Number(b.bytes);
  const kind = UPLOAD_MIMES[mime];
  if (!kind || kind !== b.kind) throw new UserError("نوع الملف غير مقبول. المقبول: صور PNG/JPG/WEBP، فيديو MP4/MOV، صوت MP3/WAV.", 400);
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_UPLOAD_BYTES) throw new UserError("حجم الملف أكبر من ٥٠ ميجا.", 400);
  const { count } = await db().from("jawad_uploads").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending");
  if ((count ?? 0) >= MAX_PENDING) throw new UserError("عندك ملفات كثيرة قيد الرفع. انتظر حتى تكتمل.", 429);

  const path = `${userId}/refs/${randomUUID()}.${UPLOAD_EXT[mime]}`;
  const { data: row, error } = await db()
    .from("jawad_uploads")
    .insert({ user_id: userId, kind, storage_path: path, file_name: String(b.fileName ?? "").slice(0, 200), mime, bytes, status: "pending" })
    .select("id")
    .single();
  if (error) throw new UserError("جداول JAWAD AI غير جاهزة بعد.", 503);
  const signed = await db().storage.from(JAWAD_BUCKET).createSignedUploadUrl(path);
  if (signed.error) throw signed.error;
  return { id: row.id as string, path, signedUrl: signed.data.signedUrl, token: signed.data.token };
}

async function reject(row: UploadRow, message: string) {
  await db().storage.from(JAWAD_BUCKET).remove([row.storage_path]);
  await db().from("jawad_uploads").update({ status: "rejected", error: message }).eq("id", row.id);
  return { ...row, status: "rejected" as const, error: message };
}

/** Step 2: reads the stored file and records what it really is. Idempotent. */
export async function confirmUpload(userId: string, id: unknown): Promise<UploadRow> {
  if (!isUuid(id)) throw new UserError("ملف غير صحيح.", 400);
  const { data } = await db().from("jawad_uploads").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  const row = data as UploadRow | null;
  if (!row) throw new UserError("ما لقينا الملف.", 404);
  if (row.status !== "pending") return row;

  const dl = await db().storage.from(JAWAD_BUCKET).download(row.storage_path);
  if (dl.error || !dl.data) throw new UserError("ما وصل الملف بعد؛ جرّب الرفع مرة ثانية.", 409);
  const buf = new Uint8Array(await dl.data.arrayBuffer());
  if (buf.length > MAX_UPLOAD_BYTES) return reject(row, "حجم الملف أكبر من ٥٠ ميجا.");
  const s = sniff(buf);
  if (!s) return reject(row, "محتوى الملف لا يطابق أي نوع مقبول (امتداد الملف وحده لا يكفي).");
  if (s.kind !== row.kind) return reject(row, `محتوى الملف ${s.kind === "image" ? "صورة" : s.kind === "video" ? "فيديو" : "صوت"} وليس كما اخترت.`);

  let meta: { width?: number; height?: number; durationMs?: number; fps?: number } = {};
  if (s.kind === "image") {
    const m = await sharp(Buffer.from(buf)).metadata().catch(() => null);
    if (!m?.width || !m.height) return reject(row, "تعذّر قراءة الصورة؛ قد تكون تالفة.");
    // EXIF orientations 5–8 swap the displayed width and height
    meta = (m.orientation ?? 1) >= 5 ? { width: m.height, height: m.width } : { width: m.width, height: m.height };
  } else {
    meta = probe(buf, s);
    if (!meta.durationMs) return reject(row, "تعذّر قراءة مدة الملف؛ قد يكون تالفًا أو بصيغة غير مدعومة.");
    if (s.kind === "video" && (!meta.width || !meta.height)) return reject(row, "تعذّر قراءة أبعاد الفيديو.");
  }

  const update = {
    status: "ready" as const,
    mime: s.mime,
    bytes: buf.length,
    width: meta.width ?? null,
    height: meta.height ?? null,
    duration_ms: meta.durationMs ?? null,
    fps: meta.fps ?? null,
    error: null,
  };
  await db().from("jawad_uploads").update(update).eq("id", row.id).eq("status", "pending");
  return { ...row, ...update };
}

/** The user's stored references by id, as the rules see them (role from the request). Unknown or foreign ids throw. */
export async function refsFor(userId: string, wanted: { uploadId: string; role: RefRole }[]): Promise<{ meta: RefMeta[]; rows: UploadRow[] }> {
  if (!wanted.length) return { meta: [], rows: [] };
  const ids = [...new Set(wanted.map((w) => w.uploadId))];
  if (ids.length !== wanted.length || !ids.every(isUuid)) throw new UserError("مراجع غير صحيحة.", 400);
  const { data } = await db().from("jawad_uploads").select("*").in("id", ids).eq("user_id", userId);
  const rows = (data ?? []) as UploadRow[];
  if (rows.length !== ids.length) throw new UserError("أحد المراجع غير موجود (ربما حُذف). أزله وجرّب.", 400);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const meta = wanted.map((w) => {
    const r = byId.get(w.uploadId)!;
    return {
      id: r.id,
      kind: r.kind,
      role: w.role,
      mime: r.mime ?? "",
      bytes: Number(r.bytes ?? 0),
      width: r.width,
      height: r.height,
      durationMs: r.duration_ms,
      fps: r.fps == null ? null : Number(r.fps),
      status: r.status,
    } satisfies RefMeta;
  });
  return { meta, rows: wanted.map((w) => byId.get(w.uploadId)!) };
}

/** Views with short-lived links (only the owner of the files ever gets them). */
export async function uploadViews(rows: UploadRow[]): Promise<UploadView[]> {
  const ready = rows.filter((r) => r.status === "ready");
  const signed = ready.length ? (await db().storage.from(JAWAD_BUCKET).createSignedUrls(ready.map((r) => r.storage_path), 6 * 3600)).data ?? [] : [];
  const url = new Map(ready.map((r, i) => [r.id, signed[i]?.signedUrl ?? null]));
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    fileName: r.file_name,
    mime: r.mime ?? "",
    bytes: Number(r.bytes ?? 0),
    width: r.width,
    height: r.height,
    durationMs: r.duration_ms,
    fps: r.fps == null ? null : Number(r.fps),
    status: r.status,
    error: r.error,
    url: url.get(r.id) ?? null,
  }));
}

/** Deletes one of the user's references (jobs keep their own copy of what they used). */
export async function deleteUpload(userId: string, id: unknown) {
  if (!isUuid(id)) throw new UserError("ملف غير صحيح.", 400);
  const { data } = await db().from("jawad_uploads").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  const row = data as UploadRow | null;
  if (!row) return;
  // A reference an unfinished job still needs is kept until that job ends
  const { data: open } = await db()
    .from("jawad_jobs")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["queued", "submitting", "running", "saving"])
    .contains("refs", [{ uploadId: row.id }])
    .limit(1);
  if (open?.length) throw new UserError("هذا المرجع مستخدم في توليد لم ينتهِ بعد.", 409);
  await db().storage.from(JAWAD_BUCKET).remove([row.storage_path]);
  await db().from("jawad_uploads").delete().eq("id", row.id);
}

/** "Use as reference": copies one of the user's results into a new, checked reference. */
/** "Use as reference" for a picture or video of one of the user's film projects (owner checked through the project). */
export async function uploadFromFilmAsset(userId: string, assetId: unknown) {
  if (!isUuid(assetId)) throw new UserError("ملف غير صحيح.", 400);
  const { data: a } = await db().from("film_assets").select("project_id,storage_path,ref_key,kind").eq("id", assetId).maybeSingle();
  if (!a?.storage_path) throw new UserError("ما لقينا هذا العمل.", 404);
  const { data: p } = await db().from("film_projects").select("user_id").eq("id", a.project_id).maybeSingle();
  if (!p || p.user_id !== userId) throw new UserError("ما لقينا هذا العمل.", 404);
  const { data: blob, error: dl } = await db().storage.from(FILM_BUCKET).download(a.storage_path);
  if (dl || !blob) throw new UserError("تعذّر قراءة الملف؛ جرّب مرة ثانية.", 502);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length > MAX_UPLOAD_BYTES) throw new UserError("الملف أكبر من ٥٠ ميجا.", 400);
  // What the file really is, from its bytes (the server checks it again when confirming)
  const s = sniff(bytes);
  const kind = s ? UPLOAD_MIMES[s.mime] : undefined;
  if (!s || !kind) throw new UserError("هذا النوع من الملفات لا يُستخدم كمرجع.", 400);
  const path = `${userId}/refs/${randomUUID()}.${UPLOAD_EXT[s.mime]}`;
  const up = await db().storage.from(JAWAD_BUCKET).upload(path, bytes, { contentType: s.mime, upsert: false });
  if (up.error) throw up.error;
  const name = `${String(a.ref_key || "film").replace(/[^\w-]/g, "").slice(0, 40) || "film"}.${UPLOAD_EXT[s.mime]}`;
  const { data: row, error } = await db()
    .from("jawad_uploads")
    .insert({ user_id: userId, kind, storage_path: path, file_name: name, mime: s.mime, bytes: bytes.length, status: "pending" })
    .select("id")
    .single();
  if (error) throw error;
  return confirmUpload(userId, row.id);
}

/** A picture made on the server for the user (a frame of their own video), stored as a checked reference. */
export async function uploadFromBuffer(userId: string, bytes: Uint8Array, fileName: string) {
  if (bytes.length > MAX_UPLOAD_BYTES) throw new UserError("الملف أكبر من ٥٠ ميجا.", 400);
  const s = sniff(bytes);
  const kind = s ? UPLOAD_MIMES[s.mime] : undefined;
  if (!s || !kind) throw new UserError("ملف غير صالح.", 400);
  const path = `${userId}/refs/${randomUUID()}.${UPLOAD_EXT[s.mime]}`;
  const up = await db().storage.from(JAWAD_BUCKET).upload(path, bytes, { contentType: s.mime, upsert: false });
  if (up.error) throw up.error;
  const { data: row, error } = await db()
    .from("jawad_uploads")
    .insert({ user_id: userId, kind, storage_path: path, file_name: fileName.slice(0, 200), mime: s.mime, bytes: bytes.length, status: "pending" })
    .select("id")
    .single();
  if (error) throw error;
  return confirmUpload(userId, row.id);
}

export async function uploadFromOutput(userId: string, outputId: unknown) {
  if (!isUuid(outputId)) throw new UserError("ملف غير صحيح.", 400);
  const { data: out } = await db().from("jawad_outputs").select("*").eq("id", outputId).eq("user_id", userId).maybeSingle();
  if (!out) throw new UserError("ما لقينا هذا العمل.", 404);
  const mime = String(out.mime);
  const kind = UPLOAD_MIMES[mime];
  if (!kind) throw new UserError("هذا النوع من النتائج لا يُستخدم كمرجع.", 400);
  const path = `${userId}/refs/${randomUUID()}.${UPLOAD_EXT[mime]}`;
  const copy = await db().storage.from(JAWAD_BUCKET).copy(out.storage_path, path);
  if (copy.error) throw copy.error;
  const { data: row, error } = await db()
    .from("jawad_uploads")
    .insert({ user_id: userId, kind, storage_path: path, file_name: `result-${String(out.id).slice(0, 8)}.${UPLOAD_EXT[mime]}`, mime, bytes: out.bytes, status: "pending" })
    .select("id")
    .single();
  if (error) throw error;
  return confirmUpload(userId, row.id);
}
