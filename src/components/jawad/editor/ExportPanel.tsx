"use client";

import { useRef, useState } from "react";
import { duration, flatten, formatTime, type Timeline } from "@/lib/editor/model";
import { api, postJson } from "@/lib/fetch";
import Dialog from "../Dialog";
import Icon from "../Icon";
import { desktop } from "./desktop";
import { canExport, download, exportVideo, ExportError, type ExportResult } from "./export";
import {
  exportName,
  exportPlan,
  fmtBytes,
  QUALITY_AR,
  QUALITY_LIST,
  RES_AR,
  RES_HINT,
  RES_LIST,
  sourceFromTimeline,
  sourceLine,
  type ExportFps,
  type ExportQuality,
  type ExportRes,
  type SourceInfo,
} from "@/lib/editor/export-plan";
import { measureSource } from "./source-info";
import { sendInParts } from "./parts";
import type { EditorAsset } from "./types";
import { toSRT } from "./captions";
import { packProject, saveFile } from "./package";

type Phase = { k: "idle" } | { k: "running"; p: number } | { k: "done"; r: ExportResult; saved: boolean | null; purgeAt: string | null } | { k: "error"; m: string };

const when = (iso: string) => new Date(iso).toLocaleString("ar", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });

/** «صدّر»: 720p or 1080p, made in this browser; then the file downloads and the 3-day countdown starts. */
export default function ExportPanel({
  open,
  onClose,
  projectId,
  title,
  kind,
  tl,
  assets,
  flush,
  onExported,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  title: string;
  kind: string;
  tl: Timeline;
  assets: EditorAsset[];
  flush: () => Promise<void>;
  onExported: (purgeAt: string) => void;
}) {
  const [res, setRes] = useState<ExportRes>(1080);
  const [quality, setQuality] = useState<ExportQuality>("high");
  const [fpsFrom, setFpsFrom] = useState<ExportFps>("project");
  // the typed bitrate («مخصص»), kept while the person edits it
  const [mbps, setMbps] = useState(12);
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  // «نفس المصدر»: the biggest video of the timeline — its size from the project's own files, its frame rate and
  // bitrate measured in the browser once (the first time a «نفس المصدر» choice is made)
  const [source, setSource] = useState<SourceInfo | null>(() => sourceFromTimeline(tl, assets));
  const measured = useRef(false);
  const wantSource = res === "source" || quality === "source" || fpsFrom === "source";
  // «احفظ المشروع في جهازي»: what it is doing, or what went wrong
  const [packing, setPacking] = useState<{ busy: boolean; text: string; bad?: boolean } | null>(null);
  const srt = toSRT(tl);
  const pack = async () => {
    setPacking({ busy: true, text: "نجهّز المشروع…" });
    try {
      await flush();
      const r = await packProject({ title: title || "مونتاج", kind, tl, assets }, (text) => setPacking({ busy: true, text }));
      saveFile(r.blob, r.name);
      setPacking({ busy: false, text: `نزل «\u2068${r.name}\u2069» على جهازك. افتحه في أي جهاز من «افتح مشروع محفوظ».` });
    } catch (e) {
      setPacking({ busy: false, text: e instanceof Error ? e.message : "تعذّر حفظ المشروع.", bad: true });
    }
  };
  const abort = useRef<AbortController | null>(null);
  const total = duration(tl);
  const plan = exportPlan(tl, { res, quality, fps: fpsFrom }, source);
  const name = exportName(title, plan);
  // the file's own frame rate and bitrate, read from the file itself (only when «نفس المصدر» is wanted)
  const matchSource = async () => {
    if (measured.current) return;
    measured.current = true;
    const base = sourceFromTimeline(tl, assets);
    if (!base) return;
    const file = assets.find((a) => a.kind === "video" && a.width === base.width && a.height === base.height && a.status === "ready" && a.url);
    const more = file?.url ? await measureSource(file.url).catch(() => null) : null;
    setSource(more ? { ...base, fps: more.fps ?? base.fps, mbps: more.mbps ?? base.mbps } : base);
  };

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
      const run = (list: { id: string; kind: EditorAsset["kind"]; url: string | null; status: string; hasAudio: boolean }[]) =>
        exportVideo(
          flatten(tl),
          list.map((a) => ({ id: a.id, kind: a.kind, url: a.status === "ready" ? a.url : null, hasAudio: a.hasAudio })),
          plan,
          (p) => {
            if (p - last >= 0.005 || p === 1) {
              last = p;
              setPhase({ k: "running", p });
            }
          },
          ac.signal,
        );
      // The links to the files live a few hours: a long session (or a file moved between sequences) can leave one dead,
      // and the browser then says only «Failed to fetch». The links are renewed first, and once more if it still fails.
      const fresh = async () => (desktop() ? assets : (await api<{ assets: EditorAsset[] }>(`/api/jawad/editor/projects/${projectId}`)).assets);
      let r: ExportResult;
      try {
        r = await run(await fresh().catch(() => assets));
      } catch (e) {
        if (!(e instanceof TypeError || (e instanceof Error && /failed to fetch|networkerror|load failed/i.test(e.message)))) throw e;
        last = 0;
        setPhase({ k: "running", p: 0 });
        try {
          r = await run(await fresh());
        } catch (e2) {
          if (e2 instanceof TypeError || (e2 instanceof Error && /failed to fetch|networkerror|load failed/i.test(e2.message))) {
            throw new ExportError("المتصفح ما قدر يقرأ أحد ملفات المشروع (الاتصال انقطع أو الملف ما عاد يُفتح). حدّث الصفحة (F5) وجرّب التصدير مرة ثانية؛ وإذا تكرر، شغّل بلاغ 🐞 وأرسله.");
          }
          throw e2;
        }
      }
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
            <div className="space-y-1.5">
              <span className="jw-label">الدقة</span>
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="الدقة">
                {RES_LIST.map((r) => (
                  <button
                    key={String(r)}
                    type="button"
                    role="radio"
                    aria-checked={res === r}
                    title={RES_HINT[String(r)]}
                    className={`rounded-lg border px-2 py-1.5 text-start text-xs ${res === r ? "border-jw-accent bg-jw-accent/10" : "border-jw-line hover:border-jw-line-strong"}`}
                    onClick={() => {
                      setRes(r);
                      if (r === "source") void matchSource();
                    }}
                  >
                    <b className="block">{RES_AR[String(r)]}</b>
                    <span className="block text-[10px] leading-4 text-jw-muted">{RES_HINT[String(r)]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="jw-label">جودة الصورة (البت ريت)</span>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="جودة الصورة">
                {QUALITY_LIST.map((q) => (
                  <button
                    key={q}
                    type="button"
                    role="radio"
                    aria-checked={quality === q}
                    className={`jw-chip !px-2.5 !py-1 !text-xs ${quality === q ? "!border-jw-accent !bg-jw-accent/15" : ""}`}
                    onClick={() => {
                      setQuality(q);
                      if (q === "source") void matchSource();
                    }}
                  >
                    {QUALITY_AR[q]}
                  </button>
                ))}
                <button
                  type="button"
                  role="radio"
                  aria-checked={typeof quality === "object"}
                  className={`jw-chip !px-2.5 !py-1 !text-xs ${typeof quality === "object" ? "!border-jw-accent !bg-jw-accent/15" : ""}`}
                  onClick={() => setQuality({ mbps })}
                >
                  مخصص
                </button>
              </div>
              {typeof quality === "object" && (
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="number"
                    min={1}
                    max={200}
                    step={1}
                    className="jw-input !min-h-8 w-20 text-xs"
                    value={mbps}
                    onChange={(e) => {
                      const v = Math.min(200, Math.max(1, Number(e.target.value) || 1));
                      setMbps(v);
                      setQuality({ mbps: v });
                    }}
                    aria-label="البت ريت بالميجابت في الثانية"
                  />
                  <span className="text-jw-muted">ميجابت/ثانية — أعلى رقم = جودة أعلى وملف أكبر</span>
                </label>
              )}
            </div>

            <div className="space-y-1.5">
              <span className="jw-label">الفريم ريت</span>
              <div className="jw-seg" role="radiogroup" aria-label="الفريم ريت">
                <button type="button" role="radio" aria-checked={fpsFrom === "project"} onClick={() => setFpsFrom("project")}>
                  مثل المشروع ({Math.round(tl.fps)})
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={fpsFrom === "source"}
                  onClick={() => {
                    setFpsFrom("source");
                    void matchSource();
                  }}
                >
                  نفس المصدر{source?.fps ? ` (${Math.round(source.fps)})` : ""}
                </button>
              </div>
            </div>

            <button
              type="button"
              className="w-full rounded-xl border border-jw-accent/50 bg-jw-accent/5 p-2 text-start text-xs leading-5"
              onClick={() => {
                setRes("source");
                setQuality("source");
                setFpsFrom("source");
                void matchSource();
              }}
            >
              <b className="text-jw-accent">🎯 المدخل = المخرج</b>
              <span className="block text-jw-muted">ضغطة واحدة: نفس دقة المقطع الأصلي وفريم ريته وبت ريته — بلا تصغير ولا نزول جودة.</span>
            </button>

            <p className="rounded-lg bg-jw-surface-2 p-2.5 text-sm leading-6">
              الملف الطالع: <b className="text-jw-ink" dir="ltr">{plan.width}×{plan.height}</b> · <b className="text-jw-ink" dir="ltr">{plan.fps} ف/ث</b> · <b className="text-jw-ink" dir="ltr">{plan.mbps} ميجابت/ث</b> · MP4
              <span className="block text-xs text-jw-muted">
                المدة <span dir="ltr">{formatTime(total)}</span> · الحجم تقريبًا <span dir="ltr">{fmtBytes(plan.bytes)}</span>
              </span>
              <span className="block text-xs text-jw-faint">المصدر: {sourceLine(source)}</span>
            </p>
            {plan.noSource && wantSource && <p className="rounded-lg bg-jw-warn/10 p-2 text-xs text-jw-warn">ما فيه مقطع فيديو في التايملاين أطابق مقاسه، فاستخدمت مقاس المشروع.</p>}
            {plan.heavy && (
              <p className="rounded-lg bg-jw-warn/10 p-2 text-xs text-jw-warn">
                <Icon name="alert" size={13} className="inline" /> هذا التصدير ثقيل (دقة عالية أو مشروع طويل): يصير على جهازك ويأخذ وقتًا ويحتاج ذاكرة. لو جهازك ضعيف اختر دقة أقل، وخلّ الصفحة مفتوحة.
              </p>
            )}
            <p className="text-xs text-jw-faint">التصدير يصير داخل متصفحك (بدون انتظار سيرفر). خلّ الصفحة مفتوحة حتى يخلص.</p>
            {phase.k === "error" && <p className="error-box text-sm">{phase.m}</p>}
            <button type="button" className="jw-btn jw-btn-primary w-full" disabled={!total} onClick={start}>
              <Icon name="download" size={16} /> صدّر الحين
            </button>
            <div className="space-y-2 rounded-xl border border-jw-line p-3">
              <p className="text-sm font-bold">💾 المشروع نفسه في جهازك</p>
              <p className="text-xs leading-5 text-jw-muted">ملف واحد فيه التايملاين وكل الفيديوهات والأصوات والصور والكابشن: تحتفظ فيه، تفتحه في جهاز ثاني، أو تاخذ ملفاته لبرنامج ثاني.</p>
              <button type="button" className="jw-btn w-full" disabled={packing?.busy} onClick={pack}>
                {packing?.busy ? <span className="jw-spinner" /> : <Icon name="download" size={16} />} {packing?.busy ? packing.text : "احفظ المشروع في جهازي"}
              </button>
              {srt && (
                <button type="button" className="jw-btn jw-btn-quiet w-full" onClick={() => saveFile(new Blob([srt], { type: "application/x-subrip" }), `${title || "captions"}.srt`)}>
                  <Icon name="download" size={16} /> الكابشن بروحه (SRT)
                </button>
              )}
              {packing && !packing.busy && <p className={`text-xs ${packing.bad ? "text-jw-danger" : "text-jw-ok"}`}>{packing.text}</p>}
            </div>
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
