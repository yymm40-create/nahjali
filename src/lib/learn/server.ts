// «مكان الدورات» — the database side: courses › days › lessons, who may watch, and the viewings. Server only.
// A viewer never receives a file or a link to one: `startSession` gives a key for that viewing alone, and `servePiece` opens a stored
// piece and locks it again with that key, no faster than watching needs. The video's own key (`content_key`) never leaves this file.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import { isAdmin } from "@config/site";
import type { Product } from "@config/course";
import { LEARN, cleanTitle, cleanUnlock, dayCapReached, hasAccess, manifestProblem, paceAllows, segmentPath, watermarkLabel, type Manifest, type SegmentInfo } from "@config/learn";
import { myCourse } from "@/lib/course/orders";
import { aad, fromB64, importKey, open, randomKey, seal, toB64 } from "./crypto";

const db = () => createAdminClient();
const bucket = () => storage.from(LEARN.bucket);

export interface LessonView {
  id: string;
  dayId: string;
  courseId: string;
  title: string;
  position: number;
  status: "draft" | "ready";
  duration: number;
}
export interface DayView {
  id: string;
  courseId: string;
  title: string;
  position: number;
  lessons: LessonView[];
}
export interface CourseView {
  id: string;
  title: string;
  summary: string;
  unlock: Product[];
  published: boolean;
  position: number;
  days: DayView[];
}

const LESSON_COLS = "id,day_id,course_id,title,position,status,duration_s";

/** The whole tree, in order. Lessons carry no key and no piece list. */
export async function loadTree(opts: { courseId?: string; onlyPublished?: boolean } = {}): Promise<CourseView[]> {
  let cq = db().from("learn_courses").select("*").order("position").order("created_at");
  if (opts.courseId) cq = cq.eq("id", opts.courseId);
  if (opts.onlyPublished) cq = cq.eq("published", true);
  const { data: courses, error } = await cq;
  if (error) throw error;
  if (!courses?.length) return [];
  const ids = courses.map((c) => c.id as string);
  const [days, lessons] = await Promise.all([
    db().from("learn_days").select("*").in("course_id", ids).order("position").order("created_at"),
    db().from("learn_lessons").select(LESSON_COLS).in("course_id", ids).order("position").order("created_at"),
  ]);
  if (days.error) throw days.error;
  if (lessons.error) throw lessons.error;
  return courses.map((c) => ({
    id: c.id as string,
    title: String(c.title),
    summary: String(c.summary ?? ""),
    unlock: cleanUnlock(c.unlock),
    published: !!c.published,
    position: Number(c.position),
    days: (days.data ?? [])
      .filter((d) => d.course_id === c.id)
      .map((d) => ({
        id: d.id as string,
        courseId: c.id as string,
        title: String(d.title),
        position: Number(d.position),
        lessons: (lessons.data ?? [])
          .filter((l) => l.day_id === d.id)
          .map((l) => ({ id: l.id as string, dayId: d.id as string, courseId: c.id as string, title: String(l.title), position: Number(l.position), status: l.status === "ready" ? ("ready" as const) : ("draft" as const), duration: Number(l.duration_s) || 0 })),
      })),
  }));
}

// —— who may watch ——

export async function accessFor(user: { id: string; email?: string | null }, courses: CourseView[]): Promise<Set<string>> {
  const admin = isAdmin(user.email);
  const out = new Set<string>();
  if (admin) {
    for (const c of courses) out.add(c.id);
    return out;
  }
  const email = (user.email ?? "").toLowerCase();
  const [mine, grants] = await Promise.all([
    myCourse(user.id).catch(() => null),
    email ? db().from("learn_grants").select("course_id").eq("email", email) : Promise.resolve({ data: [] as { course_id: string }[] }),
  ]);
  const granted = new Set((grants.data ?? []).map((g) => g.course_id as string));
  for (const c of courses) if (hasAccess({ admin: false, granted: granted.has(c.id), unlock: c.unlock, owned: mine?.products ?? [] })) out.add(c.id);
  return out;
}

/** The courses (published, with their lessons) this person may open. */
export async function myCourses(user: { id: string; email?: string | null }): Promise<CourseView[]> {
  const admin = isAdmin(user.email);
  const all = await loadTree({ onlyPublished: !admin });
  const ok = await accessFor(user, all);
  return all.filter((c) => ok.has(c.id));
}

