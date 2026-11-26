"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { ApiError, mahdiFetch } from "@/lib/mahdi/client/fetch";
import {
  enterSends,
  linkPieces,
  plainAnswer,
  questionsLeftText,
  readEvents,
  renewText,
  sheikhWording,
  SHEIKH_DAILY,
  SHEIKH_QUESTION_MAX,
  type SheikhMode,
  type SheikhMsg,
  type SheikhSource,
} from "@/lib/mahdi/sheikh";
import ConfirmSheet from "./ConfirmSheet";
import Icon from "./Icon";
import { useMahdi } from "./Provider";

const S = t.sheikh;

interface Data {
  ready: boolean;
  messages: SheikhMsg[];
  left?: Record<SheikhMode, number>;
  renew?: Record<SheikhMode, number | null>;
}

/** The answer being written: the question, the text so far, and whether the sheikh is back in the library. */
interface Live {
  question: string;
  text: string;
  searching: boolean;
}

const USER_BUBBLE = { background: "color-mix(in srgb, var(--m-gold) 16%, var(--m-surface-2))" } as const;
/** The reading surface: solid, never see-through, so the narration reads clearly on any style. */
const READING = { background: "var(--m-surface-solid)", border: "1px solid var(--m-line)" } as const;
const PILL = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-5";
const NUM_PILL = { background: "color-mix(in srgb, var(--m-gold) 22%, var(--m-surface-solid))", color: "var(--m-gold-text)" } as const;
const GRADE_PILL = { background: "var(--m-surface-2)", border: "1px solid var(--m-line)", color: "var(--m-ink)" } as const;

const coarse = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;

/**
 * «الشيخ الذكي»: the ONE conversation with the sheikh (kept on the server, shown only on /mahdi/sheikh). He searches the
 * app's copy of the thaqalayn hadith books and answers with the texts, their sources and gradings — «سؤال سريع» or
 * «بحث شامل» (with a Word file). The answer appears while it is written, and «وقّف» stops it.
 */
