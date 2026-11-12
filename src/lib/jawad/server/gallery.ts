// «معرض الناس» and the permanent share link (config/jawad/gallery.ts): publishing and sharing one's own result, the
// owner's review, the public lists, and the one file a public work may show. Server only. The table is
// 0112_jawad_gallery.sql, run by hand: until then every reader answers `ready: false` and every writer says so.
//
// Files: a result stays private in the «jawad» bucket; a public work's address (/api/jawad/gallery/<id>/media) signs a
// short link to THAT row's own output on each view, after checking it is still public — so a link keeps working, stops
// the moment its owner turns it off or the owner hides it, and can never reach another file.

import { createAdminClient } from "@/lib/supabase/admin";
import { UserError } from "@/lib/api";
import { isAdmin } from "@config/site";
import { generatorById } from "@config/jawad/generators";
import {
  cleanTitle,
  isGalleryKind,
  isShareSlug,
  mediaUrlOf,
  newShareSlug,
  PAGE_SIZE,
  publishStatus,
  reviewPatch,
  shareUrlOf,
  galleryFromJob,
  type GalleryCard,
  type GalleryKind,
  type GalleryStatus,
  type ReviewAction,
} from "@config/jawad/gallery";
import { isUuid } from "./uploads";
import { JAWAD_BUCKET, loadRuntime } from "./runtime";
import { storage } from "@/lib/storage";

const db = () => createAdminClient();
const TABLE = "jawad_gallery";

export const GALLERY_NOT_READY = "معرض الناس يحتاج تشغيل ملف قاعدة البيانات 0112 أولًا.";
/** the table (0112) is not there yet */
export const galleryMissing = (e: unknown) => ["42P01", "PGRST205", "PGRST204", "42703"].includes((e as { code?: string } | null)?.code ?? "");
const fail = (e: unknown): never => {
  if (galleryMissing(e)) throw new UserError(GALLERY_NOT_READY, 503, { notReady: true });
  throw e;
};

export interface GalleryRow {
  id: string;
  user_id: string;
  job_id: string;
  output_id: string;
  kind: GalleryKind;
  title: string;
  prompt: string;
  generator_id: string;
  settings: Record<string, string | number | boolean>;
  style_id: string;
  ref_style: "none" | "frames" | "references";
  ref_names: { name: string; kind: "image" | "video" | "audio" }[];
  width: number | null;
  height: number | null;
  status: GalleryStatus;
  featured: boolean;
  submitted_at: string | null;
  reviewed_at: string | null;
  share_slug: string | null;
  share_on: boolean;
  created_at: string;
}

/** What the work's owner sees about one of their results. */
export interface MyGalleryState {
  id: string;
  status: GalleryStatus;
  featured: boolean;
  title: string;
  shareUrl: string | null;
}
const mine = (r: GalleryRow): MyGalleryState => ({ id: r.id, status: r.status, featured: r.featured, title: r.title, shareUrl: r.share_on && r.share_slug && r.status !== "hidden" ? shareUrlOf(r.share_slug) : null });

/** A row is shown to everyone: in the gallery (approved), or by its share link while it is on (and not hidden). */
export const isPublic = (r: Pick<GalleryRow, "status" | "share_on">) => r.status === "approved" || (r.share_on && r.status !== "hidden");

async function cardsOf(rows: GalleryRow[]): Promise<GalleryCard[]> {
  const rt = await loadRuntime().catch(() => null);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    prompt: r.prompt,
    generatorId: r.generator_id,
    generatorName: rt?.generators.find((g) => g.id === r.generator_id)?.name ?? generatorById(r.generator_id)?.name ?? (r.generator_id === "claude-code" ? "حيدرا ماكس" : r.generator_id),
    settings: r.settings ?? {},
    styleId: r.style_id ?? "",
    refStyle: r.ref_style ?? "none",
    refNames: Array.isArray(r.ref_names) ? r.ref_names : [],
    featured: r.featured,
    width: r.width,
    height: r.height,
    mediaUrl: mediaUrlOf(r.id),
    at: r.reviewed_at ?? r.created_at,
  }));
}

// ───────────────────────── the work's owner ─────────────────────────

