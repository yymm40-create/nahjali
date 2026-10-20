"use client";

import { useState } from "react";
import { GOAL_LIMITS, MAHDI_LIMITS, MILESTONE_PERIODS, UNIT_CHOICES, type MilestonePeriod } from "@config/mahdi";
import { fmtNum, t } from "@/lib/mahdi/i18n";
import { parseNumberInput } from "@/lib/mahdi/client/derive";
import type { Milestone } from "@/lib/mahdi/types";
import { useMahdi } from "../Provider";
import Sheet from "../Sheet";
import { exampleStepFor } from "./GoalGuide";

const MILESTONE_UNITS = ["مرة", "جلسة", ...UNIT_CHOICES];

/** Add or edit a milestone («هدف مرحلي»): a number, a unit and a period, the obstacle it removes and its if-then plan. */
export default function MilestoneForm({
  open,
  onClose,
  projectId,
  milestone,
  obstacle,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  milestone?: Milestone;
  /** turning this obstacle of the goal into a milestone */
  obstacle?: string;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={milestone ? t.milestone.editTitle : t.milestone.newTitle} wide>
      {open && <Form projectId={projectId} milestone={milestone} obstacle={obstacle} onClose={onClose} />}
    </Sheet>
  );
}

function Form({ projectId, milestone, obstacle, onClose }: { projectId: string; milestone?: Milestone; obstacle?: string; onClose: () => void }) {
  const { store, state, toast } = useMahdi();
  const example = obstacle ? exampleStepFor(obstacle) : null;
  const [title, setTitle] = useState(milestone?.title ?? example?.milestone ?? "");
  const [why, setWhy] = useState(milestone?.obstacle ?? obstacle ?? "");
  const [plan, setPlan] = useState(milestone?.plan ?? example?.plan ?? "");
  const [target, setTarget] = useState(milestone ? fmtNum(milestone.target) : "");
  const [unit, setUnit] = useState(milestone?.unit ?? "مرة");
  const [period, setPeriod] = useState<MilestonePeriod>(milestone?.period ?? "month");
  const [startsOn, setStartsOn] = useState(milestone?.startsOn ?? state.today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const n = parseNumberInput(target);
  const valid = title.trim().length > 0 && Number.isFinite(n) && n > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError("");
    const body = { title: title.trim(), obstacle: why, plan, target: n, unit: unit.trim(), period, startsOn };
    try {
      if (milestone) await store.mutate(`/api/mahdi/milestones/${milestone.id}`, "PATCH", body);
      else await store.mutate("/api/mahdi/milestones", "POST", { ...body, projectId });
      toast(t.common.saved);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="m-card p-3 text-sm leading-relaxed">{t.goalGuide.milestoneTemplate}</p>

      <label className="block">
        <span className="m-label">{t.milestone.obstacle}</span>
        <input className="m-field" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={GOAL_LIMITS.obstacleMax} placeholder={t.milestone.obstaclePlaceholder} />
      </label>

      <label className="block">
        <span className="m-label">{t.milestone.title}</span>
        <input className="m-field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={GOAL_LIMITS.milestoneTitleMax} placeholder={t.milestone.titlePlaceholder} required autoFocus={!milestone} />
      </label>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block w-28">
          <span className="m-label">{t.milestone.target}</span>
          <input className="m-field m-num text-lg" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="8" required />
        </label>
        <label className="block min-w-0 flex-1">
          <span className="m-label">{t.milestone.unit}</span>
          <input className="m-field" value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={MAHDI_LIMITS.unitMax} placeholder={t.milestone.unitPlaceholder} list="m-milestone-units" />
          <datalist id="m-milestone-units">
            {MILESTONE_UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </label>
      </div>

      <fieldset>
        <legend className="m-label">{t.milestone.period}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t.milestone.period}>
          {MILESTONE_PERIODS.map((p) => (
            <button key={p} type="button" role="radio" aria-checked={period === p} className="m-option min-h-12 px-3 font-semibold" onClick={() => setPeriod(p)}>
              {t.milestone.periods[p]}
            </button>
          ))}
        </div>
        {valid && <p className="m-hint mt-2">{t.milestone.perPeriod(fmtNum(n), unit.trim(), t.milestone.periods[period])}</p>}
      </fieldset>

      <label className="block">
        <span className="m-label">
          {t.milestone.plan} <span className="m-muted font-normal">({t.common.optional})</span>
        </span>
        <input className="m-field" value={plan} onChange={(e) => setPlan(e.target.value)} maxLength={GOAL_LIMITS.planMax} placeholder={t.milestone.planPlaceholder} />
        <span className="m-hint mt-1 block">{t.milestone.planHint}</span>
      </label>

      <label className="block max-w-60">
        <span className="m-label">{t.milestone.startsOn}</span>
        <input type="date" className="m-field" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required />
      </label>

      {error && <p className="m-error" role="alert">{error}</p>}
      <button className="m-btn m-btn-primary w-full" disabled={busy || !valid}>
        {busy ? t.common.saving : milestone ? t.common.save : t.milestone.create}
      </button>
    </form>
  );
}
