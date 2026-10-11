"use client";

// «الطالب الذكي» · «🧪 اختبر فهمي» — the quiz's questions asked one at a time, each marked as soon as it is answered,
// and at the end a VERDICT on how well the student understood: their level, the questions that cost them points and what
// to do next. A choice question is marked by the site; a written one is shown against the model answer and the student
// marks it themselves (right, partly, not) — honestly, since nobody else is looking. Nothing here costs anything: no
// model is called, the verdict is arithmetic (src/lib/jawad/student/level.ts).

import { useState } from "react";
import Icon from "@/components/jawad/Icon";
import { QUESTION_TYPES } from "@config/jawad/student";
import { LEVELS_OF_UNDERSTANDING, isAutoMarked, mark, verdict, type Marked, type SelfMark } from "@/lib/jawad/student/level";
import type { Question } from "@/lib/jawad/student/model";
import { post, type OutputView } from "./client";

const TYPE_LABEL = Object.fromEntries(QUESTION_TYPES.map((t) => [t.id, t.label]));

const SELF: { id: SelfMark; label: string }[] = [
  { id: "right", label: "✅ إجابتي صحيحة" },
  { id: "partly", label: "🟡 صحيحة جزئيًا" },
  { id: "wrong", label: "❌ ما أصبت" },
];

