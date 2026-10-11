"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Icon from "@/components/jawad/Icon";
import { STUDENT, isResearchSource } from "@config/jawad/student";
import { useProject, type ProjectState } from "./client";
import { PURPOSES } from "@config/jawad/student";
import OutputsStep from "./OutputsStep";
import { useAutopilot } from "./autopilot";
import StartTiers, { type TierId } from "./StartTiers";
import { STEP_LOOK } from "./look";
import { AutoSwitch } from "./StudentHome";
import { ErrorLine } from "./ui";

// The student sees TWO steps: «المادة» — ONE page of three tiers («مراتب»: the request, the material, the understanding, one
// under the other, see StartTiers) — and «النواتج». The text review and the source rules happen by themselves: the text is
// read and approved by the assistant, and the research the request asked for runs after the understanding. Every tier
// reached can be opened again. `StepId` stays the finer position inside the first page (which tier is the current one).
const STEPS = [
  { id: "brief", label: "الطلب", emoji: "🎯" },
  { id: "sources", label: "المادة", emoji: STEP_LOOK[0].emoji },
  { id: "understanding", label: "الفهم", emoji: STEP_LOOK[1].emoji },
  { id: "outputs", label: "النواتج", emoji: STEP_LOOK[2].emoji },
] as const;
type StepId = (typeof STEPS)[number]["id"];
const GROUPS = [
  { id: "start", label: "المادة", emoji: "📚" },
  { id: "outputs", label: "النواتج", emoji: STEP_LOOK[2].emoji },
] as const;
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
  // the tiers of the first page: the one the material is at is open, the ones behind it fold
  const [open, setOpen] = useState<Record<string, boolean>>(step === "outputs" ? {} : { [step]: true });
  if (lastStage !== project.stage) {
    setLastStage(project.stage);
    setView(step);
    setOpen(step === "outputs" ? {} : { [step]: true });
  }
  // «ملفاتي + بحث»: once the understanding is approved, the research runs by itself
  const { start } = auto;
  // «صادق يبحث لي» (the first page's choice; `?go=research` when the brief couldn't be saved): no upload page and no
  // approval of the understanding — research, reading and understanding run by themselves up to the outputs
  const fromHome = useSyncExternalStore(noSubscribe, () => window.location.search.includes("go=research"), () => false);
  // «صادق يكمل تلقائيًا» (the first page's switch, changed here any time): off, nothing moves on by itself
  const offFromHome = useSyncExternalStore(noSubscribe, () => window.location.search.includes("auto=0"), () => false);
  const [autoSet, setAutoSet] = useState<boolean | null>(null);
  const autoOn = autoSet ?? (project.brief.auto && !offFromHome);
  const [filesInstead, setFilesInstead] = useState(false);
  const researchMode = project.brief.mode === "research" || fromHome || p.state.sources.some((s) => isResearchSource(s.name));
  // with صادق off, a researched material goes the usual way (the text, then the understanding to approve)
  const researching = autoOn && researchMode && !filesInstead && ["sources", "review", "understanding"].includes(project.stage);
  const written = p.state.sources.some((s) => s.kind === "text" && isResearchSource(s.name));
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
    if (autoOn && project.stage === "scope" && !auto.mode) start("step");
  }, [autoOn, project.stage, auto.mode, start]);
  // a material left half-read (the page was closed): reading goes on when it is opened again
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || auto.mode) return;
    resumed.current = true;
    if (autoOn && project.stage === "review" && !researching) start("material");
  }, [autoOn, project.stage, auto.mode, start, researching]);
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

  const HINT: Record<"start" | "outputs", string> = {
    start: project.brief.mode === "research" ? "اكتب طلبك، وخلّ صادق يبحث ويكتب مادتك (أو أضف ملفاتك)، ثم اعتمد فهمه — كله هنا في صفحة وحدة." : "اكتب طلبك، أضف صورك أو ملفاتك أو نصك، ثم اعتمد فهم صادق — كله هنا في صفحة وحدة.",
    outputs: autoOn ? "اختر نواتجك، أجب الأسئلة القصيرة، واضغط «ابدأ»." : "اختر نواتجك واضغط «ابدأ»، وبعدها افتح كل ناتج: راجع خطته واعتمدها قبل التصنيع.",
  };
  const group: "start" | "outputs" = view === "outputs" ? "outputs" : "start";
  const gi = GROUPS.findIndex((g) => g.id === group);
  const reachedGroup = reached >= 3 ? 1 : 0;
  const toggle = (id: TierId) => {
    const on = !open[id];
    setOpen((o) => ({ ...o, [id]: on }));
    if (on) setView(id);
  };
  const purpose = PURPOSES.find((x) => x.id === project.brief.purpose);

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
          <AutoSwitch
            compact
            on={autoOn}
            onChange={(on) => {
              setAutoSet(on);
              if (!on) auto.stop();
              p.act({ action: "auto", on }).catch(() => null);
            }}
          />
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
          <span className="bar" style={{ width: `${(reachedGroup / (GROUPS.length - 1)) * 80}%` }} aria-hidden />
          {GROUPS.map((g, i) => (
            <button
              key={g.id}
              type="button"
              className={`st-step ${i < reachedGroup ? "done" : ""} ${i === reachedGroup ? "current" : ""} ${group === g.id ? "viewing" : ""}`}
              aria-current={group === g.id ? "step" : undefined}
              disabled={i > reachedGroup}
              onClick={() => setView(g.id === "outputs" ? "outputs" : step === "outputs" ? "understanding" : step)}
            >
              <span className="dot text-lg">{i < reachedGroup ? <Icon name="check" size={18} /> : <span aria-hidden>{g.emoji}</span>}</span>
              <span className="text-center leading-tight">{g.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-jw-muted">{HINT[group]}</p>
        {auto.mode ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 rounded-2xl p-3 text-white" style={{ background: "var(--st-grad)" }} role="status" aria-live="polite">
            <span className="jw-spinner !border-white/40 !border-t-white" aria-hidden />
            <span className="font-semibold">🤖 صادق يكمل {auto.mode.scope === "step" ? "هذه الخطوة" : "كل الخطوات"} تلقائيًا{auto.doing ? `: ${auto.doing}` : ""}</span>
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

      <div key={group} className="st-rise">
        {group === "start" ? (
          <StartTiers p={p} reached={reached} open={open} onToggle={toggle} researching={researching} working={auto.doing} error={auto.error} onGo={() => start("all")} onFiles={() => setFilesInstead(true)} onContinue={() => start("material")} />
        ) : (
          <OutputsStep p={p} autoOn={autoOn} onStart={() => start("all")} onCreated={() => autoOn && start("all")} onResearch={() => start("step")} researching={project.stage === "scope"} working={Boolean(auto.mode)} />
        )}
      </div>

      {/* between the two steps: from the outputs back to the tiers, and forward again once the material has gone on */}
      <nav aria-label="التنقل بين الخطوات" className="flex flex-wrap items-center justify-between gap-2">
        {gi > 0 ? (
          <button type="button" className="jw-btn" onClick={() => { setView("understanding"); setOpen({ understanding: true }); }}>
            → رجوع: {GROUPS[gi - 1].label}
          </button>
        ) : (
          <span />
        )}
        {gi < reachedGroup && (
          <button type="button" className="jw-btn" onClick={() => setView("outputs")}>
            التالي: {GROUPS[gi + 1].label} ←
          </button>
        )}
      </nav>
    </div>
  );
}

export type ProjectHook = ReturnType<typeof useProject>;

const noSubscribe = () => () => {};
