"use client";

// «💬 تعليقات المراجعة» in «حيدرة كت»: «شارك للمراجعة» (an exported video uploaded with its progress, the copy of the
// last export, or «صدّر وشارك» from the export window) makes a private review link — the client watches, comments on
// moments and draws on the frame, without signing in. Here the owner turns the link on/off, sets its end and «يقدر
// ينزّل», sees every version («نسخة ٢» on the same link), and reads the comments: a press jumps to the moment on the
// timeline as it is now, then reply / resolve; «نفّذ تعليقات العميل» hands the open ones to حيدرا ماكس as a normal turn.

import { useEffect, useMemo, useRef, useState } from "react";
import { clock, EXPIRY_CHOICES, LINK_STATE_AR, mapTime, REVIEW_LIMITS, REVIEW_NOT_READY, versionName, type ExpiryChoice, type Mapped, type ReviewComment } from "@/lib/editor/review";
import type { Timeline } from "@/lib/editor/model";
import { track } from "@/lib/feature-track";
import DockFrame from "./DockFrame";
import Icon from "../Icon";
import ReviewShape from "./ReviewShape";
import type { ReviewApi, ShareOpts } from "./review-client";

export const REVIEW_ASK = "نفّذ تعليقات العميل المفتوحة على المونتاج، وقل لي وش سويت ووش يحتاجني.";

