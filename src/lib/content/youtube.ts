// «صانع المحتوى» · YouTube downloaded like Claude does it (the owner, 15 Nov 2026: «خله نفس كلاود بأداة تنزيل»):
// a YouTube link in a message to «محمد باقر» is downloaded before it is sent — the video (MP4 ≤ 720p) and its sound
// (MP3) become the person's own uploads, the page takes frames from the video (a contact sheet he looks at), and the
// sound is heard by ElevenLabs as before. YouTube blocks downloads from cloud servers, so the download runs on Apify
// (actor memo23/youtube-video-downloader, pay per file, a failed file costs nothing): APIFY_TOKEN turns it on.
// The download is paid with the reply that carries it (billYoutube), once. Server only.

import { UserError } from "@/lib/api";
import { storage } from "@/lib/storage";
import { JAWAD_BUCKET } from "@/lib/jawad/server/runtime";
import { uploadFromBuffer, uploadViews, type UploadRow } from "@/lib/jawad/server/uploads";
import { keyOf } from "@/lib/link-listen";

const ACTOR = "memo23~youtube-video-downloader";
const API = "https://api.apify.com/v2";
/** the video is downloaded up to this long (longer: only its sound, and its words through the link) */
export const YT_VIDEO_MINUTES = 15;
const YT_AUDIO_MINUTES = 90;
const MAX_MB = 150;
/** downloads one person may start in a day */
const PER_DAY = 15;
/** Apify's price for one download (720p MP4 + MP3 + the run's start), and its large-file part per 10 MB above 50 MB */
const BASE_USD = 0.07;
const PER_10MB_USD = 0.006;

export const youtubeEnabled = () => !!process.env.APIFY_TOKEN;

type Part = "video" | "audio";
interface Run {
  id: string;
  ds: string;
}
interface DlRecord {
  key: string;
  url: string;
  state: "running" | "saving" | "ready" | "failed";
  runs: { [P in Part]?: Run };
  uploads: { [P in Part]?: string };
  title: string;
  usd: number;
  why?: string;
  at: string;
  savingAt?: string;
}
interface Bill {
  userId: string;
  usd: number;
  billed: boolean;
  /** the video's link key («yt:…»): its words are kept under it */
  key?: string;
  part?: Part;
}

const recPath = (userId: string, key: string) => `yt-dl/${userId}/${key.replace(/[^\w-]/g, "_")}.json`;
const billPath = (uploadId: string) => `yt-dl/up/${uploadId}.json`;

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const { data, error } = await storage.from(JAWAD_BUCKET).download(path);
    return error || !data ? null : (JSON.parse(await data.text()) as T);
  } catch {
    return null;
  }
}
async function writeJson(path: string, v: unknown) {
  await storage.from(JAWAD_BUCKET).upload(path, Buffer.from(JSON.stringify(v)), { contentType: "application/json", upsert: true });
}

async function apify<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: { authorization: `Bearer ${process.env.APIFY_TOKEN}`, ...(init?.body ? { "content-type": "application/json" } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`apify ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`);
  const j = (await r.json()) as { data?: T };
  return (j.data ?? j) as T;
}

async function startRun(url: string, part: Part): Promise<Run> {
  const input =
    part === "video"
      ? { videoUrls: [url], format: "mp4", quality: "720p", maxMinutes: YT_VIDEO_MINUTES, maxMegabytes: MAX_MB, storageType: "apify", maxConcurrency: 1 }
      : { videoUrls: [url], format: "mp3", maxMinutes: YT_AUDIO_MINUTES, maxMegabytes: MAX_MB, storageType: "apify", maxConcurrency: 1 };
  const d = await apify<{ id: string; defaultDatasetId: string }>(`/acts/${ACTOR}/runs`, { method: "POST", body: input });
  return { id: d.id, ds: d.defaultDatasetId };
}

/** The video's YouTube id key («yt:…»), or null when the text holds no YouTube link. */
export function youtubeKeyOf(url: string): string | null {
  const k = keyOf(url);
  return k?.startsWith("yt:") ? k : null;
}

