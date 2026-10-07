"use client";

// «الطالب الذكي» — finished outputs: written documents (with additions and research marked), the verbatim transcript,
// slides and books as PDF previews, audio players, and the interactive quiz.

import { useEffect, useState } from "react";
import Icon from "@/components/jawad/Icon";
import { QUESTION_TYPES, fontById, type Design } from "@config/jawad/student";
import type { Block, Doc, Question } from "@/lib/jawad/student/model";
import { docText } from "@/lib/jawad/student/model";
import { fileUrl, post, type OutputView, type Research } from "./client";
import { ErrorLine, PaidButton } from "./ui";

const FILE_LABEL: Record<string, string> = {
  pdf: "PDF",
  pptx: "PPTX",
  txt: "نص TXT",
  trial_pdf: "النسخة التجريبية PDF",
  trial_pptx: "النسخة التجريبية PPTX",
  quiz_pdf: "ورقة الأسئلة PDF",
  answers_pdf: "ورقة الإجابات PDF",
  pictures_pdf: "الصفحات المصممة PDF",
};

export function FileLinks({ o, only }: { o: OutputView; only?: (n: string) => boolean }) {
  const files = o.files.filter((f) => (only ? only(f) : !f.startsWith("trial_") && f !== "pictures_pdf"));
  if (!files.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {files.map((f) => (
        <a key={f} href={fileUrl(o.id, f)} className="jw-btn">
          <Icon name="download" size={16} /> {FILE_LABEL[f] ?? (f.startsWith("audio_") ? `الملف الصوتي ${f.slice(6)}` : f)}
        </a>
      ))}
    </div>
  );
}

export function PdfFrame({ o, name }: { o: OutputView; name: string }) {
  if (!o.files.includes(name)) return null;
  const src = `${fileUrl(o.id, name, true)}&t=${encodeURIComponent(o.updatedAt)}`;
  return (
    <>
      {/* phones show an embedded PDF blank or as one page: a button opens it in the phone's own viewer */}
      <a href={src} target="_blank" rel="noopener" className="jw-btn jw-btn-primary w-full sm:hidden">
        <Icon name="download" size={16} /> افتح الملف 📄
      </a>
      <iframe title="معاينة" src={src} className="hidden h-[70vh] w-full rounded-lg border border-jw-line bg-white sm:block" />
    </>
  );
}

