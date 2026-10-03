"use client";

import { useState } from "react";

/** Numbered questions with options + a free answer for each (course rule: always allow your own answer). */
export default function QuestionsForm({
  questions: qs,
  busy,
  onSubmit,
}: {
  questions: { question: string; options: string[] }[];
  busy: boolean;
  onSubmit: (answers: string[]) => void;
}) {
  const [choice, setChoice] = useState<string[]>(qs.map(() => ""));
  const [other, setOther] = useState<string[]>(qs.map(() => ""));
  const answer = (i: number) => (choice[i] === "__other" ? other[i].trim() : choice[i]);
  const ready = qs.every((_, i) => answer(i));
  const setAt = (arr: string[], i: number, v: string) => arr.map((x, j) => (j === i ? v : x));

  return (
    <div className="space-y-5">
      {qs.map((q, i) => (
        <fieldset key={i} className="space-y-2">
          <legend className="mb-1 font-extrabold">{i + 1}. {q.question}</legend>
          {[...q.options, "__other"].map((opt) => (
            <label key={opt} className={`flex cursor-pointer items-start gap-2 rounded-2xl border p-3 ${choice[i] === opt ? "border-gold bg-surface-2" : "border-line"}`}>
              <input type="radio" className="mt-1.5 accent-[var(--gold)]" name={`q${i}`} checked={choice[i] === opt} onChange={() => setChoice(setAt(choice, i, opt))} />
              <span className="font-bold">{opt === "__other" ? "جواب ثاني من عندي" : opt}</span>
            </label>
          ))}
          {choice[i] === "__other" && (
            <textarea className="field min-h-20" value={other[i]} onChange={(e) => setOther(setAt(other, i, e.target.value.slice(0, 1500)))} placeholder="اكتب جوابك" />
          )}
        </fieldset>
      ))}
      <button className="btn btn-primary w-full" disabled={busy || !ready} onClick={() => onSubmit(qs.map((_, i) => answer(i)))}>
        أرسل إجاباتي
      </button>
    </div>
  );
}
