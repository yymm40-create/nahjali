// «رابط مراجعة للعميل» in «حيدرة كت» — server only. The project's owner shares a version (an uploaded copy of an export:
// the site's checked upload flow, jawad_uploads), turns the link on or off, sets its end and «يقدر ينزّل», replies and
// resolves; the public page (no sign-in) may only read an active link and comment on it, cleaned and limited
// (review.ts). Until migration 0117 runs every call answers REVIEW_NOT_READY (503) — or `ready: false` for a read.

import { createHash } from "crypto";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import { JAWAD_BUCKET } from "@/lib/jawad/server/runtime";
import { confirmUpload, deleteUpload, signUpload, uploadFromBuffer } from "@/lib/jawad/server/uploads";
import { duration, readTimeline, type Timeline } from "./model";
import {
  anchorsFit,
  anchorsOf,
  canManageReview,
  cleanAt,
  cleanBody,
  cleanName,
  cleanShape,
  EXPIRED_VIDEO_DAYS,
  expiryFrom,
  isExpiryChoice,
  isReviewSlug,
  linkState,
  looksLikeBot,
  mapTime,
  newReviewSlug,
  nextVersionN,
  publicCommentBlock,
  readAnchors,
  REVIEW_LIMITS,
  REVIEW_NOT_READY,
  REVIEW_OWNER_ONLY,
  reviewNote,
  reviewPath,
  videosToPrune,
  type Anchor,
  type LinkState,
  type ReviewComment,
  type ReviewVersion,
  type Shape,
} from "./review";

const db = () => createAdminClient();
const LINK_SECONDS = 6 * 3600;
const OWNER_NAME = "صاحب الفيديو";

interface ReviewRow {
  id: string;
  project_id: string;
  user_id: string;
  slug: string;
  title: string;
  active: boolean;
  allow_download: boolean;
  expires_at: string | null;
  seen_at: string;
  videos_purged_at: string | null;
  created_at: string;
}
interface VersionRow {
  id: string;
  review_id: string;
  n: number;
  upload_id: string | null;
  storage_path: string | null;
  duration_ms: number;
  width: number | null;
  height: number | null;
  project_version: number | null;
  anchors: unknown;
  created_at: string;
}
interface CommentRow {
  id: number;
  review_id: string;
  version_id: string;
  parent_id: number | null;
  kind: "comment" | "approve";
  author: string;
  by_owner: boolean;
  body: string;
  at_ms: number | null;
  shape: Shape | null;
  resolved_at: string | null;
  ip_hash: string | null;
  created_at: string;
}

/** The project as this module needs it. */
export interface ReviewProject {
  id: string;
  user_id: string;
  title: string;
  version: number;
  timeline: unknown;
  export_path: string | null;
  purged_at: string | null;
}

/** What the editor's «تعليقات المراجعة» shows. */
export interface OwnerReview {
  ready: boolean;
  review: null | {
    slug: string;
    path: string;
    active: boolean;
    allowDownload: boolean;
    expiresAt: string | null;
    state: LinkState;
    seenAt: string;
  };
  versions: (ReviewVersion & { anchors: Anchor[]; fit: boolean })[];
  comments: ReviewComment[];
  /** the client's comments after the owner's last look */
  fresh: number;
  /** a copy of the last export is kept with the project (it can be shared without uploading) */
  hasExport: boolean;
}

const notReady = () => new UserError(REVIEW_NOT_READY, 503);

function owner(p: ReviewProject, userId: string) {
  if (!canManageReview(p, userId)) throw new UserError(REVIEW_OWNER_ONLY, 403);
  if (p.purged_at) throw new UserError("انحذفت ملفات هذا المشروع.", 410);
}

async function reviewOf(projectId: string): Promise<ReviewRow | null> {
  const { data, error } = await db().from("editor_reviews").select("*").eq("project_id", projectId).maybeSingle();
  if (error) throw notReady();
  return (data as ReviewRow | null) ?? null;
}

