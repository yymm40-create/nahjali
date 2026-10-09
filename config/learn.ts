// «مكان الدورات» — courses › days › videos, watched but never downloaded. Pure rules shared by the server, the owner's
// uploader and the player (no I/O here). How a video is kept:
//   • the owner's browser cuts it into ~6 s pieces (fragmented MP4, each starts on a key frame) and locks every piece with
//     AES-GCM before it leaves his computer; the pieces sit in a PRIVATE bucket that has no public address at all;
//   • a viewer never gets a file or a link: the player asks the site for one piece at a time, the site opens the piece
//     and locks it again with a key made for THAT viewing session only, and the player feeds it to the video (MSE);
//   • the site hands pieces out no faster than watching needs (so a script takes as long as the video itself), a few
//     viewings at a time per person, a daily cap per lesson, and a moving name tag over the picture that the page notices
//     when it is tampered with.
// None of it can stop a camera pointed at a screen, or a skilled person recording their own screen: only a paid DRM
// service raises that wall further. The owner is told so; see config/jawad/knowledge.ts.

import type { Product } from "./course";

export const LEARN = {
  base: "/jawad-ai/learn",
  adminBase: "/admin/learn",
  /** the private bucket of the locked pieces (never in PUBLIC_BUCKETS, never served by /files) */
  bucket: "learn",
  /** a piece lasts at least this long (a fragment starts on the next key frame after it) */
  segSeconds: 6,
  /** a locked piece can't be bigger than this (a 4K piece of 6 s is ~ 20 MB at the worst) */
  maxSegBytes: 48 * 1024 * 1024,
  /** the owner's file: up to this size (his browser cuts it, nothing big goes through the site's server) */
  maxFileBytes: 6 * 1024 * 1024 * 1024,
  /** viewings alive at once for one person (a new one closes the oldest) */
  maxSessions: 2,
  /** the player says «أنا موجود» this often (seconds); a session silent for `staleAfter` is gone */
  beatEvery: 20,
  staleAfter: 90,
  /** pieces are handed out up to (this many seconds of video ahead of the viewing time) × paceFactor … */
  leadSeconds: 150,
  paceFactor: 2,
  /** … and one person may be served at most this many times a lesson's length in 24 hours */
  dayTimes: 4,
  maxTitle: 120,
  maxSummary: 600,
} as const;

export const PRODUCT_KEYS: Product[] = ["live", "recorded", "combo"];
/** what a course asks of the buyer: any of these products unlocks it (empty = only people the owner adds by email) */
export const cleanUnlock = (v: unknown): Product[] => (Array.isArray(v) ? PRODUCT_KEYS.filter((p) => v.includes(p)) : []);

export interface SegmentInfo {
  /** 1-based; the init piece (ftyp+moov) is number 0 and is not in the list */
  n: number;
  /** seconds from the start of the video */
  start: number;
  dur: number;
  /** size of the locked piece */
  bytes: number;
}

export interface Manifest {
  /** for MediaSource: video/mp4; codecs="avc1.…,mp4a.…" */
  mime: string;
  duration: number;
  initBytes: number;
  segments: SegmentInfo[];
}

export const segmentPath = (lessonId: string, n: number) => `${lessonId}/${n}.bin`;

/** The piece that plays second `t` (the last one whose start is ≤ t); -1 when there are none. */
export function segmentAt(segments: readonly SegmentInfo[], t: number): number {
  if (!segments.length) return -1;
  let lo = 0;
  let hi = segments.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segments[mid].start <= t + 1e-3) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Is this list a usable manifest (consecutive numbers, in time order, no holes)? Used before a lesson is marked ready. */
export function manifestProblem(m: Manifest): string | null {
  if (!m.mime || !/^video\/mp4;\s*codecs="[^"]+"$/.test(m.mime)) return "نوع الفيديو غير مفهوم.";
  if (!(m.duration > 0) || m.duration > 24 * 3600) return "مدة الفيديو غير صحيحة.";
  if (!m.segments.length) return "الفيديو ما انقسم لأجزاء.";
  if (m.segments.length > 10_000) return "الفيديو طويل جدًا.";
  let prev = -1;
  for (let i = 0; i < m.segments.length; i++) {
    const s = m.segments[i];
    if (s.n !== i + 1) return "ترقيم الأجزاء ناقص.";
    if (!(s.dur > 0) || s.start < prev - 1e-6) return "ترتيب الأجزاء في الوقت غير صحيح.";
    if (!(s.bytes > 28) || s.bytes > LEARN.maxSegBytes) return "حجم جزء غير صحيح.";
    prev = s.start;
  }
  return null;
}

/**
 * May the viewer be sent a piece of `segSec` seconds? The site serves the video's time at most `paceFactor` times
 * faster than it passes, with a head start of `leadSeconds` for the first buffering and for seeks.
 */
export function paceAllows(o: { elapsedSec: number; servedSec: number; segSec: number }): boolean {
  return o.servedSec + o.segSec <= Math.max(0, o.elapsedSec) * LEARN.paceFactor + LEARN.leadSeconds;
}

/** Has this person already been served more than the daily share of this lesson? */
export const dayCapReached = (servedSec24h: number, duration: number) => servedSec24h >= LEARN.dayTimes * Math.max(duration, 60);

export function hasAccess(o: { admin: boolean; granted: boolean; unlock: readonly Product[]; owned: readonly Product[] }): boolean {
  if (o.admin || o.granted) return true;
  return o.unlock.some((p) => o.owned.includes(p));
}

/** The name tag on the picture: who is watching (so a leaked recording points to them). */
export function watermarkLabel(email: string | null | undefined, sessionId: string): string {
  const e = (email ?? "").trim();
  const [name, host] = e.split("@");
  const mask = name && host ? `${name.slice(0, 3)}${name.length > 3 ? "…" : ""}@${host}` : "";
  return [mask, sessionId.slice(0, 6).toUpperCase()].filter(Boolean).join(" · ");
}

export const cleanTitle = (v: unknown, max: number = LEARN.maxTitle) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export const fmtDuration = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
};
