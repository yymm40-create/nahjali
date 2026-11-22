"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { linkPieces, plainAnswer, SHEIKH_QUESTION_MAX, type SheikhMode, type SheikhMsg, type SheikhSource } from "@/lib/mahdi/sheikh";
import Icon from "./Icon";
import { useMahdi } from "./Provider";

const S = t.sheikh;

interface Data {
  ready: boolean;
  messages: SheikhMsg[];
  left?: Record<SheikhMode, number>;
}

/**
 * «الشيخ الذكي»: the conversation with the sheikh, kept on the server. He searches the app's copy of the thaqalayn
 * hadith books and answers with the texts, their links and gradings — «سؤال سريع» or «بحث شامل» (with a Word file).
 * Used in the floating robot's panel and on /mahdi/sheikh.
 */
export default function SheikhChat({ autoFocus = false }: { autoFocus?: boolean }) {
  const { toast } = useMahdi();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [mode, setMode] = useState<SheikhMode>("quick");
  const endRef = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let live = true;
    mahdiFetch<Data>("/api/mahdi/sheikh")
      .then((d) => live && setData(d))
      .catch((e: Error) => live && setError(e.message || S.loadError));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [data, pending]);

  useEffect(() => {
    if (autoFocus) input.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  async function send(q = text.trim()) {
    if (!q || pending) return;
    setPending(q);
    setText("");
    setError("");
    try {
      const r = await mahdiFetch<{ messages: SheikhMsg[]; left: Record<SheikhMode, number> }>("/api/mahdi/sheikh", { method: "POST", json: { question: q, mode } });
      setData((d) => ({ ready: true, messages: [...(d?.messages ?? []), ...r.messages], left: r.left }));
    } catch (e) {
      setText(q);
      setError((e as Error).message);
    }
    setPending(null);
  }

  async function clear() {
    if (!window.confirm(S.clearConfirm)) return;
    try {
      await mahdiFetch("/api/mahdi/sheikh", { method: "DELETE" });
      setData((d) => (d ? { ...d, messages: [] } : d));
    } catch (e) {
      toast((e as Error).message);
    }
  }

  const messages = data?.messages ?? [];
  return (
    <div className="m-sheikh-body flex min-h-0 flex-1 flex-col gap-2">
      {data && !data.ready ? (
        <p className="m-note text-sm">{S.notReady}</p>
      ) : (
        <>
          <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-0.5" aria-live="polite">
            {!data && !error && <li className="m-muted py-2 text-sm">{t.common.loading}</li>}
            {data && !messages.length && !pending && (
              <li className="space-y-3 py-1">
                <p className="text-[0.92rem] leading-relaxed">{S.intro}</p>
                <p className="m-muted text-xs">{S.notFatwa}</p>
                <div className="flex flex-wrap gap-2">
                  {S.examples.map((x) => (
                    <button key={x} type="button" className="m-chip text-start text-xs" onClick={() => send(x)}>
                      {x}
                    </button>
                  ))}
                </div>
              </li>
            )}
            {messages.length > 0 && (
              <li className="flex justify-center">
                <button type="button" className="m-btn m-btn-quiet m-btn-sm text-xs" onClick={clear}>
                  <Icon name="trash" size={14} /> {S.clear}
                </button>
              </li>
            )}
            {messages.map((m) =>
              m.role === "user" ? (
                <li key={m.id} className="ms-auto max-w-[88%] rounded-2xl px-3 py-2" style={{ background: "color-mix(in srgb, var(--m-gold) 16%, var(--m-surface-2))" }}>
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
            {pending && (
              <>
                <li className="ms-auto max-w-[88%] rounded-2xl px-3 py-2" style={{ background: "color-mix(in srgb, var(--m-gold) 16%, var(--m-surface-2))" }}>
                  <p className="whitespace-pre-line text-[0.92rem]" dir="auto">
                    {pending}
                  </p>
                </li>
                <li className="m-soft flex max-w-[88%] items-center gap-2 rounded-2xl px-3 py-2 text-sm" role="status">
                  <span className="m-sheikh-typing" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  {mode === "deep" ? S.searchingDeep : S.searching}
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
                disabled={!!pending}
                title={k === "quick" ? S.quickHint : S.deepHint}
              >
                <span className="font-semibold">{k === "quick" ? S.quick : S.deep}</span>
                {data?.left && data.left[k] < 10 ? <span className="m-muted"> · {S.left(data.left[k])}</span> : null}
              </button>
            ))}
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label className="sr-only" htmlFor="m-sheikh-text">
              {S.placeholder}
            </label>
            <textarea
              ref={input}
              id="m-sheikh-text"
              className="m-field max-h-40 min-h-11 flex-1 resize-none py-2.5"
              rows={1}
              maxLength={SHEIKH_QUESTION_MAX}
              dir="auto"
              placeholder={S.placeholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button type="submit" className="m-btn m-btn-primary size-11 shrink-0 p-0" disabled={!!pending || !text.trim()} aria-label={pending ? S.searching : S.send}>
              <Icon name="send" size={18} />
            </button>
          </form>
        </>
      )}
      {error && (
        <p role="alert" className="m-error text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

/** One answer: the text (sources as tappable numbers), the list of sources, copy / share, and «في خطأ؟». */
function Answer({ m, onChange }: { m: SheikhMsg; onChange: (m: SheikhMsg) => void }) {
  const { toast } = useMahdi();
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState("");
  const [sending, setSending] = useState(false);
  const body = plainAnswer(m.body);
  const byN = new Map<number, SheikhSource>(m.sources.map((s) => [s.n, s]));
  const plain = `${body.replace(/\*\*/g, "")}${m.sources.length ? `\n\n${S.sources}:\n${m.sources.map((s) => `[${s.n}] ${s.title} — ${s.url}`).join("\n")}` : ""}`;

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
    <article className="m-soft max-w-[96%] space-y-2 rounded-2xl px-3 py-2.5">
      <div className="space-y-2 text-[0.95rem] leading-8" dir="auto">
        {body.split("\n").map((line, i) =>
          line.trim() ? (
            <p key={i}>
              {linkPieces(line).map((p, j) => {
                if (p.t === "bold") return <strong key={j}>{p.v}</strong>;
                if (p.t === "link")
                  return (
                    <a key={j} href={p.v} target="_blank" rel="noopener noreferrer" className="m-gold break-all underline" dir="ltr">
                      {p.v.replace(/^https?:\/\//, "")}
                    </a>
                  );
                if (p.t === "cite") {
                  const s = byN.get(p.v);
                  return s ? (
                    <a key={j} href={s.url} target="_blank" rel="noopener noreferrer" className="m-gold m-num mx-0.5 text-xs font-semibold no-underline" title={s.title}>
                      [{p.v}]
                    </a>
                  ) : null;
                }
                return <span key={j}>{p.v}</span>;
              })}
            </p>
          ) : null,
        )}
      </div>
      {m.mode === "deep" && (
        <a href={`/api/mahdi/sheikh/word?id=${m.id}`} className="m-btn m-btn-ghost m-btn-sm w-full text-xs" download>
          <Icon name="book" size={16} /> {S.word}
        </a>
      )}
      {m.sources.length > 0 && (
        <details className="text-xs">
          <summary className="m-muted cursor-pointer">
            {S.sources} ({m.sources.length})
          </summary>
          <ul className="mt-1.5 space-y-1">
            {m.sources.map((s) => (
              <li key={s.n}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="m-gold underline">
                  <span className="m-num">[{s.n}]</span> {s.title}
                </a>
                <span className="m-muted"> · {s.source}</span>
              </li>
            ))}
          </ul>
        </details>
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