export default function SheikhChat({ autoFocus = false }: { autoFocus?: boolean }) {
  const { toast } = useMahdi();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [live, setLive] = useState<Live | null>(null);
  const [mode, setMode] = useState<SheikhMode>("quick");
  const [menu, setMenu] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const endRef = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const stopRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let live = true;
    mahdiFetch<Data>("/api/mahdi/sheikh")
      .then((d) => live && setData(d))
      .catch((e: Error) => live && setError(e.message || S.loadError));
    // the «يتجدد خلال…» line stays true while the page is open
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      live = false;
      clearInterval(tick);
      stopRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [data, live]);

  useEffect(() => {
    if (autoFocus) input.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  // the box grows with what is written (up to about six lines, then it scrolls)
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [text]);

  async function send(q = text.trim()) {
    if (!q || live) return;
    const ctrl = new AbortController();
    stopRef.current = ctrl;
    setLive({ question: q, text: "", searching: true });
    setText("");
    setError("");
    try {
      const res = await fetch("/api/mahdi/sheikh", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, mode, stream: true }),
        signal: ctrl.signal,
      });
      if (res.status === 401) {
        // the session ended: back to sign-in, then here again (as every other request of the app does); a full reload on
        // purpose, it drops the stale session from memory
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        location.href = `/mahdi/login?next=${encodeURIComponent(location.pathname + location.search)}`;
        throw new ApiError(t.errors.unauthenticated, 401);
      }
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new ApiError(body.error ?? t.errors.generic, res.status);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let finished = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const { events, rest } = readEvents(buf + dec.decode(value, { stream: true }));
        buf = rest;
        for (const e of events) {
          if (e.t === "search") setLive((l) => (l ? { ...l, text: "", searching: true } : l));
          else if (e.t === "text") setLive((l) => (l ? { ...l, text: l.text + e.v, searching: false } : l));
          else if (e.t === "done") {
            finished = true;
            setData((d) => ({ ready: true, messages: [...(d?.messages ?? []), ...e.messages], left: e.left, renew: e.renew ?? d?.renew }));
          } else if (e.t === "error") throw new ApiError(e.message, 503);
        }
      }
      if (!finished) throw new ApiError(t.errors.network, 0);
    } catch (e) {
      setText(q);
      if (ctrl.signal.aborted) toast(S.stopped);
      else setError(e instanceof TypeError ? t.errors.network : (e as Error).message || t.errors.generic);
    }
    stopRef.current = null;
    setLive(null);
  }

  const stop = () => stopRef.current?.abort();

  async function clear() {
    await mahdiFetch("/api/mahdi/sheikh", { method: "DELETE" });
    setData((d) => (d ? { ...d, messages: [] } : d));
  }

  const messages = data?.messages ?? [];
  const left = data?.left;
  const renew = data?.renew?.[mode] ?? null;
  const notWhole = !!left && left[mode] < SHEIKH_DAILY[mode] && left[mode] < 999;
  return (
    <div className="m-sheikh-body flex min-h-0 flex-1 flex-col gap-2">
      {data && !data.ready ? (
        <p className="m-note text-sm">{S.notReady}</p>
      ) : (
        <>
          {/* always at the top: what is left today and when the next question comes back */}
          <div className="flex items-center gap-2">
            <p className="m-num min-w-0 flex-1 text-sm font-semibold" aria-live="polite">
              {left ? (mode === "quick" ? questionsLeftText(left.quick) : S.deepLeft(left.deep)) : " "}
              {notWhole && renewText(renew, now) ? <span className="m-muted block text-xs font-normal">{renewText(renew, now)}</span> : null}
            </p>
            <div className="relative">
              <button
                type="button"
                className="m-icon-btn size-10"
                aria-label={S.menu}
                aria-haspopup="menu"
                aria-expanded={menu}
                onClick={() => setMenu((m) => !m)}
                onBlur={(e) => {
                  if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node | null)) setMenu(false);
                }}
              >
                <Icon name="more" size={22} strokeWidth={3} />
              </button>
              {menu && (
                <div role="menu" className="absolute end-0 top-11 z-20 min-w-44 rounded-2xl p-1.5 shadow-lg" style={READING}>
                  <button
                    type="button"
                    role="menuitem"
                    className="m-btn m-btn-quiet m-btn-sm w-full justify-start text-sm"
                    disabled={!messages.length || !!live}
                    onClick={() => {
                      setMenu(false);
                      setConfirmClear(true);
                    }}
                  >
                    <Icon name="trash" size={16} /> {S.clear}
                  </button>
                </div>
              )}
            </div>
          </div>

          <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-0.5">
            {!data && !error && <li className="m-muted py-2 text-sm">{t.common.loading}</li>}
            {data && !messages.length && !live && (
              <li className="space-y-3 py-1">
                <p className="text-[0.92rem] leading-relaxed">{S.intro}</p>
                <div className="flex flex-wrap gap-2">
                  {S.examples.map((x) => (
                    <button key={x} type="button" className="m-chip text-start text-xs" onClick={() => send(x)}>
                      {x}
                    </button>
                  ))}
                </div>
              </li>
            )}
            {messages.map((m) =>
              m.role === "user" ? (
                <li key={m.id} className="ms-auto max-w-[88%] rounded-2xl px-3 py-2" style={USER_BUBBLE}>
                  <p className="whitespace-pre-line text-[0.92rem]" dir="auto">
                    {m.body}
                  </p>
                </li>
              ) : (
                <li key={m.id}>
                  <Answer m={m} onChange={(n) => setData((d) => (d ? { ...d, messages: d.messages.map((x) => (x.id === n.id ? n : x)) } : d))} />
                </li>
              ),
            )}
            {live && (
              <>
                <li className="ms-auto max-w-[88%] rounded-2xl px-3 py-2" style={USER_BUBBLE}>
                  <p className="whitespace-pre-line text-[0.92rem]" dir="auto">
                    {live.question}
                  </p>
                </li>
                <li aria-live="polite">
                  <article className="max-w-[96%] space-y-2 rounded-2xl px-3.5 py-3" style={READING} aria-busy="true">
                    <p className="m-muted flex items-center gap-2 text-xs font-semibold" role="status">
                      <span className="m-sheikh-typing" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                      {live.searching ? (mode === "deep" ? S.searchingDeep : S.searching) : S.writing}
                    </p>
                    {live.text && <AnswerBody body={sheikhWording(plainAnswer(live.text))} sources={[]} />}
                  </article>
                </li>
              </>
            )}
            <div ref={endRef} />
          </ol>

          <div className="flex gap-1.5" role="radiogroup" aria-label={S.modeLabel}>
            {(["quick", "deep"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={mode === k}
                className="m-option min-h-9 flex-1 px-2 py-1 text-xs"
                onClick={() => setMode(k)}
                disabled={!!live}
                title={k === "quick" ? S.quickHint : S.deepHint}
              >
                <span className="font-semibold">{k === "quick" ? S.quick : S.deep}</span>
                {left && left[k] < 999 ? <span className="m-muted m-num"> · {S.left(left[k])}</span> : null}
              </button>
            ))}
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (live) stop();
              else send();
            }}
          >
            <label className="sr-only" htmlFor="m-sheikh-text">
              {S.placeholder}
            </label>
            <textarea
              ref={input}
              id="m-sheikh-text"
              className="m-field min-h-11 flex-1 resize-none overflow-y-auto py-2.5 leading-7"
              rows={1}
              maxLength={SHEIKH_QUESTION_MAX}
              dir="auto"
              enterKeyHint="enter"
              placeholder={S.placeholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // a keyboard: Enter sends (Shift+Enter a new line); a phone: Enter is a new line, the button sends
                if (e.key === "Enter" && enterSends(coarse(), e.shiftKey, e.nativeEvent.isComposing)) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            {live ? (
              <button type="submit" className="m-btn m-btn-ghost size-11 shrink-0 p-0" aria-label={S.stop} title={S.stop}>
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="5" width="14" height="14" rx="2.5" fill="currentColor" />
                </svg>
              </button>
            ) : (
              <button type="submit" className="m-btn m-btn-primary size-11 shrink-0 p-0" disabled={!text.trim()} aria-label={S.send}>
                <Icon name="send" size={18} />
              </button>
            )}
          </form>
        </>
      )}
      {error && (
        <p role="alert" className="m-error text-sm">
          {error}
        </p>
      )}
      <ConfirmSheet open={confirmClear} onClose={() => setConfirmClear(false)} title={S.clear} body={S.clearConfirm} confirmLabel={S.clearYes} onConfirm={clear} />
    </div>
  );
}