/** Starts (or finds) this person's download of a YouTube link. */
export async function startYoutube(userId: string, url: string): Promise<{ key: string }> {
  if (!youtubeEnabled()) throw new UserError("تنزيل يوتيوب مو مفعّل للحين.", 503);
  const key = youtubeKeyOf(url);
  if (!key) throw new UserError("هذا مو رابط فيديو يوتيوب.", 400);
  const had = await readJson<DlRecord>(recPath(userId, key));
  if (had && had.state !== "failed") return { key };
  // a day's limit: the person's records made since midnight (UTC)
  const { data: list } = await storage.from(JAWAD_BUCKET).list(`yt-dl/${userId}`, { limit: 200 });
  const today = new Date().toISOString().slice(0, 10);
  if ((list ?? []).filter((f) => String(f.created_at ?? "").startsWith(today)).length >= PER_DAY) throw new UserError(`وصلت حد التنزيل اليوم (${PER_DAY} فيديو).`, 429);
  const [video, audio] = await Promise.all([startRun(url, "video"), startRun(url, "audio")]);
  await writeJson(recPath(userId, key), { key, url, state: "running", runs: { video, audio }, uploads: {}, title: "", usd: 0, at: new Date().toISOString() } satisfies DlRecord);
  return { key };
}

interface Row {
  downloadUrl?: string | null;
  error?: string | null;
  title?: string;
  durationSec?: number;
  fileSizeBytes?: number;
}

/** A finished run's file (bytes), or why there is none. */
async function fileOf(run: Run): Promise<{ bytes?: Uint8Array; row?: Row; why?: string }> {
  const rows = await apify<Row[]>(`/datasets/${run.ds}/items?clean=true`).catch(() => null);
  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!row?.downloadUrl) return { row, why: row?.error ? String(row.error).slice(0, 160) : "ما انحمّل" };
  const link = new URL(row.downloadUrl);
  // the token goes only to Apify's own address
  const headers = link.hostname === "api.apify.com" ? { authorization: `Bearer ${process.env.APIFY_TOKEN}` } : undefined;
  const r = await fetch(link, { headers, signal: AbortSignal.timeout(180_000) });
  if (!r.ok) return { row, why: `تحميل الملف ${r.status}` };
  return { bytes: new Uint8Array(await r.arrayBuffer()), row };
}

const priceOf = (bytes: number) => BASE_USD + Math.max(0, Math.ceil((bytes / 1048576 - 50) / 10)) * PER_10MB_USD;

export interface YoutubeState {
  state: "running" | "ready" | "failed";
  title?: string;
  why?: string;
  files?: { id: string; kind: "video" | "audio"; name: string; durationMs: number | null; url: string | null }[];
}

