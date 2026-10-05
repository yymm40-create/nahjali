"use client";

// «الطالب الذكي» — the plans the student reviews and edits by hand before anything long is made: a book's chapters,
// the full slide map, the quiz's distribution, the reading text of an audio (added tashkeel highlighted).

import { QUESTION_TYPES } from "@config/jawad/student";
import Icon from "@/components/jawad/Icon";
import type { AudioPlan, DocPlan, ImageChoice, QuizPlan, Slide, SlidePlan } from "@/lib/jawad/student/model";
import { emptyImage } from "@/lib/jawad/student/model";

type Img = { id: string; name: string };

function ImagePick({ value, onChange, images }: { value: ImageChoice; onChange: (v: ImageChoice) => void; images: Img[] }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-jw-muted">صورة:</span>
        <select className="jw-select w-auto py-1 text-xs" value={value.mode} onChange={(e) => onChange({ ...value, mode: e.target.value as ImageChoice["mode"], path: "" })}>
          <option value="none">بدون</option>
          {images.length > 0 && <option value="own">من صوري</option>}
          <option value="generate">توليد صورة توضيحية (بسعرها)</option>
        </select>
        {value.mode === "own" && (
          <select className="jw-select w-auto py-1 text-xs" value={value.sourceId} onChange={(e) => onChange({ ...value, sourceId: e.target.value, path: "" })}>
            <option value="">اختر</option>
            {images.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        )}
        {value.path && <span className="text-jw-ok">جاهزة</span>}
      </div>
      {value.mode === "generate" && <input className="jw-input py-1 text-xs" value={value.prompt} onChange={(e) => onChange({ ...value, prompt: e.target.value, path: "" })} placeholder="وصف الصورة" aria-label="وصف الصورة" />}
    </div>
  );
}

const move = <T,>(list: T[], i: number, d: number) => {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
};

export function DocPlanEditor({ plan, onChange, labels, images, withImages }: { plan: DocPlan; onChange: (p: DocPlan) => void; labels: Map<string, string>; images: Img[]; withImages: boolean }) {
  const setCh = (i: number, patch: Partial<DocPlan["chapters"][number]>) => onChange({ ...plan, chapters: plan.chapters.map((c, k) => (k === i ? { ...c, ...patch } : c)) });
  const used = new Set(plan.chapters.flatMap((c) => c.segments));
  const unused = [...labels.keys()].filter((k) => !used.has(k));
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="jw-input" value={plan.title} onChange={(e) => onChange({ ...plan, title: e.target.value })} aria-label="العنوان" />
        <input className="jw-input" value={plan.subtitle} onChange={(e) => onChange({ ...plan, subtitle: e.target.value })} aria-label="العنوان الفرعي" placeholder="العنوان الفرعي" />
      </div>
      <ol className="space-y-2">
        {plan.chapters.map((c, i) => (
          <li key={i} className="space-y-2 rounded-lg bg-jw-surface-2 p-3">
            <div className="flex items-center gap-2">
              <b className="shrink-0 text-sm">الفصل {i + 1}</b>
              <input className="jw-input py-1" value={c.title} onChange={(e) => setCh(i, { title: e.target.value })} aria-label={`عنوان الفصل ${i + 1}`} />
              <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" aria-label="لأعلى" onClick={() => onChange({ ...plan, chapters: move(plan.chapters, i, -1) })}>
                <Icon name="chevronDown" size={12} className="rotate-180" />
              </button>
              <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" aria-label="لأسفل" onClick={() => onChange({ ...plan, chapters: move(plan.chapters, i, 1) })}>
                <Icon name="chevronDown" size={12} />
              </button>
              <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" aria-label="حذف الفصل" onClick={() => onChange({ ...plan, chapters: plan.chapters.filter((_, k) => k !== i) })}>
                <Icon name="trash" size={12} />
              </button>
            </div>
            <textarea className="jw-textarea text-sm" rows={2} value={c.purpose} onChange={(e) => setCh(i, { purpose: e.target.value })} aria-label="ما يغطيه الفصل" />
            <p className="text-xs text-jw-faint">من المادة: {c.segments.map((s) => labels.get(s) ?? s).join("، ") || "—"}</p>
            {withImages && <ImagePick value={c.image} onChange={(image) => setCh(i, { image })} images={images} />}
          </li>
        ))}
      </ol>
      <button type="button" className="jw-btn jw-btn-quiet" onClick={() => onChange({ ...plan, chapters: [...plan.chapters, { title: "فصل جديد", purpose: "", segments: [], image: emptyImage() }] })}>
        <Icon name="plus" size={14} /> أضف فصلًا
      </button>
      {unused.length > 0 && <p className="text-xs text-jw-warn">أجزاء من المادة لا يغطيها أي فصل: {unused.map((u) => labels.get(u)).join("، ")}</p>}
    </div>
  );
}

