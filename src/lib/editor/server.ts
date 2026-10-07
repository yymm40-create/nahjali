// «حيدرة كت» — projects, media and saves. Server only. Every call checks the project belongs to the person; the
// browser gets short-lived links to its own files only. Uploads go straight to storage with a one-time URL (Vercel
// limits request bodies) and are checked here from their first bytes, without loading whole files into memory.

import { randomUUID } from "crypto";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { FILM_BUCKET } from "@/lib/film/types";
import { JAWAD_BUCKET } from "@/lib/jawad/server/runtime";
import { applyAll, CommandError, type Command } from "./commands";
import { editorSniff, EDITOR_MIMES, KIND_AR, storedType } from "./media";
import { allTracks, emptyTimeline, isProjectKind, PROJECT_KINDS, readTimeline, type AssetInfo, type AssetKind, type ProjectKind, type Timeline } from "./model";

import { storage } from "@/lib/storage";
export const EDITOR_BUCKET = "editor";
/** Media of a project is deleted this long after its export (the person downloads the video first). */
export const PURGE_AFTER_MS = 3 * 86_400_000;
const LINK_SECONDS = 6 * 3600;
const MAX_PROJECTS = 200;
const MAX_ASSETS = 500;
/** Above this a file goes up in parts (R2 takes one PUT up to 5 GB; parts also go on after a cut). */
const PARTS_FROM = 100 * 1024 * 1024;
/** R2's own limit for one file (10,000 parts of up to 5 GB). */
export const MAX_FILE_BYTES = 4.9 * 1024 ** 4;
const MiB = 1024 * 1024;
/** 64 MB parts, bigger for files whose 64 MB parts would pass 9,500. */
const partSize = (bytes: number) => Math.max(64 * MiB, Math.ceil(bytes / 9500 / MiB) * MiB);

const db = () => createAdminClient();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);
const NOT_READY = "حيدرة كت يحتاج تجهيز قاعدة البيانات أول (ملف 0030).";

