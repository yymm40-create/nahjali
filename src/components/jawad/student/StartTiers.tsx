"use client";

// «الطالب الذكي» — the first page, ALL ON ONE PAGE, as tiers («مراتب»): the request (the subject, the purpose, the
// level), the material (files, the paste, the transcription of a video or a recording, the question to «الذكاء
// الإسلامي», or صادق's research) and the understanding. They stand one under the other; the tier the material has
// reached is open, the ones behind it are folded and open again with a press, the ones ahead are locked until it is
// reached. It used to be three pages the student went between.

import type { ReactNode } from "react";
import Icon from "@/components/jawad/Icon";
import BriefStep from "./BriefStep";
import IslamicAsk from "./IslamicAsk";
import ResearchRun from "./ResearchRun";
import SourcesStep from "./SourcesStep";
import type { ProjectHook } from "./StudentProject";
import UnderstandingStep from "./UnderstandingStep";

export type TierId = "sources" | "understanding";

export const TIERS: { id: TierId; n: number; label: string; emoji: string; hint: string }[] = [
  { id: "sources", n: 1, label: "المادة ومحتواها", emoji: "📤", hint: "اسم المادة، وملفاتك: PDF، صور، يوتيوب، تسجيل، نص — أو صادق يبحث لك." },
  { id: "understanding", n: 2, label: "الفهم", emoji: "🧠", hint: "صادق فرّغ وقرأ كل شي: اقرأ فهمه، واعتمده أو صحّحه." },
];

/** Which tier a material is at: 0 material, 1 understanding; 2 once it has gone on to the outputs (from StudentProject's
 *  steps, where 1 is the material, 2 the understanding and 3 the outputs). */
export const tierReached = (reached: number) => Math.max(0, Math.min(2, reached - 1));

export default function StartTiers({
  p,
  reached,
  open,
  onToggle,
  researching,
  working,
  error,
  onGo,
  onFiles,
  onContinue,
}: {
  p: ProjectHook;
  /** the step the material has reached, as StudentProject counts them (0 request … 3 outputs) */
  reached: number;
  open: Record<string, boolean>;
  onToggle: (id: TierId) => void;
  researching: boolean;
  working: string | null;
  error: string | null;
  onGo: () => void;
  onFiles: () => void;
  onContinue: () => void;
}) {
  const at = tierReached(reached);
  const body = (id: TierId): ReactNode => {
    if (id === "sources") {
      // the way of research: its own run — and the question to «الذكاء الإسلامي» is still here, never hidden by it
      return researching ? (
        <div className="space-y-4">
          <BriefStep p={p} />
          <ResearchRun p={p} working={working} error={error} onGo={onGo} onFiles={onFiles} />
          <IslamicAsk p={p} />
        </div>
      ) : (
        <div className="space-y-4">
          <BriefStep p={p} />
          <SourcesStep p={p} onContinue={onContinue} />
        </div>
      );
    }
    return researching ? (
      <p className="jw-panel p-4 text-center text-sm text-jw-muted">يفهم صادق مادتك تلقائيًا بعد ما يكتبها من البحث، وتشوف فهمه هنا.</p>
    ) : (
      <UnderstandingStep p={p} />
    );
  };

  return (
    <ol className="space-y-4" aria-label="مراتب المادة">
      {TIERS.map((t, i) => {
        const locked = i > at;
        const done = i < at || reached >= 3;
        const current = i === at && reached < 3;
        const isOpen = !locked && Boolean(open[t.id]);
        return (
          <li key={t.id} data-st-tier={t.id} className={`st-tier ${locked ? "locked" : ""} ${done ? "done" : ""} ${current ? "current" : ""}`}>
            <button type="button" className="st-tier-head" aria-expanded={isOpen} aria-controls={`st-tier-${t.id}`} disabled={locked} onClick={() => onToggle(t.id)}>
              <span className="st-tier-n" aria-hidden>
                {done ? <Icon name="check" size={16} /> : locked ? "🔒" : t.n}
              </span>
              <span className="min-w-0 flex-1 text-start">
                <b className="block text-base">
                  {t.emoji} {t.label}
                </b>
                <span className="block text-xs text-jw-muted">{locked ? "تنفتح بعد ما تكمل المرتبة اللي قبلها." : t.hint}</span>
              </span>
              {!locked && <Icon name="chevronDown" size={16} className={isOpen ? "rotate-180" : ""} />}
            </button>
            {/* a folded tier stays mounted (hidden), so an upload in progress or a half-written answer is not lost by folding it */}
            {!locked && (
              <div id={`st-tier-${t.id}`} className="st-tier-body" hidden={!isOpen}>
                {body(t.id)}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
