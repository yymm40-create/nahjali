"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/jawad/Icon";
import { STUDENT } from "@config/jawad/student";
import { useProject, type ProjectState } from "./client";
import OutputsStep from "./OutputsStep";
import ReviewStep from "./ReviewStep";
import ScopeStep from "./ScopeStep";
import SourcesStep from "./SourcesStep";
import { useAutopilot } from "./autopilot";
import { STEP_LOOK } from "./look";
import { ErrorLine } from "./ui";
import UnderstandingStep from "./UnderstandingStep";

const STEPS = [
  { id: "sources", label: "المادة" },
  { id: "review", label: "مراجعة النص" },
  { id: "understanding", label: "الفهم" },
  { id: "scope", label: "حدود المصدر" },
  { id: "outputs", label: "النواتج" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

export default function StudentProject({ initial }: { initial: ProjectState }) {
  const p = useProject(initial);
  const auto = useAutopilot(p.state, p.busy, p.refresh);
  const { project } = p.state;
  const reached = STEPS.findIndex((s) => s.id === project.stage);
  const [view, setView] = useState<StepId>(project.stage);
  // when the project moves on (an approval), follow it
  const [lastStage, setLastStage] = useState(project.stage);
  if (lastStage !== project.stage) {
    setLastStage(project.stage);
    setView(project.stage);
  }
  // a new step opens at the top of the steps bar, smoothly
  const navRef = useRef<HTMLElement>(null);
  const firstView = useRef(true);
  useEffect(() => {
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    navRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [view]);

  const HINT: Record<StepId, string> = {
    sources: "أضف نصك أو ارفع الصور وملفات PDF، ثم استخرج النص.",
    review: "راجع النص المستخرج وصحّح ما يلزم، ثم اعتمده.",
    understanding: "اقرأ كيف فهم المساعد مادتك، واعتمد الفهم أو عدّله.",
    scope: "حدّد: هل يضيف المساعد من معرفته؟ وهل يبحث في الويب؟",
    outputs: "اختر ما تريد صنعه من مادتك، وكل ناتج له خطواته.",
  };
  const vi = STEPS.findIndex((s) => s.id === view);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6" data-st-stage={view} data-st-project={project.id}>
      <header className="st-rise flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={STUDENT.base} className="jw-btn jw-btn-icon" aria-label="موادي">
            <Icon name="chevronRight" size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">{project.title || "مادة"}</h1>
            <p className="text-xs text-jw-faint">
              {project.level ? `${project.level} · ` : ""}تُحذف {new Date(project.expiresAt).toLocaleDateString("ar")} إن لم تُستخدم
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {p.state.balance !== null && <span className="jw-chip !px-3 !py-1 !text-sm">🪙 {p.state.balance}</span>}
          <button
            type="button"
            className="jw-btn jw-btn-quiet jw-btn-icon !text-jw-danger"
            aria-label="حذف المادة"
            title="حذف المادة"
            onClick={async () => {
              if (!confirm("حذف هذه المادة وكل ملفاتها ونواتجها نهائيًا؟")) return;
              try {
                await p.act({ action: "delete" });
                window.location.href = STUDENT.base;
              } catch (e) {
                alert(`ما انحذفت المادة: ${e instanceof Error ? e.message : String(e)}`);
              }
            }}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      </header>

      {p.pending && <div className="st-loading" role="progressbar" aria-label="جارٍ التنفيذ" />}
      <nav ref={navRef} aria-label="مراحل المادة" className="jw-panel scroll-mt-24 px-2 py-4 sm:px-6">
        <div className="st-steps">
          <span className="bar" style={{ width: `${(reached / (STEPS.length - 1)) * 80}%` }} aria-hidden />
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`st-step ${i < reached ? "done" : ""} ${i === reached ? "current" : ""} ${view === s.id ? "viewing" : ""}`}
              aria-current={view === s.id ? "step" : undefined}
              disabled={i > reached}
              onClick={() => setView(s.id)}
            >
              <span className="dot text-lg">{i < reached ? <Icon name="check" size={18} /> : <span aria-hidden>{STEP_LOOK[i].emoji}</span>}</span>
              <span className="text-center leading-tight">{s.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-jw-muted">{HINT[STEPS[vi].id]}</p>
        {auto.mode ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 rounded-2xl p-3 text-white" style={{ background: "var(--st-grad)" }} role="status" aria-live="polite">
            <span className="jw-spinner !border-white/40 !border-t-white" aria-hidden />
            <span className="font-semibold">🤖 المساعد يكمل {auto.mode.scope === "step" ? "هذه الخطوة" : "كل الخطوات"} تلقائيًا{auto.doing ? `: ${auto.doing}` : ""}</span>
            <button type="button" className="rounded-full bg-white px-4 py-1 text-sm font-bold text-pink-600" onClick={auto.stop}>
              أوقف
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button type="button" className="jw-btn" onClick={() => auto.start("step")}>
              ⚡ تخطَّ هذه الخطوة — دع المساعد يقرر
            </button>
            <button type="button" className="jw-btn" onClick={() => auto.start("all")}>
              🤖 دع المساعد يكمل كل الخطوات
            </button>
            <span className="w-full text-center text-[11px] text-jw-faint">يختار المساعد الإعدادات ويعتمد بدلًا عنك، والخطوات المدفوعة تُخصم بسعرها. تقدر توقفه في أي وقت.</span>
          </div>
        )}
        {auto.error && (
          <div className="mt-3">
            <ErrorLine error={auto.error} />
          </div>
        )}
      </nav>

      <ErrorLine error={p.error} />

      <div key={view} className="st-rise">
      {view === "sources" && <SourcesStep p={p} />}
      {view === "review" && <ReviewStep p={p} />}
      {view === "understanding" && <UnderstandingStep p={p} />}
      {view === "scope" && <ScopeStep p={p} />}
      {view === "outputs" && <OutputsStep p={p} />}
      </div>
    </div>
  );
}

export type ProjectHook = ReturnType<typeof useProject>;