function BlockView({ b, research }: { b: Block; research: Research | null }) {
  const base = "text-[15px] leading-8";
  switch (b.t) {
    case "h":
      return <h4 className="mt-4 font-bold text-jw-accent">{b.text || b.title}</h4>;
    case "list":
      return (
        <ul className={`list-inside list-disc ${base}`}>
          {b.items.map((i, k) => (
            <li key={k}>
              {i.title && <b>{i.title}: </b>}
              {i.text}
            </li>
          ))}
        </ul>
      );
    case "term":
      return (
        <p className={`${base} border-s-4 border-jw-accent ps-3`}>
          <b className="text-jw-accent">{b.title}:</b> {b.text}
        </p>
      );
    case "quote":
      return <blockquote className={`${base} border-s-2 border-jw-gold ps-3 italic`}>«{b.text}» {b.title && <small className="text-jw-faint">— {b.title}</small>}</blockquote>;
    case "addition":
      return (
        <div className="rounded-lg border border-dashed border-jw-warn p-3">
          <span className="text-xs font-bold text-jw-warn">إضافة من صادق — ليست من المادة</span>
          <p className={base}>{b.text}</p>
        </div>
      );
    case "research":
      return (
        <div className="rounded-lg border border-dashed border-jw-accent p-3">
          <span className="text-xs font-bold text-jw-accent">من البحث الخارجي</span>
          <p className={base}>
            {b.text}{" "}
            {b.sources.map((n) => (
              <a key={n} href={research?.sources[n]?.url} target="_blank" rel="noreferrer" className="text-xs text-jw-accent">
                [{n + 1}]
              </a>
            ))}
          </p>
        </div>
      );
    case "cards":
    case "steps":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {b.items.map((i, k) => (
            <div key={k} className="rounded-lg bg-jw-surface-2 p-3 text-sm">
              <b className="block text-jw-accent">
                {b.t === "steps" ? `${k + 1}. ` : ""}
                {i.title}
              </b>
              {i.text}
            </div>
          ))}
        </div>
      );
    case "compare":
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {b.rows.map((r, k) => (
                <tr key={k} className={k === 0 ? "font-bold text-jw-accent" : ""}>
                  {r.map((c, n) => (
                    <td key={n} className="border border-jw-line p-2">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "note":
      return <p className="rounded-lg bg-jw-surface-2 p-2 text-sm text-jw-muted">✎ {b.text}</p>;
    case "question":
      return <p className={`${base} font-semibold text-jw-accent`}>سؤال مراجعة: {b.text}</p>;
    case "scene":
      return (
        <div className="rounded-lg bg-jw-surface-2 p-3">
          <b>{b.title}</b>
          <p className={base}>{b.text}</p>
        </div>
      );
    case "image":
      return null;
    default:
      return <p className={base}>{b.text}</p>;
  }
}

export function DocView({ doc, research, chapterRef }: { doc: Doc; research: Research | null; chapterRef?: (i: number) => React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">{doc.title}</h3>
        <button type="button" className="jw-btn jw-btn-quiet" onClick={() => navigator.clipboard.writeText(docText(doc)).then(() => setCopied(true))}>
          <Icon name="copy" size={14} /> {copied ? "نُسخ" : "انسخ النص كاملًا"}
        </button>
      </div>
      {doc.chapters.map((c, i) => (
        <section key={i} className="space-y-2 border-t border-jw-line pt-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold">
              {i + 1}. {c.title}
            </h3>
            {chapterRef?.(i)}
          </div>
          {c.blocks.map((b, k) => (
            <BlockView key={k} b={b} research={research} />
          ))}
        </section>
      ))}
    </article>
  );
}

export function TranscriptView({ content }: { content: { title: string; segments: { label: string; raw: string; text: string }[] } }) {
  const [copied, setCopied] = useState(false);
  const all = content.segments.map((s) => s.text).join("\n\n");
  return (
    <article className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="jw-btn" onClick={() => navigator.clipboard.writeText(all).then(() => setCopied(true))}>
          <Icon name="copy" size={14} /> {copied ? "نُسخ النص كاملًا" : "انسخ النص كاملًا"}
        </button>
        <span className="text-xs text-jw-faint">{all.length.toLocaleString("ar")} حرف · مطابق للنص الذي اعتمدته</span>
      </div>
      {content.segments.map((s, i) => (
        <section key={i} className="rounded-lg bg-jw-surface-2 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs text-jw-faint">
            {s.label}
            {s.raw !== s.text && <span className="jw-chip !py-0 text-[10px] !text-jw-warn">فيه تصحيحاتك</span>}
          </div>
          <p className="whitespace-pre-wrap text-base leading-8" dir="auto">
            {s.text}
          </p>
          {s.raw !== s.text && (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-jw-muted">النص المستخرج الأولي</summary>
              <p className="whitespace-pre-wrap text-sm text-jw-muted" dir="auto">
                {s.raw}
              </p>
            </details>
          )}
        </section>
      ))}
    </article>
  );
}

export function SlidesFonts({ design }: { design: Design | undefined }) {
  const ids = design ? [...new Set([design.fonts.heading, design.fonts.body, design.fonts.accent])] : [];
  return (
    <p className="rounded-lg bg-jw-surface-2 p-3 text-xs text-jw-muted">
      ملف PPTX يستخدم الخطوط بأسمائها ولا يحملها داخله: إذا لم تكن مثبتة على جهازك يعرض PowerPoint خطًا بديلًا. ثبّت الخطوط (مجانية برخصة مفتوحة):{" "}
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && "، "}
          <a className="text-jw-accent underline" href={fontById(id).url} target="_blank" rel="noreferrer">
            {fontById(id).label}
          </a>
        </span>
      ))}
      . ملف PDF يحمل الخطوط داخله ويظهر كما صُمم في كل جهاز.
    </p>
  );
}

export function AudioResult({ o }: { o: OutputView }) {
  const c = o.content as { run: number; files: { title: string; seconds: number; complete: boolean }[]; failedParts: number } | null;
  if (!c) return null;
  return (
    <div className="space-y-3">
      {c.files.map((f, i) => (
        <div key={i} className="rounded-lg bg-jw-surface-2 p-3">
          <b className="block text-sm">
            {c.files.length > 1 ? `${i + 1}. ` : ""}
            {f.title}
          </b>
          {f.complete && o.files.includes(`audio_${i + 1}`) ? (
            <>
              <audio controls preload="none" className="mt-2 w-full" src={fileUrl(o.id, `audio_${i + 1}`, true)} />
              <span className="text-xs text-jw-faint">
                {Math.floor(f.seconds / 60)}:{String(Math.round(f.seconds % 60)).padStart(2, "0")} دقيقة
              </span>
            </>
          ) : (
            <p className="text-sm text-jw-warn">لم يكتمل هذا الملف: فيه مقاطع متعثرة.</p>
          )}
        </div>
      ))}
    </div>
  );
}

const TYPE_LABEL = Object.fromEntries(QUESTION_TYPES.map((t) => [t.id, t.label]));

/**
 * «بطاقات مراجعة»: every question as a card to flip (question → answer and why). «أعرفها» puts it away, «أراجعها»
 * brings it back later in the round; what the student knows is remembered in this browser (per output).
 */
function Flashcards({ o, qs }: { o: OutputView; qs: Question[] }) {
  const KEY = `st-cards:${o.id}`;
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [queue, setQueue] = useState<number[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let k = new Set<number>();
    try {
      k = new Set<number>(JSON.parse(localStorage.getItem(KEY) ?? "[]") as number[]);
    } catch {
      // nothing remembered
    }
    const t = setTimeout(() => {
      setKnown(k);
      setQueue(qs.map((_, i) => i).filter((i) => !k.has(i)));
      setLoaded(true);
    }, 0);
    return () => clearTimeout(t);
  }, [KEY, qs]);
  const remember = (k: Set<number>) => {
    setKnown(k);
    try {
      localStorage.setItem(KEY, JSON.stringify([...k]));
    } catch {
      // private mode
    }
  };
  const i = queue[0];
  const q = i === undefined ? null : qs[i];
  const mastery = qs.length ? Math.round((known.size / qs.length) * 100) : 0;
  const answer = (ok: boolean) => {
    setFlipped(false);
    if (ok) remember(new Set([...known, i]));
    // «أراجعها»: the card comes back after a few others
    setQueue((cur) => (ok ? cur.slice(1) : [...cur.slice(1, 4), cur[0], ...cur.slice(4)]));
  };
  if (!loaded) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-jw-muted">أتقنت {known.size} من {qs.length} ({mastery}٪)</span>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-jw-surface-3"><div className="h-full rounded-full bg-jw-ok transition-all" style={{ width: `${mastery}%` }} /></div>
      </div>
      {q ? (
        <>
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className={`jw-panel block min-h-44 w-full p-5 text-start transition-colors ${flipped ? "border-jw-ok/50 bg-jw-ok/5" : "hover:border-jw-accent-line"}`}
            aria-live="polite"
          >
            <span className="mb-2 block text-xs text-jw-faint">{flipped ? "الإجابة" : "السؤال"} · بطاقة {qs.length - queue.length + 1} من {qs.length}</span>
            {flipped ? (
              <>
                <b className="block text-lg text-jw-ok">{q.answer}</b>
                {q.explanation && <span className="mt-2 block text-sm text-jw-muted">{q.explanation}</span>}
              </>
            ) : (
              <b className="block text-lg">{q.question}</b>
            )}
            {!flipped && <span className="mt-3 block text-xs text-jw-faint">💡 فكّر بالجواب، وبعدين اضغط البطاقة تنقلب.</span>}
          </button>
          {flipped && (
            <div className="flex gap-2">
              <button type="button" className="jw-btn jw-btn-primary flex-1" onClick={() => answer(true)}>أعرفها ✅</button>
              <button type="button" className="jw-btn flex-1" onClick={() => answer(false)}>أراجعها 🔁</button>
            </div>
          )}
        </>
      ) : (
        <div className="jw-panel space-y-2 p-5 text-center">
          <p className="text-3xl">🏆</p>
          <p className="font-bold">أتقنت كل البطاقات!</p>
          <button type="button" className="jw-btn" onClick={() => { remember(new Set()); setQueue(qs.map((_, k) => k)); }}>ابدأ جولة جديدة</button>
        </div>
      )}
    </div>
  );
}