async function versionsOf(reviewId: string): Promise<VersionRow[]> {
  const { data, error } = await db().from("editor_review_versions").select("*").eq("review_id", reviewId).order("n", { ascending: true });
  if (error) throw notReady();
  return (data ?? []) as VersionRow[];
}

async function commentsOf(reviewId: string): Promise<CommentRow[]> {
  const { data, error } = await db().from("editor_review_comments").select("*").eq("review_id", reviewId).order("created_at", { ascending: true }).limit(3000);
  if (error) throw notReady();
  return (data ?? []) as CommentRow[];
}

const commentView = (c: CommentRow): ReviewComment => ({
  id: Number(c.id),
  versionId: c.version_id,
  parentId: c.parent_id == null ? null : Number(c.parent_id),
  kind: c.kind,
  author: c.author,
  byOwner: c.by_owner,
  body: c.body,
  at: c.at_ms,
  shape: cleanShape(c.shape),
  resolved: !!c.resolved_at,
  createdAt: c.created_at,
});

async function versionViews(rows: VersionRow[], title: string, download: boolean): Promise<ReviewVersion[]> {
  const live = rows.filter((v) => v.storage_path);
  const signed = live.length ? ((await storage.from(JAWAD_BUCKET).createSignedUrls(live.map((v) => v.storage_path!), LINK_SECONDS)).data ?? []) : [];
  const urls = new Map(live.map((v, i) => [v.id, signed[i]?.signedUrl ?? null]));
  const downloads = new Map<string, string | null>();
  if (download) {
    for (const v of live) {
      const name = `${(title || "مونتاج").slice(0, 60)} - نسخة ${v.n}.mp4`;
      downloads.set(v.id, (await storage.from(JAWAD_BUCKET).createSignedUrl(v.storage_path!, LINK_SECONDS, { download: name })).data?.signedUrl ?? null);
    }
  }
  return rows.map((v) => ({
    id: v.id,
    n: v.n,
    durationMs: v.duration_ms,
    width: v.width,
    height: v.height,
    url: urls.get(v.id) ?? null,
    downloadUrl: downloads.get(v.id) ?? null,
    createdAt: v.created_at,
  }));
}

// ───────── the owner (the editor) ─────────

export async function ownerReview(p: ReviewProject, userId: string, now = Date.now()): Promise<OwnerReview> {
  owner(p, userId);
  const hasExport = !!p.export_path;
  let r: ReviewRow | null;
  try {
    r = await reviewOf(p.id);
  } catch {
    return { ready: false, review: null, versions: [], comments: [], fresh: 0, hasExport };
  }
  if (!r) return { ready: true, review: null, versions: [], comments: [], fresh: 0, hasExport };
  const [vs, cs] = await Promise.all([versionsOf(r.id), commentsOf(r.id)]);
  const tlMs = duration(readTimeline(p.timeline));
  const views = await versionViews(vs, r.title, false);
  const seen = Date.parse(r.seen_at);
  return {
    ready: true,
    review: { slug: r.slug, path: reviewPath(r.slug), active: r.active, allowDownload: r.allow_download, expiresAt: r.expires_at, state: linkState(r, now), seenAt: r.seen_at },
    versions: views.map((v, i) => {
      const anchors = readAnchors(vs[i].anchors);
      return { ...v, anchors, fit: anchors.length > 0 && anchorsFit(tlMs, v.durationMs) };
    }),
    comments: cs.map(commentView),
    fresh: cs.filter((c) => !c.by_owner && Date.parse(c.created_at) > seen).length,
    hasExport,
  };
}

/** Step 1 of an upload for the review: the site's own signed upload (MP4/MOV, 200 MB), only once 0117 is in. */
export async function signReviewUpload(p: ReviewProject, userId: string, b: { mime?: unknown; bytes?: unknown; fileName?: unknown }) {
  owner(p, userId);
  await reviewOf(p.id);
  if (Number(b.bytes) > REVIEW_LIMITS.videoBytes) throw new UserError("الفيديو أكبر من ٢٠٠ ميجا؛ صدّره بدقة أو جودة أقل للمراجعة (720p تكفي).", 400);
  return signUpload(userId, { kind: "video", mime: b.mime, bytes: b.bytes, fileName: b.fileName });
}

