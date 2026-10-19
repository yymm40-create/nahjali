"use client";

import { useState } from "react";
import type { JourneyIntake } from "@/lib/film/intake";
import RobotFace from "@/components/RobotFace";

export default function JourneyIntakeCard({ intake, busy, confirmLabel = "صح، اعتمد وابدأ الرحلة", onRecheck, onConfirm, onEdit }: { intake: JourneyIntake; busy: boolean; confirmLabel?: string; onRecheck: (answers: Record<string, string>) => void; onConfirm: () => void; onEdit: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const blocking = intake.questions.filter((question) => question.required);
  const answered = blocking.every((question) => answers[question.id]?.trim());
  return (
    <section className="space-y-3 rounded-2xl border-2 border-[var(--film-blue)] bg-white/90 p-4" aria-live="polite">
      <header className="flex items-center gap-2">
        <RobotFace id="sajjad" size={28} />
        <div><p className="font-black">سجاد · هذا اللي فهمته</p><p className="text-xs font-bold text-muted">لن يبدأ السيناريو قبل تأكيدك.</p></div>
      </header>
      <p className="whitespace-pre-wrap text-sm font-bold leading-7">{intake.understanding}</p>
      {intake.fixedFacts.length > 0 && <List title="ثوابت ما تتغير" items={intake.fixedFacts} />}
      {intake.characters.length > 0 && <List title="الشخصيات" items={intake.characters.map((item) => `${item.name}: ${item.description}`)} />}
      {intake.places.length > 0 && <List title="البيئات" items={intake.places.map((item) => `${item.name}: ${item.description}`)} />}
      {intake.scenePlan.length > 0 && (
        <details className="rounded-xl bg-[var(--film-soft)] p-3" open={intake.scenePlan.length <= 8}>
          <summary className="cursor-pointer text-sm font-black">خريطة المشاهد ({intake.scenePlan.length})</summary>
          <ol className="mt-2 space-y-2 text-xs font-bold leading-6">{intake.scenePlan.map((scene) => <li key={scene.number}><b>{scene.number}. {scene.title}</b> — {scene.summary}{scene.goal && <> · الهدف: {scene.goal}</>}{scene.transition && <> · الانتقال: {scene.transition}</>}</li>)}</ol>
        </details>
      )}
      {intake.episodePlan.length > 0 && (
        <details className="rounded-xl bg-[var(--film-soft)] p-3">
          <summary className="cursor-pointer text-sm font-black">الخطة الأولية للحلقات ({intake.episodePlan.length})</summary>
          <ol className="mt-2 space-y-2 text-xs font-bold leading-6">{intake.episodePlan.map((episode) => <li key={episode.number}><b>{episode.number}. {episode.title}</b> — {episode.summary}<br />المشاهد: {episode.scenes.join("، ")}</li>)}</ol>
        </details>
      )}
      {intake.questions.length > 0 && (
        <div className="space-y-3 rounded-2xl border-2 border-[var(--film-hl)] bg-[var(--film-soft)] p-3">
          <p className="font-black">ناقصني منك هذي الأشياء عشان ما أخمّن:</p>
          {intake.questions.map((question) => (
            <div key={question.id} className="space-y-1.5">
              <p className="text-sm font-extrabold">{question.question}</p>
              {question.why && <p className="text-xs font-bold text-muted">ليش مهم؟ {question.why}</p>}
              <div className="flex flex-wrap gap-1.5">{question.options.map((option) => <button key={option} type="button" className={`rounded-full border px-3 py-1 text-xs font-bold ${answers[question.id] === option ? "border-[var(--film-blue)] bg-[var(--film-blue)] text-white" : "border-black/15 bg-white"}`} onClick={() => setAnswers((current) => ({ ...current, [question.id]: option }))}>{option}</button>)}</div>
              <input className="field text-sm" placeholder="أو اكتب جوابك" value={question.options.includes(answers[question.id] ?? "") ? "" : (answers[question.id] ?? "")} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} />
            </div>
          ))}
          <button type="button" className="btn btn-primary w-full" disabled={busy || !answered} onClick={() => onRecheck(answers)}>{busy ? "سجاد يراجع…" : "أرسل الأجوبة وخله يثبت الفهم"}</button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary min-h-11 flex-1" disabled={busy || blocking.length > 0} onClick={onConfirm}>{busy ? "لحظة…" : confirmLabel}</button>
        <button type="button" className="btn btn-ghost min-h-11" disabled={busy} onClick={onEdit}>عدّل فكرتي</button>
      </div>
    </section>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-xl bg-surface-2 p-3"><p className="text-sm font-black">{title}</p><ul className="mt-1 list-inside list-disc space-y-1 text-xs font-bold leading-6">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}