/** Where a download stands; when both runs ended, their files are saved as the person's uploads (once). */
export async function youtubeState(userId: string, key: string): Promise<YoutubeState> {
  const path = recPath(userId, key);
  const rec = await readJson<DlRecord>(path);
  if (!rec) throw new UserError("ما لقينا هذا التنزيل.", 404);
  if (rec.state === "ready") return { state: "ready", title: rec.title, files: await viewsOf(userId, rec) };
  if (rec.state === "failed") return { state: "failed", why: rec.why };
  // another request is saving the files right now (a few minutes at most)
  if (rec.state === "saving" && rec.savingAt && Date.now() - Date.parse(rec.savingAt) < 5 * 60_000) return { state: "running" };
  const parts = Object.entries(rec.runs) as [Part, Run][];
  const status = await Promise.all(parts.map(([, r]) => apify<{ status: string }>(`/actor-runs/${r.id}`).then((d) => d.status, () => "RUNNING")));
  if (status.some((s) => s === "READY" || s === "RUNNING")) {
    // a download that never ends is given up after 15 minutes
    if (Date.now() - Date.parse(rec.at) < 15 * 60_000) return { state: "running" };
  }
  await writeJson(path, { ...rec, state: "saving", savingAt: new Date().toISOString() });
  const name = (t: string) => t.replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 120) || "فيديو يوتيوب";
  const uploads: DlRecord["uploads"] = {};
  let title = "";
  let bytes = 0;
  const whys: string[] = [];
  for (const [part, run] of parts) {
    const i = parts.findIndex(([p]) => p === part);
    if (status[i] !== "SUCCEEDED") {
      whys.push(`${part}: ${status[i]}`);
      continue;
    }
    try {
      const f = await fileOf(run);
      title ||= f.row?.title ?? "";
      if (!f.bytes) {
        whys.push(`${part}: ${f.why}`);
        continue;
      }
      bytes += f.bytes.length;
      const row = await uploadFromBuffer(userId, f.bytes, part === "video" ? `${name(title)}.mp4` : `صوت - ${name(title)}.mp3`);
      if (row.status === "ready") uploads[part] = row.id;
      else whys.push(`${part}: ${row.error ?? "رُفض"}`);
    } catch (e) {
      whys.push(`${part}: ${e instanceof Error ? e.message.slice(0, 120) : "خطأ"}`);
    }
  }
  if (!uploads.video && !uploads.audio) {
    await writeJson(path, { ...rec, state: "failed", why: whys.join(" · ").slice(0, 300) || "ما انحمّل", title });
    return { state: "failed", why: whys.join(" · ").slice(0, 300) };
  }
  const usd = Math.round(priceOf(bytes) * 10000) / 10000;
  // the download is paid with the reply that carries its files: the first of them holds the bill
  const first = uploads.video ?? uploads.audio!;
  await writeJson(billPath(first), { userId, usd, billed: false, key, part: uploads.video === first ? "video" : "audio" } satisfies Bill);
  if (uploads.audio && uploads.audio !== first) await writeJson(billPath(uploads.audio), { userId, usd: 0, billed: true, key, part: "audio" } satisfies Bill);
  const done: DlRecord = { ...rec, state: "ready", uploads, title, usd, ...(whys.length ? { why: whys.join(" · ").slice(0, 300) } : {}) };
  await writeJson(path, done);
  return { state: "ready", title, files: await viewsOf(userId, done) };
}

async function viewsOf(userId: string, rec: DlRecord): Promise<YoutubeState["files"]> {
  const ids = [rec.uploads.video, rec.uploads.audio].filter((x): x is string => !!x);
  if (!ids.length) return [];
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data } = await createAdminClient().from("jawad_uploads").select("*").in("id", ids).eq("user_id", userId).eq("status", "ready");
  const views = await uploadViews((data ?? []) as UploadRow[]);
  return ids.flatMap((id) => {
    const v = views.find((x) => x.id === id);
    return v ? [{ id, kind: v.kind as "video" | "audio", name: v.fileName, durationMs: v.durationMs, url: v.url ?? null }] : [];
  });
}

/**
 * The YouTube downloads among a message's files: what they cost (charged with this reply, once) and their ids (their
 * words come through the link itself, so they are not heard a second time).
 */
export async function billYoutube(userId: string, ids: string[]): Promise<{ usd: number; ids: Set<string> }> {
  let usd = 0;
  const found = new Set<string>();
  for (const id of ids) {
    const b = await readJson<Bill>(billPath(id));
    if (!b || b.userId !== userId) continue;
    found.add(id);
    if (!b.billed && b.usd > 0) {
      usd += b.usd;
      await writeJson(billPath(id), { ...b, billed: true });
    }
  }
  return { usd, ids: found };
}

/** A downloaded YouTube file's link key and part, or null when it is not one. */
export async function youtubeOf(userId: string, uploadId: string): Promise<{ key: string; part: Part } | null> {
  const b = await readJson<Bill>(billPath(uploadId));
  return b && b.userId === userId && b.key ? { key: b.key, part: b.part ?? "video" } : null;
}