export interface EditorProject {
  id: string;
  user_id: string;
  title: string;
  kind: ProjectKind;
  timeline: Timeline;
  version: number;
  film_project_id: string | null;
  export_path: string | null;
  exported_at: string | null;
  purge_at: string | null;
  purged_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetRow {
  id: string;
  project_id: string;
  user_id: string;
  kind: AssetKind;
  bucket: "editor" | "jawad" | "film";
  path: string;
  name: string;
  mime: string;
  bytes: number;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  origin: "upload" | "jawad" | "film" | "generated";
  status: "pending" | "ready" | "missing";
  meta: Record<string, unknown>;
  created_at: string;
}

export interface AssetView {
  id: string;
  kind: AssetKind;
  name: string;
  mime: string;
  bytes: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean;
  origin: AssetRow["origin"];
  /** the JAWAD AI result or film video it was brought in from */
  sourceId: string | null;
  /** a JAWAD AI result (or a film video linked to one): its job and result, for «التعديل الذكي» */
  jobId: string | null;
  outputId: string | null;
  status: AssetRow["status"];
  url: string | null;
}

export interface ProjectSummary {
  id: string;
  title: string;
  kind: ProjectKind;
  updatedAt: string;
  exportedAt: string | null;
  purgeAt: string | null;
  purged: boolean;
  filmProjectId: string | null;
  clips: number;
}

const summary = (p: EditorProject): ProjectSummary => ({
  id: p.id,
  title: p.title,
  kind: p.kind,
  updatedAt: p.updated_at,
  exportedAt: p.exported_at,
  purgeAt: p.purge_at,
  purged: !!p.purged_at,
  filmProjectId: p.film_project_id,
  clips: (p.timeline?.tracks ?? []).reduce((n, t) => n + (t.clips?.length ?? 0), 0),
});

export async function listEditorProjects(userId: string): Promise<ProjectSummary[]> {
  const { data, error } = await db().from("editor_projects").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(100);
  if (error) throw new UserError(NOT_READY, 503);
  return ((data ?? []) as EditorProject[]).map(summary);
}

export async function createEditorProject(userId: string, b: { title?: unknown; kind?: unknown }, filmProjectId: string | null = null) {
  const kind: ProjectKind = isProjectKind(b.kind) ? b.kind : "reel";
  const { count, error: e } = await db().from("editor_projects").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (e) throw new UserError(NOT_READY, 503);
  if ((count ?? 0) >= MAX_PROJECTS) throw new UserError("عندك مشاريع كثيرة؛ احذف القديمة أول.", 429);
  const title = String(b.title ?? "").trim().slice(0, 120) || `${PROJECT_KINDS[kind].label} جديد`;
  const { data, error } = await db()
    .from("editor_projects")
    .insert({ user_id: userId, title, kind, timeline: emptyTimeline(PROJECT_KINDS[kind].ratio), film_project_id: filmProjectId })
    .select("id")
    .single();
  if (error) throw new UserError(NOT_READY, 503);
  return data.id as string;
}

export async function requireEditorProject(id: unknown, userId: string) {
  if (!isUuid(id)) throw new UserError("ما لقينا هذا المشروع.", 404);
  const { data, error } = await db().from("editor_projects").select("*").eq("id", id).maybeSingle();
  if (error) throw new UserError(NOT_READY, 503);
  if (!data || data.user_id !== userId) throw new UserError("ما لقينا هذا المشروع.", 404);
  return data as EditorProject;
}

async function assetRows(projectId: string) {
  const { data } = await db().from("editor_assets").select("*").eq("project_id", projectId).order("created_at", { ascending: true });
  return (data ?? []) as AssetRow[];
}

/** Links by bucket, made in one call per bucket. */
async function sign(rows: AssetRow[]) {
  const out = new Map<string, string>();
  for (const bucket of ["editor", "jawad", "film"] as const) {
    const list = rows.filter((r) => r.bucket === bucket && r.status === "ready" && !r.meta?.local);
    if (!list.length) continue;
    const { data } = await storage.from(bucket).createSignedUrls(list.map((r) => r.path), LINK_SECONDS);
    (data ?? []).forEach((d, i) => d.signedUrl && out.set(list[i].id, d.signedUrl));
  }
  return out;
}

/** A file the desktop program keeps on the person's computer: served by the program itself (desktop/main.js). */
const localUrl = (r: AssetRow) => (r.meta?.local && typeof r.meta.localId === "string" ? `haidara-media://file/${r.meta.localId}` : null);

const view = (r: AssetRow, signed: string | null): AssetView => {
  const url = localUrl(r) ?? signed;
  return {
  id: r.id,
  kind: r.kind,
  name: r.name,
  mime: r.mime,
  bytes: Number(r.bytes ?? 0),
  durationMs: r.duration_ms,
  width: r.width,
  height: r.height,
  hasAudio: r.kind === "audio" || r.meta?.hasAudio !== false,
  origin: r.origin,
  sourceId: typeof r.meta?.sourceId === "string" ? r.meta.sourceId : null,
  jobId: typeof r.meta?.jobId === "string" ? r.meta.jobId : null,
  outputId: typeof r.meta?.outputId === "string" ? r.meta.outputId : r.origin === "jawad" && typeof r.meta?.sourceId === "string" ? r.meta.sourceId : null,
  status: url || r.status !== "ready" ? r.status : "missing",
  url,
  };
};

export async function assetViews(projectId: string) {
  const rows = (await assetRows(projectId)).filter((r) => r.status !== "pending");
  const urls = await sign(rows);
  return rows.map((r) => view(r, urls.get(r.id) ?? null));
}

export const assetInfo = (a: Pick<AssetView, "id" | "kind" | "durationMs" | "width" | "height" | "hasAudio">): AssetInfo => ({
  id: a.id,
  kind: a.kind,
  durationMs: a.durationMs,
  width: a.width,
  height: a.height,
  hasAudio: a.hasAudio,
});

export async function projectState(p: EditorProject) {
  const assets = await assetViews(p.id);
  return {
    project: { ...summary(p), version: p.version, timeline: readTimeline(p.timeline) },
    assets,
  };
}

/**
 * Saves the whole timeline if nobody saved since `version` (another tab, Claude…); otherwise 409 with the newer one.
 * The document is cleaned first (clips on media that isn't in this project are dropped).
 */
export async function saveTimeline(p: EditorProject, b: { timeline?: unknown; version?: unknown; label?: unknown; actor?: unknown; title?: unknown }) {
  const version = Number(b.version);
  if (!Number.isInteger(version)) throw new UserError("نسخة غير صحيحة.", 400);
  const ids = new Set((await assetRows(p.id)).filter((r) => r.status !== "pending").map((r) => r.id));
  const timeline = readTimeline(b.timeline, ids);
  const patch: Record<string, unknown> = { timeline, version: version + 1, updated_at: new Date().toISOString() };
  if (typeof b.title === "string" && b.title.trim()) patch.title = b.title.trim().slice(0, 120);
  const { data, error } = await db().from("editor_projects").update(patch).eq("id", p.id).eq("version", version).select("version").maybeSingle();
  if (error) throw error;
  if (!data) {
    const now = await requireEditorProject(p.id, p.user_id);
    return { ok: false as const, version: now.version, timeline: readTimeline(now.timeline) };
  }
  await db().from("editor_ops").insert({ project_id: p.id, version: version + 1, actor: String(b.actor ?? "user").slice(0, 60), label: String(b.label ?? "").slice(0, 200) });
  return { ok: true as const, version: version + 1 };
}

/** Runs commands on the stored timeline and saves (for Claude and plugins later; the page edits locally). */
export async function runCommands(p: EditorProject, cmds: Command[], actor: string) {
  const assets = await assetViews(p.id);
  try {
    const r = applyAll(readTimeline(p.timeline), cmds, new Map(assets.map((a) => [a.id, assetInfo(a)])));
    const saved = await saveTimeline(p, { timeline: r.timeline, version: p.version, label: r.label, actor });
    if (!saved.ok) throw new UserError("تغيّر المشروع أثناء التنفيذ؛ جرّب مرة ثانية.", 409);
    return { version: saved.version, timeline: r.timeline, label: r.label };
  } catch (err) {
    if (err instanceof CommandError) throw new UserError(err.message, 400);
    throw err;
  }
}

/** The project's change history, newest first. */
export async function history(projectId: string) {
  const { data } = await db().from("editor_ops").select("version,actor,label,created_at").eq("project_id", projectId).not("actor", "in", "(speech,claude)").order("id", { ascending: false }).limit(50);
  return data ?? [];
}

// ---------- media ----------

export function stillOpen(p: EditorProject) {
  if (p.purged_at) throw new UserError("انحذفت ملفات هذا المشروع بعد ٣ أيام من تصديره. ابدأ مشروعًا جديدًا.", 410);
}

/**
 * Step 1 of an upload: a pending record and a one-time URL, or for a large file a multi-part upload
 * (`multipart`: the browser asks for the parts' links, sends them, then joins them with completeUpload).
 */
/**
 * The desktop program: a file stays on the person's computer and only its description is kept here (what the
 * timeline needs: kind, length, pixels). Its link points into the program, which serves the file from the disk.
 */
export async function addLocalAsset(p: EditorProject, b: { localId?: unknown; kind?: unknown; container?: unknown; bytes?: unknown; name?: unknown; durationMs?: unknown; width?: unknown; height?: unknown; hasAudio?: unknown }) {
  stillOpen(p);
  if (!isUuid(b.localId)) throw new UserError("ملف غير صحيح.", 400);
  const kind = b.kind as AssetKind;
  if (!["video", "audio", "image"].includes(kind)) throw new UserError("نوع الملف غير مقبول.", 400);
  let type: { mime: string; ext: string };
  try {
    type = storedType(String(b.container ?? "") as Parameters<typeof storedType>[0], kind);
  } catch {
    throw new UserError("نوع الملف غير مقبول.", 400);
  }
  if (!type || !EDITOR_MIMES.has(type.mime)) throw new UserError("نوع الملف غير مقبول.", 400);
  const durationMs = kind === "image" ? null : clampInt(b.durationMs, 24 * 3600_000);
  if (kind !== "image" && !durationMs) throw new UserError("تعذّر قراءة مدة الملف؛ قد يكون تالفًا أو بترميز ما يدعمه البرنامج.", 400);
  const { count } = await db().from("editor_assets").select("id", { count: "exact", head: true }).eq("project_id", p.id);
  if ((count ?? 0) >= MAX_ASSETS) throw new UserError("مكتبة هذا المشروع ممتلئة؛ احذف ملفات ما تحتاجها.", 429);
  const { data, error } = await db()
    .from("editor_assets")
    .insert({
      project_id: p.id,
      user_id: p.user_id,
      kind,
      // (nothing is stored under this path: the rows of every kind share the table's columns)
      bucket: EDITOR_BUCKET,
      path: `${p.user_id}/${p.id}/local/${b.localId}`,
      name: String(b.name ?? "").slice(0, 200),
      mime: type.mime,
      bytes: Math.max(0, Math.round(Number(b.bytes) || 0)),
      duration_ms: durationMs,
      width: kind === "audio" ? null : clampInt(b.width, 16384),
      height: kind === "audio" ? null : clampInt(b.height, 16384),
      origin: "upload",
      status: "ready",
      meta: { local: true, localId: b.localId, hasAudio: kind !== "image" && b.hasAudio !== false },
    })
    .select("*")
    .single();
  if (error || !data) throw new UserError(NOT_READY, 503);
  return view(data as AssetRow, null);
}

export async function signAssetUpload(p: EditorProject, b: { kind?: unknown; container?: unknown; bytes?: unknown; name?: unknown }) {
  stillOpen(p);
  const kind = b.kind as AssetKind;
  if (!["video", "audio", "image"].includes(kind)) throw new UserError("نوع الملف غير مقبول.", 400);
  const container = String(b.container ?? "") as Parameters<typeof storedType>[0];
  let type: { mime: string; ext: string };
  try {
    type = storedType(container, kind);
  } catch {
    throw new UserError("نوع الملف غير مقبول.", 400);
  }
  if (!type || !EDITOR_MIMES.has(type.mime)) throw new UserError("نوع الملف غير مقبول.", 400);
  const bytes = Number(b.bytes);
  if (!Number.isFinite(bytes) || bytes <= 0) throw new UserError("الملف فاضي.", 400);
  if (bytes > MAX_FILE_BYTES) throw new UserError("الملف أكبر من ٤٫٩ تيرا، أكبر حجم يقبله التخزين.", 400);
  const { count } = await db().from("editor_assets").select("id", { count: "exact", head: true }).eq("project_id", p.id);
  if ((count ?? 0) >= MAX_ASSETS) throw new UserError("مكتبة هذا المشروع ممتلئة؛ احذف ملفات ما تحتاجها.", 429);

  const path = `${p.user_id}/${p.id}/media/${randomUUID()}.${type.ext}`;
  const { data: row, error } = await db()
    .from("editor_assets")
    .insert({ project_id: p.id, user_id: p.user_id, kind, bucket: EDITOR_BUCKET, path, name: String(b.name ?? "").slice(0, 200), mime: type.mime, bytes, origin: "upload", status: "pending" })
    .select("id")
    .single();
  if (error) throw new UserError(NOT_READY, 503);
  if (bytes > PARTS_FROM) {
    const uploadId = await storage.from(EDITOR_BUCKET).createMultipart(path, type.mime);
    return { id: row.id as string, mime: type.mime, multipart: { uploadId, partSize: partSize(bytes) } };
  }
  const signed = await storage.from(EDITOR_BUCKET).createSignedUploadUrl(path);
  if (signed.error) throw signed.error;
  return { id: row.id as string, mime: type.mime, signedUrl: signed.data.signedUrl };
}

/** Where a multi-part upload goes: a pending file of this project, or (`id: "export"`) the project's export. */
async function partsTarget(p: EditorProject, id: unknown, uploadId: unknown) {
  if (typeof uploadId !== "string" || !uploadId || uploadId.length > 1024) throw new UserError("رفع غير صحيح.", 400);
  if (id === "export") return { path: `${p.user_id}/${p.id}/export.mp4`, uploadId };
  if (!isUuid(id)) throw new UserError("ملف غير صحيح.", 400);
  const { data } = await db().from("editor_assets").select("path,bucket,status").eq("id", id).eq("project_id", p.id).maybeSingle();
  if (!data || data.status !== "pending" || data.bucket !== EDITOR_BUCKET) throw new UserError("ما لقينا هذا الرفع؛ ابدأه من جديد.", 404);
  return { path: data.path as string, uploadId };
}

const partNumbers = (v: unknown) => {
  const list = Array.isArray(v) ? v.slice(0, 50).map(Number) : [];
  if (!list.length || list.some((n) => !Number.isInteger(n) || n < 1 || n > 10_000)) throw new UserError("أجزاء غير صحيحة.", 400);
  return list;
};

/** Links for the next parts of a multi-part upload (up to 50 at a time; each works for 6 hours). */
export async function partUrls(p: EditorProject, b: { id?: unknown; uploadId?: unknown; parts?: unknown }) {
  stillOpen(p);
  const t = await partsTarget(p, b.id, b.uploadId);
  return { urls: await storage.from(EDITOR_BUCKET).signParts(t.path, t.uploadId, partNumbers(b.parts)) };
}

/** The parts already stored, to go on after a cut or a reload; `parts: null` when the upload has to start again. */
export async function uploadedParts(p: EditorProject, b: { id?: unknown; uploadId?: unknown }) {
  const t = await partsTarget(p, b.id, b.uploadId);
  return { parts: await storage.from(EDITOR_BUCKET).uploadedParts(t.path, t.uploadId) };
}

/** Joins the parts into the file; the upload is then confirmed as usual (confirm_upload / exported). */
export async function completeUpload(p: EditorProject, b: { id?: unknown; uploadId?: unknown; parts?: unknown }) {
  stillOpen(p);
  const t = await partsTarget(p, b.id, b.uploadId);
  const parts = (Array.isArray(b.parts) ? b.parts.slice(0, 10_000) : []).map((x) => ({ part: Number((x as { part?: unknown })?.part), etag: String((x as { etag?: unknown })?.etag ?? "") }));
  if (!parts.length || parts.some((x) => !Number.isInteger(x.part) || x.part < 1 || x.part > 10_000 || !x.etag || x.etag.length > 200)) throw new UserError("أجزاء غير صحيحة.", 400);
  try {
    await storage.from(EDITOR_BUCKET).completeMultipart(t.path, t.uploadId, parts);
  } catch {
    throw new UserError("تعذّر تجميع أجزاء الملف؛ جرّب الرفع مرة ثانية.", 409);
  }
  return { ok: true };
}

/** The first bytes of a stored file, through a short link (the file itself may be large). */
async function head(bucket: string, path: string) {
  const s = await storage.from(bucket).createSignedUrl(path, 60);
  if (!s.data?.signedUrl) return null;
  const r = await fetch(s.data.signedUrl, { headers: { range: "bytes=0-63" } }).catch(() => null);
  if (!r || !r.ok) return null;
  return new Uint8Array(await r.arrayBuffer()).subarray(0, 64);
}

async function storedSize(bucket: string, path: string) {
  const dir = path.slice(0, path.lastIndexOf("/"));
  const name = path.slice(path.lastIndexOf("/") + 1);
  const { data } = await storage.from(bucket).list(dir, { search: name, limit: 5 });
  const f = (data ?? []).find((x) => x.name === name);
  return f ? Number((f.metadata as { size?: number } | null)?.size ?? 0) : null;
}

const clampInt = (v: unknown, hi: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, hi) : null;
};