/** The person's own finished picture or video and its job — else «ما لقينا» (another person's result looks absent). */
async function ownResult(userId: string, outputId: unknown) {
  if (!isUuid(outputId)) throw new UserError("طلب غير صحيح.", 400);
  const { data: out } = await db().from("jawad_outputs").select("id,job_id,user_id,kind,width,height").eq("id", outputId).eq("user_id", userId).maybeSingle();
  if (!out || out.user_id !== userId) throw new UserError("ما لقينا هذا العمل.", 404);
  if (!isGalleryKind(out.kind)) throw new UserError("المعرض والرابط الدائم للصور والفيديو بس.", 400);
  const { data: job } = await db().from("jawad_jobs").select("id,user_id,status,generator_id,prompt,inputs,refs,idempotency_key").eq("id", out.job_id).eq("user_id", userId).maybeSingle();
  if (!job || job.user_id !== userId) throw new UserError("ما لقينا هذا العمل.", 404);
  if (job.status !== "succeeded") throw new UserError("انشر العمل بعد ما يكتمل.", 400);
  return { out, job };
}

async function rowOfOutput(outputId: string): Promise<GalleryRow | null> {
  const { data, error } = await db().from(TABLE).select("*").eq("output_id", outputId).maybeSingle();
  if (error) fail(error);
  return (data as GalleryRow | null) ?? null;
}

/** The fields copied from the job (a cartoon job's prompt is the site owner's alone: never copied). */
function copyOf(userId: string, out: { id: string; job_id: string; kind: GalleryKind; width: number | null; height: number | null }, job: { generator_id: string; prompt: string; inputs: unknown; refs: unknown; idempotency_key?: string | null }) {
  const use = galleryFromJob(job);
  const secret = String(job.idempotency_key ?? "").startsWith("cartoon_");
  return {
    user_id: userId,
    job_id: out.job_id,
    output_id: out.id,
    kind: out.kind,
    prompt: secret ? "" : use.prompt,
    generator_id: use.generatorId,
    settings: use.settings,
    style_id: use.styleId,
    ref_style: use.refStyle,
    ref_names: secret ? [] : use.refNames,
    width: out.width ?? null,
    height: out.height ?? null,
  };
}

/** The gallery state of some of the person's own results (`ready: false` before 0112). */
export async function myGallery(userId: string, outputIds: string[]): Promise<{ ready: boolean; items: Record<string, MyGalleryState> }> {
  const ids = outputIds.filter(isUuid).slice(0, 100);
  if (!ids.length) {
    const { error } = await db().from(TABLE).select("id").eq("user_id", userId).limit(1);
    return { ready: !(error && galleryMissing(error)), items: {} };
  }
  const { data, error } = await db().from(TABLE).select("*").eq("user_id", userId).in("output_id", ids);
  if (error) {
    if (galleryMissing(error)) return { ready: false, items: {} };
    throw error;
  }
  return { ready: true, items: Object.fromEntries(((data ?? []) as GalleryRow[]).filter((r) => r.user_id === userId).map((r) => [r.output_id, mine(r)])) };
}

/** «انشر في المعرض»: the person's own result goes to the owner's review (nothing is public before he approves). */
export async function publishToGallery(user: { id: string }, outputId: unknown, rawTitle: unknown): Promise<MyGalleryState> {
  const { out, job } = await ownResult(user.id, outputId);
  const title = cleanTitle(rawTitle);
  const existing = await rowOfOutput(out.id);
  if (existing && existing.user_id !== user.id) throw new UserError("ما لقينا هذا العمل.", 404);
  const status = publishStatus(existing, title);
  if (!status) throw new UserError("الإدارة أخفت هذا العمل، فما ينفع ينشر.", 403);
  const now = new Date().toISOString();
  const fields = { ...copyOf(user.id, out, job), title, status, ...(status === "pending" ? { submitted_at: now, featured: false } : {}) };
  const q = existing ? db().from(TABLE).update(fields).eq("id", existing.id).eq("user_id", user.id) : db().from(TABLE).insert(fields);
  const { data, error } = await q.select("*").single();
  if (error) fail(error);
  return mine(data as GalleryRow);
}

