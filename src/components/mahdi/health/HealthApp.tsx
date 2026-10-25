"use client";

// «الصحة العلوية» · the setup (/mahdi/health/setup) and the plan's parts. The person enters who they are and what they want
// (gym only, nutrition only, or both), picks a complete ready plan or builds it with us one step at a time, and then
// chooses how it goes into their habits (by days, by exercises or weekly, plus the nutrition habits) in a project of
// its own. Everything is computed on the device from the research (no AI, no cost); the plan is saved to the account.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useHealth, type SetupStep } from "./HealthProvider";
import {
  EXERCISES,
  FOCUS,
  GYM_WAYS,
  LABELS,
  MUSCLE_NAMES,
  RED_FLAGS,
  SPLIT_CHOICES,
  SPLIT_NAMES,
  arNum,
  bmiOf,
  buildDayFrom,
  dayFocuses,
  dayLabel,
  daysOfCount,
  focusName,
  candidates,
  dose,
  exerciseById,
  foodHabitsFor,
  gentle,
  habitsFor,
  macrosOf,
  makePlan,
  placeOk,
  splitFor,
  nutrition,
  trimester,
  weeklySets,
  type FoodHabit,
  type GymWay,
  type HealthPlan,
  type HealthProfile,
  type Focus,
  type PlanDay,
  type SplitPreference,
} from "@/lib/mahdi/health/plan";
import RobotFace from "@/components/RobotFace";
import "./health.css";
import FoodGuide from "./FoodGuide";

/** «عباس سبع القنطرة»: the coach of «الصحة العلوية»; a word on every screen (to a man or to a woman). */
export const COACH = "عباس سبع القنطرة";
export function coachLine(screen: Screen, f: boolean, preg: boolean): string {
  const g = (m: string, w: string) => (f ? w : m);
  switch (screen) {
    case "track":
      return g("وش ناوي عليه يا بطل؟ اختر وأنا معك للآخر 💪", "وش ناوية عليه يا بطلة؟ اختاري وأنا معك للآخر 💪");
    case "about":
      return g("عطني أرقامك بصدق، الخطة تنحسب عليها بالضبط.", "عطيني أرقامك بصدق، الخطة تنحسب عليها بالضبط.");
    case "goal":
      return preg ? "في الحمل هدفنا صحتك وصحة الجنين، مو الرجيم. نختار الهدف ونمشي بهدوء." : g("الهدف الواضح نص الطريق. وش تبي توصل له؟", "الهدف الواضح نص الطريق. وش تبين توصلين له؟");
    case "train":
      return preg ? "سلامتك أولًا: جاوبي على أسئلة الطبيبة بصدق، والجدول يكون خفيف وآمن." : g("الالتزام أهم من كثرة الأيام: اختر كم يوم تقدر تثبت عليه، وأنت تحدد متى.", "الالتزام أهم من كثرة الأيام: اختاري كم يوم تقدرين تثبتين عليه، وأنتِ تحددين متى.");
    case "mode":
      return g("تبيها جاهزة الحين، ولا نبنيها مع بعض حبة حبة؟", "تبينها جاهزة الحين، ولا نبنيها مع بعض حبة حبة؟");
    case "build-food":
      return g("هذا اللي أقترحه لك من البحوث، وتقدر تعدّله على راحتك.", "هذا اللي أقترحه لك من البحوث، وتقدرين تعدّلينه على راحتك.");
    case "build-day":
      return g("شوف تمارين اليوم: بدّل اللي ما يناسبك، والمهم التكنيك قبل الوزن.", "شوفي تمارين اليوم: بدّلي اللي ما يناسبك، والمهم التكنيك قبل الوزن.");
    case "plan":
      return g("خطتك جاهزة! الحين لا تكتفي بالقراءة، خلها عادات وابدأ اليوم.", "خطتك جاهزة! الحين لا تكتفين بالقراءة، خليها عادات وابدئي اليوم.");
    case "habits":
      return g("اختر كيف تتابعها كل يوم، وأنا أشوف نسبتك ترتفع 🔥", "اختاري كيف تتابعينها كل يوم، وأنا أشوف نسبتك ترتفع 🔥");
    default:
      return "";
  }
}

export function Coach({ line }: { line: string }) {
  if (!line) return null;
  return (
    <div className="gym-coach">
      <RobotFace id="sabaa" size={46} />
      <p>
        <b>{COACH}</b>
        {line}
      </p>
    </div>
  );
}

type Screen = "home" | SetupStep | "plan" | "habits";
const WIZARD: Screen[] = ["track", "about", "goal", "train", "mode"];

export function Barbell() {
  return (
    <svg className="barbell" viewBox="0 0 220 60" aria-hidden="true">
      <rect x="10" y="27" width="200" height="6" rx="3" fill="#c6ff1a" />
      <rect x="22" y="6" width="14" height="48" rx="3" fill="#c6ff1a" />
      <rect x="38" y="12" width="10" height="36" rx="3" fill="#c6ff1a" />
      <rect x="184" y="6" width="14" height="48" rx="3" fill="#c6ff1a" />
      <rect x="172" y="12" width="10" height="36" rx="3" fill="#c6ff1a" />
    </svg>
  );
}

export function Choice({ on, onClick, big, title, hint, disabled = false }: { on: boolean; onClick: () => void; big?: string; title: string; hint?: string; disabled?: boolean }) {
  return (
    <button type="button" className="gym-choice" aria-pressed={on} onClick={onClick} disabled={disabled}>
      {big && <span className="big">{big}</span>}
      <b>{title}</b>
      {hint && <span>{hint}</span>}
    </button>
  );
}

