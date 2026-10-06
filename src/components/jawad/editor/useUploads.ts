"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/fetch";
import { putWithProgress } from "../studio/upload";
import { probe, shortName } from "./media";
import type { EditorAsset } from "./types";

export interface UploadItem {
  key: string;
  name: string;
  progress: number;
  error: string | null;
  note: string | null;
}

/**
 * Files from the device, one after another: read in the browser, sent straight to storage with a one-time link, then
 * checked by the server. Each finished file goes to `onDone` (the editor puts it on the timeline).
 */
export function useUploads(projectId: string, onDone: (a: EditorAsset) => void) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const queue = useRef<{ key: string; file: File }[]>([]);
  const busy = useRef(false);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  const patch = (key: string, p: Partial<UploadItem>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const next = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      for (let job = queue.current.shift(); job; job = queue.current.shift()) {
        const { key, file } = job;
        try {
          const m = await probe(file);
          if (!m.playable) patch(key, { note: "متصفحك قد لا يعرض هذا الملف أثناء المونتاج (ترميز غير مدعوم)؛ جرّب Chrome." });
          const s = await postJson<{ id: string; mime: string; signedUrl: string }>(`/api/jawad/editor/projects/${projectId}`, {
            action: "sign_upload",
            kind: m.kind,
            container: m.container,
            bytes: file.size,
            name: shortName(file.name),
          });
          try {
            await putWithProgress(s.signedUrl, file, s.mime, (p) => patch(key, { progress: p }));
          } catch (err) {
            const msg = err instanceof Error ? err.message : "";
            // the storage plan's own limit (50 MB per file on Supabase Free)
            if (/\((413|400)\)/.test(msg)) throw new Error(`«${file.name}» أكبر من الحجم المسموح في التخزين حاليًا. قصّه أو صغّره وجرّب.`);
            throw err;
          }
          const r = await postJson<{ asset: EditorAsset }>(`/api/jawad/editor/projects/${projectId}`, {
            action: "confirm_upload",
            id: s.id,
            durationMs: m.durationMs,
            width: m.width,
            height: m.height,
            hasAudio: m.hasAudio,
          });
          done.current(r.asset);
          // finished: it leaves the list, unless there is something to tell about it
          if (m.playable) setItems((xs) => xs.filter((x) => x.key !== key));
          else patch(key, { progress: 1 });
        } catch (err) {
          patch(key, { error: err instanceof Error ? err.message : "تعذّر الرفع." });
        }
      }
    } finally {
      busy.current = false;
    }
  }, [projectId]);

  const add = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (!list.length) return;
      const made = list.map((file) => ({ key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`, file }));
      setItems((xs) => [...xs, ...made.map(({ key, file }) => ({ key, name: file.name, progress: 0, error: null, note: null }))]);
      queue.current.push(...made);
      void next();
    },
    [next],
  );

  const dismiss = useCallback((key: string) => setItems((xs) => xs.filter((x) => x.key !== key)), []);

  return { items, add, dismiss, busy: items.some((x) => !x.error && !x.note) };
}
