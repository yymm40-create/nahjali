"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Icon from "@/components/jawad/Icon";
import { STUDENT } from "@config/jawad/student";
import { useProject, type ProjectState } from "./client";
import { PURPOSES } from "@config/jawad/student";
import OutputsStep from "./OutputsStep";
import ResearchRun from "./ResearchRun";
import SourcesStep from "./SourcesStep";
import { useAutopilot } from "./autopilot";
import { STEP_LOOK } from "./look";
import { ErrorLine } from "./ui";
import UnderstandingStep from "./UnderstandingStep";

// Three steps the student sees. The text review and the source rules happen by themselves: the text is read and
// approved by the assistant, and the research the first page asked for runs after the understanding.
const STEPS = [
  { id: "sources", label: "المادة" },
  { id: "understanding", label: "الفهم" },
  { id: "outputs", label: "النواتج" },
] as const;
type StepId = (typeof STEPS)[number]["id"];
const stepOf = (stage: ProjectState["project"]["stage"]): StepId => (stage === "review" ? "sources" : stage === "scope" ? "outputs" : stage);

export default function StudentProject({ initial }: { initial: ProjectState }) {
  const p = useProject(initial);
  const auto = useAutopilot(p.state, p.busy, p.refresh);
  const { project } = p.state;
  const step = stepOf(project.stage);
  const reached = STEPS.findIndex((s) => s.id === step);
  const [view, setView] = useState<StepId>(step);
  // when the project moves on (an approval), follow it
  const [lastStage, setLastStage] = useState(project.stage);
  if (lastStage !== project.stage) {
    setLastStage(project.stage);
    setView(step);
  }
  // «ملفاتي + بحث»: once the understanding is approved, the research runs by itself
  const { start } = auto;
  // «كلاود يبحث لي» (the first page's choice; `?go=research` when the brief couldn't be saved): no upload page and no
  // approval of the understanding — research, reading and understanding run by themselves up to the outputs
  const fromHome = useSyncExternalStore(noSubscribe, () => window.location.search.includes("go=research"), () => false);
  const [filesInstead, setFilesInstead] = useState(false);
  const researchMode = project.brief.mode === "research" || fromHome || p.state.sources.some((s) => s.name.startsWith("بحث كلاود"));
  const researching = researchMode && !filesInstead && ["sources", "review", "understanding"].includes(project.stage);
  const written = p.state.sources.some((s) => s.kind === "text" && s.name.startsWith("بحث كلاود"));
  const searching = p.state.jobs.some((j) => j.kind === "research" && (j.status === "queued" || j.status === "running"));
  // started once for each point it can start from (the research running, then written); a stop is not restarted alone
  const autoKey = useRef("");
  useEffect(() => {
    if (!researching || auto.mode || !(written || searching)) return;
    const key = `${project.stage}:${written}`;
    if (autoKey.current === key) return;
    autoKey.current = key;
    start("all");
  }, [researching, auto.mode, written, searching, project.stage, start]);
  useEffect(() => {
    if (project.stage === "scope" && !auto.mode) start("step");
  }, [project.stage, auto.mode, start]);
  // a material left half-read (the page was closed): reading goes on when it is opened again
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || auto.mode) return;
    resumed.current = true;
    if (project.stage === "review" && !researching) start("material");
  }, [project.stage, auto.mode, start, researching]);
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
    sources: project.brief.mode === "research" ? "خلّ كلاود يبحث ويكتب مادتك، أو أضف ملفاتك، ثم «تابع»." : "أضف صورك أو ملفات PDF أو نصك، ثم «تابع».",
    understanding: "اقرأ كيف فهم المساعد مادتك، واعتمده أو صحّحه.",
    outputs: "اختر نواتجك، أجب الأسئلة القصيرة، واضغط «ابدأ».",
  };
  const purpose = PURPOSES.find((x) => x.id === project.brief.purpose);
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
              {project.level ? `${project.level} · ` : ""}
              {purpose ? `${purpose.id === "other" ? project.brief.purposeNote || purpose.label : purpose.label} · ` : ""}تُحذف {new Date(project.expiresAt).toLocaleDateString("ar")} إن لم تُستخدم
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
        ) : null}
        {auto.error && (
          <div className="mt-3">
            <ErrorLine error={auto.error} />
          </div>
        )}
      </nav>

      <ErrorLine error={p.error} />

      <div key={view} className="st-rise">
      {researching && view !== "outputs" ? (
        <ResearchRun p={p} working={auto.doing} error={auto.error} onGo={() => start("all")} onFiles={() => setFilesInstead(true)} />
      ) : (
        view === "sources" && <SourcesStep p={p} onContinue={() => start("material")} />
      )}
      {view === "understanding" && !researching && <UnderstandingStep p={p} />}
      {view === "outputs" && <OutputsStep p={p} onStart={() => start("all")} researching={project.stage === "scope"} working={Boolean(auto.mode)} />}
      </div>
    </div>
  );
}

export type ProjectHook = ReturnType<typeof useProject>;

const noSubscribe = () => () => {};
