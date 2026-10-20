"use client";

import { useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import Icon from "../Icon";
import Sheet from "../Sheet";

export type GoalExample = (typeof t.goalGuide.examples)[number];

/** The example milestone written for an obstacle, when the obstacle came from one of the guide's examples. */
export function exampleStepFor(obstacle: string) {
  for (const ex of t.goalGuide.examples) for (const o of ex.obstacles) if (o.obstacle === obstacle.trim()) return o;
  return null;
}

/**
 * «كيف أكتب هدفي؟»: the steps that research found work (WOOP, implementation intentions, goal-setting theory,
 * self-concordance, OKR/Hoshin, 4DX), examples to start from, and the ready template.
 */
export default function GoalGuide({
  open,
  onClose,
  onUseExample,
  onUseTemplate,
}: {
  open: boolean;
  onClose: () => void;
  onUseExample?: (ex: GoalExample) => void;
  onUseTemplate?: () => void;
}) {
  const g = t.goalGuide;
  const [example, setExample] = useState(0);
  const ex = g.examples[example];
  return (
    <Sheet open={open} onClose={onClose} title={g.title} wide>
      <div className="space-y-6">
        <p className="leading-relaxed">{g.intro}</p>

        <ol className="space-y-3">
          {g.steps.map((s, i) => (
            <li key={s.title} className="m-card flex gap-3 p-3">
              <span className="m-num grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold" style={{ background: "var(--m-surface-2)" }}>
                {i + 1}
              </span>
              <div className="min-w-0 space-y-1">
                <p className="font-semibold">{s.title}</p>
                <p className="m-muted text-sm leading-relaxed">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="space-y-3">
          <h3 className="font-semibold">{g.templateTitle}</h3>
          <p className="m-card p-3 leading-relaxed">{g.template}</p>
          <p className="m-card p-3 text-sm leading-relaxed">{g.milestoneTemplate}</p>
          {onUseTemplate && (
            <button
              type="button"
              className="m-btn m-btn-ghost"
              onClick={() => {
                onUseTemplate();
                onClose();
              }}
            >
              <Icon name="edit" size={18} /> {t.goal.useTemplate}
            </button>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">{g.examplesTitle}</h3>
          <div className="flex flex-wrap gap-2" role="group" aria-label={g.examplesTitle}>
            {g.examples.map((e, i) => (
              <button key={e.name} type="button" className="m-chip min-h-10 px-3" aria-pressed={i === example} onClick={() => setExample(i)}>
                {e.name}
              </button>
            ))}
          </div>
          <div className="m-card space-y-3 p-4" aria-live="polite">
            <p className="text-lg font-semibold leading-relaxed">«{ex.statement}»</p>
            <p className="text-sm">
              <span className="m-eyebrow">{t.goal.purpose}: </span>
              {ex.why}
            </p>
            <p className="text-sm">
              <span className="m-eyebrow">{t.goal.success}: </span>
              {ex.vision}
            </p>
            <ul className="space-y-2">
              {ex.obstacles.map((o) => (
                <li key={o.obstacle} className="rounded-xl p-3 text-sm" style={{ background: "var(--m-surface-2)" }}>
                  <p>
                    <span className="m-muted">{t.milestone.obstacle}: </span>
                    {o.obstacle}
                  </p>
                  <p className="font-semibold">↳ {o.milestone}</p>
                  <p className="m-muted">{o.plan}</p>
                </li>
              ))}
            </ul>
            {onUseExample && (
              <button
                type="button"
                className="m-btn m-btn-primary w-full"
                onClick={() => {
                  onUseExample(ex);
                  onClose();
                }}
              >
                {g.useExample}
              </button>
            )}
          </div>
        </section>

        <details className="text-sm">
          <summary className="m-muted cursor-pointer">{g.sourcesTitle}</summary>
          <ul className="m-muted mt-2 list-disc space-y-1 ps-5" dir="auto">
            {g.sources.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </details>
      </div>
    </Sheet>
  );
}
