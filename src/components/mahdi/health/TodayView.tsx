"use client";

// «اليوم» in «الصحة العلوية»: the tracker. The day's workout from the plan — every set logged as weight × reps, with
// what was done last time, the suggestion for this time and a rest timer — cardio, the day's nutrition and a weigh-in.
// Linked to «لأجل المهدي»: finishing the workout ticks its habit, and the protein, water, fruit and vegetables,
// calories and steps are the very values of their habits (logged here or there, they are the same number).

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GUIDE, muscleInfo } from "@config/mahdi/exercise-guide";
import { REF } from "@config/mahdi/health-research";
import RobotFace from "@/components/RobotFace";
import { useMahdi } from "@/components/mahdi/Provider";
import { WEEKDAYS, arNum, dayLabel, exerciseById, focusName, type PlanDay, type PlanItem, type Workout } from "@/lib/mahdi/health/plan";
import { bestSet, e1rm, gymHabitWrites, lastTime, mealTotals, parseNum, record, sessionMin, suggestion, weekOf, type DayLog, type FoodKey, type MealItem, type SetLog } from "@/lib/mahdi/health/tracker";
import { Barbell, COACH, DayCard } from "./HealthApp";
import { useHealth } from "./HealthProvider";
import ExerciseFigure from "./ExerciseFigure";
import MealLog from "./MealLog";

const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
/**
 * A number field that keeps what is being typed («7.» on the way to «7.5», «٧٫٥», «7,5») and hands back the number.
 * The plain `Number(value)` field swallowed the decimal point, so 7.5 could not be written.
 */
function NumField({ value, onValue, className = "gym-input", decimal = true, ...rest }: { value: number | null | undefined; onValue: (n: number) => void; className?: string; decimal?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [text, setText] = useState(value ? String(value) : "");
  const [focused, setFocused] = useState(false);
  const shown = focused ? text : value ? String(value) : "";
  return (
    <input
      {...rest}
      className={className}
      inputMode={decimal ? "decimal" : "numeric"}
      value={shown}
      onFocus={() => (setFocused(true), setText(value ? String(value) : ""))}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const raw = decimal ? e.target.value : e.target.value.replace(/[.,٫،]/g, "");
        setText(raw);
        onValue(parseNum(raw));
      }}
    />
  );
}

/** the moment a button is pressed (outside render) */
const nowMs = () => Date.now();

/** «مدة التمرين»: the clock of the session, from «ابدأ» to «خلصت». */
function fmtMin(min: number) {
  const m = Math.floor(min);
  const sec = Math.floor((min - m) * 60);
  return m >= 60 ? `${arNum(Math.floor(m / 60))}:${String(m % 60).padStart(2, "0")} س` : `${m}:${String(sec).padStart(2, "0")}`;
}
function SessionClock({ log }: { log: DayLog }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!log.startedAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [log.startedAt]);
  return <b dir="ltr">{fmtMin(sessionMin(log, now))}</b>;
}

/** The day of the rotation the person trains next: the one after the last session (any day of the calendar). */
function nextDay(w: Workout, days: DayLog[], date: string): PlanDay | undefined {
  const prev = days.filter((d) => d.date < date && d.planDay !== undefined && (d.done || Object.keys(d.sets).length)).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!prev) return w.days[0];
  const i = w.days.findIndex((d) => d.weekday === prev.planDay);
  return w.days[(i + 1) % w.days.length] ?? w.days[0];
}

const shortDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("ar", { day: "numeric", month: "short", timeZone: "UTC" });

const FOOD: { key: FoodKey; link: string; icon: string; name: string; unit: string; adds: number[] }[] = [
  { key: "proteinG", link: "protein", icon: "🥩", name: "البروتين", unit: "غ", adds: [10, 25] },
  { key: "waterCups", link: "water", icon: "💧", name: "الماء", unit: "كوب", adds: [1] },
  { key: "produce", link: "produce", icon: "🥗", name: "خضار وفواكه", unit: "حصة", adds: [1] },
  { key: "kcal", link: "kcal", icon: "🔥", name: "السعرات", unit: "سعرة", adds: [100, 300] },
  { key: "steps", link: "steps", icon: "👟", name: "الخطوات", unit: "خطوة", adds: [1000] },
];

