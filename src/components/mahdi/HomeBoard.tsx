"use client";

// «لأجل المهدي» — the home screen of the redesign: a bento of cards («الويدجت») the person arranges. The standard
// one answers at a glance how far today's habits are, how far today's reading goal is, and what is left to tap (each
// habit a big button: one tap and it is done). Everything else — the priorities, the tasks, the week, the book, the
// health, the stories, the full list by project — can be added, removed and moved («رتّب رئيسيتك»).

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { dayGoals, daySeries, dayScore, dayStreak, startOfWeek, versionAt, weekScore, goalProgress, type Instance } from "@/lib/mahdi/engine";
import { fmtDateLong, fmtHijri, fmtNum, fmtPct, t } from "@/lib/mahdi/i18n";
import { bySort, CHALLENGE_GROUP, pickPhrase } from "@/lib/mahdi/client/derive";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { CONSISTENCY_THRESHOLD } from "@config/mahdi";
import { WIDGETS, homeWidgets, moveWidget, widgetDef, type WidgetId } from "@/lib/mahdi/home-widgets";
import type { Habit, Profile, Project } from "@/lib/mahdi/types";
import BookletCard from "./BookletCard";
import DayBars from "./DayBars";
import DayPriorities from "./DayPriorities";
import DayTasks from "./DayTasks";
import HabitRow from "./HabitRow";
import HealthCard from "./health/HealthCard";
import Icon from "./Icon";
import LogSheet from "./LogSheet";
import ProgressRing from "./ProgressRing";
import ProjectForm from "./ProjectForm";
import { useMahdi } from "./Provider";
import ReadingCard from "./ReadingCard";
import Sheet from "./Sheet";
import { StoriesBar } from "./social/Stories";
import { useReading } from "./useReading";

const LOCAL = "mahdi:home-widgets";