export function Stepper({ label, value, set, step = 1, min, max, unit }: { label: string; value: number; set: (n: number) => void; step?: number; min: number; max: number; unit?: string }) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 10) / 10));
  return (
    <label className="gym-field">
      <span>{label}</span>
      <span className="gym-stepper">
        <button type="button" className="gym-icon-btn" onClick={() => set(clamp(value - step))} aria-label="أقل">−</button>
        <input className="gym-input" inputMode="decimal" value={Number.isFinite(value) ? value : ""} onChange={(e) => set(Number(e.target.value.replace(/[^\d.]/g, "")) || 0)} onBlur={() => set(clamp(value))} />
        <button type="button" className="gym-icon-btn" onClick={() => set(clamp(value + step))} aria-label="أكثر">+</button>
        {unit && <span className="gym-small">{unit}</span>}
      </span>
    </label>
  );
}

export default function HealthApp() {
  const router = useRouter();
  const { loaded, plan, save, profile: p, setProfile: setP, step: screen, setStep } = useHealth();
  const [dayIdx, setDayIdx] = useState(0);
  const [foodIdx, setFoodIdx] = useState(0);
  const top = useRef<HTMLDivElement>(null);

  const go = (s: Screen) => {
    if (s === "plan") return router.push("/mahdi/health/plan");
    if (s === "home") return router.push("/mahdi/health");
    if (s === "habits") return router.push("/mahdi/health/habits");
    setStep(s);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const set = <K extends keyof HealthProfile>(k: K, v: HealthProfile[K]) => setP((o) => ({ ...o, [k]: v }));
  const female = p.sex === "female";
  const preg = female && p.stage === "pregnant";
  const n = useMemo(() => (p.track === "gym" ? null : nutrition(p)), [p]);

  const start = (mode: HealthPlan["mode"]) => {
    const fresh = makePlan(p, mode);
    save(fresh);
    if (mode === "ready") go("plan");
    else {
      setFoodIdx(0);
      setDayIdx(0);
      go(fresh.food ? "build-food" : fresh.workout && !fresh.workout.blocked && fresh.workout.days.length ? "build-day" : "plan");
    }
  };

  if (!loaded) return <p className="gym-dim py-10 text-center">لحظة… 🏋️</p>;

  const wizardAt = WIZARD.indexOf(screen);

  return (
    <div className="space-y-4" ref={top}>
      {wizardAt >= 0 && (
        <div className="gym-bar" aria-label={`الخطوة ${wizardAt + 1} من ${WIZARD.length}`}>
          <b className="on" />
          {WIZARD.map((s, i) => (
            <i key={s} className={i <= wizardAt ? "on" : ""} />
          ))}
          <b className={wizardAt === WIZARD.length - 1 ? "on" : ""} />
        </div>
      )}

      <Coach line={coachLine(screen, female, preg)} />

      {screen === "track" && (
        <section className="space-y-4">
          <h2 className="gym-title">وش تبي؟</h2>
          <div className="gym-choices">
            <Choice on={p.track === "gym"} onClick={() => set("track", "gym")} big="🏋️" title="الجيم بس" hint="جدول تمارين حسب أيامك ومكانك" />
            <Choice on={p.track === "food"} onClick={() => set("track", "food")} big="🥗" title="التغذية بس" hint="سعراتك وبروتينك ومايك وعاداتك الغذائية" />
            <Choice on={p.track === "both"} onClick={() => set("track", "both")} big="⚡" title="الاثنين" hint="الجدول والتغذية مع بعض (الأفضل)" />
          </div>
          <Nav back={() => go("home")} next={() => go("about")} />
        </section>
      )}

      {screen === "about" && (
        <section className="space-y-4">
          <h2 className="gym-title">عرّفنا عليك</h2>
          <div className="gym-choices">
            <Choice on={p.sex === "male"} onClick={() => setP((o) => ({ ...o, sex: "male", stage: "none" }))} big="🧔" title="رجل" />
            <Choice on={female} onClick={() => set("sex", "female")} big="🧕" title="امرأة" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stepper label="العمر" value={p.age} set={(v) => set("age", v)} min={13} max={90} unit="سنة" />
            <Stepper label="الطول" value={p.heightCm} set={(v) => set("heightCm", v)} min={120} max={230} unit="سم" />
            <Stepper label={preg ? "الوزن قبل الحمل" : "الوزن"} value={p.weightKg} set={(v) => set("weightKg", v)} step={0.5} min={30} max={300} unit="كغ" />
          </div>
          <p className="gym-small">مؤشر كتلة الجسم: <b className="text-white">{bmiOf(p.weightKg, p.heightCm)}</b></p>

          {female && p.age >= 14 && p.age <= 55 && (
            <div className="gym-card space-y-3">
              <b>هل أنتِ…</b>
              <div className="gym-chips">
                {(["none", "pregnant", "postpartum", "breastfeeding"] as const).map((s) => (
                  <button key={s} type="button" className="gym-chip" aria-pressed={p.stage === s} onClick={() => set("stage", s)}>
                    {s === "none" ? "لا شي منها" : LABELS.stage[s]}
                  </button>
                ))}
              </div>
              {preg && (
                <>
                  <Stepper label="أسبوع الحمل" value={p.pregWeek} set={(v) => set("pregWeek", v)} min={1} max={42} unit={`(الثلث ${["الأول", "الثاني", "الثالث"][trimester(p.pregWeek) - 1]})`} />
                  <label className="gym-check">
                    <input type="checkbox" checked={p.wasActive} onChange={(e) => set("wasActive", e.target.checked)} />
                    <span>كنت أتمرن بانتظام قبل الحمل</span>
                  </label>
                  <p className="gym-small">ندخّل وزنك قبل الحمل عشان نحسب لك الزيادة المناسبة في الوزن.</p>
                </>
              )}
              {(p.stage === "postpartum" || p.stage === "breastfeeding") && <Stepper label="كم شهر من الولادة؟" value={p.babyMonths} set={(v) => set("babyMonths", v)} min={0} max={24} unit="شهر" />}
            </div>
          )}
          <Nav back={() => go("track")} next={() => go("goal")} />
        </section>
      )}

      {screen === "goal" && (
        <section className="space-y-4">
          <h2 className="gym-title">وش أهدافك؟</h2>
          <p className="gym-small">تقدر تختار أكثر من هدف (مثلًا نزول وزن + بناء عضل).</p>
          <div className="gym-choices">
            {(
              [
                ["lose", "🔥", preg ? "زيادة صحية بس (بدون رجيم)" : "نزول وزن وحرق دهون"],
                ["muscle", "💪", "عضل أكثر وشكل أقوى"],
                ["strength", "🏋️", "أرفع أثقل (قوة)"],
                ["fit", "⚡", "لياقة وشكل متناسق"],
                ["health", "❤️", "صحة عامة ونشاط"],
              ] as const
            ).map(([g, icon, hint]) => (
              <Choice
                key={g}
                on={p.goals.includes(g)}
                onClick={() => set("goals", p.goals.includes(g) ? (p.goals.length > 1 ? p.goals.filter((x) => x !== g) : p.goals) : [...p.goals, g])}
                big={icon}
                title={LABELS.goal[g]}
                hint={hint}
              />
            ))}
          </div>
          <h3 className="font-black">حركتك اليومية (بدون التمرين)</h3>
          <div className="gym-chips">
            {(Object.keys(LABELS.activity) as (keyof typeof LABELS.activity)[]).map((a) => (
              <button key={a} type="button" className="gym-chip" aria-pressed={p.activity === a} onClick={() => set("activity", a)}>
                {LABELS.activity[a]}
              </button>
            ))}
          </div>
          {p.track !== "gym" && (
            <div className="gym-field">
              <span>كم وجبة باليوم؟</span>
              <div className="gym-chips">
                {[2, 3, 4, 5].map((m) => (
                  <button key={m} type="button" className="gym-chip" aria-pressed={p.meals === m} onClick={() => set("meals", m)}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Nav back={() => go("about")} next={() => go(p.track === "food" ? "mode" : "train")} />
        </section>
      )}

      {screen === "train" && (
        <section className="space-y-4">
          <h2 className="gym-title">تمرينك</h2>
          <div className="gym-field">
            <span>مستواك</span>
            <div className="gym-chips">
              {(["beginner", "intermediate", "advanced"] as const).map((l) => (
                <button key={l} type="button" className="gym-chip" aria-pressed={p.level === l} onClick={() => set("level", l)}>
                  {LABELS.level[l]}
                </button>
              ))}
            </div>
          </div>
          <div className="gym-choices">
            <Choice on={p.place === "gym"} onClick={() => set("place", "gym")} big="🏟️" title="جيم (نادي)" hint="أجهزة وكيبلات وبار وأوزان حرة" />
            <Choice on={p.place === "home"} onClick={() => set("place", "home")} big="🏠" title="جيم بيتي" hint="عندي دمبلز أو مقعد أو مطاط أو بار عقلة" />
            <Choice on={p.place === "body"} onClick={() => set("place", "body")} big="🤸" title="بدون أدوات" hint="وزن جسمي بس: كرسي، منشفة، جدار، درج" />
          </div>
          <div className="gym-field">
            <span>كم يوم تتمرن بالأسبوع؟</span>
            <div className="gym-chips">
              {[1, 2, 3, 4, 5, 6, 7].map((count) => (
                <button
                  key={count}
                  type="button"
                  className="gym-chip"
                  aria-pressed={p.days.length === count}
                  onClick={() => {
                    const days = daysOfCount(count);
                    const splitPreference = SPLIT_CHOICES[p.splitPreference].minDays <= days.length ? p.splitPreference : "auto";
                    setP((old) => ({ ...old, days, splitPreference }));
                  }}
                >
                  {count === 1 ? "يوم واحد" : count === 2 ? "يومين" : `${arNum(count)} أيام`}
                </button>
              ))}
            </div>
            <p className="gym-small">الجدول ما ينربط بالتقويم: «اليوم ١، اليوم ٢…» تسويها بالترتيب متى ما تمرنت، وترتاح اليوم اللي يناسبك. التوصية: كل عضلات الجسم يومين على الأقل بالأسبوع، والمبتدئ 2–3 أيام كفاية.</p>
          </div>
          <div className="gym-field">
            <span>اختر نظام الجدول</span>
            <div className="gym-choices">
              {(Object.entries(SPLIT_CHOICES) as [SplitPreference, (typeof SPLIT_CHOICES)[SplitPreference]][]).map(([id, option]) => {
                const unavailable = p.days.length < option.minDays;
                return (
                  <Choice
                    key={id}
                    on={p.splitPreference === id}
                    onClick={() => set("splitPreference", id)}
                    disabled={unavailable}
                    title={option.name}
                    hint={unavailable ? `اختر ${option.minDays} أيام أو أكثر` : option.hint}
                  />
                );
              })}
            </div>
            <div className="gym-split-preview">
              {splitFor(p).map((focus, i) => (
                <div key={`${p.days[i]}-${focus}`}>
                  <b>{dayLabel(i)} · {FOCUS[focus].name}</b>
                  <small>{[...new Set(FOCUS[focus].slots)].slice(0, 6).map((muscle) => MUSCLE_NAMES[muscle]).join(" · ")}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="gym-field">
            <span>وقت الحصة</span>
            <div className="gym-chips">
              {[30, 45, 60, 75].map((m) => (
                <button key={m} type="button" className="gym-chip" aria-pressed={p.minutes === m} onClick={() => set("minutes", m)}>
                  {m} دقيقة
                </button>
              ))}
            </div>
          </div>

          {female && p.stage !== "none" && (
            <div className="gym-card warn space-y-2">
              <b>🩺 سلامتك وسلامة {preg ? "الجنين" : "جسمك بعد الولادة"}</b>
              {preg && (
                <>
                  <p className="gym-small">أشّري لو عندك أي وحدة من هذي (الكلية الأمريكية لأطباء النساء والولادة):</p>
                  {RED_FLAGS.map((r) => (
                    <label key={r.id} className="gym-check">
                      <input type="checkbox" checked={p.redFlags.includes(r.id)} onChange={(e) => set("redFlags", e.target.checked ? [...p.redFlags, r.id] : p.redFlags.filter((x) => x !== r.id))} />
                      <span>{r.text}</span>
                    </label>
                  ))}
                </>
              )}
              <label className="gym-check">
                <input type="checkbox" checked={p.clearance} onChange={(e) => set("clearance", e.target.checked)} />
                <span>
                  <b>طبيبتي ما منعتني من الرياضة</b>
                  {!preg && " (بعد الولادة)"}
                </span>
              </label>
            </div>
          )}
          <Nav back={() => go("goal")} next={() => go("mode")} />
        </section>
      )}

      {screen === "mode" && (
        <section className="space-y-4">
          <h2 className="gym-title">كيف تبي خطتك؟</h2>
          {n && (
            <div className="gym-stats">
              <div className="gym-stat"><b>{n.kcal}</b><span>سعرة باليوم</span></div>
              <div className="gym-stat"><b>{n.proteinG}</b><span>غرام بروتين</span></div>
              <div className="gym-stat orange"><b>{n.waterCups}</b><span>أكواب ماء</span></div>
            </div>
          )}
          <div className="gym-choices">
            <Choice on={false} onClick={() => start("ready")} big="🚀" title="اقترح لي جدولًا" hint="نختار أقل عدد مفيد من أشهر التمارين، وتعدّلها بعدين" />
            <Choice on={false} onClick={() => start("steps")} big="🧱" title="أختار بنفسي" hint="نمر على كل يوم، ونعرض بدائل معروفة لكل عضلة" />
            <Choice
              on={false}
              onClick={() => {
                start("ready");
                // عباس opens with a first plan already made, and they shape it together in the chat
                window.dispatchEvent(new CustomEvent("gym-coach", { detail: { text: "سويت خطة مبدئية، أبي نرتب أيامي وتماريني مع بعض" } }));
              }}
              big="🦁"
              title="أرتبها مع عباس"
              hint="محادثة مع عباس سبع القنطرة: تقول له وش تبي، وهو يرتب أيامك وتمارينك بنفسه"
            />
          </div>
          <Nav back={() => go(p.track === "food" ? "goal" : "train")} />
        </section>
      )}

      {screen === "build-food" && plan?.food && n && (
        <BuildFood
          idx={foodIdx}
          plan={plan}
          n={n}
          save={save}
          back={() => (foodIdx ? setFoodIdx(foodIdx - 1) : go("mode"))}
          next={() => {
            if (foodIdx < FOOD_STEPS.length - 1) setFoodIdx(foodIdx + 1);
            else go(plan.workout && !plan.workout.blocked && plan.workout.days.length ? "build-day" : "plan");
          }}
        />
      )}

      {screen === "build-day" && plan?.workout && plan.workout.days[dayIdx] && (
        <section className="space-y-4">
          <span className="gym-eyebrow">يوم {dayIdx + 1} من {plan.workout.days.length}</span>
          <h2 className="gym-title">{dayLabel(dayIdx)}: {focusName(plan.workout.days[dayIdx])}</h2>
          <p className="gym-small">هذي التمارين المقترحة. بدّل أي تمرين (🔄)، احذفه، غيّر المجموعات، أو أضف تمرين من تحت.</p>
          <DayCard plan={plan} day={plan.workout.days[dayIdx]} save={save} editable />
          <Nav
            back={() => (dayIdx ? setDayIdx(dayIdx - 1) : plan.food ? (setFoodIdx(FOOD_STEPS.length - 1), go("build-food")) : go("mode"))}
            next={() => (dayIdx < plan.workout!.days.length - 1 ? setDayIdx(dayIdx + 1) : go("plan"))}
            nextLabel={dayIdx < plan.workout.days.length - 1 ? "اعتمد اليوم ←" : "اعتمد الجدول ✓"}
          />
        </section>
      )}

    </div>
  );
}

export function Nav({ back, next, nextLabel = "التالي ←" }: { back?: () => void; next?: () => void; nextLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      {back ? (
        <button type="button" className="gym-btn ghost sm" onClick={back}>→ رجوع</button>
      ) : (
        <span />
      )}
      {next && (
        <button type="button" className="gym-btn" onClick={next}>
          {nextLabel}
        </button>
      )}
    </div>
  );
}

export function Disclaimer() {
  return <p className="gym-small text-center">هذي توصيات عامة للأصحاء من المصادر العالمية، ما تغني عن طبيبك. عندك مرض أو إصابة أو حمل؟ استشر طبيبك قبل ما تبدأ.</p>;
}

export function PlanSummary({ plan, onOpen, onHabits, onEdit }: { plan: HealthPlan; onOpen: () => void; onHabits: () => void; onEdit: () => void }) {
  const w = plan.workout;
  return (
    <section className="gym-card hot space-y-3">
      <div className="flex items-center justify-between">
        <span className="gym-eyebrow">خطتي</span>
        <span className="gym-small">{LABELS.track[plan.profile.track]} · {plan.profile.goals.map((g) => LABELS.goal[g]).join(" + ")}</span>
      </div>
      <div className="gym-stats">
        {plan.food && (
          <>
            <div className="gym-stat"><b>{plan.food.kcal}</b><span>سعرة</span></div>
            <div className="gym-stat"><b>{plan.food.proteinG}</b><span>غ بروتين</span></div>
          </>
        )}
        {w && !w.blocked && <div className="gym-stat orange"><b>{w.days.length}</b><span>أيام تمرين</span></div>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="gym-btn sm" onClick={onOpen}>📋 افتح الخطة</button>
        <button type="button" className="gym-btn orange sm" onClick={onHabits}>➕ أدخلها في عاداتي</button>
        <button type="button" className="gym-btn ghost sm" onClick={onEdit}>✏️ عدّل معلوماتي</button>
      </div>
    </section>
  );
}

const FOOD_STEPS = ["kcal", "proteinG", "waterCups", "produce", "steps"] as const;

function BuildFood({ idx, plan, n, save, back, next }: { idx: number; plan: HealthPlan; n: ReturnType<typeof nutrition>; save: (p: HealthPlan) => void; back: () => void; next: () => void }) {
  const k = FOOD_STEPS[idx];
  const f = plan.food!;
  const info: Record<(typeof FOOD_STEPS)[number], { title: string; icon: string; unit: string; step: number; min: number; max: number; why: string }> = {
    kcal: { title: "سعراتك اليومية", icon: "🔥", unit: "سعرة", step: 50, min: 1000, max: 6000, why: `حرقك وقت الراحة ${n.bmr} سعرة، ومع حركتك ${n.tdee}. ${n.notes[0] ?? ""}` },
    proteinG: { title: "البروتين", icon: "🥩", unit: "غرام", step: 5, min: 20, max: 400, why: `وزّعه ${n.proteinMealG} غ تقريبًا في كل وجبة كل 3–4 ساعات (الجمعية الدولية للتغذية الرياضية). الإرشادات الجديدة 1.2–1.6 غ لكل كيلو، وأكثر مع المقاومة أو التنشيف.` },
    waterCups: { title: "الماء", icon: "💧", unit: "كوب (250 مل)", step: 1, min: 2, max: 20, why: `حوالي ${n.waterL} لتر شرب باليوم (الهيئة الأوروبية لسلامة الأغذية)، وزِد في الحر ومع التمرين.` },
    produce: { title: "الخضار والفواكه", icon: "🥗", unit: "حصص", step: 1, min: 1, max: 15, why: "منظمة الصحة العالمية: 400 غرام على الأقل (5 حصص) باليوم. الحصة = حبة فاكهة أو كوب خضار ورقية." },
    steps: { title: "خطواتك", icon: "👟", unit: "خطوة", step: 500, min: 1000, max: 40000, why: "فائدة الخطوات على العمر تستقر تقريبًا عند 8,000–10,000 لمن هو أصغر من 60، و6,000–8,000 فوقها (ذا لانسيت 2022)." },
  };
  const it = info[k];
  return (
    <section className="space-y-4">
      <span className="gym-eyebrow">التغذية · {idx + 1} من {FOOD_STEPS.length}</span>
      <h2 className="gym-title">{it.icon} {it.title}</h2>
      <div className="gym-card space-y-3">
        <Stepper label={`المقترح لك: ${n[k].toLocaleString("en")}`} value={f[k]} set={(v) => save({ ...plan, food: { ...f, [k]: v } })} step={it.step} min={it.min} max={it.max} unit={it.unit} />
        <p className="gym-small">{it.why}</p>
      </div>
      {k === "kcal" && (
        <div className="gym-stats">
          <div className="gym-stat"><b>{macrosOf(f, plan.profile).fatG}</b><span>غ دهون تقريبًا</span></div>
          <div className="gym-stat"><b>{n.fiberG}</b><span>غ ألياف</span></div>
          <div className="gym-stat orange"><b>&lt;{n.sugarG}</b><span>غ سكر مضاف</span></div>
          <div className="gym-stat orange"><b>&lt;{n.saltG}</b><span>غ ملح</span></div>
        </div>
      )}
      <Nav back={back} next={next} nextLabel="اعتمد ←" />
    </section>
  );
}

/** The types a day can train, in the order they are offered (the gentle table keeps its own one). */
const TYPE_CHOICES: Focus[] = ["full", "upper", "lower", "push", "pull", "legs"];

/** Saves the plan's days and keeps the profile's day list the same (the rotation, no calendar). */
export function saveDays(plan: HealthPlan, save: (p: HealthPlan) => void, days: PlanDay[]) {
  const w = plan.workout!;
  save({ ...plan, profile: { ...plan.profile, days: days.map((d) => d.weekday) }, workout: { ...w, days } });
}

export function DayCard({ plan, day, save, editable, onRemove }: { plan: HealthPlan; day: PlanDay; save: (p: HealthPlan) => void; editable?: boolean; onRemove?: () => void }) {
  const [replacing, setReplacing] = useState<string | null>(null);
  const [rebuilt, setRebuilt] = useState(false);
  const w = plan.workout!;
  const p = plan.profile;
  const idx = Math.max(0, w.days.findIndex((x) => x.weekday === day.weekday));
  const setDay = (d: PlanDay) => saveDays(plan, save, w.days.map((x) => (x.weekday === d.weekday ? d : x)));
  const types = dayFocuses(day);
  const soft = gentle(p);
  // one tap on a type adds it to the day (or takes it off); the day's exercises are arranged again for the types chosen
  const toggleType = (f: Focus) => {
    const next = types.includes(f) ? types.filter((x) => x !== f) : [...types, f].slice(-3);
    if (!next.length) return;
    setDay(buildDayFrom(p, day.weekday, next, day.variant, day.cardioMin));
    setRebuilt(true);
  };
  const move = (i: number, by: number) => {
    const items = [...day.items];
    const j = i + by;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    setDay({ ...day, items });
  };
  const pool = EXERCISES.filter((e) => placeOk(e, p.place) && (!soft || e.preg) && !day.items.some((i) => i.exId === e.id));
  return (
    <article className="gym-day">
      <header>
        <h3>{dayLabel(idx)}</h3>
        <span className="tag">{focusName(day)}</span>
        {editable && onRemove && w.days.length > 1 && (
          <button type="button" className="gym-icon-btn" aria-label={`احذف ${dayLabel(idx)}`} title="احذف اليوم من الجدول" onClick={onRemove}>🗑</button>
        )}
      </header>
      {editable && !soft && (
        <div className="space-y-1 px-3 pt-2">
          <small className="gym-small">نوع اليوم (تقدر تختار نوعين أو ثلاثة مع بعض):</small>
          <div className="gym-chips">
            {TYPE_CHOICES.map((f) => (
              <button key={f} type="button" className="gym-chip" aria-pressed={types.includes(f)} onClick={() => toggleType(f)}>
                {FOCUS[f].name.replace(/ \(.*\)$/, "")}
              </button>
            ))}
          </div>
          {rebuilt && <small className="gym-small">✓ رتّبنا تمارين اليوم على الأنواع اللي اخترتها. عدّل اللي تبيه تحت.</small>}
        </div>
      )}
      {day.items.map((it, i) => {
        const ex = exerciseById(it.exId);
        if (!ex) return null;
        return (
          <div key={it.exId} className={`gym-ex${editable ? " edit" : ""}`}>
            <span className="n">{i + 1}</span>
            <span className="what">
              <b>{ex.name}</b>
              <small>{MUSCLE_NAMES[ex.muscle]} · {ex.cue} · راحة {it.restSec % 60 === 0 ? `${it.restSec / 60} د` : `${it.restSec} ث`}</small>
            </span>
            <span className="dose" dir="ltr">
              <em>{it.sets}</em>×{it.reps}
            </span>
            {editable && (
              <span className="tools">
                <button type="button" className="gym-icon-btn" aria-label="فوق" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" className="gym-icon-btn" aria-label="مجموعات أقل" onClick={() => setDay({ ...day, items: day.items.map((x) => (x.exId === it.exId ? { ...x, sets: Math.max(1, x.sets - 1) } : x)) })}>−</button>
                <button type="button" className="gym-icon-btn" aria-label="مجموعات أكثر" onClick={() => setDay({ ...day, items: day.items.map((x) => (x.exId === it.exId ? { ...x, sets: Math.min(10, x.sets + 1) } : x)) })}>+</button>
                <button
                  type="button"
                  className="gym-icon-btn"
                  aria-label="بدّل التمرين"
                  title="اختر من أشهر بدائل نفس العضلة"
                  aria-expanded={replacing === it.exId}
                  onClick={() => setReplacing(replacing === it.exId ? null : it.exId)}
                >
                  بدائل
                </button>
                <button type="button" className="gym-icon-btn" aria-label="احذف" onClick={() => setDay({ ...day, items: day.items.filter((x) => x.exId !== it.exId) })}>✕</button>
              </span>
            )}
            {editable && replacing === it.exId && (
              <div className="gym-ex-alts" aria-label={`بدائل ${ex.name}`}>
                <small>أشهر خيارات {MUSCLE_NAMES[ex.muscle]} — اختر اللي ترتاح له:</small>
                <div>
                  {candidates(ex.muscle, p).slice(0, 6).map((alt, k) => (
                    <button
                      key={alt.id}
                      type="button"
                      aria-pressed={alt.id === it.exId}
                      onClick={() => {
                        if (alt.id !== it.exId && !day.items.some((x) => x.exId === alt.id)) setDay({ ...day, items: day.items.map((x) => (x.exId === it.exId ? { exId: alt.id, ...dose(alt, p) } : x)) });
                        setReplacing(null);
                      }}
                    >
                      <b>{alt.name}</b>
                      <span>{k === 0 ? "الأشهر والمقترح" : alt.cue}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {day.cardioMin > 0 && (
        <div className="gym-ex">
          <span className="n">🚶</span>
          <span className="what"><b>كارديو بعد الحصة</b><small>مشي سريع، دراجة، أو جهاز الدرج — تقدر تتكلم بس بصعوبة</small></span>
          <span className="dose"><em>{day.cardioMin}</em> د</span>
        </div>
      )}
      {editable && (
        <div className="space-y-2 p-3">
          <select
            className="gym-select w-full"
            value=""
            aria-label="أضف تمرين"
            onChange={(e) => {
              const ex = exerciseById(e.target.value);
              if (ex) setDay({ ...day, items: [...day.items, { exId: ex.id, ...dose(ex, p) }] });
            }}
          >
            <option value="">➕ أضف تمرين لهذا اليوم…</option>
            {Object.entries(MUSCLE_NAMES).map(([m, name]) => {
              const list = pool.filter((e) => e.muscle === m);
              return list.length ? (
                <optgroup key={m} label={name}>
                  {list.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </select>
          <p className="gym-small">تختار التمرين وينضاف على طول. وإذا تبي عباس يرتبها لك، كلمه من وجهه على الجنب.</p>
        </div>
      )}
    </article>
  );
}

export function PlanView({ plan, save, onHabits, onHome }: { plan: HealthPlan; save: (p: HealthPlan) => void; onHabits: () => void; onHome: () => void }) {
  const [edit, setEdit] = useState(false);
  const n = plan.profile.track === "gym" ? null : nutrition(plan.profile);
  const w = plan.workout;
  const vol = w ? weeklySets(w) : {};
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="gym-title">خطتك <em>جاهزة</em> 🔥</h2>
        <button type="button" className="gym-btn ghost sm" onClick={onHome}>الرئيسية</button>
      </div>

      {plan.food && n && (
        <div className="gym-card space-y-3">
          <span className="gym-eyebrow">🥗 التغذية</span>
          <div className="gym-stats">
            <div className="gym-stat"><b>{plan.food.kcal}</b><span>سعرة باليوم</span></div>
            <div className="gym-stat"><b>{plan.food.proteinG}</b><span>غ بروتين ({n.proteinMealG} غ للوجبة)</span></div>
            <div className="gym-stat"><b>{macrosOf(plan.food, plan.profile).fatG}</b><span>غ دهون</span></div>
            <div className="gym-stat"><b>{macrosOf(plan.food, plan.profile).carbG}</b><span>غ كربوهيدرات</span></div>
            <div className="gym-stat orange"><b>{plan.food.waterCups}</b><span>أكواب ماء</span></div>
            <div className="gym-stat orange"><b>{plan.food.produce}</b><span>حصص خضار وفواكه</span></div>
            <div className="gym-stat"><b>{n.fiberG}</b><span>غ ألياف</span></div>
            <div className="gym-stat"><b>{plan.food.steps.toLocaleString("en")}</b><span>خطوة</span></div>
          </div>
          {n.gwg && (
            <p className="gym-card warn gym-small">🤰 الزيادة المناسبة في وزنك طول الحمل ({n.gwg.label}): <b className="text-white">{n.gwg.min}–{n.gwg.max} كغ</b> (معهد الطب الأمريكي 2009).</p>
          )}
          {!!n.notes.length && (
            <ul className="gym-list gym-small">
              {n.notes.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
          <p className="gym-small">أقل من {n.saltG} غ ملح، والسكر المضاف أقل من {n.sugarG} غ باليوم (منظمة الصحة العالمية). أكثر أكلك أطعمة كاملة: لحم وسمك وبيض وألبان وبقوليات وحبوب كاملة وخضار وفواكه.</p>
        </div>
      )}

      {plan.food && n && (
        <FoodGuide
          t={{
            kcal: plan.food.kcal,
            proteinG: plan.food.proteinG,
            carbG: macrosOf(plan.food, plan.profile).carbG,
            fatG: macrosOf(plan.food, plan.profile).fatG,
            fiberG: n.fiberG,
            meals: plan.profile.meals,
            sex: plan.profile.sex === "female" ? "female" : "male",
          }}
        />
      )}

      {w && w.blocked && (
        <div className="gym-card stop space-y-2">
          <b>🩺 جدول التمارين متوقف</b>
          <p className="gym-small">{w.blocked}</p>
          <p className="gym-small">المشي الخفيف وتمارين قاع الحوض غالبًا مسموحة، بس خذي رأي طبيبتك أول.</p>
        </div>
      )}

      {w && !w.blocked && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="gym-eyebrow">🏋️ جدول التمارين · {SPLIT_NAMES[w.split]}</span>
            <button type="button" className={`gym-btn sm ${edit ? "" : "ghost"}`} onClick={() => setEdit(!edit)}>
              {edit ? "✓ خلصت التعديل" : "✏️ عدّل الجدول"}
            </button>
          </div>
          {w.days.map((d) => (
            <DayCard key={d.weekday} plan={plan} day={d} save={save} editable={edit} onRemove={() => saveDays(plan, save, w.days.filter((x) => x.weekday !== d.weekday))} />
          ))}
          {edit && w.days.length < 7 && (
            <button
              type="button"
              className="gym-btn ghost w-full"
              onClick={() => {
                const id = [0, 1, 2, 3, 4, 5, 6].find((x) => !w.days.some((d) => d.weekday === x))!;
                saveDays(plan, save, [...w.days, buildDayFrom(plan.profile, id, [gentle(plan.profile) ? "gentle" : "full"], 0, w.days[0]?.cardioMin ?? 0)]);
              }}
            >
              ➕ أضف يوم تمرين ({dayLabel(w.days.length)})
            </button>
          )}
          <div className="gym-card space-y-2">
            <b>📊 مجموعاتك الأسبوعية لكل عضلة</b>
            <div className="gym-chips">
              {(Object.entries(vol) as [keyof typeof MUSCLE_NAMES, number][]).map(([m, s]) => (
                <span key={m} className="gym-chip" aria-pressed={s >= 10}>{MUSCLE_NAMES[m]}: {s}</span>
              ))}
            </div>
            <p className="gym-small">الأخضر = 10 مجموعات أو أكثر بالأسبوع (أفضل نمو حسب التحليلات). المبتدئ يبدأ أقل ويزيد شوي شوي.</p>
          </div>
          <ul className="gym-list gym-small">
            {w.notes.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="gym-card hot space-y-2 text-center">
        <b className="text-lg">جاهز تبدأ؟</b>
        <p className="gym-small">خلّ الخطة تصير عادات يومية في «لأجل المهدي» وتتابعها وتشوف نسبتك كل يوم.</p>
        <button type="button" className="gym-btn orange" onClick={onHabits}>➕ أدخلها في عاداتي</button>
      </div>
      <Disclaimer />
    </section>
  );
}

export function ToHabits({ plan, projects, back, apply }: { plan: HealthPlan; projects: { id: string; name: string; icon: string }[]; back: () => void; apply: (b: { gym: GymWay | null; food: FoodHabit[]; where: string; projectId?: string }) => Promise<string | null> }) {
  const hasGym = !!plan.workout && !plan.workout.blocked && plan.workout.days.length > 0;
  const foodList = foodHabitsFor(plan);
  const [gym, setGym] = useState<GymWay | null>(hasGym ? "days" : null);
  const [food, setFood] = useState<FoodHabit[]>(foodList.filter((x) => x.on).map((x) => x.id));
  const [where, setWhere] = useState<"one" | "two" | "existing">("one");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const preview = habitsFor(plan, gym, food);

  if (done)
    return (
      <section className="gym-card hot space-y-3 text-center">
        <p className="text-5xl">🏆</p>
        <h2 className="gym-title">صارت <em>عاداتك</em>!</h2>
        <p className="gym-small">كل يوم افتح «لأجل المهدي» وأشّر على اللي سويته. الاستمرار أهم من الكمال.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={`/mahdi/projects/${done}`} className="gym-btn">افتح المشروع</Link>
          <Link href="/mahdi" className="gym-btn ghost">يومي</Link>
        </div>
      </section>
    );

  return (
    <section className="space-y-4">
      <h2 className="gym-title">كيف تدخل الخطة في عاداتك؟</h2>
      {hasGym && (
        <div className="space-y-2">
          <span className="gym-eyebrow">🏋️ التمارين</span>
          <div className="gym-choices">
            {GYM_WAYS.map((g) => (
              <Choice key={g.id} on={gym === g.id} onClick={() => setGym(g.id)} title={g.title} hint={g.hint} />
            ))}
            <Choice on={gym === null} onClick={() => setGym(null)} title="بدون" hint="ما أبي التمارين في العادات" />
          </div>
        </div>
      )}
      <div className="gym-card space-y-1">
        <span className="gym-eyebrow">🥗 التغذية والحركة</span>
        {foodList.map((f) => (
          <label key={f.id} className="gym-check">
            <input type="checkbox" checked={food.includes(f.id)} onChange={(e) => setFood(e.target.checked ? [...food, f.id] : food.filter((x) => x !== f.id))} />
            <span>{f.label}</span>
          </label>
        ))}
      </div>
      <div className="space-y-2">
        <span className="gym-eyebrow">📁 وين تنحط؟</span>
        <div className="gym-choices">
          <Choice on={where === "one"} onClick={() => setWhere("one")} big="💪" title="مشروع «الصحة العلوية»" hint="مشروع جديد خاص فيها كلها" />
          <Choice on={where === "two"} onClick={() => setWhere("two")} big="🏋️🥗" title="مشروعين" hint="«الجيم» و«التغذية» كل واحد لحاله" />
          {projects.length > 0 && <Choice on={where === "existing"} onClick={() => setWhere("existing")} big="📂" title="مشروع عندي" hint="داخل مشروع موجود" />}
        </div>
        {where === "existing" && (
          <select className="gym-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((x) => (
              <option key={x.id} value={x.id}>{x.icon} {x.name}</option>
            ))}
          </select>
        )}
      </div>
      <div className="gym-card space-y-2">
        <b>راح ننشئ {preview.length} عادة:</b>
        <ul className="gym-list gym-small">
          {preview.slice(0, 30).map((h) => (
            <li key={h.key}>
              {h.icon} {h.name} — {h.key.startsWith("day-") ? "مرة بالأسبوع، أي يوم" : h.freq === "weekly" ? (h.unit ? `${h.target} ${h.unit} بالأسبوع` : h.target === 1 ? "مرة بالأسبوع" : `${arNum(h.target)} مرات بالأسبوع`) : "كل يوم"}
              {h.measure !== "check" && h.freq !== "weekly" ? ` · ${h.target}${h.unit ? ` ${h.unit}` : h.group === "gym" ? " مجموعات" : ""}` : ""}
            </li>
          ))}
        </ul>
      </div>
      <Nav
        back={back}
        next={
          busy || !preview.length
            ? undefined
            : async () => {
                setBusy(true);
                const id = await apply({ gym, food, where, projectId: where === "existing" ? projectId : undefined });
                setBusy(false);
                if (id) setDone(id);
              }
        }
        nextLabel={busy ? "لحظة…" : "✓ أضف العادات"}
      />
    </section>
  );
}
