"use client";

import { useState } from "react";
import { buildTimeline, diffDays, leadLagAdvice, planHistory, planProgress, startOfWeek, summarize, weekGoals, type PlanProgress } from "@/lib/mahdi/engine";
import { fmtDate, fmtMonth, fmtNum, t } from "@/lib/mahdi/i18n";
import { bySort, parseNumberInput } from "@/lib/mahdi/client/derive";
import type { Habit, Milestone, Project } from "@/lib/mahdi/types";
import ConfirmSheet from "../ConfirmSheet";
import Icon from "../Icon";
import { useMahdi } from "../Provider";
import MilestoneForm from "./MilestoneForm";

const REVIEW_EVERY_DAYS = 14;

/**
 * A strategic goal's page: the goal itself (not counted), its milestones counted period by period (the lag measures),
 * the habits under each one or for the whole goal (the lead measures), the obstacles still waiting to become
 * milestones, and the periodic review.
 */
export default function GoalPlanView({
  project,
  habits,
  renderHabit,
  onAddHabit,
}: {
  project: Project;
  habits: Habit[];
  renderHabit: (h: Habit) => React.ReactNode;
  onAddHabit: (milestoneId: string | null) => void;
}) {
  const { state, store, toast } = useMahdi();
  const { snap, today } = state;
  const goal = project.goal;
  const archived = Boolean(project.archivedAt);
  const milestones = (snap.milestones ?? []).filter((m) => m.projectId === project.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const [form, setForm] = useState<{ milestone?: Milestone; obstacle?: string } | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  if (!goal) return null;

  const general = goal.habitScope === "general";
  const used = new Set(milestones.map((m) => m.obstacle.trim()));
  const openObstacles = goal.obstacles.filter((o) => !used.has(o.text.trim()));
  const known = new Set(milestones.map((m) => m.id));
  const looseHabits = habits.filter((h) => general || !h.milestoneId || !known.has(h.milestoneId));
  const reviewAge = goal.reviewedAt ? diffDays(today, goal.reviewedAt) : null;
  const reviewDue = reviewAge === null || reviewAge >= REVIEW_EVERY_DAYS;

  /** This week's score of some habits (the lead measure), or null when they have nothing due. */
  const leadScore = (list: Habit[]) => {
    if (!list.length) return null;
    const ids = new Set(list.map((h) => h.id));
    const ctx = { asOf: today, weekStart: snap.profile.weekStart };
    const tl = buildTimeline(
      list.filter((h) => ids.has(h.id)).map((h) => ({ id: h.id, projectId: h.projectId, versions: h.versions, logs: state.logs[h.id] ?? {} })),
      snap.logsFrom,
      today,
      ctx,
    );
    return summarize(weekGoals(tl, startOfWeek(today, snap.profile.weekStart))).score;
  };

  async function markReviewed() {
    try {
      await store.mutate(`/api/mahdi/projects/${project.id}`, "PATCH", { goal: { ...goal, reviewedAt: today } });
      toast(t.common.saved);
      setReviewOpen(false);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <section className="m-card space-y-3 p-5">
        <p className="m-eyebrow flex items-center gap-1">
          <Icon name="target" size={16} /> {t.goal.badge}
        </p>
        <p className="m-display text-2xl leading-snug">{goal.statement}</p>
        {goal.why && (
          <p className="text-sm leading-relaxed">
            <span className="m-eyebrow">{t.goal.purpose}: </span>
            {goal.why}
          </p>
        )}
        {goal.vision && (
          <p className="text-sm leading-relaxed">
            <span className="m-eyebrow">{t.goal.success}: </span>
            {goal.vision}
          </p>
        )}
        <p className="m-muted text-sm">{goal.horizon ? t.goal.until(fmtMonth(goal.horizon)) : t.goal.openHorizon}</p>
      </section>

      <section className="space-y-3" aria-labelledby={`ms-${project.id}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 id={`ms-${project.id}`} className="font-semibold">{t.goal.milestones}</h2>
            <p className="m-hint">{t.goal.milestonesHint}</p>
          </div>
          {!archived && (
            <button type="button" className="m-btn m-btn-ghost m-btn-sm shrink-0" onClick={() => setForm({})}>
              <Icon name="plus" size={18} /> {t.goal.addMilestone}
            </button>
          )}
        </div>

        {milestones.length === 0 && <p className="m-card m-muted p-4 text-sm">{t.goal.noMilestones}</p>}
        {milestones.map((m) => {
          const own = general ? [] : habits.filter((h) => h.milestoneId === m.id);
          return (
            <MilestoneCard
              key={m.id}
              milestone={m}
              logs={snap.milestoneLogs?.[m.id]}
              lead={leadScore(general ? habits : own)}
              habits={general ? null : own}
              renderHabit={renderHabit}
              onAddHabit={archived ? null : () => onAddHabit(m.id)}
              onEdit={archived ? null : () => setForm({ milestone: m })}
            />
          );
        })}

        {openObstacles.length > 0 && !archived && (
          <div className="m-card space-y-2 p-4">
            <p className="m-eyebrow">{t.goal.openObstacles}</p>
            <ul className="space-y-2">
              {openObstacles.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 text-sm">{o.text}</span>
                  <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => setForm({ obstacle: o.text })}>
                    <Icon name="flag" size={16} /> {t.goal.toMilestone}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {(general || looseHabits.length > 0) && (
        <section className="m-card px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t.goal.generalHabits}</h2>
            {!archived && (
              <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => onAddHabit(null)}>
                <Icon name="plus" size={18} /> {t.project.addHabit}
              </button>
            )}
          </div>
          {looseHabits.length === 0 ? <p className="m-hint py-2">{t.goal.noHabits}</p> : <ul className="divide-y" style={{ borderColor: "var(--m-line)" }}>{[...looseHabits].sort(bySort).map(renderHabit)}</ul>}
        </section>
      )}

      <section className="m-card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">{t.goal.review}</h2>
            <p className="m-hint">{goal.reviewedAt ? t.goal.lastReview(fmtDate(goal.reviewedAt)) : t.goal.neverReviewed}</p>
          </div>
          {reviewDue && <span className="m-chip m-chip-gold text-sm">{t.goal.reviewDue}</span>}
        </div>
        <p className="m-muted text-sm leading-relaxed">{t.goal.reviewHint}</p>
        <button type="button" className="m-btn m-btn-quiet -ms-3" aria-expanded={reviewOpen} onClick={() => setReviewOpen((v) => !v)}>
          <Icon name={reviewOpen ? "chevronUp" : "chevronDown"} size={18} /> {t.goal.reviewStart}
        </button>
        {reviewOpen && (
          <div className="space-y-3">
            <ol className="list-decimal space-y-1 ps-5 text-sm">
              {t.goal.reviewQuestions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
            <button type="button" className="m-btn m-btn-primary" onClick={markReviewed} disabled={archived}>
              <Icon name="check" size={18} /> {t.goal.reviewed}
            </button>
          </div>
        )}
      </section>

      <MilestoneForm open={Boolean(form)} onClose={() => setForm(null)} projectId={project.id} milestone={form?.milestone} obstacle={form?.obstacle} />
    </div>
  );
}

const PACE_TONE: Record<PlanProgress["pace"], string> = {
  ahead: "var(--m-success)",
  on: "var(--pc, var(--m-gold))",
  behind: "var(--m-warning)",
  notStarted: "var(--m-muted)",
};

/** One milestone: this period's number against its target, the pace, quick logging, past periods, and its habits. */
function MilestoneCard({
  milestone: m,
  logs,
  lead,
  habits,
  renderHabit,
  onAddHabit,
  onEdit,
}: {
  milestone: Milestone;
  logs: Record<string, number> | undefined;
  lead: number | null;
  habits: Habit[] | null;
  renderHabit: (h: Habit) => React.ReactNode;
  onAddHabit: (() => void) | null;
  onEdit: (() => void) | null;
}) {
  const { state, store, toast } = useMahdi();
  const { today } = state;
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const p = planProgress(m, logs, today);
  const history = planHistory(m, logs, today, 6);
  const advice = m.doneAt ? null : leadLagAdvice(lead, p);
  const todayValue = logs?.[today] ?? 0;
  const done = Boolean(m.doneAt);

  async function log(delta: number) {
    if (busy || !Number.isFinite(delta) || delta === 0) return;
    setBusy(true);
    try {
      await store.mutate(`/api/mahdi/milestones/${m.id}/log`, "POST", { date: today, value: Math.max(0, todayValue + delta) });
      setAmount("");
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  async function setDone(value: boolean) {
    try {
      await store.mutate(`/api/mahdi/milestones/${m.id}`, "PATCH", { done: value });
      toast(t.common.saved);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <article className={`m-card space-y-3 p-4 ${done ? "opacity-80" : ""}`}>
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{m.title}</h3>
          <p className="m-muted text-sm">{t.milestone.perPeriod(fmtNum(m.target), m.unit, t.milestone.periods[m.period])}</p>
        </div>
        {onEdit && (
          <button type="button" className="m-icon-btn" onClick={onEdit} aria-label={`${t.milestone.editTitle}: ${m.title}`}>
            <Icon name="edit" size={18} />
          </button>
        )}
      </header>

      {(m.obstacle || m.plan) && (
        <div className="space-y-1 rounded-xl p-3 text-sm" style={{ background: "var(--m-surface-2)" }}>
          {m.obstacle && (
            <p>
              <span className="m-muted">{t.milestone.obstacle}: </span>
              {m.obstacle}
            </p>
          )}
          {m.plan && <p className="font-semibold">{m.plan}</p>}
        </div>
      )}

      {done ? (
        <p className="m-note text-sm">{t.milestone.doneNote}</p>
      ) : (
        <>
          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="m-num font-semibold">{t.milestone.of(fmtNum(p.done), fmtNum(p.target))}</span>
              <span style={{ color: PACE_TONE[p.pace] }}>
                {t.milestone.pace[p.pace]} · {t.milestone.daysLeft(p.daysLeft)}
              </span>
            </div>
            <div className="m-bar relative" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.ratio * 100)} aria-label={m.title}>
              <span style={{ width: `${Math.round(p.ratio * 100)}%` }} />
              {p.pace !== "notStarted" && <i className="absolute inset-y-0 w-0.5" style={{ insetInlineStart: `${Math.round(p.elapsed * 100)}%`, background: "var(--m-ink)", opacity: 0.35 }} aria-hidden="true" />}
            </div>
            <p className="m-hint">
              {fmtDate(p.from)} – {fmtDate(p.to)}
            </p>
          </div>

          {onEdit && p.pace !== "notStarted" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="m-label m-0 text-sm">{t.milestone.logToday}</span>
              {todayValue > 0 && (
                <button type="button" className="m-icon-btn m-btn-ghost" disabled={busy} onClick={() => log(-1)} aria-label={`${t.habit.minusOne}: ${m.title}`}>
                  <Icon name="minus" size={18} />
                </button>
              )}
              <span className="m-num min-w-8 text-center font-semibold">{fmtNum(todayValue)}</span>
              <button type="button" className="m-icon-btn m-btn-ghost" disabled={busy} onClick={() => log(1)} aria-label={`${t.habit.plusOne}: ${m.title}`}>
                <Icon name="plus" size={18} />
              </button>
              <input
                className="m-field m-num text-center"
                style={{ width: "5.5rem" }}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="+5"
                aria-label={`${t.milestone.log}: ${m.title}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") log(parseNumberInput(amount));
                }}
              />
              {amount && (
                <button type="button" className="m-btn m-btn-ghost m-btn-sm" disabled={busy} onClick={() => log(parseNumberInput(amount))}>
                  {t.milestone.log}
                </button>
              )}
            </div>
          )}

          {advice && (
            <p className="text-sm" style={{ color: advice === "onTrack" ? "var(--m-success)" : "var(--m-warning)" }}>
              <span className="m-eyebrow">{t.goal.leadLag}: </span>
              {t.goal.advice[advice]}
            </p>
          )}
        </>
      )}

      {history.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="m-hint">{t.milestone.history}:</span>
          {history.map((h) => (
            <span
              key={h.index}
              className="size-4 rounded-full border-2"
              style={{ borderColor: "var(--pc, var(--m-gold))", background: h.hit ? "var(--pc, var(--m-gold))" : "transparent" }}
              title={`${fmtDate(h.from)} – ${fmtDate(h.to)}: ${fmtNum(h.done)} · ${h.hit ? t.milestone.hit : t.milestone.missed}`}
              aria-label={`${fmtDate(h.from)}: ${h.hit ? t.milestone.hit : t.milestone.missed}`}
            />
          ))}
        </div>
      )}

      {habits && (
        <div className="border-t pt-2" style={{ borderColor: "var(--m-line)" }}>
          <div className="flex items-center justify-between">
            <p className="m-eyebrow">{t.goal.habitsOf(m.title)}</p>
            {onAddHabit && (
              <button type="button" className="m-btn m-btn-quiet m-btn-sm shrink-0 whitespace-nowrap" onClick={onAddHabit}>
                <Icon name="plus" size={16} /> {t.project.addHabit}
              </button>
            )}
          </div>
          {habits.length === 0 ? <p className="m-hint py-1">{t.goal.noHabits}</p> : <ul className="divide-y" style={{ borderColor: "var(--m-line)" }}>{[...habits].sort(bySort).map(renderHabit)}</ul>}
        </div>
      )}

      {onEdit && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => setDone(!done)}>
            <Icon name={done ? "undo" : "check"} size={16} /> {done ? t.milestone.reopen : t.milestone.markDone}
          </button>
          <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => setDeleting(true)}>
            <Icon name="trash" size={16} /> {t.common.delete}
          </button>
        </div>
      )}

      <ConfirmSheet
        open={deleting}
        onClose={() => setDeleting(false)}
        title={t.milestone.deleteTitle(m.title)}
        body={t.milestone.deleteBody}
        onConfirm={async () => {
          await store.mutate(`/api/mahdi/milestones/${m.id}`, "DELETE");
        }}
      />
    </article>
  );
}
