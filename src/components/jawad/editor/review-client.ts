"use client";

// «رابط مراجعة للعميل» in the editor: the project's review state (read on opening and every 90 s while the page is in
// view, for the «جديد» badge and the markers on the ruler), sharing a video (the site's checked upload with progress,
// or the copy of the last export kept with the project), and the comments as marks on the timeline as it is now.

import { useCallback, useEffect, useState } from "react";
import { api, postJson } from "@/lib/fetch";
import { track } from "@/lib/feature-track";
import { mapTime, REVIEW_LIMITS, type ExpiryChoice, type Mapped } from "@/lib/editor/review";
import type { OwnerReview } from "@/lib/editor/review-server";
import type { Timeline } from "@/lib/editor/model";
import { probeFile, putWithProgress } from "../studio/upload";

export type { OwnerReview };

/** A comment as a mark on the ruler. */
export interface ReviewMark {
  id: number;
  at: number;
  how: Mapped["how"];
  done: boolean;
  text: string;
}

/** Each open or resolved top-level comment with a moment, carried to the timeline as it is now. */
export function reviewMarks(data: OwnerReview | null, tl: Timeline): ReviewMark[] {
  if (!data?.versions.length) return [];
  const byId = new Map(data.versions.map((v) => [v.id, v]));
  return data.comments.flatMap((c) => {
    const v = byId.get(c.versionId);
    if (!v || c.kind !== "comment" || c.parentId != null || c.byOwner || c.at == null) return [];
    const m = v.fit ? mapTime(v.anchors, c.at, tl) : { at: c.at, how: "lost" as const };
    return [{ id: c.id, at: m.at, how: m.how, done: c.resolved, text: `${c.author}: ${c.body.slice(0, 80)}` }];
  });
}

export interface ShareOpts {
  expiry: ExpiryChoice;
  allowDownload: boolean;
}

export function useReview(projectId: string, flush: () => Promise<void>, on: boolean) {
  const url = `/api/jawad/editor/projects/${projectId}/review`;
  const [data, setData] = useState<OwnerReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  // the video going up: its share (0–1), then the server's check
  const [upload, setUpload] = useState<{ p: number; phase: "up" | "check" } | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<OwnerReview>(url));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [url]);

  useEffect(() => {
    if (!on) return;
    const first = setTimeout(() => void load(), 1500);
    const every = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 90_000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [on, load]);

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      const r = await postJson<OwnerReview>(url, body);
      setData(r);
      return r;
    },
    [url],
  );

  /** An exported video (from the device, or just made in the export window) shared as the next version. */
  const shareFile = useCallback(
    async (file: File, opts: ShareOpts) => {
      if (file.size > REVIEW_LIMITS.videoBytes) throw new Error("الفيديو أكبر من ٢٠٠ ميجا؛ صدّره بدقة أو جودة أقل للمراجعة (720p تكفي).");
      const probe = await probeFile(file, "video");
      // the project as it is now is what the comments' times are carried from
      await flush();
      setUpload({ p: 0, phase: "up" });
      try {
        const s = await postJson<{ id: string; signedUrl: string }>(url, { action: "sign", mime: probe.mime, bytes: file.size, fileName: file.name });
        await putWithProgress(s.signedUrl, file, probe.mime, (p) => setUpload({ p, phase: "up" }));
        setUpload({ p: 1, phase: "check" });
        const r = await postJson<{ n: number; fit: boolean; path: string }>(url, { action: "share", uploadId: s.id, ...opts });
        track("editor.review_share");
        await load();
        return r;
      } finally {
        setUpload(null);
      }
    },
    [url, flush, load],
  );

  /** The copy of the last export kept with the project, shared without uploading again. */
  const shareExport = useCallback(
    async (opts: ShareOpts) => {
      await flush();
      setUpload({ p: 1, phase: "check" });
      try {
        const r = await postJson<{ n: number; fit: boolean; path: string }>(url, { action: "share", fromExport: true, ...opts });
        track("editor.review_share");
        await load();
        return r;
      } finally {
        setUpload(null);
      }
    },
    [url, flush, load],
  );

  return { data, error, upload, load, act, shareFile, shareExport };
}

export type ReviewApi = ReturnType<typeof useReview>;
