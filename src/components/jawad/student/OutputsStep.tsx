"use client";

// «الطالب الذكي» — «النواتج»: what to make (a few taps), short questions with choices for each, one box for anything
// special, then «ابدأ»: everything is planned, made and approved by the assistant (the page's autopilot), and the files
// appear here to download. The design and fonts are never asked: Claude picks them (design-pick.ts).

import { useState } from "react";
import Icon from "@/components/jawad/Icon";
import { OUTPUT_KINDS, OUTPUT_STATUS, type OutputKind } from "@config/jawad/student";
import { PICTURE_KINDS } from "./autopilot";
import { KIND_LOOK, Tile } from "./look";
import OutputPanel from "./OutputPanel";
import type { ProjectHook } from "./StudentProject";
import { ErrorLine, JobStatus, useAsync } from "./ui";

type S = Record<string, unknown>;

/** What fits each purpose of the first page, chosen in advance (one tap to change). */
const SUGGEST: Record<string, OutputKind[]> = {
  exam: ["summary", "quiz"],
  understand: ["explain"],
  research: ["book"],
  teach: ["slides", "summary"],
  present: ["slides"],
  other: ["summary"],
};

/** The first answer of every question (what the assistant would choose). */
function defaults(kind: OutputKind, level: string): S {
  const young = /ابتدائي|متوسط/.test(level);
  switch (kind) {
    case "summary":
    case "explain":
      return { density: young ? "low" : "medium", pictures: "" };
    case "book":
      return { writing: "explain", page: "A4", density: "medium", pictures: "" };
    case "slides":
      return { count: 0, aspect: "16:9", notesMode: "both", render: "editable", imageQuality: "high" };
    case "audio":
      return { source: "text", mode: "single" };
    case "quiz":
      return { count: 10, difficulty: young ? "easy" : "medium", types: young ? ["mcq", "tf"] : ["mcq", "tf", "short"], usage: "both" };
    default:
      return {};
  }
}