/**
 * Step 2: checks the stored file's first bytes and records it. What the browser's decoder measured (duration,
 * pixels, whether a video has sound) is taken as it says: it only shapes the timeline, never what anyone pays.
 */
export async function confirmAsset(p: EditorProject, b: { id?: unknown; durationMs?: unknown; width?: unknown; height?: unknown; hasAudio?: unknown }) {
  if (!isUuid(b.id)) throw new UserError("ملف غير صحيح.", 400);
  const { data } = await db().from("editor_assets").select("*").eq("id", b.id).eq("project_id", p.id).maybeSingle();
  const row = data as AssetRow | null;
  if (!row) throw new UserError("ما لقينا الملف.", 404);
  if (row.status === "ready") return view(row, (await sign([row])).get(row.id) ?? null);

  const bytes = await head(row.bucket, row.path);
  const drop = async (m: string) => {
    await storage.from(row.bucket).remove([row.path]);
    await db().from("editor_assets").delete().eq("id", row.id);
    throw new UserError(m, 400);
  };
  if (!bytes) throw new UserError("ما وصل الملف بعد؛ جرّب الرفع مرة ثانية.", 409);
  const s = editorSniff(bytes);
  if (!s) return drop("محتوى الملف ما يطابق أي نوع مقبول (امتداد الملف وحده ما يكفي).");
  if (!s.kinds.includes(row.kind) || storedType(s.container, row.kind).mime !== row.mime) return drop(`محتوى الملف ما يطابق نوعه (${KIND_AR[row.kind]}).`);
  const size = await storedSize(row.bucket, row.path);

  const durationMs = row.kind === "image" ? null : clampInt(b.durationMs, 24 * 3600_000);
  if (row.kind !== "image" && !durationMs) return drop("تعذّر قراءة مدة الملف؛ قد يكون تالفًا أو بترميز ما يدعمه المتصفح.");
  const update = {
    status: "ready" as const,
    bytes: size ?? row.bytes,
    duration_ms: durationMs,
    width: row.kind === "audio" ? null : clampInt(b.width, 16384),
    height: row.kind === "audio" ? null : clampInt(b.height, 16384),
    meta: { ...row.meta, hasAudio: row.kind === "video" ? b.hasAudio !== false : row.kind === "audio" },
  };
  await db().from("editor_assets").update(update).eq("id", row.id);
  const done = { ...row, ...update };
  return view(done, (await sign([done])).get(done.id) ?? null);
}