export default function UnderstandingTest({ o, qs }: { o: OutputView; qs: Question[] }) {
  const [at, setAt] = useState(0);
  const [answer, setAnswer] = useState("");
  // the answer is in: the question is shown against the model answer (and, when written, waits for the student's mark)
  const [shown, setShown] = useState(false);
  const [marked, setMarked] = useState<Marked[]>([]);
  // the verdict comes only after the LAST question's marking has been seen, not the moment it is answered
  const [finished, setFinished] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  if (!qs.length) return <p className="jw-panel p-4 text-sm text-jw-muted">ما فيه أسئلة في هذا الاختبار بعد.</p>;

  if (finished) {
    const v = verdict(marked);
    return (
      <div className="space-y-4">
        <div className="jw-panel space-y-3 p-5 text-center" role="status" aria-live="polite">
          <p className="text-5xl" aria-hidden>
            {v.level.emoji}
          </p>
          <p className="text-sm text-jw-muted">مستوى فهمك لهذي المادة</p>
          <h3 className="text-2xl font-extrabold">{v.level.name}</h3>
          <p className="text-lg font-bold" dir="ltr">
            {v.percent}% <span className="text-sm font-normal text-jw-muted">({v.points} / {v.total})</span>
          </p>
          <p className="text-sm">{v.level.says}</p>
          {/* where the percentage falls among the levels: the student sees the thresholds, not only the verdict */}
          <ol className="mx-auto grid max-w-md grid-cols-5 gap-1 text-[10px] text-jw-muted" aria-label="مستويات الفهم">
            {LEVELS_OF_UNDERSTANDING.map((l) => (
              <li key={l.id} className={`rounded-lg border p-1 ${l.id === v.level.id ? "border-transparent bg-violet-600 font-bold text-white" : "border-jw-line"}`}>
                <span aria-hidden>{l.emoji}</span>
                <span className="block">{l.name}</span>
                <span className="block" dir="ltr">{l.from}%+</span>
              </li>
            ))}
          </ol>
          <p className="rounded-xl bg-jw-surface-2 p-3 text-sm">
            <b>وش تسوي الحين؟</b> {v.level.next}
          </p>
          <p className="text-[11px] text-jw-faint">
            {v.bySite} سؤال صحّحها الموقع{v.bySelf ? `، و${v.bySelf} مكتوبة قيّمتها أنت بنفسك` : ""}. المستوى تقدير لفهمك لهذي المادة، مو حكم على قدراتك.
          </p>
        </div>

        {v.weak.length > 0 ? (
          <div className="space-y-2">
            <h4 className="font-bold">النقاط اللي ترجع لها ({v.weak.length})</h4>
            {v.weak.map((m) => (
              <div key={m.index} className="space-y-1 rounded-xl bg-jw-surface-2 p-3 text-sm">
                <b>
                  {m.index + 1}. {m.question.question}
                </b>
                <p>
                  <span className="text-jw-ok font-semibold">الإجابة النموذجية:</span> {m.question.answer}
                </p>
                {m.question.explanation && <p className="text-jw-muted">{m.question.explanation}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center font-semibold text-jw-ok">ما فيه أي نقطة ضعف في هذا الاختبار 👏</p>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="jw-btn jw-btn-primary"
            onClick={() => {
              setAt(0);
              setAnswer("");
              setShown(false);
              setMarked([]);
              setAnswers({});
              setFinished(false);
            }}
          >
            أعد اختبار فهمي
          </button>
        </div>
      </div>
    );
  }

  const q = qs[at];
  const auto = isAutoMarked(q);
  const isLast = at + 1 >= qs.length;
  const submit = () => {
    setAnswers((a) => ({ ...a, [at]: answer }));
    if (auto) setMarked((m) => [...m, mark(q, at, answer)]);
    setShown(true);
  };
  // the test is over: its attempt is kept like a plain quiz's (its choice answers; the site marks them again on its side)
  const finish = () => {
    setFinished(true);
    void post(`/api/jawad/student/outputs/${o.id}`, { action: "quiz_attempt", answers }).catch(() => null);
  };
  const next = () => {
    if (isLast) return finish();
    setAt((i) => i + 1);
    setAnswer("");
    setShown(false);
  };
  // a written answer's mark closes the question; a choice question was marked the moment it was sent
  const rate = (self: SelfMark) => {
    setMarked((m) => [...m, mark(q, at, answer, self)]);
    next();
  };
  const last = marked[marked.length - 1];
  const right = auto && shown && last?.index === at && last.points === 1;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-jw-muted">
          <span>
            السؤال {at + 1} من {qs.length} · {TYPE_LABEL[q.type] ?? q.type}
          </span>
          <span>{Math.round((marked.length / qs.length) * 100)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-jw-surface-3" aria-hidden>
          <div className="h-full rounded-full transition-all" style={{ width: `${(marked.length / qs.length) * 100}%`, background: "var(--st-grad)" }} />
        </div>
      </div>

      <fieldset className="space-y-3 rounded-2xl bg-jw-surface-2 p-4">
        <legend className="px-1 text-lg font-bold">{q.question}</legend>
        {auto ? (
          <div className="space-y-2" role="radiogroup" aria-label="الخيارات">
            {q.options.map((op) => {
              const chosen = answer === op;
              const isRight = shown && op.trim() === q.answer.trim();
              return (
                <button
                  key={op}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  disabled={shown}
                  onClick={() => setAnswer(op)}
                  className={`flex w-full items-center gap-2 rounded-xl border p-3 text-start text-sm transition-all ${isRight ? "border-jw-ok bg-jw-ok/10 font-bold" : shown && chosen ? "border-jw-danger bg-jw-danger/10" : chosen ? "border-transparent bg-white ring-4 ring-violet-300" : "border-jw-line bg-white hover:border-violet-300"}`}
                >
                  {isRight ? <Icon name="check" size={14} className="text-jw-ok" /> : null}
                  {op}
                </button>
              );
            })}
          </div>
        ) : (
          <textarea className="jw-textarea" rows={q.type === "short" ? 3 : 6} value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={shown} placeholder="اكتب إجابتك بكلامك…" aria-label="إجابتك" />
        )}

        {shown && (
          <div className="space-y-1 rounded-xl bg-jw-surface-3 p-3 text-sm" role="status" aria-live="polite">
            {auto && <b className={right ? "text-jw-ok" : "text-jw-danger"}>{right ? "✅ صح" : "❌ مو صح"}</b>}
            <p>
              <b className="text-jw-ok">الإجابة النموذجية:</b> {q.answer}
            </p>
            {q.explanation && <p className="text-jw-muted">{q.explanation}</p>}
          </div>
        )}
      </fieldset>

      {!shown ? (
        <button type="button" className="jw-btn jw-btn-primary" disabled={!answer.trim()} onClick={submit}>
          {auto ? "أجب" : "أرني الإجابة النموذجية"}
        </button>
      ) : auto ? (
        <button type="button" className="jw-btn jw-btn-primary" onClick={next}>
          {isLast ? "اعرف مستواي" : "السؤال التالي"}
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-semibold">قارن إجابتك بالنموذجية — وش تقيّمها؟</p>
          <div className="flex flex-wrap gap-2">
            {SELF.map((s) => (
              <button key={s.id} type="button" className="jw-btn" onClick={() => rate(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
