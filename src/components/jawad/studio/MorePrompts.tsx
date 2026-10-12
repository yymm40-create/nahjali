"use client";

// «برومبت ثاني وثالث»: up to three prompts at once, each its own generation made at the same time (one picture or
// video each), with the references at the top shared out: every prompt says which of them it uses. «جواد» can fill
// them, with their references, in order.

import { MAX_PROMPTS, type ExtraPrompt } from "./types";

function RefChips({ all, value, onChange }: { all: string[]; value: string[] | null; onChange: (v: string[] | null) => void }) {
  if (!all.length) return <p className="text-[11px] text-jw-faint">ما فيه مراجع فوق؛ أضف مراجع إذا تبي تحددها لكل برومبت.</p>;
  const on = (n: string) => value === null || value.includes(n);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-jw-muted">مراجعه:</span>
      {all.map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={on(n)}
          className={`rounded-full border px-2 py-0.5 text-[11px] ${on(n) ? "border-jw-accent bg-jw-accent/15 font-bold" : "border-jw-line text-jw-faint line-through"}`}
          onClick={() => {
            const cur = value ?? all;
            const next = cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n];
            onChange(next.length === all.length ? null : next);
          }}
          dir="ltr"
        >
          @{n}
        </button>
      ))}
    </div>
  );
}

export default function MorePrompts({ refs, extra, mainRefs, onChange }: { refs: string[]; extra: ExtraPrompt[]; mainRefs: string[] | null; onChange: (extra: ExtraPrompt[], mainRefs: string[] | null) => void }) {
  const set = (i: number, x: Partial<ExtraPrompt>) => onChange(extra.map((e, k) => (k === i ? { ...e, ...x } : e)), mainRefs);
  return (
    <div className="space-y-2">
      {!!extra.length && (
        <div className="space-y-2 rounded-xl border border-jw-line bg-jw-surface-2 p-2.5">
          <p className="text-xs font-bold">البرومبت ١ (فوق)</p>
          <RefChips all={refs} value={mainRefs} onChange={(v) => onChange(extra, v)} />
        </div>
      )}
      {extra.map((e, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-jw-line bg-jw-surface-2 p-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold">البرومبت {i + 2}</p>
            <button type="button" className="text-xs text-jw-danger" onClick={() => onChange(extra.filter((_, k) => k !== i), extra.length === 1 ? null : mainRefs)}>
              شيله
            </button>
          </div>
          <textarea className="jw-textarea w-full" rows={3} value={e.prompt} onChange={(ev) => set(i, { prompt: ev.target.value })} placeholder={`وصف ${i === 0 ? "الصورة/المقطع الثاني" : "الثالث"}… تقدر تستخدم @اسم المرجع`} dir="auto" />
          <RefChips all={refs} value={e.refs} onChange={(v) => set(i, { refs: v })} />
        </div>
      ))}
      {extra.length < MAX_PROMPTS - 1 && (
        <button type="button" className="jw-btn !min-h-9 w-full text-xs" onClick={() => onChange([...extra, { prompt: "", refs: null }], mainRefs)}>
          ➕ أضف برومبت {extra.length ? "ثالث" : "ثاني"} (يتولّد معه بنفس الوقت)
        </button>
      )}
      {!!extra.length && (
        <p className="text-[11px] leading-5 text-jw-muted">
          كل برومبت توليد مستقل بسعره، وكلها تبدأ مع ضغطة «توليد». نصيحة: إذا ما كنت متأكد من الوصف أو المراجع، جرّب برومبت واحد أول وتأكد من نتيجته، ثم ولّد الباقي؛ تتجنب أخطاء تتكرر في كل التوليدات.
        </p>
      )}
    </div>
  );
}