export default function ReviewPanel({
  dock,
  open,
  onClose,
  review,
  tl,
  focus,
  onSeek,
  onAsk,
  onExport,
  readOnly,
}: {
  dock?: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  review: ReviewApi;
  /** the timeline now (the comments' times are carried to it) */
  tl: Timeline;
  /** a comment pressed on the ruler */
  focus: number | null;
  onSeek: (ms: number) => void;
  /** «نفّذ تعليقات العميل»: a message to حيدرا ماكس */
  onAsk: (text: string) => void;
  /** «صدّر وشارك»: the export window, which shares the video when it is done */
  onExport: (opts: ShareOpts) => void;
  readOnly: boolean;
}) {
  const { data, error, upload } = review;
  const [opts, setOpts] = useState<ShareOpts>({ expiry: "none", allowDownload: false });
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [versionId, setVersionId] = useState<string>("all");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [peek, setPeek] = useState<number | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const peekVideo = useRef<HTMLVideoElement>(null);

  // opened: fresh numbers, and the «جديد» badge starts again
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      track("editor.review_open");
      void review.load().then(() => undefined);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const fresh = data?.fresh ?? 0;
  useEffect(() => {
    if (!open || !fresh) return;
    const t = setTimeout(() => void review.act({ action: "seen" }).catch(() => undefined), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fresh]);
  const [shownFocus, setShownFocus] = useState<number | null>(null);
  if (focus !== shownFocus) {
    setShownFocus(focus);
    if (focus != null) {
      setPeek(focus);
      setFilter("all");
      setVersionId("all");
    }
  }

  const versions = useMemo(() => data?.versions ?? [], [data]);
  const byVersion = useMemo(() => new Map(versions.map((v) => [v.id, v])), [versions]);
  const comments = useMemo(() => data?.comments ?? [], [data]);
  const top = comments
    .filter((c) => c.kind === "comment" && c.parentId == null && !c.byOwner)
    .filter((c) => versionId === "all" || c.versionId === versionId)
    .filter((c) => filter === "all" || !c.resolved)
    .sort((a, b) => (byVersion.get(b.versionId)?.n ?? 0) - (byVersion.get(a.versionId)?.n ?? 0) || (a.at ?? Infinity) - (b.at ?? Infinity));
  const openCount = comments.filter((c) => c.kind === "comment" && c.parentId == null && !c.byOwner && !c.resolved).length;
  const approvals = comments.filter((c) => c.kind === "approve");
  const where = (c: ReviewComment): Mapped | null => {
    if (c.at == null) return null;
    const v = byVersion.get(c.versionId);
    return v?.fit ? mapTime(v.anchors, c.at, tl) : { at: c.at, how: "lost" };
  };
  const lost = top.some((c) => where(c)?.how === "lost");
  const seenAt = data?.review ? Date.parse(data.review.seenAt) : 0;
  const link = data?.review ? `${typeof location !== "undefined" ? location.origin : ""}${data.review.path}` : "";

  const run = async (what: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setNote(null);
    try {
      await what();
      if (ok) setNote({ text: ok, bad: false });
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : String(e), bad: true });
    } finally {
      setBusy(false);
    }
  };
  const shared = (r: { n: number; fit: boolean }) => `انحفظت ${versionName(r.n)} على الرابط ✓${r.fit ? "" : " (طول الفيديو ما يطابق المشروع، فالتعليقات بتظهر على وقتها في الفيديو)"}`;
  const pickFile = (f: File | undefined) => {
    if (!f) return;
    void run(async () => setNote({ text: shared(await review.shareFile(f, opts)), bad: false }));
  };
  const settings = (patch: Record<string, unknown>) => void run(() => review.act({ action: "settings", ...patch }));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setNote({ text: "انسخ الرابط ✓ أرسله لعميلك.", bad: false });
    } catch {
      setNote({ text: link, bad: false });
    }
  };

  const peekComment = peek != null ? comments.find((c) => c.id === peek) : null;
  const peekVersion = peekComment ? byVersion.get(peekComment.versionId) : null;
  useEffect(() => {
    const v = peekVideo.current;
    if (v && peekComment?.at != null) v.currentTime = peekComment.at / 1000;
  }, [peekComment?.id, peekComment?.at]);

  const shareButtons = (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="space-y-1">
          <span className="jw-label">مدة الرابط</span>
          <select className="jw-select !py-1.5 text-xs" value={opts.expiry} onChange={(e) => setOpts({ ...opts, expiry: e.target.value as ExpiryChoice })} disabled={!!data?.review}>
            {EXPIRY_CHOICES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-1.5 pb-1.5">
          <input type="checkbox" checked={data?.review ? data.review.allowDownload : opts.allowDownload} onChange={(e) => (data?.review ? settings({ allowDownload: e.target.checked }) : setOpts({ ...opts, allowDownload: e.target.checked }))} />
          يقدر ينزّل
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className="jw-btn jw-btn-primary !min-h-9 text-xs" disabled={busy || !!upload || readOnly} onClick={() => onExport(opts)} title="يفتح التصدير، ولما يخلص ينرفع الفيديو للرابط">
          <Icon name="download" size={14} /> صدّر وشارك
        </button>
        <button type="button" className="jw-btn !min-h-9 text-xs" disabled={busy || !!upload} onClick={() => file.current?.click()} title="فيديو صدّرته قبل (MP4 أو MOV، ٢٠٠ ميجا بالأكثر)">
          <Icon name="upload" size={14} /> ارفع فيديو مصدّر
        </button>
        {data?.hasExport && (
          <button type="button" className="jw-btn !min-h-9 text-xs" disabled={busy || !!upload} onClick={() => void run(async () => setNote({ text: shared(await review.shareExport(opts)), bad: false }))} title="آخر تصدير محفوظ مع المشروع">
            <Icon name="retry" size={14} /> شارك آخر تصدير
          </button>
        )}
      </div>
      <input ref={file} type="file" accept="video/mp4,video/quicktime,.mp4,.mov" className="hidden" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
      {upload && (
        <div className="space-y-1" aria-live="polite">
          <div className="h-1.5 overflow-hidden rounded-full bg-jw-surface-2">
            <div className="h-full bg-jw-accent transition-[width]" style={{ width: `${Math.round(upload.p * 100)}%` }} />
          </div>
          <p className="m-0 text-[11px] text-jw-muted">{upload.phase === "up" ? `نرفع الفيديو… ${Math.round(upload.p * 100)}%` : "نفحص الفيديو ونجهّز الرابط…"}</p>
        </div>
      )}
    </div>
  );

  return (
    <DockFrame dock={dock} open={open} onClose={onClose} title="تعليقات المراجعة">
      <div className="space-y-3 p-3">
        <p className="m-0 text-[12px] leading-5 text-jw-muted">شارك المونتاج مع عميلك برابط خاص: يشوفه ويعلّق على أي لحظة ويرسم على الصورة، بدون تسجيل.</p>
        {error && <p className="m-0 rounded-lg bg-jw-surface-2 px-2 py-1.5 text-[12px] text-jw-muted">ℹ️ {error}</p>}
        {!data && !error && (
          <p className="m-0 flex items-center gap-2 text-[12px] text-jw-muted">
            <span className="jw-spinner !h-3 !w-3" /> نجيب المراجعة…
          </p>
        )}
        {data && !data.ready && <p className="m-0 rounded-lg bg-jw-surface-2 px-2 py-1.5 text-[12px] text-jw-muted">ℹ️ {REVIEW_NOT_READY}</p>}

        {data?.ready && !data.review && (
          <section className="space-y-2 rounded-xl border border-jw-line p-2.5">
            <b className="text-sm">شارك للمراجعة</b>
            {shareButtons}
          </section>
        )}

        {data?.ready && data.review && (
          <section className="space-y-2 rounded-xl border border-jw-line p-2.5">
            <div className="flex items-center gap-2">
              <b className="flex-1 text-sm">رابط المراجعة</b>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${data.review.state === "on" ? "bg-emerald-500/15 text-emerald-400" : "bg-jw-surface-2 text-jw-muted"}`}>{LINK_STATE_AR[data.review.state]}</span>
            </div>
            <div className="flex gap-1.5">
              <input className="jw-input !py-1 text-[11px]" readOnly value={link} dir="ltr" onFocus={(e) => e.currentTarget.select()} aria-label="رابط المراجعة" />
              <button type="button" className="jw-btn jw-btn-icon !min-h-8" onClick={() => void copy()} aria-label="انسخ الرابط" title="انسخ الرابط"><Icon name="copy" size={14} /></button>
              <a className="jw-btn jw-btn-icon !min-h-8" href={data.review.path} target="_blank" rel="noreferrer" aria-label="افتح صفحة العميل" title="افتح صفحة العميل"><Icon name="external" size={14} /></a>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={data.review.active} onChange={(e) => settings({ active: e.target.checked })} disabled={busy} /> شغّال
              </label>
              <select className="jw-select !w-auto !py-1 text-xs" value="" onChange={(e) => e.target.value && settings({ expiry: e.target.value })} disabled={busy} aria-label="مدة الرابط">
                <option value="">{data.review.expiresAt ? `ينتهي ${new Date(data.review.expiresAt).toLocaleDateString("ar", { day: "numeric", month: "short" })}` : "بدون انتهاء"} — غيّر…</option>
                {EXPIRY_CHOICES.map((c) => (
                  <option key={c.id} value={c.id}>{c.id === "none" ? c.label : `${c.label} من الحين`}</option>
                ))}
              </select>
            </div>
            <details>
              <summary className="cursor-pointer text-[12px]">شارك نسخة جديدة ({versionName((versions.at(-1)?.n ?? 0) + 1)})</summary>
              <div className="mt-2">{shareButtons}</div>
            </details>
            <ul className="m-0 list-none space-y-1 p-0 text-[12px]">
              {[...versions].reverse().map((v) => {
                const ok = approvals.filter((a) => a.versionId === v.id);
                return (
                  <li key={v.id} className="flex flex-wrap items-center gap-1.5">
                    <b>{versionName(v.n)}</b>
                    <span className="text-jw-faint tabular-nums" dir="ltr">{clock(v.durationMs)}</span>
                    {!v.url && <span className="text-jw-faint">(انحذف فيديوها، التعليقات باقية)</span>}
                    {ok.length > 0 && <span className="text-emerald-400">✅ وافق: {ok.map((a) => a.author).join("، ")}</span>}
                  </li>
                );
              })}
            </ul>
            <button type="button" className="text-[11px] text-jw-danger underline" disabled={busy} onClick={() => window.confirm("تحذف رابط المراجعة وكل نسخه وتعليقاته؟ ما يرجع.") && void run(() => review.act({ action: "delete" }), "انحذف الرابط.")}>
              احذف الرابط
            </button>
          </section>
        )}

        {note && <p className={`m-0 break-words text-[12px] ${note.bad ? "text-jw-danger" : "text-emerald-400"}`}>{note.text}</p>}

        {data?.review && (
          <section className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <b className="flex-1 text-sm">التعليقات ({openCount} مفتوح)</b>
              <select className="jw-select !w-auto !py-1 text-xs" value={versionId} onChange={(e) => setVersionId(e.target.value)} aria-label="النسخة">
                <option value="all">كل النسخ</option>
                {[...versions].reverse().map((v) => (
                  <option key={v.id} value={v.id}>{versionName(v.n)}</option>
                ))}
              </select>
              <select className="jw-select !w-auto !py-1 text-xs" value={filter} onChange={(e) => setFilter(e.target.value as "open" | "all")} aria-label="أي تعليقات">
                <option value="open">المفتوحة</option>
                <option value="all">الكل</option>
              </select>
            </div>
            {openCount > 0 && !readOnly && (
              <button type="button" className="jw-btn w-full !min-h-9 text-xs" onClick={() => { track("editor.review_apply"); onAsk(REVIEW_ASK); }}>
                <span className="jw-orb h-4 w-4" aria-hidden /> نفّذ تعليقات العميل مع حيدرا ماكس
              </button>
            )}
            {lost && <p className="m-0 text-[11px] leading-5 text-jw-warn">⚠️ تغيّر المشروع بعد بعض النسخ: التعليقات اللي عليها ⚠️ على وقتها في النسخة، مو على التايملاين الحين.</p>}
            {peekComment && peekVersion?.url && peekComment.at != null && (
              <div className="relative overflow-hidden rounded-lg bg-black" style={{ aspectRatio: `${peekVersion.width || 16} / ${peekVersion.height || 9}`, maxHeight: 220, margin: "0 auto" }}>
                <video ref={peekVideo} src={peekVersion.url} className="h-full w-full" muted playsInline preload="metadata" onLoadedMetadata={(e) => (e.currentTarget.currentTime = (peekComment.at ?? 0) / 1000)} />
                {peekComment.shape && <ReviewShape shape={peekComment.shape} />}
                <button type="button" className="absolute end-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white" onClick={() => setPeek(null)} aria-label="سكّر المعاينة"><Icon name="x" size={12} /></button>
                <span className="absolute bottom-1 start-1 rounded bg-black/60 px-1.5 text-[10px] text-white">{versionName(peekVersion.n)} · <span dir="ltr">{clock(peekComment.at)}</span></span>
              </div>
            )}
            {!top.length && <p className="m-0 text-[12px] text-jw-muted">{filter === "open" ? "ما فيه تعليقات مفتوحة." : "ما فيه تعليقات بعد."}</p>}
            <ol className="m-0 list-none space-y-2 p-0">
              {top.map((c) => {
                const m = where(c);
                const v = byVersion.get(c.versionId);
                const isNew = Date.parse(c.createdAt) > seenAt;
                return (
                  <li key={c.id} className={`rounded-xl border p-2.5 ${peek === c.id ? "border-jw-accent" : "border-jw-line"} ${c.resolved ? "opacity-60" : ""}`}>
                    <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                      <b dir="auto" className="max-w-[9rem] truncate">{c.author}</b>
                      {v && <span className="text-jw-faint">{versionName(v.n)}</span>}
                      {m && (
                        <button
                          type="button"
                          className="jw-chip tabular-nums"
                          dir="ltr"
                          onClick={() => {
                            onSeek(m.at);
                            setPeek(c.id);
                          }}
                          title={m.how === "lost" ? "تغيّر المشروع: هذا وقته في النسخة" : m.how === "moved" ? `كان عند ${clock(c.at ?? 0)} في النسخة` : "روح للحظة"}
                        >
                          {m.how === "lost" ? "⚠️ " : ""}
                          {clock(m.at)}
                        </button>
                      )}
                      {c.shape && <span className="text-jw-muted" title="رسم على الصورة">{c.shape.t === "box" ? "▢" : "↗"}</span>}
                      {isNew && <span className="rounded-full bg-jw-accent/15 px-1.5 text-[10px] font-semibold text-jw-accent">جديد</span>}
                    </div>
                    <p className="m-0 mt-1 whitespace-pre-wrap break-words text-[13px] leading-6" dir="auto">{c.body}</p>
                    {comments
                      .filter((r) => r.parentId === c.id)
                      .map((r) => (
                        <div key={r.id} className="mt-1.5 border-s-2 border-jw-line ps-2 text-[12px]">
                          <b dir="auto" className={r.byOwner ? "text-jw-accent" : ""}>{r.byOwner ? "أنت" : r.author}</b>
                          <p className="m-0 whitespace-pre-wrap break-words leading-5" dir="auto">{r.body}</p>
                        </div>
                      ))}
                    {replyTo === c.id ? (
                      <div className="mt-2 flex gap-1.5">
                        <input className="jw-input !py-1 text-[12px]" maxLength={REVIEW_LIMITS.body} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="ردّك يوصل للعميل" dir="auto" />
                        <button type="button" className="jw-btn !min-h-8 text-xs" disabled={busy || !reply.trim()} onClick={() => void run(async () => { await review.act({ action: "reply", parentId: c.id, body: reply }); setReply(""); setReplyTo(null); })}>رد</button>
                      </div>
                    ) : (
                      <div className="mt-1.5 flex gap-3 text-[11px]">
                        <button type="button" className="text-jw-muted underline" onClick={() => { setReplyTo(c.id); setReply(""); }}>رد</button>
                        <button type="button" className="text-jw-muted underline" disabled={busy} onClick={() => void run(() => review.act({ action: "resolve", id: c.id, resolved: !c.resolved }))}>
                          {c.resolved ? "رجّعه مفتوح" : "✓ تم"}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </div>
    </DockFrame>
  );
}