/** Removes a file from the project's library (refused while a clip on the timeline uses it). */
export async function deleteAsset(p: EditorProject, id: unknown) {
  if (!isUuid(id)) throw new UserError("ملف غير صحيح.", 400);
  const { data } = await db().from("editor_assets").select("*").eq("id", id).eq("project_id", p.id).maybeSingle();
  const row = data as AssetRow | null;
  if (!row) return;
  const used = allTracks(readTimeline(p.timeline)).some((t) => t.clips.some((c) => c.assetId === row.id));
  if (used) throw new UserError("هذا الملف مستخدم في أحد التسلسلات؛ احذف مقاطعه أول.", 409);
  // only our own copies are deleted; a work from JAWAD AI or the film maker stays where it was
  if (row.bucket === EDITOR_BUCKET) await storage.from(EDITOR_BUCKET).remove([row.path]);
  await db().from("editor_assets").delete().eq("id", row.id);
}

// ---------- the person's other works (JAWAD AI results and film maker videos) ----------

export interface ImportItem {
  source: "jawad" | "film";
  id: string;
  kind: AssetKind;
  name: string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  url: string | null;
}

/** What the person can bring in from their works: newest JAWAD AI results and film maker videos. */
export async function importables(userId: string): Promise<ImportItem[]> {
  const [outs, films] = await Promise.all([
    db().from("jawad_outputs").select("id,kind,storage_path,width,height,duration_ms,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(60),
    db().from("film_projects").select("id,title").eq("user_id", userId).order("updated_at", { ascending: false }).limit(20),
  ]);
  const items: (ImportItem & { bucket: string; path: string })[] = [];
  for (const o of (outs.data ?? []) as { id: string; kind: AssetKind; storage_path: string; width: number | null; height: number | null; duration_ms: number | null; created_at: string }[]) {
    items.push({ source: "jawad", id: o.id, kind: o.kind, name: "من أعمالي", durationMs: o.duration_ms, width: o.width, height: o.height, createdAt: o.created_at, url: null, bucket: JAWAD_BUCKET, path: o.storage_path });
  }
  const projects = (films.data ?? []) as { id: string; title: string }[];
  if (projects.length) {
    const { data } = await db()
      .from("film_assets")
      .select("id,project_id,kind,ref_key,storage_path,meta,created_at")
      .in("project_id", projects.map((x) => x.id))
      .eq("kind", "video")
      .not("storage_path", "is", null)
      .order("created_at", { ascending: false })
      .limit(60);
    for (const a of (data ?? []) as { id: string; project_id: string; ref_key: string; storage_path: string; meta: Record<string, unknown>; created_at: string }[]) {
      const title = projects.find((x) => x.id === a.project_id)?.title ?? "";
      items.push({ source: "film", id: a.id, kind: "video", name: `${title} · ${a.ref_key}`, durationMs: Number(a.meta?.durationSec ?? 0) * 1000 || null, width: null, height: null, createdAt: a.created_at, url: null, bucket: FILM_BUCKET, path: a.storage_path });
    }
  }
  items.sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1));
  for (const bucket of [JAWAD_BUCKET, FILM_BUCKET]) {
    const list = items.filter((i) => i.bucket === bucket);
    if (!list.length) continue;
    const { data } = await storage.from(bucket).createSignedUrls(list.map((i) => i.path), LINK_SECONDS);
    (data ?? []).forEach((d, i) => (list[i].url = d.signedUrl ?? null));
  }
  return items.map((i): ImportItem => ({ source: i.source, id: i.id, kind: i.kind, name: i.name, durationMs: i.durationMs, width: i.width, height: i.height, createdAt: i.createdAt, url: i.url }));
}