/**
 * Shares a version: the uploaded copy (`uploadId`, checked again here), or the copy of the last export kept with the
 * project (`fromExport`). The first share makes the link; every next one is «نسخة N» on the same link. The project's clips
 * at this moment ride with it (to carry the comments' times later) when the video is as long as the project.
 */
export async function shareVersion(p: ReviewProject, userId: string, b: { uploadId?: unknown; fromExport?: unknown; expiry?: unknown; allowDownload?: unknown }, now = Date.now()) {
  owner(p, userId);
  let r = await reviewOf(p.id);
  let upload: { id: string; storage_path: string; duration_ms: number | null; width: number | null; height: number | null; status: string; kind: string; error: string | null };
  if (b.fromExport === true) {
    if (!p.export_path) throw new UserError("ما فيه تصدير محفوظ مع المشروع؛ صدّر وشارك، أو ارفع الفيديو من جهازك.", 400);
    // its size from the listing first: a big export is refused before it is read
    const dir = p.export_path.slice(0, p.export_path.lastIndexOf("/"));
    const base = p.export_path.slice(p.export_path.lastIndexOf("/") + 1);
    const { data: listed } = await storage.from("editor").list(dir, { search: base, limit: 5 });
    const size = Number(((listed ?? []).find((f) => f.name === base)?.metadata as { size?: number } | null)?.size ?? 0);
    if (size > REVIEW_LIMITS.videoBytes) throw new UserError("آخر تصدير أكبر من ٢٠٠ ميجا؛ صدّره بدقة أقل للمراجعة (720p تكفي).", 400);
    const { data: blob, error } = await storage.from("editor").download(p.export_path);
    if (error || !blob) throw new UserError("ما قدرنا نقرأ آخر تصدير؛ صدّر مرة ثانية.", 409);
    if (blob.size > REVIEW_LIMITS.videoBytes) throw new UserError("آخر تصدير أكبر من ٢٠٠ ميجا؛ صدّره بدقة أقل للمراجعة (720p تكفي).", 400);
    upload = await uploadFromBuffer(userId, new Uint8Array(await blob.arrayBuffer()), `${(p.title || "مونتاج").slice(0, 80)}.mp4`);
  } else {
    upload = await confirmUpload(userId, b.uploadId);
  }
  if (upload.status !== "ready") throw new UserError(upload.error ?? "الملف ما نجح فحصه.", 400);
  if (upload.kind !== "video") throw new UserError("المراجعة تحتاج فيديو.", 400);

  if (!r) {
    const patch = {
      project_id: p.id,
      user_id: userId,
      slug: newReviewSlug(),
      title: (p.title || "مونتاج").slice(0, 120),
      active: true,
      allow_download: b.allowDownload === true,
      expires_at: isExpiryChoice(b.expiry) ? expiryFrom(b.expiry, now) : null,
      seen_at: new Date(now).toISOString(),
    };
    const { data, error } = await db().from("editor_reviews").insert(patch).select("*").single();
    if (error || !data) throw notReady();
    r = data as ReviewRow;
  }
  const vs = await versionsOf(r.id);
  if (vs.length >= REVIEW_LIMITS.versions) throw new UserError(`وصلت ${REVIEW_LIMITS.versions} نسخة على هذا الرابط؛ احذف الرابط وابدأ رابط جديد.`, 429);
  const tl = readTimeline(p.timeline);
  const fit = anchorsFit(duration(tl), Number(upload.duration_ms ?? 0));
  const row = {
    review_id: r.id,
    n: nextVersionN(vs.map((v) => v.n)),
    upload_id: upload.id,
    storage_path: upload.storage_path,
    duration_ms: Number(upload.duration_ms ?? 0),
    width: upload.width,
    height: upload.height,
    project_version: p.version,
    anchors: fit ? anchorsOf(tl) : [],
  };
  const { error } = await db().from("editor_review_versions").insert(row);
  if (error) throw notReady();
  await db().from("editor_reviews").update({ updated_at: new Date(now).toISOString(), title: (p.title || r.title).slice(0, 120) }).eq("id", r.id);
  await pruneVideos(userId, [...vs, { ...row, id: "", created_at: "" } as VersionRow]);
  return { n: row.n, fit, path: reviewPath(r.slug) };
}

