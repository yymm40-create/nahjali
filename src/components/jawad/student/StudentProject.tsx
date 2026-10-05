"use client";

import Link from "next/link";
import { useState } from "react";
import Icon from "@/components/jawad/Icon";
import { STUDENT } from "@config/jawad/student";
import { useProject, type ProjectState } from "./client";
import OutputsStep from "./OutputsStep";
import ReviewStep from "./ReviewStep";
import ScopeStep from "./ScopeStep";
import SourcesStep from "./SourcesStep";
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
  const { project } = p.state;
  const reached = STEPS.findIndex((s) => s.id === project.stage);
  const [view, setView] = useState<StepId>(project.stage);
  // when the project moves on (an approval), follow it
  const [lastStage, setLastStage] = useState(project.stage);
  if (lastStage !== project.stage) {
    setLastStage(project.stage);
    setView(project.stage);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-3 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <Link href={STUDENT.base} className="text-xs text-jw-muted hover:underline">
            <Icon name="chevronRight" size={12} className="inline" /> موادي
          </Link>
          <h1 className="truncate text-xl font-bold">{project.title || "مادة"}</h1>
          <p className="text-xs text-jw-faint">
            {project.level ? `${project.level} · ` : ""}تُحذف في {new Date(project.expiresAt).toLocaleDateString("ar")} إن لم تُستخدم (٣٠ يومًا من آخر نشاط)
            {p.state.balance !== null ? ` · رصيدك ${p.state.balance} نقدة` : ""}
          </p>
        </div>
        <button
          type="button"
          className="jw-btn jw-btn-quiet text-jw-danger"
          onClick={async () => {
            if (!confirm("حذف هذه المادة وكل ملفاتها ونواتجها نهائيًا؟")) return;
            await p.act({ action: "delete" }).catch(() => null);
            window.location.href = STUDENT.base;
          }}
        >
          <Icon name="trash" size={14} /> حذف المادة
        </button>
      </div>

      <nav aria-label="مراحل المادة" className="jw-tabs flex gap-1 overflow-x-auto">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`jw-chip shrink-0 ${view === s.id ? "!border-jw-accent !text-jw-ink" : ""}`}
            aria-current={view === s.id ? "step" : undefined}
            disabled={i > reached}
            onClick={() => setView(s.id)}
          >
            <span className="grid size-5 place-items-center rounded-full bg-jw-surface-3 text-xs">{i < reached ? <Icon name="check" size={12} /> : i + 1}</span>
            {s.label}
          </button>
        ))}
      </nav>

      <ErrorLine error={p.error} />

      {view === "sources" && <SourcesStep p={p} />}
      {view === "review" && <ReviewStep p={p} />}
      {view === "understanding" && <UnderstandingStep p={p} />}
      {view === "scope" && <ScopeStep p={p} />}
      {view === "outputs" && <OutputsStep p={p} />}
    </div>
  );
}

export type ProjectHook = ReturnType<typeof useProject>;