/**
 * Adds works of the person's to the project's library. The file stays where it is (no copy): the clip points at
 * it. Duration and pixels come from the browser (`measured`), which reads them when it shows the work.
 */
export async function importAssets(p: EditorProject, b: { items?: unknown }) {
  stillOpen(p);
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 40) as { source?: unknown; id?: unknown; durationMs?: unknown; width?: unknown; height?: unknown; hasAudio?: unknown; name?: unknown }[];
  if (!items.length) throw new UserError("اختر عملًا واحدًا على الأقل.", 400);
  const rows: Record<string, unknown>[] = [];
  for (const it of items) {
    if (!isUuid(it.id)) continue;
    let src: { bucket: "jawad" | "film"; path: string; kind: AssetKind; name: string; jobId?: string } | null = null;
    if (it.source === "jawad") {
      const { data } = await db().from("jawad_outputs").select("user_id,kind,storage_path,job_id").eq("id", it.id).maybeSingle();
      if (data && data.user_id === p.user_id) src = { bucket: "jawad", path: data.storage_path, kind: data.kind, name: String(it.name ?? "من أعمالي"), jobId: data.job_id };
    } else if (it.source === "film") {
      const { data } = await db().from("film_assets").select("project_id,kind,storage_path,ref_key").eq("id", it.id).maybeSingle();
      if (data?.storage_path && ["video", "audio", "image"].includes(data.kind)) {
        const { data: fp } = await db().from("film_projects").select("user_id,title").eq("id", data.project_id).maybeSingle();
        if (fp && fp.user_id === p.user_id) src = { bucket: "film", path: data.storage_path, kind: data.kind as AssetKind, name: String(it.name ?? `${fp.title} · ${data.ref_key}`) };
      }
    }
    if (!src) continue;
    const kind = src.kind;
    rows.push({
      project_id: p.id,
      user_id: p.user_id,
      kind,
      bucket: src.bucket,
      path: src.path,
      name: src.name.slice(0, 200),
      mime: kind === "video" ? "video/mp4" : kind === "audio" ? "audio/mpeg" : "image/png",
      duration_ms: kind === "image" ? null : clampInt(it.durationMs, 24 * 3600_000),
      width: kind === "audio" ? null : clampInt(it.width, 16384),
      height: kind === "audio" ? null : clampInt(it.height, 16384),
      origin: it.source,
      status: "ready",
      // a JAWAD AI result keeps its job, so a piece of it can be made again («التعديل الذكي»)
      meta: { hasAudio: kind !== "image" && it.hasAudio !== false, sourceId: it.id, ...(src.jobId ? { jobId: src.jobId } : {}) },
    });
  }
  if (!rows.length) throw new UserError("ما لقينا هذي الأعمال.", 404);
  const { data, error } = await db().from("editor_assets").insert(rows).select("*");
  if (error) throw new UserError(NOT_READY, 503);
  const added = (data ?? []) as AssetRow[];
  const urls = await sign(added);
  return added.map((r) => view(r, urls.get(r.id) ?? null));
}

