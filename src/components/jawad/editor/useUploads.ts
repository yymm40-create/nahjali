"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/fetch";
import { putWithProgress } from "../studio/upload";
import { probe, probeUrl, shortName } from "./media";
import { sendInParts, UploadGone, type PartsUpload } from "./parts";
import type { EditorAsset } from "./types";
import { desktop, type LinkFile } from "./desktop";

/** Where a dropped file goes once it is uploaded (none: the usual place). */
export interface Placement {
  at: number;
  trackId: string | null;
  /** one: just here · stack: each file on its own track, one above the other · line: one after another */
  mode: "one" | "stack" | "line";
  /** the files dropped together share it */
  group: string;
  first: boolean;
}

export interface UploadItem {
  key: string;
  name: string;
  progress: number;
  error: string | null;
  note: string | null;
}

interface Started {
  id: string;
  mime: string;
  signedUrl?: string;
  multipart?: { uploadId: string; partSize: number };
}

// A large file's upload, kept per file so the same file picked again after a reload goes on where it stopped
const resumeKey = (projectId: string, f: File) => `editor-upload:${projectId}:${f.name}:${f.size}:${f.lastModified}`;
function readResume(key: string): (PartsUpload & { mime: string }) | null {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null");
    return v && typeof v.id === "string" && typeof v.uploadId === "string" && typeof v.partSize === "number" ? v : null;
  } catch {
    return null;
  }
}
function writeResume(key: string, v: (PartsUpload & { mime: string }) | null) {
  try {
    if (v) localStorage.setItem(key, JSON.stringify(v));
    else localStorage.removeItem(key);
  } catch {
    // private mode: no resume after a reload, the upload itself still works
  }
}

/**
 * Files from the device, one after another: read in the browser, sent straight to storage with a one-time link, then
 * checked by the server. Each finished file goes to `onDone` (the editor puts it on the timeline).
 */