// —— the owner's changes ——

const nextPosition = async (table: "learn_courses" | "learn_days" | "learn_lessons", col?: string, val?: string) => {
  let q = db().from(table).select("position").order("position", { ascending: false }).limit(1);
  if (col && val) q = q.eq(col, val);
  const { data } = await q;
  return (Number(data?.[0]?.position) || 0) + 1;
};

export async function saveCourse(b: { id?: string; title?: unknown; summary?: unknown; unlock?: unknown; published?: unknown }) {
  const title = cleanTitle(b.title);
  if (!b.id && !title) throw new UserError("اكتب اسم الدورة.", 400);
  const patch: Record<string, unknown> = {};
  if (b.title !== undefined) {
    if (!title) throw new UserError("اكتب اسم الدورة.", 400);
    patch.title = title;
  }
  if (b.summary !== undefined) patch.summary = cleanTitle(b.summary, LEARN.maxSummary);
  if (b.unlock !== undefined) patch.unlock = cleanUnlock(b.unlock);
  if (b.published !== undefined) patch.published = !!b.published;
  if (b.id) {
    const { error } = await db().from("learn_courses").update(patch).eq("id", b.id);
    if (error) throw error;
    return b.id;
  }
  const { data, error } = await db().from("learn_courses").insert({ ...patch, position: await nextPosition("learn_courses") }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function saveDay(b: { id?: string; courseId?: string; title?: unknown }) {
  const title = cleanTitle(b.title);
  if (!title) throw new UserError("اكتب اسم اليوم.", 400);
  if (b.id) {
    const { error } = await db().from("learn_days").update({ title }).eq("id", b.id);
    if (error) throw error;
    return b.id;
  }
  if (!b.courseId) throw new UserError("اختر الدورة.", 400);
  const { data, error } = await db().from("learn_days").insert({ course_id: b.courseId, title, position: await nextPosition("learn_days", "course_id", b.courseId) }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

/** A new lesson, empty (a draft): the owner's browser gets its key to lock the pieces with. */
export async function createLesson(dayId: string, titleRaw: unknown) {
  const title = cleanTitle(titleRaw);
  if (!title) throw new UserError("اكتب اسم الفيديو.", 400);
  const { data: day } = await db().from("learn_days").select("id,course_id").eq("id", dayId).maybeSingle();
  if (!day) throw new UserError("اليوم غير موجود.", 404);
  const key = toB64(randomKey());
  const { data, error } = await db()
    .from("learn_lessons")
    .insert({ day_id: dayId, course_id: day.course_id, title, content_key: key, position: await nextPosition("learn_lessons", "day_id", dayId) })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string, key };
}

export async function renameLesson(id: string, title: unknown) {
  const t = cleanTitle(title);
  if (!t) throw new UserError("اكتب اسم الفيديو.", 400);
  const { error } = await db().from("learn_lessons").update({ title: t }).eq("id", id);
  if (error) throw error;
}

/** A draft being (re)uploaded: its key again (the owner's browser needs it), and it goes back to draft. */
export async function restartLesson(id: string) {
  const { data } = await db().from("learn_lessons").select("content_key").eq("id", id).maybeSingle();
  if (!data) throw new UserError("الفيديو غير موجود.", 404);
  await db().from("learn_lessons").update({ status: "draft" }).eq("id", id);
  return { key: data.content_key as string };
}

/** Links the owner's browser PUTs the locked pieces to. */
export async function signPieces(lessonId: string, ns: unknown) {
  if (!Array.isArray(ns) || ns.length === 0 || ns.length > 60) throw new UserError("طلب غير صحيح.", 400);
  const { data } = await db().from("learn_lessons").select("id").eq("id", lessonId).maybeSingle();
  if (!data) throw new UserError("الفيديو غير موجود.", 404);
  const urls: Record<string, string> = {};
  for (const raw of ns) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 10_000) throw new UserError("رقم جزء غير صحيح.", 400);
    const r = await bucket().createSignedUploadUrl(segmentPath(lessonId, n));
    if (r.error || !r.data) throw new UserError("تعذّر تجهيز رابط الرفع.", 500);
    urls[String(n)] = r.data.signedUrl;
  }
  return urls;
}

/** The upload is done: check every piece is in the bucket at its size, then the lesson is ready. */
export async function finishLesson(lessonId: string, m: Manifest) {
  const problem = manifestProblem(m);
  if (problem) throw new UserError(problem, 400);
  const listed = await bucket().list(lessonId, { limit: 20_000 });
  if (listed.error) throw new UserError("تعذّر فحص الملفات المرفوعة.", 500);
  const size = new Map((listed.data ?? []).map((f) => [f.name, f.metadata?.size ?? -1]));
  if (size.get("0.bin") !== m.initBytes) throw new UserError("ملف البداية ما اكتمل رفعه، أعد المحاولة.", 409);
  for (const s of m.segments) if (size.get(`${s.n}.bin`) !== s.bytes) throw new UserError(`الجزء ${s.n} ما اكتمل رفعه، أعد المحاولة.`, 409);
  const segs: SegmentInfo[] = m.segments.map((s) => ({ n: s.n, start: Number(s.start.toFixed(3)), dur: Number(s.dur.toFixed(3)), bytes: s.bytes }));
  const { error } = await db().from("learn_lessons").update({ status: "ready", duration_s: m.duration, mime: m.mime, init_bytes: m.initBytes, segments: segs }).eq("id", lessonId);
  if (error) throw error;
  // pieces from an older, longer upload of the same lesson
  const keep = new Set(["0.bin", ...segs.map((s) => `${s.n}.bin`)]);
  const extra = (listed.data ?? []).filter((f) => !keep.has(f.name)).map((f) => `${lessonId}/${f.name}`);
  if (extra.length) await bucket().remove(extra).catch(() => null);
  forget(lessonId);
}

async function purge(lessonIds: string[]) {
  for (const id of lessonIds) {
    const listed = await bucket().list(id, { limit: 20_000 });
    const files = (listed.data ?? []).map((f) => `${id}/${f.name}`);
    if (files.length) await bucket().remove(files).catch(() => null);
    forget(id);
  }
}

export async function deleteLesson(id: string) {
  await purge([id]);
  const { error } = await db().from("learn_lessons").delete().eq("id", id);
  if (error) throw error;
}
export async function deleteDay(id: string) {
  const { data } = await db().from("learn_lessons").select("id").eq("day_id", id);
  await purge((data ?? []).map((l) => l.id as string));
  const { error } = await db().from("learn_days").delete().eq("id", id);
  if (error) throw error;
}
export async function deleteCourse(id: string) {
  const { data } = await db().from("learn_lessons").select("id").eq("course_id", id);
  await purge((data ?? []).map((l) => l.id as string));
  const { error } = await db().from("learn_courses").delete().eq("id", id);
  if (error) throw error;
}

/** Moves one up or down among its brothers (renumbers them all, so ties never matter). */
export async function move(kind: "course" | "day" | "lesson", id: string, dir: "up" | "down") {
  const table = kind === "course" ? "learn_courses" : kind === "day" ? "learn_days" : "learn_lessons";
  const parentCol = kind === "day" ? "course_id" : kind === "lesson" ? "day_id" : null;
  const { data: me } = await db().from(table).select("*").eq("id", id).maybeSingle();
  if (!me) throw new UserError("غير موجود.", 404);
  let q = db().from(table).select("id").order("position").order("created_at");
  if (parentCol) q = q.eq(parentCol, me[parentCol] as string);
  const { data } = await q;
  const ids = (data ?? []).map((r) => r.id as string);
  const i = ids.indexOf(id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await Promise.all(ids.map((x, k) => db().from(table).update({ position: k + 1 }).eq("id", x)));
}

export async function grant(courseId: string, emailRaw: unknown, by: string) {
  const email = String(emailRaw ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserError("اكتب إيميلًا صحيحًا.", 400);
  const { error } = await db().from("learn_grants").upsert({ course_id: courseId, email, granted_by: by }, { onConflict: "course_id,email" });
  if (error) throw error;
}
export async function ungrant(id: string) {
  await db().from("learn_grants").delete().eq("id", id);
}

export async function adminExtras() {
  const [grants, flags, sessions] = await Promise.all([
    db().from("learn_grants").select("id,course_id,email,created_at").order("created_at", { ascending: false }).limit(500),
    db().from("learn_flags").select("id,email,lesson_id,session_id,kind,detail,created_at").order("created_at", { ascending: false }).limit(60),
    db().from("learn_sessions").select("id,email,lesson_id,started_at,last_seen,served_s,pieces,revoked,revoked_reason,ip").order("started_at", { ascending: false }).limit(40),
  ]);
  return { grants: grants.data ?? [], flags: flags.data ?? [], sessions: sessions.data ?? [] };
}

export async function revokeSession(id: string, reason = "owner") {
  await db().from("learn_sessions").update({ revoked: true, revoked_reason: reason }).eq("id", id);
}

// —— a viewing ——

interface Cached {
  at: number;
  key: CryptoKey;
  segments: SegmentInfo[];
}
const cache = new Map<string, Cached>();
const forget = (lessonId: string) => cache.delete(lessonId);

async function lessonData(lessonId: string): Promise<Cached> {
  const hit = cache.get(lessonId);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit;
  const { data } = await db().from("learn_lessons").select("content_key,segments,status").eq("id", lessonId).maybeSingle();
  if (!data || data.status !== "ready") throw new UserError("الفيديو غير جاهز.", 404);
  const entry = { at: Date.now(), key: await importKey(fromB64(String(data.content_key))), segments: data.segments as SegmentInfo[] };
  if (cache.size > 200) cache.clear();
  cache.set(lessonId, entry);
  return entry;
}

export async function flag(f: { userId: string | null; email: string; lessonId: string | null; sessionId: string | null; kind: string; detail?: string }) {
  await db().from("learn_flags").insert({ user_id: f.userId, email: f.email, lesson_id: f.lessonId, session_id: f.sessionId, kind: f.kind, detail: (f.detail ?? "").slice(0, 400) });
}

export interface PlayStart {
  session: string;
  key: string;
  manifest: Manifest;
  label: string;
  beatEvery: number;
}

export async function startSession(user: { id: string; email?: string | null }, lessonId: string, ip: string, ua: string): Promise<PlayStart> {
  const { data: lesson } = await db().from("learn_lessons").select("id,course_id,status,duration_s,mime,init_bytes,segments").eq("id", lessonId).maybeSingle();
  if (!lesson || lesson.status !== "ready") throw new UserError("الفيديو غير جاهز.", 404);
  const admin = isAdmin(user.email);
  const courses = await loadTree({ courseId: lesson.course_id as string, onlyPublished: !admin });
  if (!courses.length || !(await accessFor(user, courses)).has(courses[0].id)) throw new UserError("هذا المحتوى للمشتركين في الدورة.", 403);

  const now = Date.now();
  // a person is served only so much of one lesson a day (a ripper asking again and again meets this)
  const since = new Date(now - 24 * 3600_000).toISOString();
  const { data: used } = await db().from("learn_sessions").select("served_s").eq("user_id", user.id).eq("lesson_id", lessonId).gte("started_at", since).limit(500);
  const usedSec = (used ?? []).reduce((a, r) => a + Number(r.served_s || 0), 0);
  if (!admin && dayCapReached(usedSec, Number(lesson.duration_s))) {
    await flag({ userId: user.id, email: user.email ?? "", lessonId, sessionId: null, kind: "day_cap", detail: `served ${Math.round(usedSec)}s in 24h` });
    throw new UserError("وصلت للحد اليومي لمشاهدة هذا الدرس. ارجع بكرة بإذن الله.", 429);
  }
  // viewings alive at once: a new one closes the oldest
  const alive = await db().from("learn_sessions").select("id,last_seen").eq("user_id", user.id).eq("revoked", false).gte("last_seen", new Date(now - LEARN.staleAfter * 1000).toISOString()).order("last_seen");
  const live = alive.data ?? [];
  const drop = live.length - (LEARN.maxSessions - 1);
  if (drop > 0) {
    const ids = live.slice(0, drop).map((s) => s.id as string);
    await db().from("learn_sessions").update({ revoked: true, revoked_reason: "newer" }).in("id", ids);
    if (live.length >= LEARN.maxSessions + 2) await flag({ userId: user.id, email: user.email ?? "", lessonId, sessionId: null, kind: "many_sessions", detail: `${live.length} alive` });
  }

  const key = toB64(randomKey());
  const { data: row, error } = await db().from("learn_sessions").insert({ user_id: user.id, email: user.email ?? "", lesson_id: lessonId, key, ip: ip.slice(0, 80), ua: ua.slice(0, 200) }).select("id").single();
  if (error) throw error;
  const segments = (lesson.segments as SegmentInfo[]).map((s) => ({ n: s.n, start: s.start, dur: s.dur, bytes: s.bytes + 0 }));
  return {
    session: row.id as string,
    key,
    manifest: { mime: String(lesson.mime), duration: Number(lesson.duration_s), initBytes: Number(lesson.init_bytes), segments },
    label: watermarkLabel(user.email, row.id as string),
    beatEvery: LEARN.beatEvery,
  };
}

/** The player says it is alive (and may report that its name tag was tampered with). Returns false when the viewing is closed. */
export async function beat(user: { id: string; email?: string | null }, sessionId: string, bad?: string): Promise<boolean> {
  const { data: s } = await db().from("learn_sessions").select("id,user_id,lesson_id,revoked").eq("id", sessionId).maybeSingle();
  if (!s || s.user_id !== user.id) return false;
  if (bad) {
    await flag({ userId: user.id, email: user.email ?? "", lessonId: s.lesson_id as string, sessionId, kind: "tamper", detail: bad });
    await db().from("learn_sessions").update({ revoked: true, revoked_reason: "tamper" }).eq("id", sessionId);
    return false;
  }
  if (s.revoked) return false;
  await db().from("learn_sessions").update({ last_seen: new Date().toISOString() }).eq("id", sessionId);
  return true;
}

export async function endSession(user: { id: string }, sessionId: string) {
  await db().from("learn_sessions").update({ revoked: true, revoked_reason: "ended" }).eq("id", sessionId).eq("user_id", user.id);
}

/** One piece, opened and locked again with this viewing's own key. n = 0 is the init piece. */
export async function servePiece(user: { id: string; email?: string | null }, sessionId: string, n: number): Promise<Uint8Array> {
  const { data: s } = await db().from("learn_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!s || s.user_id !== user.id) throw new UserError("جلسة المشاهدة غير صحيحة.", 403);
  if (s.revoked) throw new UserError("انتهت جلسة المشاهدة.", 410);
  const now = Date.now();
  if (now - new Date(String(s.last_seen)).getTime() > 10 * 60_000) throw new UserError("انتهت جلسة المشاهدة.", 410);
  const lesson = await lessonData(String(s.lesson_id));
  const seg = n === 0 ? null : lesson.segments[n - 1];
  if (n !== 0 && !seg) throw new UserError("هذا الجزء غير موجود.", 404);
  if (seg && !isAdmin(user.email) && !paceAllows({ elapsedSec: (now - new Date(String(s.started_at)).getTime()) / 1000, servedSec: Number(s.served_s), segSec: seg.dur })) {
    await flag({ userId: user.id, email: user.email ?? "", lessonId: String(s.lesson_id), sessionId, kind: "too_fast", detail: `piece ${n} after ${Math.round((now - new Date(String(s.started_at)).getTime()) / 1000)}s, served ${Math.round(Number(s.served_s))}s` });
    throw new UserError("بطّئ شوي، المشاهدة تحتاج وقتها.", 429);
  }
  const stored = await bucket().download(segmentPath(String(s.lesson_id), n));
  if (stored.error || !stored.data) throw new UserError("تعذّر قراءة الجزء.", 502);
  const plain = await open(lesson.key, new Uint8Array(await stored.data.arrayBuffer()), aad("c", String(s.lesson_id), n));
  const out = await seal(await importKey(fromB64(String(s.key))), plain, aad("s", sessionId, String(s.lesson_id), n));
  await db().from("learn_sessions").update({ last_seen: new Date(now).toISOString(), served_s: Number(s.served_s) + (seg?.dur ?? 0), pieces: Number(s.pieces) + (seg ? 1 : 0) }).eq("id", sessionId);
  return out;
}
