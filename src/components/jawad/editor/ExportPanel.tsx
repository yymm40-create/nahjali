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
import type { Player } from "./player";
import { toSRT } from "./captions";
import { packProject, saveFile } from "./package";

/** what to save: the whole video, the picture without sound, the sound alone, the subtitles, or the frame under the playhead */
type What = "video" | "alpha" | "mute" | "audio" | "srt" | "frame";
const WHATS: { id: What; icon: string; name: string; hint: string }[] = [
  { id: "video", icon: "🎬", name: "الفيديو مع الصوت", hint: "ملف MP4 كامل" },
  { id: "alpha", icon: "🪟", name: "فيديو بخلفية شفافة", hint: "ملف WebM يحفظ الأماكن الفاضية شفافة" },
  { id: "mute", icon: "🔇", name: "الفيديو بدون صوت", hint: "الصورة بروحها MP4" },
  { id: "audio", icon: "🎧", name: "الصوت بروحه", hint: "ملف M4A" },
  { id: "srt", icon: "💬", name: "الكابشن SRT", hint: "ملف الترجمة" },
  { id: "frame", icon: "🖼️", name: "الفريم صورة", hint: "PNG عند المؤشر" },
];

/** the longest video Topaz takes (src/lib/editor/upscale.ts UPSCALE_MAX_MS) */
const UPSCALE_EXPORT_MAX_MS = 5 * 60_000;