// ---------- export and the 3-day deletion ----------

/** A one-time URL to keep a copy of the exported video with the project (it is deleted with the rest). */
export async function signExportUpload(p: EditorProject, b: { bytes?: unknown } = {}) {
  stillOpen(p);
  const path = `${p.user_id}/${p.id}/export.mp4`;
  await storage.from(EDITOR_BUCKET).remove([path]);
  const bytes = Number(b.bytes);
  if (Number.isFinite(bytes) && bytes > PARTS_FROM && bytes <= MAX_FILE_BYTES) {
    return { multipart: { uploadId: await storage.from(EDITOR_BUCKET).createMultipart(path, "video/mp4"), partSize: partSize(bytes) } };
  }
  const signed = await storage.from(EDITOR_BUCKET).createSignedUploadUrl(path);
  if (signed.error) throw signed.error;
  return { signedUrl: signed.data.signedUrl };
}

/** The export finished (downloaded in the browser): from now the project's files are deleted after 3 days. */
export async function markExported(p: EditorProject, b: { saved?: unknown }) {
  stillOpen(p);
  const now = Date.now();
  const path = `${p.user_id}/${p.id}/export.mp4`;
  const saved = b.saved === true && (await storedSize(EDITOR_BUCKET, path)) != null;
  const patch = { exported_at: new Date(now).toISOString(), purge_at: new Date(now + PURGE_AFTER_MS).toISOString(), export_path: saved ? path : null };
  await db().from("editor_projects").update(patch).eq("id", p.id);
  return { purgeAt: patch.purge_at, exportUrl: saved ? ((await storage.from(EDITOR_BUCKET).createSignedUrl(path, LINK_SECONDS, { download: `${p.title || "montage"}.mp4` })).data?.signedUrl ?? null) : null };
}