function readLocal(): unknown {
  try {
    const v = localStorage.getItem(LOCAL);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export default function HomeBoard() {
  const { state, store, toast } = useMahdi();
  const { profile } = state.snap;
  // the person's arrangement: on the account (migration 0062), else this device, else the standard home
  const [list, setList] = useState<WidgetId[]>(() => homeWidgets(profile.homeWidgets));
  // before migration 0062 the account keeps no layout: this device's copy is read once the page is on the screen
  // (never during the first render, which must match the server's)
  const [local, setLocal] = useState(false);
  useEffect(() => {
    if (local || profile.homeWidgets) return;
    const saved = readLocal();
    const t = setTimeout(() => {
      setLocal(true);
      if (saved) setList(homeWidgets(saved));
    }, 0);
    return () => clearTimeout(t);
  }, [local, profile.homeWidgets]);
  const [arranging, setArranging] = useState(false);
  const [newProject, setNewProject] = useState(false);
  const hasProjects = state.snap.projects.some((p) => !p.archivedAt);

  const save = async (next: WidgetId[]) => {
    setList(next);
    try {
      localStorage.setItem(LOCAL, JSON.stringify(next));
    } catch {}
    try {
      const { profile: p } = await mahdiFetch<{ profile: Profile }>("/api/mahdi/profile", { method: "PATCH", json: { homeWidgets: next } });
      // before the migration the account keeps no layout: this device's copy stays the one used
      store.setProfile({ ...p, homeWidgets: p.homeWidgets ?? next });
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="m-num text-sm m-muted">
            {fmtDateLong(state.today)}
            {profile.showHijri && <> · {fmtHijri(state.today, profile.hijriOffset)}</>}
          </p>
          <h1 className="m-display m-shadow-text text-2xl sm:text-3xl">أهلًا {profile.displayName.split(" ")[0]} 👋</h1>
          <p className="m-shadow-text text-sm font-semibold m-gold">{t.greeting}</p>
        </div>
        <button type="button" className="m-btn m-btn-ghost m-btn-sm shrink-0" onClick={() => setArranging(true)}>
          <Icon name="grip" size={18} /> رتّب
        </button>
      </header>

      {!hasProjects ? (
        <section className="m-card space-y-3 p-6 text-center">
          <p className="text-4xl" aria-hidden="true">🌱</p>
          <p className="m-muted">{t.home.emptyProjectsHint}</p>
          <button type="button" className="m-btn m-btn-primary" onClick={() => setNewProject(true)}>
            <Icon name="plus" /> {t.home.emptyProjects}
          </button>
        </section>
      ) : null}

      <div className="m-board">
        {list.map((id) => (
          <Widget key={id} id={id} />
        ))}
      </div>
      {list.length === 0 && (
        <button type="button" className="m-card w-full p-6 text-center m-muted" onClick={() => setArranging(true)}>
          رئيسيتك فاضية. اضغط هنا وأضف اللي تبيه.
        </button>
      )}

      <Sheet open={arranging} onClose={() => setArranging(false)} title="رتّب رئيسيتك">
        <Arrange list={list} onChange={save} />
      </Sheet>
      <ProjectForm open={newProject} onClose={() => setNewProject(false)} />
    </div>
  );
}

/** One card, in its place on the board. */
function Widget({ id }: { id: WidgetId }) {
  const size = widgetDef(id).size;
  const cls = size === "half" ? "" : id === "quick" || id === "projects" ? "m-w-full m-w-wide" : "m-w-full";
  const body = (() => {
    switch (id) {
      case "habits":
        return <HabitsGoal />;
      case "reading":
        return <ReadingGoal />;
      case "quick":
        return <QuickHabits />;
      case "priorities":
        return <DayPriorities />;
      case "tasks":
        return <DayTasks />;
      case "week":
        return <Week />;
      case "book":
        return <ReadingCard />;
      case "phrase":
        return <Phrase />;
      case "projects":
        return <ByProject />;
      case "health":
        return <HealthCard />;
      case "booklet":
        return <BookletCard />;
      case "stories":
        return <StoriesBar />;
    }
  })();
  if (!body) return null;
  return <div className={`${cls} min-w-0`}>{body}</div>;
}

// ───────────────────────────── the two goals ─────────────────────────────

function useToday() {
  const { state, timeline } = useMahdi();
  const today = state.today;
  const day = dayGoals(timeline, today);
  const score = dayScore(timeline, today);
  const done = day.filter((i) => i.progress >= 1).length;
  const streak = dayStreak(timeline, CONSISTENCY_THRESHOLD);
  return { today, day, score, done, streak, timeline };
}

function HabitsGoal() {
  const { score, done, streak } = useToday();
  const v = score.score ?? 0;
  return (
    <section className="m-card m-widget m-goal h-full" aria-label="هدف العادات اليومي">
      <p className="m-widget-title">
        <Icon name="target" size={18} className="m-gold" /> عادات اليوم
      </p>
      <ProgressRing value={v} size={96} stroke={10} label={`عادات اليوم: ${fmtPct(score.score)}`}>
        <span className="m-goal-big m-num">{fmtPct(score.score)}</span>
      </ProgressRing>
      <p className="m-num text-sm font-semibold">{score.required ? `${done} من ${score.required}` : t.home.noGoalsToday}</p>
      {streak.current > 0 && (
        <span className="m-flame m-num" title={t.home.streak}>
          🔥 {streak.current}
        </span>
      )}
    </section>
  );
}

function ReadingGoal() {
  const { reading, summary } = useReading();
  const goal = goalProgress(reading.goals.daily, summary.today);
  const unit = (m: string, n: number) => (m === "minutes" ? `${fmtNum(n)} د` : m === "narrations" ? `${fmtNum(n)} رواية` : `${fmtNum(n)} ص`);
  return (
    <Link href={goal ? "/mahdi/reading" : "/mahdi/reading/goals"} className="m-card m-widget m-goal h-full" aria-label="هدف القراءة اليومي">
      <p className="m-widget-title">
        <Icon name="book" size={18} className="m-gold" /> القراءة اليوم
      </p>
      <ProgressRing value={goal?.share ?? 0} size={96} stroke={10} label={`القراءة اليوم: ${goal ? fmtPct(goal.share) : "بدون هدف"}`}>
        <span className="m-goal-big m-num">{goal ? fmtPct(goal.share) : "—"}</span>
      </ProgressRing>
      <p className="m-num text-sm font-semibold">{goal ? `${unit(goal.metric, goal.done)} من ${unit(goal.metric, goal.target)}` : "حدّد هدفك اليومي"}</p>
      {summary.streak > 0 && <span className="m-flame m-num">📖 {summary.streak}</span>}
    </Link>
  );
}

// ───────────────────────────── «اضغط وأنجز» ─────────────────────────────

function QuickHabits() {
  const { state, allHabits } = useMahdi();
  const { day, today } = useToday();
  const projects = useMemo(() => state.snap.projects.filter((p) => !p.archivedAt).sort(bySort), [state.snap.projects]);
  const byId = useMemo(() => new Map(allHabits.map((h) => [h.id, h])), [allHabits]);
  const items = day
    .map((i) => ({ i, h: byId.get(i.itemId) }))
    .filter((x): x is { i: Instance; h: Habit } => Boolean(x.h))
    .sort((a, b) => Number(a.i.progress >= 1) - Number(b.i.progress >= 1) || a.h.sortOrder - b.h.sortOrder);
  const left = items.filter((x) => x.i.progress < 1).length;
  return (
    <section className="m-card m-widget space-y-3" aria-label="اضغط وأنجز">
      <div className="flex items-center justify-between gap-2">
        <p className="m-widget-title">
          <Icon name="check" size={18} className="m-gold" /> اضغط وأنجز
        </p>
        <span className="m-chip m-num">{items.length ? (left ? `باقي ${left}` : "كملت كلها 🎉") : "ما فيه عادات اليوم"}</span>
      </div>
      {items.length > 0 ? (
        <div className="m-quick">
          {items.map(({ i, h }) => (
            <QuickButton key={i.key} habit={h} inst={i} date={today} project={projects.find((p) => p.id === h.projectId)} />
          ))}
        </div>
      ) : (
        <Link href="/mahdi/projects" className="m-btn m-btn-ghost w-full">
          <Icon name="plus" /> {t.home.emptyHabits}
        </Link>
      )}
    </section>
  );
}

/** One habit as a big button: a check is done or undone in one tap, a count goes +1, an amount opens the number pad. */
function QuickButton({ habit, inst, date, project }: { habit: Habit; inst: Instance; date: string; project?: Project }) {
  const { store, state, toast } = useMahdi();
  const [open, setOpen] = useState(false);
  const v = versionAt({ ...habit, logs: {} }, date);
  if (!v) return null;
  const dayValue = state.logs[habit.id]?.[date] ?? 0;
  const done = inst.progress >= 1 || (v.measure === "check" && dayValue >= 1);
  const commit = (value: number) => {
    const prev = store.setLog(habit.id, date, value);
    try {
      navigator.vibrate?.(done ? 6 : [10, 30, 10]);
    } catch {}
    toast(t.habit.logged(habit.name), { label: t.habit.undo, run: () => store.setLog(habit.id, date, prev) }, habit.id);
  };
  const tap = () => {
    if (v.measure === "check") commit(dayValue >= 1 ? 0 : 1);
    else if (v.measure === "count") commit(dayValue + 1);
    else setOpen(true);
  };
  return (
    <>
      <button
        type="button"
        className={`m-quick-btn p-${project?.color ?? "gold"}`}
        data-done={done}
        aria-pressed={v.measure === "check" ? done : undefined}
        aria-label={v.measure === "check" ? (done ? t.habit.markUndone(habit.name) : t.habit.markDone(habit.name)) : `${habit.name}: ${fmtNum(inst.value)} / ${fmtNum(inst.target)}`}
        onClick={tap}
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      >
        <span className="m-quick-ic" aria-hidden="true">{done ? "✓" : habit.icon || "•"}</span>
        <span className="line-clamp-2">{habit.name}</span>
        {v.measure !== "check" && <span className="m-num text-xs opacity-80">{fmtNum(inst.value)} / {fmtNum(inst.target)}</span>}
        {!done && inst.progress > 0 && <span className="m-quick-fill" style={{ transform: `scaleX(${inst.progress})` }} aria-hidden="true" />}
      </button>
      <LogSheet open={open} onClose={() => setOpen(false)} habit={habit} version={v} inst={inst} date={date} commit={commit} dayValue={dayValue} />
    </>
  );
}

// ───────────────────────────── the other cards ─────────────────────────────

function Week() {
  const { state, timeline } = useMahdi();
  const { streak } = useToday();
  const week = weekScore(timeline, startOfWeek(state.today, state.snap.profile.weekStart));
  return (
    <section className="m-card m-widget space-y-3">
      <div className="flex items-center justify-between">
        <p className="m-widget-title">
          <Icon name="calendar" size={18} className="m-gold" /> {t.home.weekSoFar}
        </p>
        <span className="m-num text-xl font-semibold m-gold">{fmtPct(week.score)}</span>
      </div>
      <DayBars points={daySeries(timeline, state.today, 7)} today={state.today} />
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5">
          <Icon name="streak" size={18} className="m-gold" /> {t.home.streak}: {t.units.days(streak.current)}
        </span>
        <Link href="/mahdi/progress" className="m-gold font-semibold">
          {t.home.seeProgress}
        </Link>
      </div>
    </section>
  );
}

function Phrase() {
  const { state, items } = useMahdi();
  const { score, done } = useToday();
  void items;
  const all = score.required > 0 && done === score.required;
  const phrase = pickPhrase(state.snap.phrases, all ? "day_complete" : "home", state.today + state.snap.profile.userId);
  if (!phrase) return null;
  return (
    <section className="m-card m-widget flex items-start gap-3">
      <Icon name="quote" size={22} className="m-gold shrink-0" />
      <p className="font-semibold leading-relaxed">{phrase.text}</p>
    </section>
  );
}

/** The full list of today's habits, by project (the older home's list). */
function ByProject() {
  const { state, allHabits } = useMahdi();
  const { day, today } = useToday();
  const projects = useMemo(() => state.snap.projects.filter((p) => !p.archivedAt).sort(bySort), [state.snap.projects]);
  const byId = useMemo(() => new Map(allHabits.map((h) => [h.id, h])), [allHabits]);
  const challenge: Project = { id: CHALLENGE_GROUP, name: t.challenges.title, icon: "🕌", color: "gold", sortOrder: 9999, archivedAt: null };
  const groups = [...projects, challenge].map((p) => ({ p, d: day.filter((i) => i.projectId === p.id) })).filter((g) => g.d.length);
  if (!groups.length) return null;
  return (
    <div className="space-y-4">
      {groups.map(({ p, d }) => (
        <section key={p.id} className={`m-card p-${p.color} px-4 py-3`} aria-labelledby={`hp-${p.id}`}>
          <h2 id={`hp-${p.id}`} className="flex items-center gap-2 font-semibold">
            <span className="m-dot" style={{ background: "var(--pc)" }} />
            <Link href={p.id === CHALLENGE_GROUP ? "/mahdi/challenges" : `/mahdi/projects/${p.id}`}>
              {p.icon && <span aria-hidden="true">{p.icon} </span>}
              {p.name}
            </Link>
          </h2>
          <ul className="divide-y" style={{ borderColor: "var(--m-line)" }}>
            {d.map((i) => {
              const h = byId.get(i.itemId);
              return h ? <HabitRow key={i.key} habit={h} inst={i} date={today} project={p} /> : null;
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ───────────────────────────── arranging ─────────────────────────────

/** «رتّب رئيسيتك»: each card on or off, and up or down; «الافتراضي» brings the standard home back. */
function Arrange({ list, onChange }: { list: WidgetId[]; onChange: (l: WidgetId[]) => void }) {
  const off = WIDGETS.filter((w) => !list.includes(w.id));
  return (
    <div className="space-y-4">
      <p className="text-sm m-muted">شغّل اللي تبيه وطفّ الباقي، ورتّبها بالأسهم. يتحفظ على حسابك.</p>
      <ul className="space-y-2">
        {list.map((id, k) => {
          const w = widgetDef(id);
          return (
            <li key={id} className="m-arrange-row">
              <button type="button" role="switch" aria-checked="true" className="m-switch" onClick={() => onChange(list.filter((x) => x !== id))} aria-label={`أخفِ ${w.name}`} />
              <span className="min-w-0 flex-1">
                <b className="block truncate">{w.name}</b>
                <span className="block truncate text-xs m-muted">{w.hint}</span>
              </span>
              <button type="button" className="m-icon-btn" disabled={k === 0} onClick={() => onChange(moveWidget(list, id, -1))} aria-label={`${w.name} لفوق`}>
                <Icon name="arrowUp" size={18} />
              </button>
              <button type="button" className="m-icon-btn" disabled={k === list.length - 1} onClick={() => onChange(moveWidget(list, id, 1))} aria-label={`${w.name} لتحت`}>
                <Icon name="arrowDown" size={18} />
              </button>
            </li>
          );
        })}
      </ul>
      {off.length > 0 && (
        <>
          <p className="m-eyebrow">أضف للرئيسية</p>
          <ul className="space-y-2">
            {off.map((w) => (
              <li key={w.id} className="m-arrange-row opacity-80">
                <button type="button" role="switch" aria-checked="false" className="m-switch" onClick={() => onChange([...list, w.id])} aria-label={`أضف ${w.name}`} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate">{w.name}</b>
                  <span className="block truncate text-xs m-muted">{w.hint}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <button type="button" className="m-btn m-btn-quiet w-full" onClick={() => onChange(homeWidgets(null))}>
        <Icon name="undo" size={18} /> رجّع الرئيسية الافتراضية
      </button>
    </div>
  );
}