export function QuizPlay({ o }: { o: OutputView }) {
  const qs = ((o.content as { questions: Question[] } | null)?.questions ?? []) as Question[];
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ score: number | null; right: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"quiz" | "cards">("quiz");
  // «ركّز على أخطائي»: the topics of the questions answered wrong, for a new quiz about them
  const wrong = result ? qs.filter((q, i) => q.options.length && answers[i] !== q.answer) : [];
  if (mode === "cards") {
    return (
      <div className="space-y-3">
        <div className="jw-seg" role="radiogroup" aria-label="طريقة المراجعة">
          <button type="button" role="radio" aria-checked={false} onClick={() => setMode("quiz")}>📝 اختبار</button>
          <button type="button" role="radio" aria-checked onClick={() => setMode("cards")}>🃏 بطاقات مراجعة</button>
        </div>
        <Flashcards o={o} qs={qs} />
      </div>
    );
  }
  const submit = async () => {
    setError(null);
    try {
      setResult(await post(`/api/jawad/student/outputs/${o.id}`, { action: "quiz_attempt", answers }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="space-y-4">
      <div className="jw-seg" role="radiogroup" aria-label="طريقة المراجعة">
        <button type="button" role="radio" aria-checked onClick={() => setMode("quiz")}>📝 اختبار</button>
        <button type="button" role="radio" aria-checked={false} onClick={() => setMode("cards")}>🃏 بطاقات مراجعة</button>
      </div>
      {qs.map((q, i) => (
        <fieldset key={i} className="space-y-2 rounded-lg bg-jw-surface-2 p-3">
          <legend className="font-semibold">
            {i + 1}. {q.question} <span className="text-xs font-normal text-jw-faint">({TYPE_LABEL[q.type] ?? q.type})</span>
          </legend>
          {q.options.length ? (
            <div className="space-y-1">
              {q.options.map((op, k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="radio" name={`q${i}`} checked={answers[i] === op} onChange={() => setAnswers({ ...answers, [i]: op })} disabled={Boolean(result)} />
                  {op}
                  {result && op === q.answer && <Icon name="check" size={14} className="text-jw-ok" />}
                </label>
              ))}
            </div>
          ) : (
            <textarea className="jw-textarea text-sm" rows={q.type === "short" ? 2 : 5} value={answers[i] ?? ""} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} disabled={Boolean(result)} aria-label="إجابتك" />
          )}
          {result && (
            <div className="rounded-lg bg-jw-surface-3 p-2 text-sm">
              <b className="text-jw-ok">الإجابة النموذجية:</b> {q.answer}
              <p className="text-jw-muted">{q.explanation}</p>
            </div>
          )}
        </fieldset>
      ))}
      <ErrorLine error={error} />
      {result ? (
        <div className="jw-panel flex flex-wrap items-center gap-3 p-3">
          {result.total > 0 && (
            <b>
              نتيجتك في أسئلة الاختيار والصح والخطأ: {result.right} من {result.total} ({result.score}٪)
            </b>
          )}
          <span className="text-sm text-jw-muted">قارن إجاباتك المكتوبة بالإجابات النموذجية.</span>
          <button type="button" className="jw-btn jw-btn-quiet" onClick={() => { setResult(null); setAnswers({}); }}>
            أعد الاختبار
          </button>
          {wrong.length > 0 && (
            <PaidButton
              label={`اختبار جديد يركّز على أخطائي (${wrong.length})`}
              primary={false}
              what="يكتب صادق أسئلة جديدة عن النقاط التي أخطأت فيها، بدل الأسئلة الحالية."
              run={async (b) => {
                const r = await post(`/api/jawad/student/outputs/${o.id}`, { action: "request", kind: "other", note: `اختبار جديد يركّز على ما أخطأت فيه، وهو: ${wrong.map((q) => q.question).join(" | ").slice(0, 3000)}`, ...b });
                window.dispatchEvent(new Event("st-refresh"));
                return r;
              }}
            />
          )}
        </div>
      ) : (
        <button type="button" className="jw-btn jw-btn-primary" onClick={submit} disabled={!qs.length}>
          سلّم الإجابات
        </button>
      )}
    </div>
  );
}