/** «اسحبه من المعرض»: back to private (a share link stays as it was). */
export async function withdrawFromGallery(user: { id: string }, outputId: unknown): Promise<MyGalleryState | null> {
  if (!isUuid(outputId)) throw new UserError("طلب غير صحيح.", 400);
  const existing = await rowOfOutput(outputId);
  if (!existing || existing.user_id !== user.id) throw new UserError("ما لقينا هذا العمل.", 404);
  if (existing.status === "hidden") return mine(existing);
  const { data, error } = await db().from(TABLE).update({ status: "none", featured: false }).eq("id", existing.id).eq("user_id", user.id).select("*").single();
  if (error) fail(error);
  return mine(data as GalleryRow);
}

/** «رابط دائم»: turns the person's own result's public link on (made once, the same address after) or off. */
export async function setShare(user: { id: string }, outputId: unknown, on: boolean, rawTitle?: unknown): Promise<MyGalleryState> {
  const existing = isUuid(outputId) ? await rowOfOutput(outputId) : null;
  if (existing && existing.user_id !== user.id) throw new UserError("ما لقينا هذا العمل.", 404);
  if (!on) {
    if (!existing) throw new UserError("ما لقينا هذا العمل.", 404);
    const { data, error } = await db().from(TABLE).update({ share_on: false }).eq("id", existing.id).eq("user_id", user.id).select("*").single();
    if (error) fail(error);
    return mine(data as GalleryRow);
  }
  const { out, job } = await ownResult(user.id, outputId);
  if (existing?.status === "hidden") throw new UserError("الإدارة أخفت هذا العمل، فما ينفع تشاركه.", 403);
  const now = new Date().toISOString();
  const title = rawTitle === undefined ? existing?.title ?? "" : cleanTitle(rawTitle);
  if (existing) {
    // an approved work keeps its title (a new one would show in the gallery without the owner's review)
    const patch = { share_on: true, shared_at: now, share_slug: existing.share_slug ?? newShareSlug(), ...(existing.status === "approved" ? {} : { title }) };
    const { data, error } = await db().from(TABLE).update(patch).eq("id", existing.id).eq("user_id", user.id).select("*").single();
    if (error) fail(error);
    return mine(data as GalleryRow);
  }
  const { data, error } = await db().from(TABLE).insert({ ...copyOf(user.id, out, job), title, status: "none", share_on: true, shared_at: now, share_slug: newShareSlug() }).select("*").single();
  if (error) fail(error);
  return mine(data as GalleryRow);
}

// ───────────────────────── everyone ─────────────────────────

/** The gallery: approved works, the featured first, then the newest. `ready: false` before 0112. */
export async function listGallery(opts: { kind?: GalleryKind | null; page?: number; limit?: number } = {}): Promise<{ ready: boolean; items: GalleryCard[]; more: boolean }> {
  const limit = Math.max(1, Math.min(PAGE_SIZE, opts.limit ?? PAGE_SIZE));
  const page = Math.max(0, Math.min(200, Math.floor(opts.page ?? 0)));
  let q = db().from(TABLE).select("*").eq("status", "approved");
  if (opts.kind) q = q.eq("kind", opts.kind);
  const { data, error } = await q.order("featured", { ascending: false }).order("reviewed_at", { ascending: false }).range(page * limit, page * limit + limit);
  if (error) {
    if (galleryMissing(error)) return { ready: false, items: [], more: false };
    throw error;
  }
  const rows = (data ?? []) as GalleryRow[];
  return { ready: true, items: await cardsOf(rows.slice(0, limit)), more: rows.length > limit };
}

/** One public work (in the gallery, or shared while its link is on), else null. */
export async function publicWork(id: unknown): Promise<GalleryCard | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await db().from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) {
    if (galleryMissing(error)) return null;
    throw error;
  }
  const r = data as GalleryRow | null;
  return r && isPublic(r) ? (await cardsOf([r]))[0] : null;
}

/** The work behind a share link while it is on, else null. */
export async function sharedWork(slug: unknown): Promise<GalleryCard | null> {
  if (!isShareSlug(slug)) return null;
  const { data, error } = await db().from(TABLE).select("*").eq("share_slug", slug).maybeSingle();
  if (error) {
    if (galleryMissing(error)) return null;
    throw error;
  }
  const r = data as GalleryRow | null;
  return r && r.share_on && r.status !== "hidden" ? (await cardsOf([r]))[0] : null;
}

