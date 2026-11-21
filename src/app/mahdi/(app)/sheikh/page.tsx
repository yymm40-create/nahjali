"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { linkPieces, plainAnswer, SHEIKH_LIMITS, SHEIKH_QUESTION_MAX, type SheikhMode, type SheikhQuestion } from "@/lib/mahdi/sheikh";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";

const S = t.sheikh;

interface Data {
  ready: boolean;
  questions: SheikhQuestion[];
  left?: { quick: number; deep: number };
}

/** «اسأل الشيخ»: questions to «الشيخ الذكي», who searches مكتبة الثقلين and answers with the texts and their sources. */
export default function SheikhPage() {
  const { toast } = useMahdi();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<SheikhMode>("quick");
  const [busy, setBusy] = useState(false);
  // «tick» asks again: on open, and every few seconds while a question runs
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    mahdiFetch<Data>("/api/mahdi/sheikh")
      .then((d) => {
        if (!live) return;
        setData(d);
        setError("");
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [tick]);
  const running = data?.questions.some((q) => q.status === "running") ?? false;
  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => setTick((n) => n + 1), 6000);
    return () => clearTimeout(id);
  }, [running, data]);

  async function ask() {
    const q = question.trim();
    if (q.length < 3) return toast(S.tooShort);
    setBusy(true);
    try {
      const r = await mahdiFetch<{ question: SheikhQuestion; left: { quick: number; deep: number } }>("/api/mahdi/sheikh", { method: "POST", json: { question: q, mode } });
      setData((d) => ({ ready: true, questions: [r.question, ...(d?.questions ?? [])], left: r.left }));
      setQuestion("");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const left = data?.left;
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="m-display text-3xl">{S.title}</h1>
        <p className="m-muted">{S.tagline}</p>
      </header>

      <p className="m-note text-sm">{S.notFatwa}</p>

      {data && !data.ready ? (
        <p className="m-card p-4 text-center m-muted">{S.notReady}</p>
      ) : (
        <section className="m-card space-y-3 p-4" aria-label={S.askTitle}>
          <label className="block space-y-1.5">
            <span className="font-semibold">{S.askTitle}</span>
            <textarea
              className="m-field min-h-28 w-full"
              dir="auto"
              maxLength={SHEIKH_QUESTION_MAX}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={S.placeholder}
            />
          </label>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={S.modeLabel}>
            {(["quick", "deep"] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} className="m-option min-h-11 px-2 text-start text-sm" onClick={() => setMode(m)}>
                <span className="block font-semibold">{m === "quick" ? S.quick : S.deep}</span>
                <span className="m-muted block text-xs">
                  {m === "quick" ? S.quickHint : S.deepHint}
                  {left ? ` · ${S.left(left[m], m === "quick" ? SHEIKH_LIMITS.quick.count : SHEIKH_LIMITS.deep.count, m)}` : ""}
                </span>
              </button>
            ))}
          </div>
          <button type="button" className="m-btn m-btn-primary w-full" disabled={busy || running || question.trim().length < 3} onClick={ask}>
            {busy ? t.common.saving : running ? S.waitRunning : S.ask}
          </button>
        </section>
      )}

      {error && (
        <p className="m-error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p className="m-muted text-center">{t.common.loading}</p>}

      {data?.questions.length ? (
        <section className="space-y-3" aria-label={S.history}>
          <h2 className="text-lg font-semibold">{S.history}</h2>
          <ul className="space-y-3">
            {data.questions.map((q) => (
              <li key={q.id}>
                <QuestionCard q={q} onChange={(n) => setData((d) => (d ? { ...d, questions: d.questions.map((x) => (x.id === n.id ? n : x)) } : d))} />
              </li>
            ))}
          </ul>
        </section>
      ) : data?.ready ? (
        <p className="m-muted text-center text-sm">{S.empty}</p>
      ) : null}
    </div>
  );
}

function since(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  return s < 60 ? S.seconds(s) : S.minutes(Math.round(s / 60));
}

/** One question: its answer (sources as links), its file, copy / share, and «في خطأ؟». */
function QuestionCard({ q, onChange }: { q: SheikhQuestion; onChange: (q: SheikhQuestion) => void }) {
  const { toast } = useMahdi();
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState("");
  const [sending, setSending] = useState(false);
  const answer = q.answer ? plainAnswer(q.answer) : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${q.question}\n\n${answer}`);
      toast(S.copied);
    } catch {
      toast(t.errors.generic);
    }
  };
  const share = () => {
    if (navigator.share) navigator.share({ title: q.question, text: `${q.question}\n\n${answer}` }).catch(() => {});
    else void copy();
  };
  const send = async () => {
    setSending(true);
    try {
      const r = await mahdiFetch<{ question: SheikhQuestion }>("/api/mahdi/sheikh", { method: "POST", json: { id: q.id, report } });
      onChange(r.question);
      setOpen(false);
      toast(S.reportThanks);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <article className="m-card space-y-3 p-4">
      <div className="flex items-start gap-2">
        <span className="m-chip shrink-0 text-xs">{q.mode === "quick" ? S.quick : S.deep}</span>
        <p className="flex-1 font-semibold" dir="auto">
          {q.question}
        </p>
      </div>

      {q.status === "running" && (
        <p className="m-note flex items-center gap-2 text-sm" role="status">
          <Icon name="search" size={18} className="m-gold" />
          <span className="flex-1">{q.mode === "quick" ? S.searchingQuick : S.searchingDeep}</span>
          <span className="m-num m-muted">{since(q.createdAt)}</span>
        </p>
      )}
      {q.status === "failed" && (
        <p className="m-error text-sm" role="alert">
          {q.error}
        </p>
      )}

      {q.status === "done" && (
        <>
          <div className="space-y-2 leading-8" dir="auto">
            {answer.split("\n").map((line, i) =>
              line.trim() ? (
                <p key={i}>
                  {linkPieces(line).map((p, j) =>
                    p.t === "link" ? (
                      <a key={j} href={p.v} target="_blank" rel="noopener noreferrer" className="m-gold break-all underline" dir="ltr">
                        {p.v.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      <span key={j}>{p.v}</span>
                    ),
                  )}
                </p>
              ) : null,
            )}
          </div>
          {q.files.map((f) => (
            <a key={f.id} href={`/api/mahdi/sheikh/file?q=${q.id}&f=${encodeURIComponent(f.id)}`} className="m-btn m-btn-ghost w-full" download>
              <Icon name="book" size={18} /> {S.download(f.name)}
            </a>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={copy}>
              {S.copy}
            </button>
            <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={share}>
              <Icon name="send" size={16} /> {S.share}
            </button>
            {q.reported ? (
              <span className="m-muted self-center text-xs">{S.reported}</span>
            ) : (
              <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => setOpen((o) => !o)}>
                <Icon name="flag" size={16} /> {S.report}
              </button>
            )}
          </div>
          {open && (
            <div className="space-y-2">
              <textarea className="m-field min-h-20 w-full" dir="auto" maxLength={1000} value={report} onChange={(e) => setReport(e.target.value)} placeholder={S.reportPlaceholder} />
              <button type="button" className="m-btn m-btn-ghost w-full" disabled={sending || report.trim().length < 3} onClick={send}>
                {sending ? t.common.saving : S.reportSend}
              </button>
            </div>
          )}
        </>
      )}
    </article>
  );
}