export async function exportLink(p: EditorProject) {
  if (!p.export_path || p.purged_at) return null;
  return (await storage.from(EDITOR_BUCKET).createSignedUrl(p.export_path, LINK_SECONDS, { download: `${p.title || "montage"}.mp4` })).data?.signedUrl ?? null;
}

/** Deletes a project and everything it uploaded. */
export async function deleteProject(p: EditorProject) {
  await removeFiles(p);
  await db().from("editor_projects").delete().eq("id", p.id);
}

async function removeFiles(p: EditorProject) {
  const own = (await assetRows(p.id)).filter((r) => r.bucket === EDITOR_BUCKET).map((r) => r.path);
  // and any sound pieces left from captions (normally deleted right after use)
  const { data: tmp } = await storage.from(EDITOR_BUCKET).list(`${p.user_id}/${p.id}/tmp`, { limit: 1000 });
  const paths = [...own, `${p.user_id}/${p.id}/export.mp4`, ...(tmp ?? []).map((f) => `${p.user_id}/${p.id}/tmp/${f.name}`)];
  for (let i = 0; i < paths.length; i += 100) await storage.from(EDITOR_BUCKET).remove(paths.slice(i, i + 100));
}

/**
 * The cron's part: projects 3 days after export lose their files (uploads and the exported copy); the timeline and
 * the record stay so the page can say what happened. Uploads never confirmed within a day are dropped too.
 */