/** A narration's own words (between « ») in the reading face; the rest as it is. */
function Quoted({ v }: { v: string }) {
  return (
    <>
      {v.split(/(«[^»]*»)/).map((part, i) =>
        part.startsWith("«") ? (
          <span key={i} className="text-[1.08rem] leading-9" style={{ fontFamily: "var(--font-amiri), var(--m-font)" }}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/** The answer's text: links to a source become its numbered pill, «[2]» too; other links stay links. */
function AnswerBody({ body, sources }: { body: string; sources: SheikhSource[] }) {
  const byN = new Map<number, SheikhSource>(sources.map((s) => [s.n, s]));
  const byUrl = new Map<string, SheikhSource>(sources.map((s) => [s.url.replace(/\/$/, ""), s]));
  const pill = (s: SheikhSource, key: number) => (
    <a key={key} href={s.url} target="_blank" rel="noopener noreferrer" className={`${PILL} m-num mx-0.5 align-middle no-underline`} style={NUM_PILL} title={s.title}>
      {s.n}
    </a>
  );
  return (
    <div className="space-y-2 text-[0.97rem] leading-8" dir="auto">
      {body.split("\n").map((line, i) =>
        line.trim() ? (
          <p key={i}>
            {linkPieces(line).map((p, j) => {
              if (p.t === "bold") return <strong key={j}>{p.v}</strong>;
              if (p.t === "link") {
                const s = byUrl.get(p.v.replace(/\/$/, ""));
                if (s) return pill(s, j);
                return (
                  <a key={j} href={p.v} target="_blank" rel="noopener noreferrer" className="m-gold break-all text-xs underline" dir="ltr">
                    {p.v.replace(/^https?:\/\//, "")}
                  </a>
                );
              }
              if (p.t === "cite") {
                const s = byN.get(p.v);
                return s ? pill(s, j) : null;
              }
              return <Quoted key={j} v={p.v} />;
            })}
          </p>
        ) : null,
      )}
    </div>
  );
}

/** One answer on the reading surface: the text, then each source as a numbered pill with its grading as a pill; copy,
 *  share and «في خطأ؟». */
function Answer({ m, onChange }: { m: SheikhMsg; onChange: (m: SheikhMsg) => void }) {
  const { toast } = useMahdi();
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const [report, setReport] = useState("");
  const [sending, setSending] = useState(false);
  const body = plainAnswer(m.body);
  const plain = `${body.replace(/\*\*/g, "")}${m.sources.length ? `\n\n${S.sources}:\n${m.sources.map((s) => `[${s.n}] ${s.title} — ${s.url}`).join("\n")}` : ""}`;
  const shown = all ? m.sources : m.sources.slice(0, 4);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plain);
      toast(S.copied);
    } catch {
      toast(t.errors.generic);
    }
  };
  const share = () => {
    if (navigator.share) navigator.share({ title: S.title, text: plain }).catch(() => {});
    else void copy();
  };
  const sendReport = async () => {
    setSending(true);
    try {
      const r = await mahdiFetch<{ message: SheikhMsg }>("/api/mahdi/sheikh", { method: "POST", json: { id: m.id, report } });
      onChange(r.message);
      setOpen(false);
      toast(S.reportThanks);
    } catch (e) {
      toast((e as Error).message);
    }
    setSending(false);
  };

  return (
    <article className="max-w-[96%] space-y-3 rounded-2xl px-3.5 py-3" style={READING}>
      <AnswerBody body={body} sources={m.sources} />
      {m.sources.length > 0 && (
        <section className="space-y-1.5 border-t pt-2.5" style={{ borderColor: "var(--m-line)" }} aria-label={S.sources}>
          <p className="m-muted text-[11px] font-semibold">
            {S.sources} <span className="m-num">({m.sources.length})</span>
          </p>
          <ul className="space-y-2">
            {shown.map((s) => (
              <li key={s.n} className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className={`${PILL} m-num`} style={NUM_PILL}>
                  {s.n}
                </span>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="min-w-0 font-semibold underline decoration-dotted underline-offset-4">
                  {s.title}
                </a>
                <span className={PILL} style={GRADE_PILL}>
                  {s.source}
                </span>
              </li>
            ))}
          </ul>
          {m.sources.length > shown.length && (
            <button type="button" className="m-btn m-btn-quiet m-btn-sm text-xs" onClick={() => setAll(true)}>
              {S.allSources(m.sources.length)}
            </button>
          )}
        </section>
      )}
      {m.mode === "deep" && (
        <a href={`/api/mahdi/sheikh/word?id=${m.id}`} className="m-btn m-btn-ghost m-btn-sm w-full text-xs" download>
          <Icon name="book" size={16} /> {S.word}
        </a>
      )}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className="m-btn m-btn-quiet m-btn-sm text-xs" onClick={copy}>
          {S.copy}
        </button>
        <button type="button" className="m-btn m-btn-quiet m-btn-sm text-xs" onClick={share}>
          <Icon name="send" size={14} /> {S.share}
        </button>
        {m.reported ? (
          <span className="m-muted self-center text-[11px]">{S.reported}</span>
        ) : (
          <button type="button" className="m-btn m-btn-quiet m-btn-sm text-xs" onClick={() => setOpen((o) => !o)}>
            <Icon name="flag" size={14} /> {S.report}
          </button>
        )}
      </div>
      {open && (
        <div className="space-y-2">
          <textarea className="m-field min-h-20 w-full" dir="auto" maxLength={1000} value={report} onChange={(e) => setReport(e.target.value)} placeholder={S.reportPlaceholder} />
          <button type="button" className="m-btn m-btn-ghost w-full" disabled={sending || report.trim().length < 3} onClick={sendReport}>
            {sending ? t.common.saving : S.reportSend}
          </button>
        </div>
      )}
    </article>
  );
}
