// BROWSER ONLY. The reading timer (kept on the device, so closing the app does not lose it) and sessions waiting to be sent.
import { t } from "../i18n";
import type { ReadingData } from "../types";
import { ApiError, mahdiFetch } from "./fetch";

export interface TimerState {
  bookId: string;
  startPage: number;
  /** When the session first started (ms). */
  startedAt: number;
  /** Time already counted before the current run (ms). */
  accumulated: number;
  /** When the current run started (ms), or null while paused. */
  runningSince: number | null;
}

const timerKey = (userId: string) => `mahdi:reading:timer:${userId}`;
const pendingKey = (userId: string) => `mahdi:reading:pending:${userId}`;

export function loadTimer(userId: string): TimerState | null {
  try {
    const v = JSON.parse(localStorage.getItem(timerKey(userId)) ?? "null");
    return v && typeof v.bookId === "string" && typeof v.startedAt === "number" ? (v as TimerState) : null;
  } catch {
    return null;
  }
}

export function saveTimer(userId: string, s: TimerState | null) {
  try {
    if (s) localStorage.setItem(timerKey(userId), JSON.stringify(s));
    else localStorage.removeItem(timerKey(userId));
  } catch {}
}

/** Milliseconds counted so far. */
export const elapsedMs = (s: TimerState, now = Date.now()) => s.accumulated + (s.runningSince ? now - s.runningSince : 0);

/** «1:05:09» or «05:09» */
export function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

/** «1 س 20 د» */
export const duration = (seconds: number) => {
  const m = Math.round(seconds / 60);
  return t.reading.hours(Math.floor(m / 60), m % 60);
};

export interface SessionBody {
  bookId: string;
  startedAt?: string;
  date?: string;
  seconds: number;
  ranges: [number, number][];
  note: string;
}

function loadPending(userId: string): SessionBody[] {
  try {
    const v = JSON.parse(localStorage.getItem(pendingKey(userId)) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function savePending(userId: string, list: SessionBody[]) {
  try {
    if (list.length) localStorage.setItem(pendingKey(userId), JSON.stringify(list));
    else localStorage.removeItem(pendingKey(userId));
  } catch {}
}

export const pendingCount = (userId: string) => loadPending(userId).length;

/**
 * Sends a session. Without a connection it is kept on the device and sent later (by `flushPending`).
 * Returns the fresh reading data, or null when it was kept for later.
 */
export async function sendSession(userId: string, body: SessionBody): Promise<ReadingData | null> {
  try {
    const { reading } = await mahdiFetch<{ reading: ReadingData }>("/api/mahdi/reading/sessions", { method: "POST", json: body });
    return reading;
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) {
      savePending(userId, [...loadPending(userId), body]);
      return null;
    }
    throw e;
  }
}

/** Sends sessions saved while offline. Refused ones (e.g. the book was removed) are dropped. */
export async function flushPending(userId: string): Promise<ReadingData | null> {
  const list = loadPending(userId);
  if (!list.length || !navigator.onLine) return null;
  let last: ReadingData | null = null;
  const left: SessionBody[] = [];
  for (const body of list) {
    try {
      last = (await mahdiFetch<{ reading: ReadingData }>("/api/mahdi/reading/sessions", { method: "POST", json: body })).reading;
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) left.push(body);
    }
  }
  savePending(userId, left);
  return last;
}

/**
 * Makes a phone photo small before it is sent (at most 1200 px, JPEG): uploads stay fast and under the server's
 * size limit. The server re-encodes it again anyway. Falls back to the original file if the browser can't read it.
 */
export async function shrinkImage(file: File, max = 1200): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("jpeg"))), "image/jpeg", 0.85));
  } catch {
    return file;
  }
}

/**
 * Uploads a book's PDF straight to storage with a one-time link from the server (large files never pass through the
 * website), reporting progress. Returns the stored path, which the book form then sends.
 */
export async function uploadBookPdf(file: File, onProgress: (pct: number) => void): Promise<string> {
  const { path, token } = await mahdiFetch<{ path: string; token: string }>("/api/mahdi/reading/pdf", { method: "POST", json: { size: file.size } });
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/upload/sign/mahdi-book-files/${path}?token=${encodeURIComponent(token)}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
    xhr.setRequestHeader("content-type", "application/pdf");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(t.reading.pdf.failed)));
    xhr.onerror = () => reject(new Error(t.reading.pdf.failed));
    xhr.send(file);
  });
  return path;
}
