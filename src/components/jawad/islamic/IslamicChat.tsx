"use client";

// «الذكاء الإسلامي» — the conversation: a question, the answer with its sources (numbered, each a link to the page it
// came from), and the questions after it in the same thread.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/jawad/Icon";
import { post } from "@/components/jawad/student/client";
import type { Answer } from "@/lib/islamic/ask";

interface Msg {
  role: "user" | "assistant";
  text: string;
  sources?: Answer["sources"];
  found?: boolean;
}

/** The answer's light markdown (paragraphs, **bold**, « » quotes, lists, [n] citations) as elements. */
function Rich({ text, sources }: { text: string; sources?: Answer["sources"] }) {
  const line = (s: string, k: number) => {
    const parts = s.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((p, i) => {
      if (/^\*\*[^*]+\*\*$/.test(p)) return <b key={i}>{p.slice(2, -2)}</b>;
      const m = /^\[(\d+)\]$/.exec(p);
      if (m) {
        const src = sources?.find((x) => x.n === Number(m[1]));
        return src ? (
          <a key={i} href={src.url} target="_blank" rel="noreferrer" className="mx-0.5 rounded bg-jw-accent/15 px-1 text-xs font-bold text-jw-accent no-underline" title={`${src.source} — ${src.title}`}>
            {m[1]}
          </a>
        ) : (
          <span key={i}>{p}</span>
        );
      }
      return <span key={i}>{p}</span>;
    });
    return <span key={k}>{parts}</span>;
  };
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 leading-8">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-•*]|\d+[.)])\s+/.test(l)))
          return (
            <ul key={i} className="list-disc space-y-1 ps-6">
              {lines.map((l, k) => (
                <li key={k}>{line(l.replace(/^\s*([-•*]|\d+[.)])\s+/, ""), k)}</li>
              ))}
            </ul>
          );
        return (
          <p key={i}>
            {lines.map((l, k) => (
              <span key={k}>
                {line(l, k)}
                {k < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export default function IslamicChat({ name, loginHref }: { name: string; loginHref: string | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  const send = async () => {
    const question = q.trim();
    if (!question || busy) return;
    setError(null);
    const history = msgs.map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setQ("");
    setBusy(true);
    try {
      const r = await post<Answer>("/api/islamic/ask", { question, history });
      setMsgs((m) => [...m, { role: "assistant", text: r.answer, sources: r.sources, found: r.found }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMsgs((m) => m.slice(0, -1));
      setQ(question);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2 text-center">
        <span className="text-5xl" aria-hidden>
          🕌
        </span>
        <h1 className="text-3xl font-bold">{name}</h1>
        <p className="text-sm text-jw-muted">يجيب من المصادر التي غُذّي بها، ويذكر لك المصدر في كل جواب. وما لم يجده يقول لك إنه لم يجده.</p>
      </header>

      {loginHref ? (
        <div className="jw-panel p-6 text-center">
          <Link href={loginHref} className="jw-btn jw-btn-primary">
            سجّل دخولك لتسأل
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {msgs.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="ms-auto max-w-[90%] rounded-2xl rounded-ee-sm bg-jw-accent/15 px-4 py-3">{m.text}</div>
              ) : (
                <article key={i} className="jw-panel space-y-3 p-4">
                  {m.found === false && <p className="text-sm font-semibold text-jw-warn">⚠ ما وُجد جواب كافٍ في المصادر المتاحة.</p>}
                  <Rich text={m.text} sources={m.sources} />
                  {m.sources && m.sources.length > 0 && (
                    <ol className="space-y-1 border-t border-jw-line pt-3 text-sm">
                      {m.sources.map((s) => (
                        <li key={s.n} className="flex gap-2">
                          <span className="shrink-0 font-bold text-jw-accent">[{s.n}]</span>
                          <a href={s.url} target="_blank" rel="noreferrer" className="min-w-0 truncate underline">
                            {s.title}
                          </a>
                          <span className="shrink-0 text-jw-muted">— {s.source}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </article>
              ),
            )}
            {busy && (
              <p className="flex items-center gap-2 text-sm text-jw-muted" role="status">
                <span className="jw-spinner" aria-hidden /> يبحث في المكتبة ويكتب الجواب…
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-lg border border-jw-danger/40 bg-jw-danger/10 px-3 py-2 text-sm text-jw-danger">
                {error}
              </p>
            )}
            <div ref={end} />
          </div>
          <form
            className="sticky bottom-4 flex items-end gap-2 rounded-2xl border border-jw-line bg-jw-surface p-2 shadow-lg"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <textarea
              className="jw-textarea min-h-12 flex-1 resize-none !border-0 !bg-transparent"
              rows={1}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="اكتب سؤالك…"
              aria-label="سؤالك"
            />
            <button type="submit" className="jw-btn jw-btn-primary jw-btn-icon" disabled={busy || !q.trim()} aria-label="أرسل">
              <Icon name="sparkles" size={18} />
            </button>
          </form>
          {msgs.length > 0 && (
            <button type="button" className="jw-btn jw-btn-quiet mx-auto block text-sm" onClick={() => setMsgs([])}>
              محادثة جديدة
            </button>
          )}
        </>
      )}
    </div>
  );
}