function Welcome() {
  const { profile } = useHealth();
  return (
    <div className="space-y-4">
      <section className="gym-hero space-y-3">
        <Barbell />
        <span className="gym-eyebrow">🏋️ الصحة العلوية</span>
        <h1 className="gym-title">
          جسمك <em>أمانة</em>،<br />خلّه قوي.
        </h1>
        <p className="gym-small max-w-md">جدول جيم (في النادي، أو جيم بيتي، أو بدون أدوات) ونظام تغذية مبني على توصيات المنظمات الطبية العالمية، للرجل والمرأة والحامل والمرضعة. تسجّل أوزانك وأكلك كل يوم، وتشوف تقدمك، وكل شي مربوط بعاداتك في «لأجل المهدي».</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/mahdi/health/setup" className="gym-btn">يلا نبدأ 💪</Link>
          <Link href="/mahdi/health/learn" className="gym-btn ghost">🧠 تعلّم عضلاتك</Link>
        </div>
      </section>
      <section className="gym-card flex items-start gap-3">
        <RobotFace id="sabaa" size={64} />
        <div className="space-y-1">
          <b className="text-lg font-black">هلا! أنا {COACH} 🦁</b>
          <p className="gym-small">
            مدربك هنا. أسوي لك الخطة، وأتابع أوزانك وأكلك، وأشرح لك كل تمرين وكل عضلة. أي شي ما فهمته أو {profile.sex === "female" ? "تبين تغيرينه" : "تبي تغيره"}، اضغط وجهي على الجنب وكلمني، وأنا أعدّل خطتك بنفسي.
          </p>
        </div>
      </section>
    </div>
  );
}