/**
 * A short link to one work's own file: for everyone while the work is public; for its owner and the site's owners
 * always (their review list). Null = nothing to show.
 */
export async function mediaLink(id: unknown, viewerOf: () => Promise<{ id: string; email?: string | null } | null>): Promise<string | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await db().from(TABLE).select("id,user_id,output_id,status,share_on").eq("id", id).maybeSingle();
  if (error || !data) return null;
  const r = data as Pick<GalleryRow, "id" | "user_id" | "output_id" | "status" | "share_on">;
  if (!isPublic(r)) {
    const viewer = await viewerOf().catch(() => null);
    if (!viewer || (viewer.id !== r.user_id && !isAdmin(viewer.email))) return null;
  }
  // the row's own output, of the row's own person: never any other file
  const { data: out } = await db().from("jawad_outputs").select("storage_path,user_id").eq("id", r.output_id).eq("user_id", r.user_id).maybeSingle();
  if (!out?.storage_path) return null;
  const { data: link, error: e2 } = await storage.from(JAWAD_BUCKET).createSignedUrl(String(out.storage_path), 3600);
  return e2 ? null : link.signedUrl;
}

// ───────────────────────── the site's owner ─────────────────────────

export interface ReviewRow extends GalleryCard {
  status: GalleryStatus;
  userId: string;
  email: string | null;
  submittedAt: string | null;
  shareOn: boolean;
}

export type ReviewFilter = "pending" | "approved" | "rejected" | "hidden" | "shared";
export const REVIEW_FILTERS: { id: ReviewFilter; label: string }[] = [
  { id: "pending", label: "ينتظر" },
  { id: "approved", label: "منشور" },
  { id: "rejected", label: "مرفوض" },
  { id: "hidden", label: "مخفي" },
  { id: "shared", label: "روابط المشاركة" },
];

/** The owner's review list (the oldest waiting first; the others newest first). */
export async function reviewList(filter: ReviewFilter): Promise<{ ready: boolean; rows: ReviewRow[]; counts: Partial<Record<ReviewFilter, number>> }> {
  let q = db().from(TABLE).select("*");
  q = filter === "shared" ? q.eq("share_on", true).neq("status", "hidden") : q.eq("status", filter);
  const { data, error } = await q.order(filter === "pending" ? "submitted_at" : "updated_at", { ascending: filter === "pending" }).limit(120);
  if (error) {
    if (galleryMissing(error)) return { ready: false, rows: [], counts: {} };
    throw error;
  }
  const rows = (data ?? []) as GalleryRow[];
  const cards = await cardsOf(rows);
  const emails = new Map<string, string | null>();
  await Promise.all(
    [...new Set(rows.map((r) => r.user_id))].slice(0, 60).map(async (uid) => {
      const { data: u } = await db().auth.admin.getUserById(uid).catch(() => ({ data: null }));
      emails.set(uid, u?.user?.email ?? null);
    }),
  );
  const { count } = await db().from(TABLE).select("id", { count: "exact", head: true }).eq("status", "pending");
  return {
    ready: true,
    rows: rows.map((r, i) => ({ ...cards[i], status: r.status, userId: r.user_id, email: emails.get(r.user_id) ?? null, submittedAt: r.submitted_at, shareOn: r.share_on })),
    counts: { pending: count ?? 0 },
  };
}

/** One of the owner's buttons on one work. */
export async function reviewWork(by: string, id: unknown, action: ReviewAction): Promise<{ status: GalleryStatus; featured: boolean }> {
  if (!isUuid(id)) throw new UserError("طلب غير صحيح.", 400);
  const { data, error } = await db().from(TABLE).select("id,status").eq("id", id).maybeSingle();
  if (error) fail(error);
  if (!data) throw new UserError("ما لقينا هذا العمل.", 404);
  const patch = reviewPatch(action, data.status as GalleryStatus, new Date().toISOString(), by);
  if (!patch) throw new UserError("هذا الزر ما يناسب حالة العمل الحين.", 400);
  const { data: row, error: e2 } = await db().from(TABLE).update(patch).eq("id", id).select("status,featured").single();
  if (e2) fail(e2);
  return row as { status: GalleryStatus; featured: boolean };
}