function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.id)} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} className={`rounded-full border px-3 py-1.5 text-sm transition-all ${value === o.id ? "border-transparent bg-violet-600 text-white" : "border-jw-line bg-white hover:border-violet-300"}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** «GPT Image 2 or Claude»: what each gives, and what drawing costs. */
function MethodChoice({ what, value, quality, perUnit, free, onChange }: { what: "page" | "slide"; value: boolean; quality: string; perUnit: { high: number; medium: number }; free: boolean; onChange: (draw: boolean, quality: string) => void }) {
  const unit = what === "slide" ? "الشريحة" : "الصفحة";
  const price = (q: "high" | "medium") => (free ? "مجانًا لك الحين" : `≈ ${perUnit[q]} نقدة لكل ${what === "slide" ? "شريحة" : "صفحة"}`);
  return (
    <div className="space-y-2">
      <span className="text-sm font-semibold">كيف تنصنع {what === "slide" ? "الشرائح" : "الصفحات"}؟</span>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" aria-pressed={!value} onClick={() => onChange(false, quality)} className={`rounded-2xl border bg-white p-3 text-start ${!value ? "border-transparent ring-4 ring-violet-300" : "border-jw-line"}`}>
          <b className="block">🧩 صادق يصممها</b>
          <span className="block text-xs text-jw-muted">
            {what === "slide" ? "ملف PPTX تقدر تعدّل نصه بنفسك + PDF." : "PDF بخط عربي حقيقي، نصه قابل للنسخ والبحث."} بدون أخطاء في الكلمات. الأرخص: بدون تكلفة إضافية.
          </span>
        </button>
        <button type="button" aria-pressed={value} onClick={() => onChange(true, quality)} className={`rounded-2xl p-3 text-start text-white ${value ? "ring-4 ring-pink-300" : "opacity-90"}`} style={{ background: "linear-gradient(135deg,#7c3aed,#db2777 55%,#f97316)" }}>
          <b className="block">🪄 GPT Image 2 يرسمها</b>
          <span className="block text-xs text-white/90">كل {unit} لوحة فنية مرسومة، أجمل بكثير. النص يصير صورة (ما ينعدل)، وقد يغلط في كلمة أحيانًا وتقدر تعيد رسمها. {price(quality === "medium" ? "medium" : "high")}.</span>
        </button>
      </div>
      {value && (
        <Choice
          label="جودة الرسم"
          value={quality}
          options={[
            { id: "high", label: `عالية${free ? "" : ` (${perUnit.high} نقدة)`}` },
            { id: "medium", label: `متوسطة${free ? "" : ` (${perUnit.medium} نقدة)`}` },
          ]}
          onChange={(q) => onChange(true, q)}
        />
      )}
    </div>
  );
}

function Questions({ kind, s, set, chosen, prices }: { kind: OutputKind; s: S; set: (patch: S) => void; chosen: OutputKind[]; prices: ProjectHook["state"]["prices"] }) {
  const density = <Choice label="قد إيش التفصيل؟" value={String(s.density)} options={[{ id: "low", label: "مختصر" }, { id: "medium", label: "متوسط" }, { id: "high", label: "مفصل" }]} onChange={(density) => set({ density })} />;
  const pages = PICTURE_KINDS.includes(kind) && (
    <MethodChoice what="page" value={Boolean(s.pictures)} quality={String(s.pictures || "high")} perUnit={prices.page} free={prices.free} onChange={(draw, q) => set({ pictures: draw ? q : "" })} />
  );
  switch (kind) {
    case "summary":
    case "explain":
      return (
        <>
          {density}
          {pages}
        </>
      );
    case "book":
      return (
        <>
          <Choice label="نوع الكتاب" value={String(s.writing)} options={[{ id: "explain", label: "كتاب شرح" }, { id: "summary", label: "كتاب ملخص" }, { id: "verbatim", label: "النص كامل كما هو" }]} onChange={(writing) => set({ writing })} />
          <Choice label="المقاس" value={String(s.page)} options={[{ id: "A4", label: "A4" }, { id: "A5", label: "A5 (صغير)" }]} onChange={(page) => set({ page })} />
          {s.writing !== "verbatim" && density}
          {pages}
        </>
      );
    case "slides":
      return (
        <>
          <Choice label="كم شريحة؟" value={Number(s.count)} options={[{ id: 0, label: "حسب المادة" }, { id: 8, label: "٨" }, { id: 12, label: "١٢" }, { id: 20, label: "٢٠" }]} onChange={(count) => set({ count })} />
          <Choice label="الشرح وين؟" value={String(s.notesMode)} options={[{ id: "slide", label: "على الشريحة" }, { id: "notes", label: "في ملاحظات المحاضر" }, { id: "both", label: "الاثنين" }]} onChange={(notesMode) => set({ notesMode })} />
          <Choice label="الشكل" value={String(s.aspect)} options={[{ id: "16:9", label: "عريض 16:9" }, { id: "4:3", label: "4:3" }]} onChange={(aspect) => set({ aspect })} />
          <MethodChoice what="slide" value={s.render === "image"} quality={String(s.imageQuality || "high")} perUnit={prices.slide} free={prices.free} onChange={(draw, q) => set({ render: draw ? "image" : "editable", imageQuality: q })} />
        </>
      );
    case "audio": {
      const texts = chosen.filter((k) => k === "summary" || k === "explain" || k === "book");
      return (
        <>
          <Choice label="وش يقرأ؟" value={String(s.source)} options={[{ id: "text", label: "المادة كاملة" }, ...texts.map((k) => ({ id: k, label: OUTPUT_KINDS.find((o) => o.kind === k)!.name }))]} onChange={(source) => set({ source })} />
          <Choice label="الملفات" value={String(s.mode)} options={[{ id: "single", label: "ملف واحد" }, { id: "multi", label: "ملف لكل قسم" }]} onChange={(mode) => set({ mode })} />
        </>
      );
    }
    case "quiz": {
      const types = (s.types as string[]) ?? [];
      const TYPES = [
        { id: "mcq", label: "اختيار متعدد" },
        { id: "tf", label: "صح وخطأ" },
        { id: "short", label: "قصيرة" },
        { id: "essay", label: "مقالية" },
      ];
      return (
        <>
          <Choice label="كم سؤال؟" value={Number(s.count)} options={[5, 10, 20, 30].map((n) => ({ id: n, label: n.toLocaleString("ar") }))} onChange={(count) => set({ count })} />
          <Choice label="الصعوبة" value={String(s.difficulty)} options={[{ id: "easy", label: "سهل" }, { id: "medium", label: "متوسط" }, { id: "hard", label: "صعب" }]} onChange={(difficulty) => set({ difficulty })} />
          <div className="space-y-1">
            <span className="text-sm font-semibold">أنواع الأسئلة</span>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => {
                const on = types.includes(t.id);
                return (
                  <button key={t.id} type="button" aria-pressed={on} onClick={() => set({ types: on ? (types.length > 1 ? types.filter((x) => x !== t.id) : types) : [...types, t.id] })} className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-transparent bg-violet-600 text-white" : "border-jw-line bg-white"}`}>
                    {on ? "✓ " : ""}
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <Choice label="كيف تستخدمه؟" value={String(s.usage)} options={[{ id: "interactive", label: "أحل هنا" }, { id: "sheet", label: "ورقة أطبعها" }, { id: "both", label: "الاثنين" }]} onChange={(usage) => set({ usage })} />
          {pages}
        </>
      );
    }
    default:
      return <p className="text-sm text-jw-muted">ما يحتاج أسئلة: المادة كاملة كما قرأها صادق، PDF ونص.</p>;
  }
}