export async function sweepEditor() {
  const now = new Date().toISOString();
  const { data, error } = await db().from("editor_projects").select("*").lt("purge_at", now).is("purged_at", null).limit(50);
  if (error) return { purged: 0, stale: 0 };
  for (const p of (data ?? []) as EditorProject[]) {
    await removeFiles(p);
    await db().from("editor_assets").update({ status: "missing" }).eq("project_id", p.id);
    await db().from("editor_projects").update({ purged_at: now, export_path: null }).eq("id", p.id);
  }
  // A very large file can take more than a day to send, so unfinished uploads are given a week (as R2 keeps their parts)
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: stale } = await db().from("editor_assets").select("id,bucket,path").eq("status", "pending").lt("created_at", weekAgo).limit(200);
  const list = (stale ?? []) as Pick<AssetRow, "id" | "bucket" | "path">[];
  if (list.length) {
    await storage.from(EDITOR_BUCKET).remove(list.filter((r) => r.bucket === EDITOR_BUCKET).map((r) => r.path));
    await db().from("editor_assets").delete().in("id", list.map((r) => r.id));
  }
  return { purged: (data ?? []).length, stale: list.length };
}

/** Film maker videos an unexported (or not yet deleted) edit still uses: the film's 7-day clean-up skips them. */
export async function filmPathsInUse(paths: string[]) {
  if (!paths.length) return new Set<string>();
  const { data, error } = await db().from("editor_assets").select("path,project_id").eq("bucket", FILM_BUCKET).in("path", paths);
  if (error || !data?.length) return new Set<string>();
  const { data: live } = await db().from("editor_projects").select("id").in("id", [...new Set(data.map((d) => d.project_id))]).is("purged_at", null);
  const ok = new Set((live ?? []).map((x) => x.id));
  return new Set(data.filter((d) => ok.has(d.project_id)).map((d) => d.path as string));
}