/** Older versions beyond the newest five lose their video (their comments stay). */
async function pruneVideos(userId: string, vs: VersionRow[]) {
  for (const v of videosToPrune(vs)) {
    if (!v.id) continue;
    if (v.upload_id) await deleteUpload(userId, v.upload_id).catch(() => undefined);
    else if (v.storage_path) await storage.from(JAWAD_BUCKET).remove([v.storage_path]);
    await db().from("editor_review_versions").update({ storage_path: null, upload_id: null }).eq("id", v.id);
  }
}

export async function updateReview(p: ReviewProject, userId: string, b: { active?: unknown; allowDownload?: unknown; expiry?: unknown }, now = Date.now()) {
  owner(p, userId);
  const r = await reviewOf(p.id);
  if (!r) throw new UserError("ما فيه رابط مراجعة لهذا المشروع بعد.", 404);
  const patch: Record<string, unknown> = { updated_at: new Date(now).toISOString() };
  if (typeof b.active === "boolean") patch.active = b.active;
  if (typeof b.allowDownload === "boolean") patch.allow_download = b.allowDownload;
  if (isExpiryChoice(b.expiry)) patch.expires_at = expiryFrom(b.expiry, now);
  await db().from("editor_reviews").update(patch).eq("id", r.id);
}

async function ownComment(r: ReviewRow, id: unknown): Promise<CommentRow> {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw new UserError("ما لقينا التعليق.", 404);
  const { data } = await db().from("editor_review_comments").select("*").eq("id", n).eq("review_id", r.id).maybeSingle();
  if (!data) throw new UserError("ما لقينا التعليق.", 404);
  return data as CommentRow;
}

/** The owner's reply under a comment (shown to the client as «صاحب الفيديو»). */
export async function ownerReply(p: ReviewProject, userId: string, b: { parentId?: unknown; body?: unknown }) {
  owner(p, userId);
  const r = await reviewOf(p.id);
  if (!r) throw new UserError("ما فيه رابط مراجعة لهذا المشروع بعد.", 404);
  const parent = await ownComment(r, b.parentId);
  const body = cleanBody(b.body);
  if (!body.ok) throw new UserError(body.error, 400);
  const { error } = await db()
    .from("editor_review_comments")
    .insert({ review_id: r.id, version_id: parent.version_id, parent_id: parent.parent_id ?? parent.id, kind: "comment", author: OWNER_NAME, by_owner: true, body: body.text, at_ms: null });
  if (error) throw notReady();
}

export async function resolveComment(p: ReviewProject, userId: string, b: { id?: unknown; resolved?: unknown }, now = Date.now()) {
  owner(p, userId);
  const r = await reviewOf(p.id);
  if (!r) throw new UserError("ما فيه رابط مراجعة لهذا المشروع بعد.", 404);
  const c = await ownComment(r, b.id);
  await db().from("editor_review_comments").update({ resolved_at: b.resolved === false ? null : new Date(now).toISOString() }).eq("id", c.id);
}

/** The owner looked at the comments: the «جديد» badge starts again from now. */
export async function markSeen(p: ReviewProject, userId: string, now = Date.now()) {
  owner(p, userId);
  const r = await reviewOf(p.id);
  if (r) await db().from("editor_reviews").update({ seen_at: new Date(now).toISOString() }).eq("id", r.id);
}