export function useUploads(projectId: string, onDone: (a: EditorAsset, place?: Placement) => void, onFail?: (place: Placement | undefined, message: string) => void, onProgress?: (place: Placement | undefined, p: number) => void) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const queue = useRef<({ key: string; file: File; local?: undefined; place?: Placement } | { key: string; file?: undefined; local: LinkFile; place?: Placement })[]>([]);
  const busy = useRef(false);
  const done = useRef(onDone);
  const failed = useRef(onFail);
  const progressed = useRef(onProgress);
  useEffect(() => {
    done.current = onDone;
    failed.current = onFail;
    progressed.current = onProgress;
  }, [onDone, onFail, onProgress]);

  const patch = (key: string, p: Partial<UploadItem>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const next = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      for (let job = queue.current.shift(); job; job = queue.current.shift()) {
        const { key, place } = job;
        try {
          // a video the desktop program downloaded from a link: already on the computer, only added to the project
          if (job.local) {
            const l = job.local;
            const m = await probeUrl(l.url, l.name);
            const r = await postJson<{ asset: EditorAsset }>(`/api/jawad/editor/projects/${projectId}`, {
              action: "add_local",
              localId: l.id,
              kind: m.kind,
              container: m.container,
              bytes: l.bytes,
              name: shortName(l.name),
              durationMs: m.durationMs,
              width: m.width,
              height: m.height,
              hasAudio: m.hasAudio,
            });
            done.current(r.asset, place);
            if (m.playable) setItems((xs) => xs.filter((x) => x.key !== key));
            else patch(key, { progress: 1, note: "متصفحك قد لا يعرض هذا الملف أثناء المونتاج (ترميز غير مدعوم)." });
            continue;
          }
          const file = job.file;
          const m = await probe(file);
          if (!m.playable) patch(key, { note: "متصفحك قد لا يعرض هذا الملف أثناء المونتاج (ترميز غير مدعوم)؛ جرّب Chrome." });
          // the desktop program: the file stays on the computer (nothing uploaded)
          const local = await desktop()?.keepLocal(file).catch(() => null);
          if (local) {
            const r = await postJson<{ asset: EditorAsset }>(`/api/jawad/editor/projects/${projectId}`, {
              action: "add_local",
              localId: local.id,
              kind: m.kind,
              container: m.container,
              bytes: file.size,
              name: shortName(file.name),
              durationMs: m.durationMs,
              width: m.width,
              height: m.height,
              hasAudio: m.hasAudio,
            });
            done.current(r.asset, place);
            if (m.playable) setItems((xs) => xs.filter((x) => x.key !== key));
            else patch(key, { progress: 1 });
            continue;
          }
          const start = () =>
            postJson<Started>(`/api/jawad/editor/projects/${projectId}`, {
              action: "sign_upload",
              kind: m.kind,
              container: m.container,
              bytes: file.size,
              name: shortName(file.name),
            });
          const rk = resumeKey(projectId, file);
          const before = readResume(rk);
          let s: Started = before ? { id: before.id, mime: before.mime, multipart: before } : await start();
          if (s.multipart) {
            const progress = (p: number) => (patch(key, { progress: p }), progressed.current?.(place, p));
            writeResume(rk, { id: s.id, mime: s.mime, ...s.multipart });
            try {
              await sendInParts(projectId, { id: s.id, ...s.multipart }, file, progress);
            } catch (err) {
              // the earlier upload of this file is gone: once more from the start
              if (!(err instanceof UploadGone) || !before) throw err;
              s = await start();
              writeResume(rk, s.multipart ? { id: s.id, mime: s.mime, ...s.multipart } : null);
              if (s.multipart) await sendInParts(projectId, { id: s.id, ...s.multipart }, file, progress);
              else await putWithProgress(s.signedUrl!, file, s.mime, progress);
            }
            writeResume(rk, null);
          } else {
            await putWithProgress(s.signedUrl!, file, s.mime, (p) => (patch(key, { progress: p }), progressed.current?.(place, p)));
          }
          const r = await postJson<{ asset: EditorAsset }>(`/api/jawad/editor/projects/${projectId}`, {
            action: "confirm_upload",
            id: s.id,
            durationMs: m.durationMs,
            width: m.width,
            height: m.height,
            hasAudio: m.hasAudio,
          });
          done.current(r.asset, place);
          // finished: it leaves the list, unless there is something to tell about it
          if (m.playable) setItems((xs) => xs.filter((x) => x.key !== key));
          else patch(key, { progress: 1 });
        } catch (err) {
          const why = err instanceof Error ? err.message : "تعذّر الرفع.";
          patch(key, { error: why });
          failed.current?.(place, why);
        }
      }
    } finally {
      busy.current = false;
    }
  }, [projectId]);

  const add = useCallback(
    (files: FileList | File[], places?: Placement[]) => {
      const list = Array.from(files);
      if (!list.length) return;
      const made = list.map((file, i) => ({ key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`, file, place: places?.[i] }));
      setItems((xs) => [...xs, ...made.map(({ key, file }) => ({ key, name: file.name, progress: 0, error: null, note: null }))]);
      queue.current.push(...made);
      void next();
    },
    [next],
  );

  // «⬇️ من رابط» in the desktop program: the video is downloaded on the computer (its progress shown here), then added
  // like a file of the computer
  const addLink = useCallback(
    async (link: string, place?: Placement) => {
      const fromLink = desktop()?.fromLink;
      if (!fromLink) return;
      const key = `link-${Math.random().toString(36).slice(2, 9)}`;
      setItems((xs) => [...xs, { key, name: link, progress: 0, error: null, note: null }]);
      const r = await fromLink(link, (m) => patch(key, { progress: m.p ?? 0, ...(m.note ? { name: m.note } : {}) })).catch((e: unknown) => ({ error: e instanceof Error ? e.message : "ما قدرنا ننزّل الفيديو." }));
      if ("error" in r) {
        patch(key, { error: r.error, name: link });
        failed.current?.(place, r.error);
        return;
      }
      patch(key, { name: r.name, progress: 1 });
      queue.current.push({ key, local: r, place });
      void next();
    },
    [next],
  );

  const dismiss = useCallback((key: string) => setItems((xs) => xs.filter((x) => x.key !== key)), []);

  return { items, add, addLink, dismiss, busy: items.some((x) => !x.error && !x.note) };
}
