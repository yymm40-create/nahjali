"use client";

import { useState } from "react";
import { GOAL_LIMITS, MAHDI_LIMITS, PROJECT_COLORS, type ProjectColor } from "@config/mahdi";
import { t } from "@/lib/mahdi/i18n";
import type { GoalObstacle, GoalPlan, Project } from "@/lib/mahdi/types";
import Icon from "../Icon";
import IconPicker from "../IconPicker";
import { useMahdi } from "../Provider";
import GoalGuide from "./GoalGuide";

const newId = () => Math.random().toString(36).slice(2, 10);

/**
 * A strategic goal («هدف استراتيجي»): its short name, the goal in one sentence, why, how success will look, by when,
 * the obstacles in the way (each becomes a counted milestone) and where the habits go. The guide button teaches how.
 */
export default function GoalForm({ project, onClose, onSaved }: { project?: Project; onClose: () => void; onSaved?: (id: string) => void }) {
  const { store, state, toast } = useMahdi();
  const g = project?.goal;
  const goals = state.snap.projects.filter((p) => p.kind === "goal" && !p.archivedAt && p.id !== project?.id).length;
  const [name, setName] = useState(project?.name ?? "");
  const [icon, setIcon] = useState(project?.icon ?? "🎯");
  const [color, setColor] = useState<ProjectColor>(project?.color ?? PROJECT_COLORS[state.snap.projects.length % PROJECT_COLORS.length]);
  const [statement, setStatement] = useState(g?.statement ?? "");
  const [why, setWhy] = useState(g?.why ?? "");
  const [vision, setVision] = useState(g?.vision ?? "");
  const [horizon, setHorizon] = useState(g?.horizon ?? "");
  const [obstacles, setObstacles] = useState<GoalObstacle[]>(g?.obstacles ?? []);
  const [draft, setDraft] = useState("");
  const [scope, setScope] = useState<GoalPlan["habitScope"]>(g?.habitScope ?? "milestone");
  const [guide, setGuide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const addObstacle = () => {
    const text = draft.trim();
    if (!text || obstacles.length >= GOAL_LIMITS.maxObstacles) return;
    setObstacles((list) => [...list, { id: newId(), text }]);
    setDraft("");
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !statement.trim()) return;
    setBusy(true);
    setError("");
    const pending = draft.trim() ? [...obstacles, { id: newId(), text: draft.trim() }] : obstacles;
    const goal: GoalPlan = { statement: statement.trim(), why, vision, horizon: horizon || null, obstacles: pending, habitScope: scope, reviewedAt: g?.reviewedAt ?? null };
    try {
      if (project) {
        await store.mutate(`/api/mahdi/projects/${project.id}`, "PATCH", { name: name.trim(), icon, color, goal });
        toast(t.common.saved);
        onSaved?.(project.id);
      } else {
        const res = await store.mutate<{ id: string }>("/api/mahdi/projects", "POST", { kind: "goal", name: name.trim(), icon, color, goal });
        onSaved?.(res.id);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <button type="button" className="m-btn m-btn-ghost w-full" onClick={() => setGuide(true)}>
        <Icon name="info" size={18} /> {t.goal.guideButton}
      </button>
      {!project && goals >= GOAL_LIMITS.advisedGoals && <p className="m-note text-sm">{t.goal.tooMany(goals)}</p>}

      <label className="block">
        <span className="m-label">{t.goal.statement}</span>
        <textarea className="m-field min-h-20" value={statement} onChange={(e) => setStatement(e.target.value)} maxLength={GOAL_LIMITS.statementMax} placeholder={t.goal.statementPlaceholder} required autoFocus={!project} />
      </label>

      <label className="block">
        <span className="m-label">{t.goal.shortName}</span>
        <input className="m-field" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAHDI_LIMITS.projectNameMax} placeholder={t.goal.shortNamePlaceholder} required />
      </label>

      <label className="block">
        <span className="m-label">
          {t.goal.why} <span className="m-muted font-normal">({t.common.optional})</span>
        </span>
        <textarea className="m-field min-h-16" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={GOAL_LIMITS.whyMax} placeholder={t.goal.whyPlaceholder} />
      </label>

      <label className="block">
        <span className="m-label">
          {t.goal.vision} <span className="m-muted font-normal">({t.common.optional})</span>
        </span>
        <textarea className="m-field min-h-16" value={vision} onChange={(e) => setVision(e.target.value)} maxLength={GOAL_LIMITS.visionMax} placeholder={t.goal.visionPlaceholder} />
      </label>

      <label className="block max-w-60">
        <span className="m-label">
          {t.goal.horizon} <span className="m-muted font-normal">({t.common.optional})</span>
        </span>
        <input type="date" className="m-field" value={horizon} onChange={(e) => setHorizon(e.target.value)} />
        <span className="m-hint mt-1 block">{t.goal.horizonHint}</span>
      </label>

      <fieldset className="space-y-2">
        <legend className="m-label">{t.goal.obstacles}</legend>
        <p className="m-hint">{t.goal.obstaclesHint}</p>
        {obstacles.length > 0 && (
          <ul className="space-y-2">
            {obstacles.map((o) => (
              <li key={o.id} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--m-surface-2)" }}>
                <span className="min-w-0 flex-1 text-sm">{o.text}</span>
                <button type="button" className="m-icon-btn" aria-label={`${t.goal.removeObstacle}: ${o.text}`} onClick={() => setObstacles((list) => list.filter((x) => x.id !== o.id))}>
                  <Icon name="close" size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {obstacles.length < GOAL_LIMITS.maxObstacles && (
          <div className="flex gap-2">
            <input
              className="m-field flex-1"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={GOAL_LIMITS.obstacleMax}
              placeholder={t.goal.obstaclePlaceholder}
              aria-label={t.goal.obstacles}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addObstacle();
                }
              }}
            />
            <button type="button" className="m-btn m-btn-ghost" onClick={addObstacle} disabled={!draft.trim()}>
              <Icon name="plus" size={18} /> {t.goal.addObstacle}
            </button>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className="m-label">{t.goal.habitScope}</legend>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t.goal.habitScope}>
          {(["milestone", "general"] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={scope === k} className="m-option p-3 text-start" onClick={() => setScope(k)}>
              <span className="block font-semibold">{t.goal.scopes[k].label}</span>
              <span className="m-hint block">{t.goal.scopes[k].hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <IconPicker value={icon} onChange={setIcon} label={t.project.icon} />
      <fieldset>
        <legend className="m-label">{t.project.color}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.project.color}>
          {PROJECT_COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={t.project.colors[c]} title={t.project.colors[c]} className={`m-option p-${c} grid size-11 place-items-center`} onClick={() => setColor(c)}>
              <span className="size-6 rounded-full" style={{ background: "var(--pc)" }} />
            </button>
          ))}
        </div>
      </fieldset>

      {error && <p className="m-error" role="alert">{error}</p>}
      <button className="m-btn m-btn-primary w-full" disabled={busy || !name.trim() || !statement.trim()}>
        {busy ? t.common.saving : project ? t.common.save : t.goal.create}
      </button>

      <GoalGuide
        open={guide}
        onClose={() => setGuide(false)}
        onUseTemplate={() => setStatement(t.goalGuide.template)}
        onUseExample={(ex) => {
          setName(ex.name);
          setStatement(ex.statement);
          setWhy(ex.why);
          setVision(ex.vision);
          setObstacles(ex.obstacles.map((o) => ({ id: newId(), text: o.obstacle })));
        }}
      />
    </form>
  );
}
