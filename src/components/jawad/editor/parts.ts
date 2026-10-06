// «حيدر كات» — a large file (100 MB up to about 5 TB) goes straight to storage in parts, four at a time.
// A part that fails is sent again; a cut connection waits for the internet to come back; and after a reload
// the same file picks up from the parts already stored (see useUploads).
import { postJson } from "@/lib/fetch";

export interface PartsUpload {
  /** the pending file's id, or "export" */
  id: string;
  uploadId: string;
  partSize: number;
}

/** The stored upload is gone (more than a week old, or joined already): start the file again. */
export class UploadGone extends Error {}

const AT_ONCE = 4;
const TRIES = 8;
const LINKS_AT_ONCE = 20;
// links work for 6 hours; asked again well before that
const LINK_FOR_MS = 5 * 3600_000;

const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const online = () =>
  typeof navigator === "undefined" || navigator.onLine
    ? Promise.resolve()
    : new Promise<void>((ok) => window.addEventListener("online", () => ok(), { once: true }));

function putPart(url: string, body: Blob, onProgress: (loaded: number) => void, signal?: AbortSignal) {
  return new Promise<string>((ok, fail) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) return fail(Object.assign(new Error(`part ${xhr.status}`), { status: xhr.status }));
      const etag = xhr.getResponseHeader("ETag");
      // Without ETag in the bucket's CORS «ExposeHeaders», the browser can't read the part's receipt
      if (!etag) return fail(Object.assign(new Error("التخزين ما سمح بقراءة إيصال الجزء (إعداد CORS في R2 ناقص: ExposeHeaders ETag)."), { fatal: true }));
      ok(etag);
    };
    xhr.onerror = () => fail(new Error("انقطع الاتصال أثناء الرفع."));
    xhr.onabort = () => fail(Object.assign(new Error("أُلغي الرفع."), { fatal: true }));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

/** Sends `file` in parts and joins them; `onProgress` gets 0–1. */
export async function sendInParts(projectId: string, up: PartsUpload, file: Blob, onProgress: (p: number) => void, signal?: AbortSignal) {
  const api = <T>(action: string, data: Record<string, unknown> = {}) =>
    postJson<T>(`/api/jawad/editor/projects/${projectId}`, { action, id: up.id, uploadId: up.uploadId, ...data });
  const count = Math.max(1, Math.ceil(file.size / up.partSize));
  const sizeOf = (n: number) => Math.min(up.partSize, file.size - (n - 1) * up.partSize);

  // gone: too old, already joined, or its file deleted from the project
  const stored = await api<{ parts: { part: number; etag: string; size: number }[] | null }>("upload_parts").then((r) => r.parts, () => null);
  if (!stored) throw new UploadGone("انتهت مهلة هذا الرفع؛ نبدأه من جديد.");
  const etags = new Map<number, string>();
  for (const p of stored) if (p.part <= count && p.size === sizeOf(p.part)) etags.set(p.part, p.etag);

  const loaded = new Map<number, number>();
  for (const n of etags.keys()) loaded.set(n, sizeOf(n));
  const report = () => onProgress([...loaded.values()].reduce((a, b) => a + b, 0) / file.size);
  report();

  const todo = Array.from({ length: count }, (_, i) => i + 1).filter((n) => !etags.has(n));
  const links = new Map<number, { url: string; at: number }>();
  async function link(n: number) {
    const have = links.get(n);
    if (have && Date.now() - have.at < LINK_FOR_MS) return have.url;
    const next = [n, ...todo.filter((m) => m !== n && !links.has(m))].slice(0, LINKS_AT_ONCE);
    const r = await api<{ urls: { part: number; url: string }[] }>("upload_part_urls", { parts: next });
    for (const u of r.urls) links.set(u.part, { url: u.url, at: Date.now() });
    return links.get(n)!.url;
  }

  async function send(n: number) {
    const body = file.slice((n - 1) * up.partSize, (n - 1) * up.partSize + sizeOf(n));
    for (let attempt = 1; ; attempt++) {
      if (signal?.aborted) throw new Error("أُلغي الرفع.");
      await online();
      try {
        const etag = await putPart(await link(n), body, (b) => (loaded.set(n, b), report()), signal);
        etags.set(n, etag);
        loaded.set(n, body.size);
        report();
        return;
      } catch (e) {
        const err = e as Error & { status?: number; fatal?: boolean };
        if (err.fatal || attempt >= TRIES) throw err;
        // an expired link: a fresh one next time
        if (err.status === 403) links.delete(n);
        loaded.set(n, 0);
        report();
        await sleep(Math.min(30_000, 1000 * 2 ** (attempt - 1)));
      }
    }
  }

  const queue = [...todo];
  await Promise.all(
    Array.from({ length: Math.min(AT_ONCE, queue.length) }, async () => {
      for (let n = queue.shift(); n; n = queue.shift()) await send(n);
    }),
  );

  await api("upload_complete", { parts: [...etags].map(([part, etag]) => ({ part, etag })) });
  onProgress(1);
}