function RestTimer({ until, onDone }: { until: number; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  useEffect(() => {
    if (left === 0) {
      try {
        navigator.vibrate?.(300);
      } catch {
        /* no vibration */
      }
    }
  }, [left]);
  return (
    <div className="gym-rest" role="timer" aria-live="polite">
      ⏱️ راحة <b>{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</b>
      {left === 0 ? <span>يلا المجموعة الجاية! 💪</span> : null}
      <button type="button" className="gym-btn sm ghost" onClick={onDone}>
        {left === 0 ? "تم" : "تخطّى"}
      </button>
    </div>
  );
}

function ExerciseLog({ item, log, days, date, onSets, onRest }: { item: PlanItem; log: DayLog; days: DayLog[]; date: string; onSets: (s: SetLog[]) => void; onRest: (sec: number) => void }) {
  const ex = exerciseById(item.exId)!;
  const g = GUIDE[item.exId];
  const sets = log.sets[item.exId] ?? [];
  const last = lastTime(days, item.exId, date);
  const prevRecord = record(days.filter((d) => d.date < date), item.exId);
  const best = bestSet(sets);
  // a new record: better than every earlier session (not on the very first one)
  const pr = !!best && !!prevRecord && (e1rm(best) > e1rm(prevRecord) || (e1rm(best) === 0 && e1rm(prevRecord) === 0 && best.reps > prevRecord.reps));
  const rows = Math.max(item.sets, sets.length);
  const setAt = (i: number, patch: Partial<SetLog>) => {
    const next = Array.from({ length: Math.max(rows, i + 1) }, (_, k) => sets[k] ?? { kg: last?.sets[k]?.kg ?? sets[k - 1]?.kg ?? last?.sets[0]?.kg ?? 0, reps: 0 });
    next[i] = { ...next[i], ...patch };
    onSets(next.filter((s, k) => s.reps > 0 || s.kg > 0 || k < sets.length));
  };
  return (
    <article className="gym-day">
      <header>
        <div className="min-w-0">
          <Link href={`/mahdi/health/learn/${ex.id}`} className="font-black underline-offset-4 hover:underline">
            {ex.name}
          </Link>
          <small className="block text-xs text-[#9aa3ad]">
            {(g?.primary ?? []).map((m) => muscleInfo(m)?.name).join("، ")} · {item.sets} × {item.reps} · راحة {item.restSec % 60 === 0 ? `${item.restSec / 60} د` : `${item.restSec} ث`}
          </small>
        </div>
        {pr && <span className="tag">🏆 رقم قياسي</span>}
      </header>
      <details className="gym-ex-how">
        <summary>👀 شوف الطريقة</summary>
        <div className="px-3 pb-2">
          <ExerciseFigure id={ex.id} name={ex.name} compact />
        </div>
      </details>
      <div className="space-y-2 p-3">
        <p className="gym-small">
          {last ? (
            <>
              آخر مرة ({shortDate(last.date)}): <b className="text-white" dir="ltr">{last.sets.map((s) => (s.kg ? `${s.kg}×${s.reps}` : `${s.reps}`)).join("  ")}</b>
              <br />
            </>
          ) : null}
          💡 {suggestion(last?.sets, item.reps, ex.body && !(last?.sets ?? []).some((s) => s.kg > 0))}
        </p>
        <div className="gym-sets">
          <span className="h">#</span>
          <span className="h">الوزن (كغ)</span>
          <span className="h">التكرار</span>
          <span className="h" />
          {Array.from({ length: rows }, (_, i) => {
            const s = sets[i];
            const done = !!s && s.reps > 0;
            return (
              <div key={i} className={`row${done ? " done" : ""}`}>
                <span className="n">{i + 1}</span>
                <NumField
                  aria-label={`وزن المجموعة ${i + 1}`}
                  placeholder={last?.sets[i]?.kg ? String(last.sets[i].kg) : ex.body ? "جسم" : "0"}
                  value={s?.kg}
                  onValue={(kg) => setAt(i, { kg: Math.min(600, Math.round(kg * 4) / 4) })}
                />
                <NumField
                  decimal={false}
                  aria-label={`تكرار المجموعة ${i + 1}`}
                  placeholder={last?.sets[i]?.reps ? String(last.sets[i].reps) : item.reps}
                  value={s?.reps}
                  onValue={(reps) => setAt(i, { reps: Math.min(200, Math.round(reps)) })}
                />
                <button
                  type="button"
                  className="gym-icon-btn"
                  aria-label={done ? "تمت المجموعة" : "سجّل المجموعة كما آخر مرة وابدأ الراحة"}
                  onClick={() => {
                    if (!done) {
                      const ref = last?.sets[i] ?? sets[i - 1] ?? last?.sets[0];
                      const reps = s?.reps || ref?.reps || Number(item.reps.match(/\d+/g)?.pop() ?? 10);
                      setAt(i, { kg: s?.kg || ref?.kg || 0, reps });
                    }
                    onRest(item.restSec);
                  }}
                >
                  {done ? "✓" : "▶"}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button type="button" className="gym-btn ghost sm" onClick={() => setAt(rows, { reps: 0 })}>
            + مجموعة
          </button>
          {sets.length > 0 && (
            <button type="button" className="gym-btn ghost sm" onClick={() => onSets(sets.slice(0, -1))}>
              − آخر مجموعة
            </button>
          )}
          <Link href={`/mahdi/health/learn/${ex.id}`} className="gym-btn ghost sm">
            🎓 التكنيك
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function TodayView() {
  const { toast } = useMahdi();
  const { plan, save, today, day, days, saveDay, habitValue, logHabit, habitFor } = useHealth();
  const [date, setDate] = useState(today);
  const [pick, setPick] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [rest, setRest] = useState<number | null>(null);
  const all = useMemo(() => Object.values(days), [days]);
  if (!plan) return <Welcome />;

  const log = day(date);
  const w = plan.workout;
  const wd = weekdayOf(date);
  // no calendar: the session picked, else the one this day already trained, else the next in the rotation
  const planned: PlanDay | undefined =
    w && !w.blocked && w.days.length
      ? (pick !== null ? w.days.find((d) => d.weekday === pick) : undefined) ?? (log.planDay !== undefined ? w.days.find((d) => d.weekday === log.planDay) : undefined) ?? nextDay(w, all, date)
      : undefined;
  const plannedIdx = planned && w ? w.days.indexOf(planned) : -1;
  const week = weekOf(today);
  const doneHabit = planned ? habitValue(`day-${planned.weekday}`, date) : null;
  const finished = log.done || (doneHabit ?? 0) > 0;

  // what is logged belongs to the session being trained (the next one in the rotation follows it)
  const setLog = (patch: Partial<DayLog>) => saveDay({ ...log, ...(planned ? { planDay: planned.weekday } : {}), ...patch });
  const running = !!log.startedAt;
  const startClock = () => setLog({ startedAt: nowMs() });
  const stopClock = () => setLog({ startedAt: null, durationMin: Math.round(sessionMin(log) * 10) / 10 });

  const finish = () => {
    const done = !log.done;
    // finishing stops the clock: the day keeps how long the whole session took
    setLog(done && log.startedAt ? { done, startedAt: null, durationMin: Math.round(sessionMin(log) * 10) / 10 } : { done });
    // the habits follow what was really trained that day (the session picked, its exercises and sets), both ways
    for (const w of gymHabitWrites({ done, session: planned?.weekday ?? null, recorded: log.planDay, sets: log.sets })) logHabit(w.key, date, w.value);
    if (done) toast(habitFor(planned ? `day-${planned.weekday}` : "weekly") || habitFor("weekly") ? "عاش! تمرين اليوم انسجّل وانحسب في عاداتك 🔥" : "عاش! تمرين اليوم انسجّل 🔥");
  };

  const foodValue = (f: (typeof FOOD)[number]) => habitValue(f.link, date) ?? log.food[f.key] ?? 0;
  const foodTarget = (f: (typeof FOOD)[number]) =>
    plan.food?.[f.key] ?? (f.key === "waterCups" ? Math.round(((REF.waterL[plan.profile.sex] * REF.drinkShare) * 1000) / REF.cupMl) : f.key === "steps" ? (plan.profile.age >= 60 ? REF.steps.over60 : REF.steps.under60) : 0);
  const setFood = (f: (typeof FOOD)[number], v: number) => {
    const value = Math.max(0, Math.round(v));
    setLog({ food: { ...log.food, [f.key]: value } });
    logHabit(f.link, date, value);
  };
  // «شنو أكلت؟»: the meals change, and the day's calories and protein move by the same amounts (habits too)
  const setMeals = (next: MealItem[]) => {
    const was = mealTotals(log.meals);
    const now = mealTotals(next);
    const food = { ...log.food };
    for (const [f, d] of [[FOOD.find((x) => x.key === "kcal")!, now.kcal - was.kcal], [FOOD.find((x) => x.key === "proteinG")!, now.p - was.p]] as const) {
      if (!d) continue;
      const value = Math.max(0, Math.round(foodValue(f) + d));
      food[f.key] = value;
      logHabit(f.link, date, value);
    }
    setLog({ meals: next, food });
  };

  return (
    <div className="space-y-4">
      {rest && <RestTimer until={rest} onDone={() => setRest(null)} />}

      <div className="gym-week" role="group" aria-label="أيام الأسبوع">
        {week.map((d) => {
          const l = days[d];
          const trained = l?.done || Object.keys(l?.sets ?? {}).length > 0;
          return (
            <button key={d} type="button" aria-pressed={d === date} onClick={() => (setDate(d), setPick(null))}>
              <small>{WEEKDAYS[weekdayOf(d)].replace("ال", "")}</small>
              <b>{Number(d.slice(8))}</b>
              <i className={trained ? "on" : ""} />
            </button>
          );
        })}
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="gym-title">
            {date === today ? "تمرين اليوم" : `تمرين ${WEEKDAYS[wd]}`} {planned ? <em>· {dayLabel(plannedIdx)}: {focusName(planned)}</em> : null}
          </h1>
          {finished && <span className="gym-chip" aria-pressed="true">✓ خلصته</span>}
        </div>

        {w?.blocked && <p className="gym-card stop gym-small">{w.blocked}</p>}
        {!w && <p className="gym-card gym-small">خطتك تغذية بس. تبي جدول تمارين؟ <Link href="/mahdi/health/setup" className="underline">عدّل خطتك</Link>.</p>}

        {w && !w.blocked && planned && (
          <div className="gym-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="gym-small">
                ⏱️ مدة التمرين: <SessionClock log={log} />
                {!running && !log.durationMin ? " · اضغط «ابدأ» أول ما تبدأ" : ""}
              </div>
              {running ? (
                <button type="button" className="gym-btn sm ghost" onClick={stopClock}>⏸ وقّف الوقت</button>
              ) : (
                <button type="button" className="gym-btn sm" onClick={startClock}>{log.durationMin ? "▶ كمّل الوقت" : "▶ ابدأ التمرين"}</button>
              )}
            </div>
            {w.days.length > 1 && (
              <div className="space-y-1">
                <small className="gym-small">تبي حصة ثانية اليوم؟ اختر أي يوم من جدولك:</small>
                <div className="gym-chips">
                  {w.days.map((d, i) => (
                    <button key={d.weekday} type="button" className="gym-chip" aria-pressed={d.weekday === planned.weekday} onClick={() => (setPick(d.weekday), setEditing(false))}>
                      {dayLabel(i)} · {focusName(d)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button type="button" className={`gym-btn sm ${editing ? "" : "ghost"}`} onClick={() => setEditing(!editing)}>
              {editing ? "✓ خلصت التعديل" : "✏️ عدّل تمارين هالحصة"}
            </button>
            {editing && <DayCard plan={plan} day={planned} save={save} editable />}
          </div>
        )}

        {planned &&
          planned.items.map((it) => (
            <ExerciseLog
              key={it.exId}
              item={it}
              log={log}
              days={all}
              date={date}
              onSets={(s) => {
                setLog({ sets: { ...log.sets, [it.exId]: s } });
                // sets changed after «خلصت»: the exercise's habit follows them
                if (log.done) logHabit(`ex-${it.exId}`, date, s.filter((x) => x.reps > 0).length);
              }}
              onRest={(sec) => setRest(Date.now() + sec * 1000)}
            />
          ))}

        {planned && (
          <div className="gym-card flex flex-wrap items-center justify-between gap-3">
            <label className="gym-field">
              <span>🚶 كارديو اليوم (دقيقة) · المقترح {planned.cardioMin}</span>
              <NumField
                decimal={false}
                value={log.cardioMin}
                placeholder={String(planned.cardioMin)}
                onValue={(n) => {
                  const v = Math.min(600, Math.round(n));
                  setLog({ cardioMin: v });
                  logHabit("cardio", date, v);
                }}
              />
            </label>
            <button type="button" className={`gym-btn ${finished ? "ghost" : ""}`} onClick={finish}>
              {log.done ? "↩︎ تراجع" : "✓ خلصت تمرين اليوم"}
            </button>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="gym-title text-2xl">تغذية <em>اليوم</em></h2>
        <MealLog meals={log.meals ?? []} onChange={setMeals} />
        <div className="space-y-2">
          {FOOD.filter((f) => plan.food || f.key === "waterCups" || f.key === "steps").map((f) => {
            const v = foodValue(f);
            const target = foodTarget(f);
            const pct = target ? Math.min(100, Math.round((v / target) * 100)) : 0;
            const linked = !!habitFor(f.link);
            return (
              <div key={f.key} className="gym-food">
                <div className="top">
                  <b>
                    {f.icon} {f.name}
                  </b>
                  <span dir="ltr">
                    <em>{v.toLocaleString("en")}</em> / {target.toLocaleString("en")} {f.unit}
                  </span>
                </div>
                <div className="bar" aria-hidden>
                  <i style={{ width: `${pct}%` }} className={pct >= 100 ? "full" : ""} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {f.adds.map((a) => (
                    <button key={a} type="button" className="gym-chip" dir="ltr" onClick={() => setFood(f, v + a)}>
                      +{a.toLocaleString("en")}
                    </button>
                  ))}
                  {v > 0 && (
                    <button type="button" className="gym-chip" dir="ltr" onClick={() => setFood(f, v - f.adds[0])}>
                      −{f.adds[0].toLocaleString("en")}
                    </button>
                  )}
                  <input className="gym-input w-24" inputMode="numeric" aria-label={`${f.name}: الرقم`} value={v || ""} placeholder="0" onChange={(e) => setFood(f, Number(e.target.value.replace(/\D/g, "")) || 0)} />
                  {linked && <small className="gym-small">🔗 عادتك</small>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="gym-card flex flex-wrap items-end justify-between gap-3">
        <label className="gym-field">
          <span>⚖️ وزنك اليوم (اختياري)</span>
          <NumField
            className="gym-input w-32"
            value={log.bodyKg}
            placeholder={String(all.filter((d) => d.bodyKg).sort((a, b) => b.date.localeCompare(a.date))[0]?.bodyKg ?? plan.profile.weightKg)}
            onValue={(n) => setLog({ bodyKg: n ? Math.round(n * 10) / 10 : null })}
          />
        </label>
        <Link href="/mahdi/health/progress" className="gym-btn ghost sm">📈 شوف تقدمك</Link>
      </section>
    </div>
  );
}