function Wizard({ p, onStart, onCancel }: { p: ProjectHook; onStart: () => void; onCancel?: () => void }) {
  const { project, prices, outputs } = p.state;
  const have = outputs.map((o) => o.kind);
  const [phase, setPhase] = useState<"pick" | "ask">("pick");
  const [pick, setPick] = useState<OutputKind[]>(() => (SUGGEST[project.brief.purpose] ?? ["summary"]).filter((k) => !have.includes(k)));
  const [answers, setAnswers] = useState<Record<string, S>>({});
  const [special, setSpecial] = useState("");
  const { busy, error, run } = useAsync();
  const of = (k: OutputKind) => ({ ...defaults(k, project.level), ...answers[k] });
  const set = (k: OutputKind) => (patch: S) => setAnswers((a) => ({ ...a, [k]: { ...of(k), ...patch } }));

  if (phase === "pick") {
    return (
      <section className="jw-panel space-y-4 p-4">
        <h2 className="text-lg font-bold">وش تبي نصنع؟</h2>
        <p className="text-sm text-jw-muted">اخترنا لك اللي يناسب غرضك. اضغط لتضيف أو تشيل.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {OUTPUT_KINDS.filter((k) => !have.includes(k.kind)).map((k) => {
            const on = pick.includes(k.kind);
            return (
              <button key={k.kind} type="button" aria-pressed={on} onClick={() => setPick(on ? pick.filter((x) => x !== k.kind) : [...pick, k.kind])} className={`relative flex items-start gap-3 rounded-2xl border bg-white p-3 text-start transition-all ${on ? "border-transparent ring-4 ring-violet-300" : "border-jw-line hover:-translate-y-0.5"}`}>
                <Tile emoji={KIND_LOOK[k.kind].emoji} grad={KIND_LOOK[k.kind].grad} size={40} />
                <span className="min-w-0">
                  <b className="block">{k.name}</b>
                  <span className="block text-xs text-jw-muted">{k.blurb}</span>
                </span>
                {on && (
                  <span className="absolute top-2 left-2 grid size-6 place-items-center rounded-full text-white" style={{ background: "var(--st-grad)" }}>
                    <Icon name="check" size={14} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="jw-btn jw-btn-primary" disabled={!pick.length} onClick={() => setPhase("ask")}>
            التالي ({pick.length})
          </button>
          {onCancel && (
            <button type="button" className="jw-btn" onClick={onCancel}>
              إلغاء
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {pick.map((k) => (
        <div key={k} className="jw-panel space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Tile emoji={KIND_LOOK[k].emoji} grad={KIND_LOOK[k].grad} size={34} />
            <h2 className="font-bold">{OUTPUT_KINDS.find((o) => o.kind === k)!.name}</h2>
          </div>
          <Questions kind={k} s={of(k)} set={set(k)} chosen={pick} prices={prices} />
        </div>
      ))}
      <div className="jw-panel space-y-3 p-4">
        <label className="block space-y-1">
          <span className="font-bold">تبي تصميم خاص أو طلب زيادة؟ (اختياري)</span>
          <textarea className="jw-textarea" rows={3} value={special} onChange={(e) => setSpecial(e.target.value)} placeholder="مثال: ألوان هادئة، أمثلة من الحياة اليومية، ركّز على الفصل الثاني…" />
        </label>
        <p className="text-xs text-jw-faint">الخطوط والتصميم يختارها صادق لك حسب مادتك وعمرك وغرضك. كل خطوة مدفوعة تنخصم بسعرها وقت تنفيذها، وترجع لك إذا فشلت.</p>
        <ErrorLine error={error} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="jw-btn jw-btn-primary !min-h-12 !px-8"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await p.act({ action: "start", outputs: pick.map((k) => ({ kind: k, settings: of(k) })), special });
                onStart();
              })
            }
          >
            {busy ? <span className="jw-spinner !border-white/40 !border-t-white" aria-hidden /> : <Icon name="sparkles" size={18} />} ابدأ
          </button>
          <button type="button" className="jw-btn" disabled={busy} onClick={() => setPhase("pick")}>
            رجوع
          </button>
        </div>
      </div>
    </section>
  );
}

export default function OutputsStep({ p, onStart, researching, working }: { p: ProjectHook; onStart: () => void; researching: boolean; working: boolean }) {
  const { outputs, jobs } = p.state;
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const running = jobs.some((j) => j.status === "queued" || j.status === "running");

  if (researching) {
    const job = jobs.find((j) => j.kind === "research" && j.status !== "succeeded");
    return (
      <section className="jw-panel space-y-3 p-6 text-center">
        <span className="text-4xl" aria-hidden>
          🔎
        </span>
        <h2 className="text-lg font-bold">صادق يبحث في الويب ليكمل مادتك</h2>
        <p className="text-sm text-jw-muted">دقائق قليلة، وبعدها تختار نواتجك.</p>
        <JobStatus job={job} />
      </section>
    );
  }
  if (!outputs.length || adding) return <Wizard p={p} onCancel={outputs.length ? () => setAdding(false) : undefined} onStart={() => { setAdding(false); onStart(); }} />;

  const sorted = [...outputs].sort((a, b) => a.ord - b.ord);
  const selected = sorted.find((o) => o.id === open) ?? null;
  const allDone = sorted.every((o) => o.status === "done");
  const stuck = !working && !running && !allDone;

  return (
    <div className="space-y-4">
      <section className="jw-panel space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{allDone ? "جاهز ✅ — نزّل ملفاتك" : "صادق يصنع نواتجك…"}</h2>
          <div className="flex gap-2">
            {stuck && (
              <button type="button" className="jw-btn jw-btn-primary" onClick={onStart}>
                <Icon name="sparkles" size={16} /> كمّل
              </button>
            )}
            <button type="button" className="jw-btn" disabled={running} onClick={() => setAdding(true)}>
              <Icon name="plus" size={16} /> نواتج أخرى
            </button>
          </div>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((o) => {
            const job = jobs.find((j) => j.outputId === o.id && (j.status === "queued" || j.status === "running"));
            return (
              <li key={o.id}>
                <button type="button" onClick={() => setOpen(open === o.id ? null : o.id)} className={`flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-start ${open === o.id ? "ring-4 ring-violet-200" : "border-jw-line"}`}>
                  <Tile emoji={KIND_LOOK[o.kind].emoji} grad={KIND_LOOK[o.kind].grad} size={36} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">{o.title}</b>
                    <span className={`block text-xs ${o.status === "done" ? "text-jw-ok" : o.status === "failed" ? "text-jw-danger" : "text-jw-muted"}`}>{job ? job.stage || "جارٍ…" : o.status === "done" ? "جاهز — اضغط للتنزيل" : (OUTPUT_STATUS[o.status] ?? o.status)}</span>
                  </span>
                  {job && <span className="jw-spinner" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
        {stuck && sorted.some((o) => o.status === "failed") && <p className="text-sm text-jw-danger">تعثّر ناتج. افتحه وشوف السبب، أو اضغط «كمّل» يحاول مرة ثانية.</p>}
      </section>
      {selected && <OutputPanel key={selected.id} p={p} o={selected} />}
    </div>
  );
}