const LAYOUTS: { id: Slide["layout"]; label: string }[] = [
  { id: "title", label: "افتتاحية" },
  { id: "section", label: "فاصل قسم" },
  { id: "bullets", label: "نقاط" },
  { id: "cards", label: "بطاقات" },
  { id: "compare", label: "مقارنة (جدول)" },
  { id: "quote", label: "اقتباس" },
  { id: "image", label: "صورة ونقاط" },
];

export function SlideMapEditor({ plan, onChange, images }: { plan: SlidePlan; onChange: (p: SlidePlan) => void; images: Img[] }) {
  const set = (i: number, patch: Partial<Slide>) => onChange({ ...plan, slides: plan.slides.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const blank = (): Slide => ({ title: "شريحة جديدة", idea: "", layout: "bullets", text: [], visual: "", notes: "", relation: "", segments: [], image: emptyImage() });
  return (
    <div className="space-y-3">
      <input className="jw-input" value={plan.title} onChange={(e) => onChange({ ...plan, title: e.target.value })} aria-label="عنوان العرض" />
      <ol className="space-y-2">
        {plan.slides.map((s, i) => (
          <li key={i} className="space-y-2 rounded-lg bg-jw-surface-2 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <b className="grid size-7 shrink-0 place-items-center rounded-full bg-jw-surface-3 text-sm">{i + 1}</b>
              <input className="jw-input min-w-40 flex-1 py-1" value={s.title} onChange={(e) => set(i, { title: e.target.value })} aria-label={`عنوان الشريحة ${i + 1}`} />
              <select className="jw-select w-auto py-1 text-sm" value={s.layout} onChange={(e) => set(i, { layout: e.target.value as Slide["layout"] })} aria-label="التخطيط">
                {LAYOUTS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
              <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" aria-label="لأعلى" onClick={() => onChange({ ...plan, slides: move(plan.slides, i, -1) })}>
                <Icon name="chevronDown" size={12} className="rotate-180" />
              </button>
              <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" aria-label="لأسفل" onClick={() => onChange({ ...plan, slides: move(plan.slides, i, 1) })}>
                <Icon name="chevronDown" size={12} />
              </button>
              <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" aria-label="أضف شريحة بعدها" onClick={() => onChange({ ...plan, slides: [...plan.slides.slice(0, i + 1), blank(), ...plan.slides.slice(i + 1)] })}>
                <Icon name="plus" size={12} />
              </button>
              <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" aria-label="حذف الشريحة" onClick={() => onChange({ ...plan, slides: plan.slides.filter((_, k) => k !== i) })}>
                <Icon name="trash" size={12} />
              </button>
            </div>
            <p className="text-xs text-jw-muted">
              <b>الفكرة:</b> {s.idea || "—"} {s.relation && <span className="text-jw-faint">· {s.relation}</span>}
            </p>
            <label className="block text-xs text-jw-muted">
              نص الشريحة (سطر لكل نقطة{s.layout === "cards" ? "؛ «عنوان: نص» لكل بطاقة" : s.layout === "compare" ? "؛ «خلية | خلية» لكل صف، الأول عناوين" : ""})
              <textarea className="jw-textarea mt-1 text-sm" rows={Math.min(8, Math.max(2, s.text.length + 1))} value={s.text.join("\n")} onChange={(e) => set(i, { text: e.target.value.split("\n") })} />
            </label>
            <label className="block text-xs text-jw-muted">
              العنصر البصري المقترح
              <input className="jw-input mt-1 py-1 text-sm" value={s.visual} onChange={(e) => set(i, { visual: e.target.value })} />
            </label>
            <label className="block text-xs text-jw-muted">
              ملاحظات المحاضر
              <textarea className="jw-textarea mt-1 text-sm" rows={2} value={s.notes} onChange={(e) => set(i, { notes: e.target.value })} />
            </label>
            <ImagePick value={s.image} onChange={(image) => set(i, { image, ...(image.mode !== "none" && s.layout !== "image" ? { layout: "image" } : {}) })} images={images} />
          </li>
        ))}
      </ol>
      <button type="button" className="jw-btn jw-btn-quiet" onClick={() => onChange({ ...plan, slides: [...plan.slides, blank()] })}>
        <Icon name="plus" size={14} /> أضف شريحة في النهاية
      </button>
    </div>
  );
}

export function QuizPlanEditor({ plan, onChange, wanted, customType }: { plan: QuizPlan; onChange: (p: QuizPlan) => void; wanted: number; customType: string }) {
  const types = [...QUESTION_TYPES.map((t) => ({ id: t.id as string, label: t.label })), ...(customType ? [{ id: "custom", label: customType }] : [])];
  const total = plan.rows.reduce((s, r) => s + Object.values(r.counts).reduce((a, b) => a + b, 0), 0);
  return (
    <div className="space-y-2 overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-jw-muted">
            <th className="p-1 text-start">الموضوع</th>
            {types.map((t) => (
              <th key={t.id} className="p-1">
                {t.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plan.rows.map((r, i) => (
            <tr key={i}>
              <td className="p-1">
                <input className="jw-input py-1" value={r.topic} onChange={(e) => onChange({ rows: plan.rows.map((x, k) => (k === i ? { ...x, topic: e.target.value } : x)) })} aria-label="الموضوع" />
              </td>
              {types.map((t) => (
                <td key={t.id} className="p-1">
                  <input
                    type="number"
                    min={0}
                    className="jw-input w-16 py-1 text-center"
                    value={r.counts[t.id] ?? 0}
                    onChange={(e) => onChange({ rows: plan.rows.map((x, k) => (k === i ? { ...x, counts: { ...x.counts, [t.id]: Math.max(0, Number(e.target.value) || 0) } } : x)) })}
                    aria-label={`${r.topic} — ${t.label}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className={`text-sm ${total === wanted ? "text-jw-ok" : "text-jw-warn"}`}>
        المجموع: {total} سؤال{total !== wanted ? ` (طلبت ${wanted})` : ""}
      </p>
    </div>
  );
}

const DIAC = /[ً-ْٰ]/;

/** The prepared reading text, with the words whose tashkeel was added or changed highlighted. */
export function TashkeelView({ original, text }: { original: string; text: string }) {
  const marks: boolean[] = new Array(text.length).fill(false);
  let j = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (DIAC.test(c)) {
      if (original[j] === c) j++;
      else marks[i] = true;
      continue;
    }
    while (j < original.length && DIAC.test(original[j])) j++; // a diacritic in the original that was dropped
    if (original[j] === c) j++;
  }
  // highlight whole words that contain a mark
  const parts: { t: string; on: boolean }[] = [];
  const re = /\s+|[^\s]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const on = marks.slice(m.index, m.index + m[0].length).some(Boolean);
    parts.push({ t: m[0], on });
  }
  return (
    <p className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-jw-surface-2 p-3 text-base leading-8" dir="auto">
      {parts.map((p, i) => (p.on ? <mark key={i} className="rounded bg-jw-warn/30 text-inherit">{p.t}</mark> : <span key={i}>{p.t}</span>))}
    </p>
  );
}

export function AudioPlanEditor({ plan, onChange }: { plan: AudioPlan; onChange: (p: AudioPlan) => void }) {
  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-jw-warn/40 bg-jw-warn/10 p-3 text-sm">
        <Icon name="alert" size={14} className="me-1 inline text-jw-warn" />
        التشكيل وتحويل النص إلى كلام قد ينتجان نطقًا خاطئًا، خاصة في الأسماء والمصطلحات. راجع النص، وعدّل التشكيل حيث يلزم. الكلمات المظللة أُضيف لها تشكيل.
      </p>
      {plan.files.map((f, i) => (
        <div key={i} className="space-y-2 rounded-lg bg-jw-surface-2 p-3">
          <input className="jw-input py-1" value={f.title} onChange={(e) => onChange({ files: plan.files.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) })} aria-label={`اسم الملف ${i + 1}`} />
          <TashkeelView original={f.original} text={f.text} />
          <details>
            <summary className="cursor-pointer text-xs text-jw-muted">تعديل النص يدويًا ({f.text.length.toLocaleString("ar")} حرف)</summary>
            <textarea className="jw-textarea mt-2 text-base" rows={10} dir="auto" value={f.text} onChange={(e) => onChange({ files: plan.files.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })} />
          </details>
        </div>
      ))}
    </div>
  );
}