/** Deletes the link, its versions' videos and every comment. */
export async function deleteReview(p: ReviewProject, userId: string) {
  owner(p, userId);
  const r = await reviewOf(p.id);
  if (!r) return;
  await removeVideos(r.user_id, await versionsOf(r.id));
  await db().from("editor_reviews").delete().eq("id", r.id);
}

async function removeVideos(userId: string, vs: VersionRow[]) {
  for (const v of vs) {
    if (v.upload_id) await deleteUpload(userId, v.upload_id).catch(() => undefined);
    else if (v.storage_path) await storage.from(JAWAD_BUCKET).remove([v.storage_path]).catch(() => undefined);
  }
}

/** A project being deleted: its review's videos go with it (the rows go by the database's cascade). */
export async function removeReviewFiles(projectId: string) {
  const { data, error } = await db().from("editor_reviews").select("id,user_id").eq("project_id", projectId).maybeSingle();
  if (error || !data) return;
  await removeVideos(String(data.user_id), await versionsOf(String(data.id)).catch(() => []));
}

/** The daily clean-up: links that ended more than 30 days ago lose their videos (the comments stay). */
export async function sweepReviews(now = Date.now()) {
  const before = new Date(now - EXPIRED_VIDEO_DAYS * 86_400_000).toISOString();
  const { data, error } = await db().from("editor_reviews").select("id,user_id").lt("expires_at", before).is("videos_purged_at", null).limit(50);
  if (error || !data?.length) return { purged: 0 };
  for (const r of data) {
    const vs = await versionsOf(String(r.id)).catch(() => []);
    await removeVideos(String(r.user_id), vs);
    await db().from("editor_review_versions").update({ storage_path: null, upload_id: null }).eq("review_id", r.id);
    await db().from("editor_reviews").update({ videos_purged_at: new Date(now).toISOString() }).eq("id", r.id);
  }
  return { purged: data.length };
}

/** حيدرا ماكس's note: the open comments of the project's review, each on the timeline as it is now (or ""). */
export async function reviewNoteFor(projectId: string, tl: Timeline): Promise<string> {
  try {
    const r = await reviewOf(projectId);
    if (!r) return "";
    const [vs, cs] = await Promise.all([versionsOf(r.id), commentsOf(r.id)]);
    const byId = new Map(vs.map((v) => [v.id, v]));
    const open = cs.filter((c) => c.kind === "comment" && !c.parent_id && !c.by_owner && !c.resolved_at && byId.has(c.version_id));
    return reviewNote(
      open.map((c) => {
        const v = byId.get(c.version_id)!;
        return {
          n: v.n,
          author: c.author,
          body: c.body,
          at: c.at_ms == null ? null : mapTime(readAnchors(v.anchors), c.at_ms, tl),
          shape: cleanShape(c.shape),
          replies: cs.filter((x) => x.parent_id === c.id).map((x) => `${x.by_owner ? "owner" : x.author}: ${x.body}`),
        };
      }),
    );
  } catch {
    return "";
  }
}

// ───────── the public page (no sign-in) ─────────

export interface PublicReview {
  state: LinkState;
  title: string;
  allowDownload: boolean;
  versions: ReviewVersion[];
  comments: ReviewComment[];
}

async function bySlug(slug: unknown): Promise<ReviewRow | null> {
  if (!isReviewSlug(slug)) return null;
  const { data, error } = await db().from("editor_reviews").select("*").eq("slug", slug).maybeSingle();
  if (error) return null;
  return (data as ReviewRow | null) ?? null;
}

/** The page's state; an off or ended link shows only that (no video, no comments). Null: no such link. */
export async function publicReview(slug: unknown, now = Date.now()): Promise<PublicReview | null> {
  const r = await bySlug(slug);
  if (!r) return null;
  const state = linkState(r, now);
  if (state !== "on") return { state, title: r.title, allowDownload: false, versions: [], comments: [] };
  const [vs, cs] = await Promise.all([versionsOf(r.id), commentsOf(r.id)]);
  return { state, title: r.title, allowDownload: r.allow_download, versions: await versionViews(vs, r.title, r.allow_download), comments: cs.map(commentView) };
}

