"use client";

import { useRef, useState } from "react";
import { duration, formatTime, type Timeline } from "@/lib/editor/model";
import { postJson } from "@/lib/fetch";
import Dialog from "../Dialog";
import Icon from "../Icon";
import { desktop } from "./desktop";
import { canExport, download, exportVideo, ExportError, type ExportResult } from "./export";
import { exportSize } from "./render";
import { sendInParts } from "./parts";
import type { EditorAsset } from "./types";

type Phase = { k: "idle" } | { k: "running"; p: number } | { k: "done"; r: ExportResult; saved: boolean | null; purgeAt: string | null } | { k: "error"; m: string };

const when = (iso: string) => new Date(iso).toLocaleString("ar", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });

/** «صدّر»: 720p or 1080p, made in this browser; then the file downloads and the 3-day countdown starts. */
export default function ExportPanel({
  open,
  onClose,
  projectId,
  title,
  tl,
  assets,
  flush,
  onExported,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  title: string;
  tl: Timeline;
  assets: EditorAsset[];
  flush: () => Promise<void>;
  onExported: (purgeAt: string) => void;
}) {
  const [quality, setQuality] = useState<720 | 1080>(1080);
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const abort = useRef<AbortController | null>(null);
  const total = duration(tl);
  const heavy = total > 15 * 60_000 || (quality === 1080 && total > 8 * 60_000);
  const size = exportSize(tl, quality);
  const name = `${title || "مونتاج"} ${quality}p`;

  const start = async () => {
    if (!canExport()) {
      setPhase({ k: "error", m: "متصفحك ما يدعم التصدير. استخدم Chrome أو Edge (أو Safari حديث)." });
      return;
    }
    const ac = new AbortController();
    abort.current = ac;
    setPhase({ k: "running", p: 0 });
    try {
      await flush();
      let last = 0;
      const r = await exportVideo(
        tl,
        assets.map((a) => ({ id: a.id, kind: a.kind, url: a.status === "ready" ? a.url : null, hasAudio: a.hasAudio })),
        quality,
        (p) => {
          if (p - last >= 0.005 || p === 1) {
            last = p;
            setPhase({ k: "running", p });
          }
        },
        ac.signal,
      );
      download(r.blob, name);
      setPhase({ k: "done", r, saved: null, purgeAt: null });
      // a copy with the project (deleted with it after 3 days); if it can't be stored → just not kept
      let saved = false;
      // (the desktop program keeps everything on the computer: no copy goes up)
      if (!desktop()) {
        try {
          const s = await postJson<{ signedUrl?: string; multipart?: { uploadId: string; partSize: number } }>(`/api/jawad/editor/projects/${projectId}`, { action: "export_sign", bytes: r.blob.size });
          if (s.multipart) {
            // a long video: in parts, like large uploads
            await sendInParts(projectId, { id: "export", ...s.multipart }, r.blob, () => {});
            saved = true;
          } else {
            const put = await fetch(s.signedUrl!, { method: "PUT", headers: { "content-type": "video/mp4" }, body: r.blob });
            saved = put.ok;
          }
        } catch {
          saved = false;
        }
      }
      const m = await postJson<{ purgeAt: string }>(`/api/jawad/editor/projects/${projectId}`, { action: "exported", saved });
      setPhase({ k: "done", r, saved, purgeAt: m.purgeAt });
      onExported(m.purgeAt);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") setPhase({ k: "idle" });
      else setPhase({ k: "error", m: err instanceof ExportError ? err.message : `تعذّر التصدير: ${err instanceof Error ? err.message : "خطأ غير متوقع"}` });
    } finally {
      abort.current = null;
    }
  };

  const close = () => {
    if (phase.k === "running") return;
    if (phase.k !== "done") setPhase({ k: "idle" });
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} title="تصدير الفيديو">
      <div className="space-y-4 p-4">
        {phase.k === "idle" || phase.k === "error" ? (
          <>
            <div className="jw-seg" role="radiogroup" aria-label="الدقة">
              {([720, 1080] as const).map((q) => (
                <button key={q} type="button" role="radio" aria-checked={quality === q} onClick={() => setQuality(q)}>
                  {q}p {q === 1080 ? "(أوضح)" : "(أسرع وأخف)"}
                </button>
              ))}
            </div>
            <p className="text-sm text-jw-muted">
              المدة <b className="text-jw-ink" dir="ltr">{formatTime(total)}</b> · المقاس <b className="text-jw-ink" dir="ltr">{size.width}×{size.height}</b> · MP4
            </p>
            {heavy && (
              <p className="rounded-lg bg-jw-warn/10 p-2 text-xs text-jw-warn">
                <Icon name="alert" size={13} className="inline" /> المشروع طويل؛ التصدير يصير على جهازك وقد يأخذ وقتًا ويحتاج ذاكرة. اختر 720p لو جهازك ضعيف، وخلّ الصفحة مفتوحة.
              </p>
            )}
            <p className="text-xs text-jw-faint">التصدير يصير داخل متصفحك (بدون انتظار سيرفر). خلّ الصفحة مفتوحة حتى يخلص.</p>
            {phase.k === "error" && <p className="error-box text-sm">{phase.m}</p>}
            <button type="button" className="jw-btn jw-btn-primary w-full" disabled={!total} onClick={start}>
              <Icon name="download" size={16} /> صدّر الحين
            </button>
          </>
        ) : phase.k === "running" ? (
          <div className="space-y-3">
            <p className="text-sm">نصدّر الفيديو… {Math.round(phase.p * 100)}٪</p>
            <div className="h-2 overflow-hidden rounded-full bg-jw-surface-3">
              <div className="h-full bg-jw-accent transition-[width]" style={{ width: `${Math.max(2, phase.p * 100)}%` }} />
            </div>
            <p className="text-xs text-jw-faint">لا تسكّر الصفحة ولا تبدّل التبويب لين يخلص.</p>
            <button type="button" className="jw-btn w-full" onClick={() => abort.current?.abort()}>
              إلغاء
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-jw-ok">
              <Icon name="check" size={16} className="inline" /> خلص! نزل الفيديو على جهازك.
            </p>
            {phase.r.lostSound && <p className="text-xs text-jw-warn">متصفحك ما يقدر يحفظ الصوت في الملف، فطلع بدون صوت. صدّره من Chrome على الكمبيوتر.</p>}
            <button type="button" className="jw-btn w-full" onClick={() => download(phase.r.blob, name)}>
              <Icon name="download" size={16} /> نزّله مرة ثانية
            </button>
            {phase.purgeAt ? (
              <p className="rounded-lg border border-jw-warn/40 bg-jw-warn/10 p-3 text-xs leading-6 text-jw-warn">
                <Icon name="clock" size={13} className="inline" /> مقاطع هذا المشروع وملفاته تنحذف <b>{when(phase.purgeAt)}</b> (بعد ٣ أيام من التصدير). تأكد إن الفيديو محفوظ عندك.
                {phase.saved ? " حفظنا نسخة منه مع المشروع لين ذاك الوقت." : " ما قدرنا نحفظ نسخة منه عندنا (حجمه أكبر من المسموح حاليًا)، فاحتفظ بالملف اللي نزل."}
              </p>
            ) : (
              <p className="text-xs text-jw-faint">
                <span className="jw-spinner" /> نحفظ نسخة مع المشروع…
              </p>
            )}
            <button type="button" className="jw-btn jw-btn-quiet w-full" onClick={() => { setPhase({ k: "idle" }); onClose(); }}>
              رجوع للمونتاج
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