type Phase = { k: "idle" } | { k: "running"; p: number } | { k: "done"; r: ExportResult; saved: boolean | null; purgeAt: string | null; local?: boolean; file: string } | { k: "error"; m: string };

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
  range,
  onRange,
  player,
  onExported,
  onUpscaleExport,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  title: string;
  kind: string;
  tl: Timeline;
  assets: EditorAsset[];
  flush: () => Promise<void>;
  /** «منطقة التصدير» (In → Out), or none */
  range: { from: number; to: number } | null;
  onRange: (r: { from: number; to: number } | null) => void;
  player: Player | null;
  onExported: (purgeAt: string) => void;
  /** «رفع دقة الفيديو كامل»: the finished file goes up and is upscaled whole; the page saves the result when it is ready (none: not offered) */
  onUpscaleExport?: (file: File, target: "4k" | "1080p", name: string) => void;
}) {
  const [res, setRes] = useState<ExportRes>(1080);
  const [quality, setQuality] = useState<ExportQuality>("high");
  const [fpsFrom, setFpsFrom] = useState<ExportFps>("project");
  // the typed bitrate («مخصص»), kept while the person edits it
  const [mbps, setMbps] = useState(12);
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [what, setWhat] = useState<What>("video");
  // the whole project, or its In → Out part
  const [part, setPart] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  // «رفع دقة الفيديو كامل»: after the export, the whole file is upscaled by Topaz (not clip by clip)
  const [upTarget, setUpTarget] = useState<"4k" | "1080p" | null>(null);
  // «نفس المصدر»: the biggest video of the timeline — its size from the project's own files, its frame rate and
  // bitrate measured in the browser once (the first time a «نفس المصدر» choice is made)
  const [source, setSource] = useState<SourceInfo | null>(() => sourceFromTimeline(tl, assets));
  const measured = useRef(false);
  const wantSource = res === "source" || quality === "source" || fpsFrom === "source";
  // «احفظ المشروع في جهازي»: what it is doing, or what went wrong
  const [packing, setPacking] = useState<{ busy: boolean; text: string; bad?: boolean } | null>(null);
  const total0 = duration(tl);
  const use = part && range && range.to > range.from ? range : null;
  const srt = toSRT(tl, undefined, use);
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
  const total = use ? use.to - use.from : total0;
  const plan = exportPlan(tl, { res, quality, fps: fpsFrom }, source, total);
  const stem = exportName(title, plan).replace(/\.mp4$/i, "") + (use ? `-${formatTime(use.from).replace(/[:.]/g, "-")}_${formatTime(use.to).replace(/[:.]/g, "-")}` : "");
  const name = `${stem}.${what === "audio" ? "m4a" : what === "alpha" ? "webm" : "mp4"}`;
  const picture = what === "video" || what === "mute" || what === "alpha";
  // whole-video upscale: only for the video with sound, made by the site (not the desktop program's local files), up to 5 minutes, and when it isn't 4K already
  const longSide = Math.max(plan.width, plan.height);
  const upWhy = !onUpscaleExport ? null : desktop() ? "برنامج حيدرة على الكمبيوتر يحفظ الملفات عندك بس، وما تروح لخادم رفع الدقة؛ استخدم المتصفح." : total > UPSCALE_EXPORT_MAX_MS ? "رفع الدقة لفيديو حتى ٥ دقائق؛ حدّد منطقة أقصر (In و Out)." : longSide >= 3800 ? "التصدير الحين 4K أصلًا؛ اختر دقة أقل (مثل 1080p) وارفعها بعدين." : null;
  const upOn = !!onUpscaleExport && what === "video" && !upWhy && upTarget !== null && (upTarget === "4k" || longSide < 1800);
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

  // the instant ones: the subtitles and the frame (no encoding)
  const quick = async () => {
    setNote(null);
    if (what === "srt") {
      if (!srt) return setNote("ما فيه كابشن في " + (use ? "هذي المنطقة." : "المشروع."));
      saveFile(new Blob([srt], { type: "application/x-subrip" }), `${stem}.srt`);
      return setNote("نزل ملف الكابشن ✓");
    }
    if (!player) return setNote("المعاينة ما جهزت بعد؛ جرّب بعد ثانية.");
    if (player.playing) player.toggle();
    const blob = await player.frameBlob();
    if (!blob) return setNote("ما قدرت أحفظ هذا الفريم. جرّب مرة ثانية.");
    saveFile(blob, `${stem.replace(/-[\d-]+_[\d-]+$/, "")}-${formatTime(player.ms).replace(/[:.]/g, "-")}.png`);
    setNote("نزل الفريم صورة ✓");
  };

  const start = async () => {
    if (what === "srt" || what === "frame") return quick();
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
          { range: use, audioOnly: what === "audio", mute: what === "mute", transparent: what === "alpha" },
        );
      // The links to the files live a few hours: a long session (or a file moved between sequences) can leave one dead,
      // and the browser then says only «Failed to fetch». The links are renewed first, and once more if it still fails.
      // (in the desktop program too: its own files keep their haidara-media:// link from the server, and the files that live
      // online — made by the AI, or uploaded from the site — get fresh links like anywhere else)
      const fresh = async () => (await api<{ assets: EditorAsset[] }>(`/api/jawad/editor/projects/${projectId}`)).assets;
      // a file that couldn't be read (only those words: any other error is shown as it is, so it can be fixed)
      const unreadable = (e: unknown) => e instanceof Error && /failed to fetch|networkerror|load failed|network error|ERR_|fetch.*(fail|abort)/i.test(e.message);
      let r: ExportResult;
      try {
        r = await run(await fresh().catch(() => assets));
      } catch (e) {
        if (!unreadable(e)) throw e;
        last = 0;
        setPhase({ k: "running", p: 0 });
        try {
          r = await run(await fresh());
        } catch (e2) {
          if (unreadable(e2)) {
            const local = desktop() ? " إذا الملف من جهازك، تأكد إنه باقي في مكانه وما انتقل أو انحذف." : "";
            throw new ExportError(`المتصفح ما قدر يقرأ أحد ملفات المشروع (الاتصال انقطع أو الملف ما عاد يُفتح).${local} حدّث الصفحة (F5) وجرّب التصدير مرة ثانية؛ وإذا تكرر، شغّل بلاغ 🐞 وأرسله. (${(e2 as Error).message.slice(0, 120)})`);
          }
          throw e2;
        }
      }
      download(r.blob, name);
      // «رفع دقة الفيديو كامل»: the same file goes up and is upscaled whole; the 4K file downloads by itself when it is ready
      if (upOn && upTarget && onUpscaleExport) onUpscaleExport(new File([r.blob], name, { type: "video/mp4" }), upTarget, `${stem}-${upTarget === "4k" ? "4K" : "1080p"}.mp4`);
      // only the whole video starts the 3-day countdown and keeps a copy; a part, a muted picture or the sound alone is just saved
      if (what !== "video" || use) {
        setPhase({ k: "done", r, saved: false, purgeAt: null, local: true, file: name });
        return;
      }
      setPhase({ k: "done", r, saved: null, purgeAt: null, file: name });
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
      setPhase({ k: "done", r, saved, purgeAt: m.purgeAt, file: name });
      onExported(m.purgeAt);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") setPhase({ k: "idle" });
      else setPhase({ k: "error", m: err instanceof ExportError ? err.message : `تعذّر التصدير: ${err instanceof Error ? err.message : "خطأ غير متوقع"}` });
    } finally {
      abort.current = null;
    }
  };

  // a finished export is shown only until the window is closed: the next time it opens it is a NEW export (the old one's
  // «نزّله مرة ثانية» used to stay there and hand back the old file even after the project was edited)
  const close = () => {
    if (phase.k === "running") return;
    setPhase({ k: "idle" });
    onClose();
  };
  // (also when the parent closes it without going through «close»: the state is reset as the window opens again)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && (phase.k === "done" || phase.k === "error")) setPhase({ k: "idle" });
  }

  return (
    <Dialog open={open} onClose={close} title="تصدير الفيديو">
      <div className="space-y-4 p-4">
        {phase.k === "idle" || phase.k === "error" ? (
          <>
            <div className="space-y-1.5">
              <span className="jw-label">وش تبي تحفظ؟</span>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label="نوع الملف">
                {WHATS.map((w) => (
                  <button key={w.id} type="button" role="radio" aria-checked={what === w.id} className={`rounded-lg border px-2 py-2 text-start text-xs ${what === w.id ? "border-jw-accent bg-jw-accent/10" : "border-jw-line hover:border-jw-line-strong"}`} onClick={() => { setWhat(w.id); setNote(null); }}>
                    <b className="block">{w.icon} {w.name}</b>
                    <span className="block text-[10px] leading-4 text-jw-muted">{w.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {what !== "frame" && (
              <div className="space-y-1.5 rounded-xl border border-jw-line p-2.5">
                <span className="jw-label">منطقة التصدير</span>
                <div className="jw-seg" role="radiogroup" aria-label="منطقة التصدير">
                  <button type="button" role="radio" aria-checked={!use} onClick={() => setPart(false)}>المشروع كله</button>
                  <button type="button" role="radio" aria-checked={!!use} disabled={!range} onClick={() => setPart(true)} title={range ? "" : "حدّد In و Out أول (زر I و O في التايملاين، أو من هنا)"}>
                    الجزء المحدد{range ? ` (${formatTime(range.from)} ← ${formatTime(range.to)})` : ""}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <button type="button" className="jw-chip !px-2.5 !py-1 !text-xs" onClick={() => { const m = Math.round(player?.ms ?? 0); onRange({ from: m, to: range && range.to > m ? range.to : total0 }); setPart(true); }}>
                    📍 In عند المؤشر
                  </button>
                  <button type="button" className="jw-chip !px-2.5 !py-1 !text-xs" onClick={() => { const m = Math.round(player?.ms ?? 0); onRange({ from: range && range.from < m ? range.from : 0, to: m }); setPart(true); }}>
                    📍 Out عند المؤشر
                  </button>
                  {range && (
                    <button type="button" className="jw-chip !px-2.5 !py-1 !text-xs" onClick={() => onRange(null)}>
                      ✕ شيل المنطقة
                    </button>
                  )}
                  <span className="text-jw-faint">اختصار: I و O (وAlt+X يشيلها)</span>
                </div>
              </div>
            )}

            {what === "frame" && <p className="rounded-lg bg-jw-surface-2 p-2.5 text-xs leading-6">يحفظ الصورة اللي واقف عليها المؤشر الحين <b dir="ltr">({formatTime(player?.ms ?? 0)})</b> بجودة المشروع الكاملة وبتدريجها، PNG.</p>}
            {what === "srt" && <p className="rounded-lg bg-jw-surface-2 p-2.5 text-xs leading-6">{srt ? `ملف ترجمة جاهز${use ? " للمنطقة المحددة (يبدأ من الصفر)" : ""}.` : "ما فيه كابشن للحين؛ سوّه من «الكابشن» أول."}</p>}
            {what === "alpha" && <p className="rounded-lg bg-jw-surface-2 p-2.5 text-xs leading-6">يحفظ الأماكن الفاضية في التايملاين شفافة (ملف WebM بصوته)، عشان تركّبه فوق أي خلفية في برنامج ثاني. الـMP4 ما يقدر يكون شفاف، فيطلع له خلفية سودا. ما يشتغل إلا في Chrome أو Edge على الكمبيوتر.</p>}
            {what === "audio" && <p className="rounded-lg bg-jw-surface-2 p-2.5 text-xs leading-6">الصوت المدموج كله (الكلام والموسيقى والمؤثرات بنفس المستويات) في ملف M4A، مدته <span dir="ltr">{formatTime(total)}</span>.</p>}

            {picture && (<>
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

            {what === "video" && onUpscaleExport && (
              <div className="space-y-1.5 rounded-xl border border-jw-line p-2.5">
                <span className="jw-label">⬆️ رفع الدقة للفيديو كامل (Topaz)</span>
                {upWhy ? (
                  <p className="text-[11px] leading-5 text-jw-muted">{upWhy}</p>
                ) : (
                  <>
                    <div className="jw-seg" role="radiogroup" aria-label="رفع الدقة للفيديو كامل">
                      <button type="button" role="radio" aria-checked={upTarget === null} onClick={() => setUpTarget(null)}>بدون</button>
                      <button type="button" role="radio" aria-checked={upTarget === "4k"} onClick={() => setUpTarget("4k")}>إلى 4K</button>
                      {longSide < 1800 && (
                        <button type="button" role="radio" aria-checked={upTarget === "1080p"} onClick={() => setUpTarget("1080p")}>إلى 1080p</button>
                      )}
                    </div>
                    <p className="text-[11px] leading-5 text-jw-muted">
                      {upTarget ? "بعد التصدير يطلع الفيديو كله (مو مقطع مقطع) لرفع الدقة، وتنزل لك النسخة المرفوعة لحالها لما تخلص (دقايق على حسب الطول). خلّ الصفحة مفتوحة؛ وإذا سكرتها ترجع تكمل لما تفتح المشروع." : "اختر الدقة وصدّر: الفيديو كامل يرتفع مرة وحدة بدل ما ترفع كل مقطع بروحه."}
                    </p>
                  </>
                )}
              </div>
            )}
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
            </>)}
            <p className="text-xs text-jw-faint">التصدير يصير داخل متصفحك (بدون انتظار سيرفر). خلّ الصفحة مفتوحة حتى يخلص.</p>
            {phase.k === "error" && <p className="error-box text-sm">{phase.m}</p>}
            <button type="button" className="jw-btn jw-btn-primary w-full" disabled={!total0} onClick={start}>
              <Icon name="download" size={16} /> {what === "srt" ? "نزّل الكابشن" : what === "frame" ? "نزّل الفريم" : what === "audio" ? "صدّر الصوت" : what === "mute" ? "صدّر بدون صوت" : upOn ? "صدّر وارفع الدقة" : "صدّر الحين"}
            </button>
            {note && <p className="text-xs text-jw-ok" aria-live="polite">{note}</p>}
            <div className="space-y-2 rounded-xl border border-jw-line p-3">
              <p className="text-sm font-bold">💾 المشروع نفسه في جهازك</p>
              <p className="text-xs leading-5 text-jw-muted">ملف واحد فيه التايملاين وكل الفيديوهات والأصوات والصور والكابشن: تحتفظ فيه، تفتحه في جهاز ثاني، أو تاخذ ملفاته لبرنامج ثاني.</p>
              <button type="button" className="jw-btn w-full" disabled={packing?.busy} onClick={pack}>
                {packing?.busy ? <span className="jw-spinner" /> : <Icon name="download" size={16} />} {packing?.busy ? packing.text : "احفظ المشروع في جهازي"}
              </button>
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
              <Icon name="check" size={16} className="inline" /> خلص! نزل الملف على جهازك.
            </p>
            {phase.r.lostSound && <p className="text-xs text-jw-warn">متصفحك ما يقدر يحفظ الصوت في الملف، فطلع بدون صوت. صدّره من Chrome على الكمبيوتر.</p>}
            <button type="button" className="jw-btn w-full" onClick={() => download(phase.r.blob, phase.file)}>
              <Icon name="download" size={16} /> نزّله مرة ثانية
            </button>
            {phase.local ? null : phase.purgeAt ? (
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