/** A one-way hash of the sender's address (salted with a server secret): the hourly limit, never the address kept. */
export const addressHash = (ip: string) => createHash("sha256").update(`${process.env.SUPABASE_SERVICE_ROLE_KEY ?? "jawad"}:review:${ip}`).digest("hex").slice(0, 40);

/**
 * A comment (or «موافق» on the whole version) from the public page. Off, ended, unknown version or a deleted video:
 * refused. A bot (the hidden field filled, or sent before it could be typed) gets a quiet «ok» and nothing is kept.
 */
export async function publicPost(slug: unknown, b: Record<string, unknown>, ip: string, now = Date.now()): Promise<{ ok: true; kept: boolean }> {
  const r = await bySlug(slug);
  if (!r) throw new UserError("ما لقينا هذا الرابط.", 404);
  const vs = await versionsOf(r.id);
  const version = vs.find((v) => v.id === b.versionId) ?? null;
  const block = publicCommentBlock(r, version, now);
  if (block) throw new UserError(block, 403);
  const v = version!;
  const name = cleanName(b.name);
  if (!name) throw new UserError("اكتب اسمك (٤٠ حرف بالأكثر، بدون روابط).", 400);
  const approve = b.action === "approve";
  let body = "";
  if (!approve) {
    const c = cleanBody(b.body);
    if (!c.ok) throw new UserError(c.error, 400);
    body = c.text;
  }
  if (looksLikeBot(b)) return { ok: true, kept: false };

  const hash = addressHash(ip);
  const hourAgo = new Date(now - 3600_000).toISOString();
  const { count: recent } = await db().from("editor_review_comments").select("id", { count: "exact", head: true }).eq("review_id", r.id).eq("ip_hash", hash).gt("created_at", hourAgo);
  if ((recent ?? 0) >= REVIEW_LIMITS.perAddressHour) throw new UserError("تعليقات كثيرة في وقت قصير؛ جرّب بعد شوي.", 429);
  const { data: mine } = await db().from("editor_review_comments").select("*").eq("version_id", v.id).eq("ip_hash", hash).order("created_at", { ascending: false }).limit(20);
  const prev = (mine ?? []) as CommentRow[];
  if (approve) {
    // «موافق» once per name on a version
    if (prev.some((c) => c.kind === "approve" && c.author === name)) return { ok: true, kept: false };
  } else {
    // the same words sent again (a double press) are kept once
    if (prev.some((c) => c.kind === "comment" && c.body === body && Date.parse(c.created_at) > now - 10 * 60_000)) return { ok: true, kept: false };
    const { count } = await db().from("editor_review_comments").select("id", { count: "exact", head: true }).eq("version_id", v.id);
    if ((count ?? 0) >= REVIEW_LIMITS.perVersion) throw new UserError("وصلت هذي النسخة حدها من التعليقات.", 429);
  }
  let parentId: number | null = null;
  if (!approve && b.parentId != null) {
    const { data: parent } = await db().from("editor_review_comments").select("id,parent_id,version_id").eq("id", Number(b.parentId)).eq("review_id", r.id).maybeSingle();
    if (!parent || parent.version_id !== v.id) throw new UserError("ما لقينا التعليق اللي ترد عليه.", 404);
    parentId = Number(parent.parent_id ?? parent.id);
  }
  const { error } = await db()
    .from("editor_review_comments")
    .insert({
      review_id: r.id,
      version_id: v.id,
      parent_id: parentId,
      kind: approve ? "approve" : "comment",
      author: name,
      by_owner: false,
      body,
      at_ms: approve || parentId ? null : cleanAt(b.at, v.duration_ms),
      shape: approve || parentId ? null : cleanShape(b.shape),
      ip_hash: hash,
    });
  if (error) throw new UserError("ما انحفظ التعليق؛ جرّب مرة ثانية.", 500);
  return { ok: true, kept: true };
}
