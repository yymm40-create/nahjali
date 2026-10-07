"use client";

// «الطالب الذكي» — «النواتج»: what to make (a few taps), short questions with choices for each (the page count and the
// file type among them, kept exactly), the design step (the student's style, ideas, fonts and page frame — or «تخطَّ»
// and صادق picks: design-pick.ts), one box for special requests (they come first), then «ابدأ»: with صادق on,
// everything is planned, made and approved by him (the page's autopilot); off, the student opens each output.

import { useState } from "react";
import Icon from "@/components/jawad/Icon";
import { DESIGNED_KINDS, OUTPUT_KINDS, OUTPUT_STATUS, emptyWish, type DesignWish, type OutputKind } from "@config/jawad/student";
import { defaults, DesignStep, Questions } from "./Questions";
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

function Wizard({ p, onStart, onCancel }: { p: ProjectHook; onStart: () => void; onCancel?: () => void }) {
  const { project, prices, outputs } = p.state;
  const have = outputs.map((o) => o.kind);
  const [phase, setPhase] = useState<"pick" | "ask" | "design">("pick");
  const [wish, setWish] = useState<DesignWish>(emptyWish);
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

  // the design step only when something designed was chosen (not a recording or a transcript alone)
  const designed = pick.some((k) => DESIGNED_KINDS.includes(k));
  const begin = (skipDesign: boolean) =>
    run(async () => {
      await p.act({ action: "start", outputs: pick.map((k) => ({ kind: k, settings: of(k) })), special, design: skipDesign ? emptyWish() : wish });
      onStart();
    });
  const startButtons = (skipDesign: boolean) => (
    <>
      <ErrorLine error={error} />
      <p className="text-xs text-jw-faint">طلباتك لها الأولوية على اختيارات صادق. كل خطوة مدفوعة تنخصم بسعرها وقت تنفيذها، وترجع لك إذا فشلت.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="jw-btn jw-btn-primary !min-h-12 !px-8" disabled={busy} onClick={() => begin(skipDesign)}>
          {busy ? <span className="jw-spinner !border-white/40 !border-t-white" aria-hidden /> : <Icon name="sparkles" size={18} />} ابدأ
        </button>
        <button type="button" className="jw-btn" disabled={busy} onClick={() => setPhase(phase === "design" ? "ask" : "pick")}>
          رجوع
        </button>
      </div>
    </>
  );

  if (phase === "design") {
    return (
      <section className="jw-panel space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">🎨 التصميم: كيف تبيه يطلع؟</h2>
            <p className="text-sm text-jw-muted">أنت تحدد الشكل النهائي، وصادق يلتزم فيه. أو تخطّ وخلّه يختار.</p>
          </div>
          <button type="button" className="jw-btn" disabled={busy} onClick={() => begin(true)}>
            تخطَّ — خلّ صادق يختار
          </button>
        </div>
        <DesignStep wish={wish} set={setWish} />
        <label className="block space-y-1">
          <span className="font-bold">طلبات خاصة على المحتوى (اختياري) — لها الأولوية</span>
          <textarea className="jw-textarea" rows={3} value={special} onChange={(e) => setSpecial(e.target.value)} placeholder="مثال: أمثلة من الحياة اليومية، ركّز على الفصل الثاني، لا تكتب مقدمة…" />
        </label>
        {startButtons(false)}
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
        {designed ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="jw-btn jw-btn-primary !min-h-12 !px-8" onClick={() => setPhase("design")}>
              التالي: التصميم 🎨
            </button>
            <button type="button" className="jw-btn" onClick={() => setPhase("pick")}>
              رجوع
            </button>
          </div>
        ) : (
          <>
            <label className="block space-y-1">
              <span className="font-bold">طلبات خاصة (اختياري) — لها الأولوية</span>
              <textarea className="jw-textarea" rows={3} value={special} onChange={(e) => setSpecial(e.target.value)} placeholder="مثال: اقرأ ببطء، ركّز على الفصل الثاني…" />
            </label>
            {startButtons(true)}
          </>
        )}
      </div>
    </section>
  );
}

export default function OutputsStep({ p, autoOn, onStart, onCreated, onResearch, researching, working }: { p: ProjectHook; autoOn: boolean; onStart: () => void; onCreated: () => void; onResearch: () => void; researching: boolean; working: boolean }) {
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
        {!working && !jobs.some((j) => j.kind === "research" && (j.status === "queued" || j.status === "running")) && (
          <button type="button" className="jw-btn jw-btn-primary mx-auto" onClick={onResearch}>
            <Icon name="sparkles" size={16} /> كمّل البحث
          </button>
        )}
      </section>
    );
  }
  if (!outputs.length || adding) return <Wizard p={p} onCancel={outputs.length ? () => setAdding(false) : undefined} onStart={() => { setAdding(false); onCreated(); }} />;

  const sorted = [...outputs].sort((a, b) => a.ord - b.ord);
  const selected = sorted.find((o) => o.id === open) ?? null;
  const allDone = sorted.every((o) => o.status === "done");
  const stuck = !working && !running && !allDone;

  return (
    <div className="space-y-4">
      <section className="jw-panel space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{allDone ? "جاهز ✅ — نزّل ملفاتك" : working || running ? "صادق يصنع نواتجك…" : autoOn ? "نواتجك" : "افتح كل ناتج: راجع خطته واعتمدها، وبعدها يتصنع"}</h2>
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
      {selected && <OutputPanel key={selected.id} p={p} o={selected} onRemade={() => autoOn && onStart()} />}
    </div>
  );
}
