"use client";

// «رابط مراجعة للعميل» — the client's page (no sign-in): the video, a bar with every comment on its moment, «علّق هنا» at
// the current time (or a press on the bar), a box or an arrow drawn on the frame, replies, and «موافق» on the whole
// version. The name is typed once (kept on this device). Everything typed is shown as plain text.

import { useEffect, useMemo, useRef, useState } from "react";
import { postJson } from "@/lib/fetch";
import { cleanShape, clock, REVIEW_LIMITS, versionName, type ReviewComment, type ReviewVersion, type Shape } from "@/lib/editor/review";
import Icon from "../Icon";
import ReviewShape from "./ReviewShape";

interface Initial {
  title: string;
  allowDownload: boolean;
  versions: ReviewVersion[];
  comments: ReviewComment[];
}

const NAME_KEY = "jw-review-name";
type Tool = null | "box" | "arrow";

export default function ReviewWatch({ slug, initial }: { slug: string; initial: Initial }) {
  const versions = initial.versions;
  const latest = [...versions].reverse().find((v) => v.url) ?? versions[versions.length - 1] ?? null;
  const [versionId, setVersionId] = useState(latest?.id ?? "");
  const version = versions.find((v) => v.id === versionId) ?? latest;
  const [comments, setComments] = useState(initial.comments);
  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [askName, setAskName] = useState(false);
  const [body, setBody] = useState("");
  // the moment the comment is for (null: the whole video)
  const [at, setAt] = useState<number | null>(null);
  const [shape, setShape] = useState<Shape | null>(null);
  const [tool, setTool] = useState<Tool>(null);
  const [drag, setDrag] = useState<{ x: number; y: number; x2: number; y2: number } | null>(null);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  const [now, setNow] = useState(0);
  const [dur, setDur] = useState(version?.durationMs ?? 0);
  const [shown, setShown] = useState<number | null>(null);
  const [honey, setHoney] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const opened = useRef(0);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      opened.current = Date.now();
      try {
        const n = localStorage.getItem(NAME_KEY) ?? "";
        setName(n);
        setNameDraft(n);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const mine = useMemo(() => comments.filter((c) => c.versionId === version?.id), [comments, version?.id]);
  const top = useMemo(() => mine.filter((c) => c.kind === "comment" && c.parentId == null).sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity) || a.id - b.id), [mine]);
  const approvals = mine.filter((c) => c.kind === "approve");
  const replies = (id: number) => mine.filter((c) => c.parentId === id);
  const total = dur || version?.durationMs || 0;
  const shownShape = shown != null ? (comments.find((c) => c.id === shown)?.shape ?? null) : null;

  const seek = (ms: number) => {
    const v = video.current;
    if (v) v.currentTime = ms / 1000;
    setNow(ms);
  };
  const commentHere = () => {
    const v = video.current;
    v?.pause();
    setAt(Math.round((v?.currentTime ?? 0) * 1000));
    setShown(null);
    setTimeout(() => box.current?.focus(), 0);
  };
  const onBar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!total) return;
    const r = e.currentTarget.getBoundingClientRect();
    // a video's time runs left → right (like the player's own bar), even on an Arabic page
    const ms = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * total);
    video.current?.pause();
    seek(ms);
    setAt(ms);
    setShown(null);
  };

  // drawing on the frame: the corners as shares of the picture
  const point = (e: React.PointerEvent) => {
    const r = frame.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
  };
  const drawStart = (e: React.PointerEvent) => {
    if (!tool) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    video.current?.pause();
    const p = point(e);
    setDrag({ x: p.x, y: p.y, x2: p.x, y2: p.y });
  };
  const drawMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = point(e);
    setDrag({ ...drag, x2: p.x, y2: p.y });
  };
  const drawEnd = () => {
    if (!drag || !tool) return;
    const s = cleanShape({ t: tool, x1: drag.x, y1: drag.y, x2: drag.x2, y2: drag.y2 });
    setDrag(null);
    if (!s) return;
    setShape(s);
    setTool(null);
    if (at == null) setAt(Math.round((video.current?.currentTime ?? 0) * 1000));
    setTimeout(() => box.current?.focus(), 0);
  };

  const keepName = () => {
    const n = nameDraft.trim().slice(0, REVIEW_LIMITS.name);
    if (!n) return false;
    setName(n);
    try {
      localStorage.setItem(NAME_KEY, n);
    } catch {}
    setAskName(false);
    return true;
  };

  const send = async (payload: Record<string, unknown>) => {
    if (!version) return false;
    if (!name) {
      setAskName(true);
      return false;
    }
    setBusy(true);
    setNote(null);
    try {
      const r = await postJson<{ kept: boolean; comments: ReviewComment[] }>(`/api/review/${slug}`, { versionId: version.id, name, website: honey, typedMs: Date.now() - opened.current, ...payload });
      setComments(r.comments);
      return true;
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : String(e), bad: true });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const post = async () => {
    if (!body.trim()) return;
    if (await send({ action: "comment", body, at, shape })) {
      setBody("");
      setShape(null);
      setAt(null);
      setNote({ text: "وصل تعليقك ✓", bad: false });
    }
  };
  const approve = async () => {
    if (!version || !window.confirm(`توافق على ${versionName(version.n)} كاملة؟`)) return;
    if (await send({ action: "approve" })) setNote({ text: "وصلت موافقتك ✓", bad: false });
  };
  const sendReply = async (id: number) => {
    if (!reply.trim()) return;
    if (await send({ action: "comment", body: reply, parentId: id })) {
      setReply("");
      setReplyTo(null);
    }
  };

  if (!version) {
    return (
      <div className="mx-auto max-w-xl px-4 pb-16 pt-10">
        <div className="jw-panel p-6 text-center text-sm text-jw-muted">ما فيه فيديو على هذا الرابط بعد.</div>
      </div>
    );
  }
  const w = version.width || 16;
  const h = version.height || 9;
  const live = drag && tool ? cleanShape({ t: tool, x1: drag.x, y1: drag.y, x2: drag.x2, y2: drag.y2 }) : null;
  const overlay = live ?? shape ?? shownShape;

  return (
    <div className="mx-auto max-w-6xl px-3 pb-16 pt-4 sm:px-4">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="m-0 min-w-0 flex-1 truncate text-lg font-semibold" dir="auto">{initial.title || "مراجعة فيديو"}</h1>
        {versions.length > 1 ? (
          <select className="jw-select !w-auto !py-1.5 text-sm" value={version.id} onChange={(e) => { setVersionId(e.target.value); setShown(null); setAt(null); setShape(null); }} aria-label="النسخة">
            {[...versions].reverse().map((v) => (
              <option key={v.id} value={v.id} disabled={!v.url}>
                {versionName(v.n)}{v.id === latest?.id ? " (الأحدث)" : ""}{!v.url ? " — انحذف فيديوها" : ""}
              </option>
            ))}
          </select>
        ) : (
          <span className="jw-chip">{versionName(version.n)}</span>
        )}
        {initial.allowDownload && version.downloadUrl && (
          <a className="jw-btn !min-h-9 text-sm" href={version.downloadUrl}>
            <Icon name="download" size={15} /> نزّل
          </a>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0 space-y-2">
          <div ref={frame} className="relative mx-auto overflow-hidden rounded-xl bg-black" style={{ width: `min(100%, calc(68vh * ${w} / ${h}))`, aspectRatio: `${w} / ${h}` }}>
            {version.url ? (
              <video
                ref={video}
                src={version.url}
                className="h-full w-full"
                controls={!tool}
                playsInline
                preload="metadata"
                controlsList={initial.allowDownload ? undefined : "nodownload"}
                onContextMenu={initial.allowDownload ? undefined : (e) => e.preventDefault()}
                onLoadedMetadata={(e) => setDur(Math.round(e.currentTarget.duration * 1000) || version.durationMs)}
                onTimeUpdate={(e) => setNow(Math.round(e.currentTarget.currentTime * 1000))}
              />
            ) : (
              <p className="m-0 grid h-full place-items-center p-4 text-center text-sm text-white/70">فيديو هذي النسخة انحذف.</p>
            )}
            {overlay && <ReviewShape shape={overlay} />}
            {tool && (
              <div className="absolute inset-0 cursor-crosshair touch-none" onPointerDown={drawStart} onPointerMove={drawMove} onPointerUp={drawEnd} onPointerCancel={() => setDrag(null)} aria-label={tool === "box" ? "ارسم مربع على الصورة" : "ارسم سهم على الصورة"} />
            )}
          </div>

          {/* the comments on their moments; a press on the bar puts the comment there */}
          <div className="relative h-7 cursor-pointer rounded-full bg-jw-surface-2" dir="ltr" onPointerDown={onBar} role="slider" aria-label="وقت التعليق" aria-valuemin={0} aria-valuemax={total} aria-valuenow={now} title="اضغط على أي لحظة وعلّق عليها">
            <div className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-jw-accent/25" style={{ width: total ? `${(now / total) * 100}%` : 0 }} />
            {top.map((c) =>
              c.at == null ? null : (
                <button
                  key={c.id}
                  type="button"
                  className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-jw-bg ${c.resolved ? "bg-emerald-500" : "bg-amber-400"}`}
                  style={{ left: `${total ? (c.at / total) * 100 : 0}%` }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => { video.current?.pause(); seek(c.at!); setShown(c.id); }}
                  title={`${c.author}: ${c.body.slice(0, 60)}`}
                  aria-label={`تعليق ${c.author} عند ${clock(c.at)}`}
                />
              ),
            )}
            {at != null && <span className="pointer-events-none absolute -top-1 bottom-[-4px] w-0.5 bg-jw-accent" style={{ left: `${total ? (at / total) * 100 : 0}%` }} />}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" className="jw-btn jw-btn-primary !min-h-9 text-sm" onClick={commentHere} disabled={!version.url}>
              <Icon name="marker" size={15} /> علّق هنا <span className="tabular-nums" dir="ltr">{clock(now)}</span>
            </button>
            <button type="button" className={`jw-btn !min-h-9 text-sm ${tool === "box" ? "border-jw-accent text-jw-accent" : ""}`} aria-pressed={tool === "box"} onClick={() => setTool(tool === "box" ? null : "box")} disabled={!version.url}>
              ▢ مربع
            </button>
            <button type="button" className={`jw-btn !min-h-9 text-sm ${tool === "arrow" ? "border-jw-accent text-jw-accent" : ""}`} aria-pressed={tool === "arrow"} onClick={() => setTool(tool === "arrow" ? null : "arrow")} disabled={!version.url}>
              ↗ سهم
            </button>
            <span className="flex-1" />
            <button type="button" className="jw-btn !min-h-9 text-sm" onClick={() => void approve()} disabled={busy || !version.url}>
              ✅ موافق على {versionName(version.n)}
            </button>
          </div>
          {tool && <p className="m-0 text-[12px] text-jw-muted">اسحب على الصورة ترسم {tool === "box" ? "مربع" : "سهم"} على اللي تقصده.</p>}
          {approvals.length > 0 && <p className="m-0 text-[12px] text-emerald-400">✅ وافق عليها: {approvals.map((a) => a.author).join("، ")}</p>}

          {/* the comment being written */}
          <div className="jw-panel space-y-2 p-3">
            {askName || !name ? (
              <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); keepName(); }}>
                <label className="text-sm" htmlFor="rv-name">اسمك:</label>
                <input id="rv-name" className="jw-input !w-auto min-w-0 flex-1" maxLength={REVIEW_LIMITS.name} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="يظهر مع تعليقاتك" autoComplete="name" />
                <button type="submit" className="jw-btn !min-h-9 text-sm" disabled={!nameDraft.trim()}>تم</button>
              </form>
            ) : (
              <p className="m-0 text-[12px] text-jw-muted">
                تعلّق باسم «<b dir="auto">{name}</b>» · <button type="button" className="underline" onClick={() => setAskName(true)}>غيّر</button>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
              {at != null ? (
                <span className="jw-chip">
                  عند <span dir="ltr" className="tabular-nums">{clock(at)}</span>
                  <button type="button" className="ms-1" onClick={() => setAt(null)} aria-label="خله على الفيديو كامل">×</button>
                </span>
              ) : (
                <span className="text-jw-muted">على الفيديو كامل (اضغط «علّق هنا» أو على الشريط لتحدد لحظة)</span>
              )}
              {shape && (
                <span className="jw-chip">
                  {shape.t === "box" ? "▢ مربع" : "↗ سهم"}
                  <button type="button" className="ms-1" onClick={() => setShape(null)} aria-label="شيل الرسم">×</button>
                </span>
              )}
            </div>
            <textarea ref={box} className="jw-textarea" rows={3} maxLength={REVIEW_LIMITS.body} value={body} onChange={(e) => setBody(e.target.value)} placeholder="وش تبي يتعدّل هنا؟" dir="auto" />
            {/* a person never sees or fills this; a script does */}
            <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" value={honey} onChange={(e) => setHoney(e.target.value)} name="website" />
            <div className="flex items-center gap-2">
              <span className="flex-1 text-[11px] text-jw-faint tabular-nums">{body.length}/{REVIEW_LIMITS.body}</span>
              <button type="button" className="jw-btn jw-btn-primary !min-h-9 text-sm" disabled={busy || !body.trim() || !version.url} onClick={() => void post()}>
                {busy ? <span className="jw-spinner !h-3 !w-3" /> : <Icon name="check" size={15} />} أرسل التعليق
              </button>
            </div>
            {note && <p className={`m-0 text-[12px] ${note.bad ? "text-jw-danger" : "text-emerald-400"}`}>{note.text}</p>}
          </div>
        </section>

        <aside className="min-w-0">
          <h2 className="mb-2 text-sm font-semibold">التعليقات ({top.length})</h2>
          {!top.length && <p className="m-0 text-sm text-jw-muted">ما فيه تعليقات على هذي النسخة بعد.</p>}
          <ol className="m-0 list-none space-y-2 p-0">
            {top.map((c) => (
              <li key={c.id} className={`rounded-xl border p-2.5 ${shown === c.id ? "border-jw-accent" : "border-jw-line"}`}>
                <div className="flex items-center gap-2 text-[12px]">
                  <b dir="auto" className="truncate">{c.author}</b>
                  {c.at != null && (
                    <button type="button" className="jw-chip tabular-nums" dir="ltr" onClick={() => { video.current?.pause(); seek(c.at!); setShown(c.id); }}>
                      {clock(c.at)}
                    </button>
                  )}
                  {c.shape && <span className="text-jw-muted">{c.shape.t === "box" ? "▢" : "↗"}</span>}
                  {c.resolved && <span className="ms-auto text-emerald-400">✓ تم</span>}
                </div>
                <p className="m-0 mt-1 whitespace-pre-wrap break-words text-[13px] leading-6" dir="auto">{c.body}</p>
                {replies(c.id).map((r) => (
                  <div key={r.id} className="mt-1.5 border-s-2 border-jw-line ps-2 text-[12px]">
                    <b dir="auto" className={r.byOwner ? "text-jw-accent" : ""}>{r.author}</b>
                    <p className="m-0 whitespace-pre-wrap break-words leading-5" dir="auto">{r.body}</p>
                  </div>
                ))}
                {replyTo === c.id ? (
                  <div className="mt-2 flex gap-1.5">
                    <input className="jw-input !py-1 text-[13px]" maxLength={REVIEW_LIMITS.body} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="ردّك" dir="auto" onKeyDown={(e) => e.key === "Enter" && void sendReply(c.id)} />
                    <button type="button" className="jw-btn !min-h-8 text-xs" disabled={busy || !reply.trim()} onClick={() => void sendReply(c.id)}>رد</button>
                  </div>
                ) : (
                  <button type="button" className="mt-1 text-[11px] text-jw-muted underline" onClick={() => { setReplyTo(c.id); setReply(""); }}>
                    رد
                  </button>
                )}
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
