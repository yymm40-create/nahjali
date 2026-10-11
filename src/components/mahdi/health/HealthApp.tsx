"use client";

// «الصحة العلوية»: the gym and the nutrition plan of «لأجل المهدي». The person enters who they are and what they want
// (gym only, nutrition only, or both), picks a complete ready plan or builds it with us one step at a time, and then
// chooses how it goes into their habits (by days, by exercises or weekly, plus the nutrition habits) in a project of
// its own. Everything is computed on the device from the research (no AI, no cost); the plan is saved to the account.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMahdi } from "@/components/mahdi/Provider";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import {
  DEFAULT_PROFILE,
  EXERCISES,
  FOCUS,
  GYM_WAYS,
  LABELS,
  MUSCLE_NAMES,
  RED_FLAGS,
  SPLIT_NAMES,
  WEEKDAYS,
  bmiOf,
  candidates,
  dose,
  exerciseById,
  foodHabitsFor,
  gentle,
  habitsFor,
  makePlan,
  nutrition,
  trimester,
  weeklySets,
  type FoodHabit,
  type GymWay,
  type HealthPlan,
  type HealthProfile,
  type PlanDay,
} from "@/lib/mahdi/health/plan";
import RobotFace from "@/components/RobotFace";
import "./health.css";

/** «عباس سبع القنطرة»: the coach of «الصحة العلوية»; a word on every screen (to a man or to a woman). */
const COACH = "عباس سبع القنطرة";
function coachLine(screen: Screen, f: boolean, preg: boolean): string {
  const g = (m: string, w: string) => (f ? w : m);
  switch (screen) {
    case "track":
      return g("وش ناوي عليه يا بطل؟ اختر وأنا معك للآخر 💪", "وش ناوية عليه يا بطلة؟ اختاري وأنا معك للآخر 💪");
    case "about":
      return g("عطني أرقامك بصدق، الخطة تنحسب عليها بالضبط.", "عطيني أرقامك بصدق، الخطة تنحسب عليها بالضبط.");
    case "goal":
      return preg ? "في الحمل هدفنا صحتك وصحة الجنين، مو الرجيم. نختار الهدف ونمشي بهدوء." : g("الهدف الواضح نص الطريق. وش تبي توصل له؟", "الهدف الواضح نص الطريق. وش تبين توصلين له؟");
    case "train":
      return preg ? "سلامتك أولًا: جاوبي على أسئلة الطبيبة بصدق، والجدول يكون خفيف وآمن." : g("الالتزام أهم من كثرة الأيام: اختر الأيام اللي تقدر تثبت عليها.", "الالتزام أهم من كثرة الأيام: اختاري الأيام اللي تقدرين تثبتين عليها.");
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

function Coach({ line }: { line: string }) {
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

type Screen = "home" | "track" | "about" | "goal" | "train" | "mode" | "build-food" | "build-day" | "plan" | "habits";
const WIZARD: Screen[] = ["track", "about", "goal", "train", "mode"];

const keyOf = (uid: string) => `mahdi-health:${uid}`;
const readLocal = (uid: string): HealthPlan | null => {
  try {
    return JSON.parse(localStorage.getItem(keyOf(uid)) ?? "null") as HealthPlan | null;
  } catch {
    return null;
  }
};
const writeLocal = (uid: string, p: HealthPlan | null) => {
  try {
    if (p) localStorage.setItem(keyOf(uid), JSON.stringify(p));
    else localStorage.removeItem(keyOf(uid));
  } catch {
    /* private window */
  }
};

function Barbell() {
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

function Choice({ on, onClick, big, title, hint }: { on: boolean; onClick: () => void; big?: string; title: string; hint?: string }) {
  return (
    <button type="button" className="gym-choice" aria-pressed={on} onClick={onClick}>
      {big && <span className="big">{big}</span>}
      <b>{title}</b>
      {hint && <span>{hint}</span>}
    </button>
  );
}

function Stepper({ label, value, set, step = 1, min, max, unit }: { label: string; value: number; set: (n: number) => void; step?: number; min: number; max: number; unit?: string }) {
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
  const { state, store, toast } = useMahdi();
  const uid = state.snap.profile.userId;
  const [plan, setPlan] = useState<HealthPlan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [p, setP] = useState<HealthProfile>(DEFAULT_PROFILE);
  const [dayIdx, setDayIdx] = useState(0);
  const [foodIdx, setFoodIdx] = useState(0);
  const saveTimer = useRef<number | null>(null);
  const top = useRef<HTMLDivElement>(null);

  // the saved plan: on the device at once, then the account's copy
  useEffect(() => {
    const local = readLocal(uid);
    let live = true;
    mahdiFetch<{ ready: boolean; plan: HealthPlan | null }>("/api/mahdi/health")
      .then((r) => {
        if (!live) return;
        const best = r.plan && (!local || r.plan.savedAt >= local.savedAt) ? r.plan : local;
        setPlan(best);
        if (best) setP(best.profile);
      })
      .catch(() => {
        if (!live) return;
        setPlan(local);
        if (local) setP(local.profile);
      })
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [uid]);

  const go = (s: Screen) => {
    setScreen(s);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const save = (next: HealthPlan) => {
    const stamped = { ...next, savedAt: new Date().toISOString() };
    setPlan(stamped);
    writeLocal(uid, stamped);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      mahdiFetch("/api/mahdi/health", { method: "PUT", json: { plan: stamped } }).catch(() => {});
    }, 800);
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

  if (!loaded) return <div className="gym grid place-items-center"><p className="gym-dim">لحظة… 🏋️</p></div>;

  const wizardAt = WIZARD.indexOf(screen);

  return (
    <div className="gym space-y-4" dir="rtl" ref={top}>
      {wizardAt >= 0 && (
        <div className="gym-bar" aria-label={`الخطوة ${wizardAt + 1} من ${WIZARD.length}`}>
          <b className="on" />
          {WIZARD.map((s, i) => (
            <i key={s} className={i <= wizardAt ? "on" : ""} />
          ))}
          <b className={wizardAt === WIZARD.length - 1 ? "on" : ""} />
        </div>
      )}

      {screen !== "home" && <Coach line={coachLine(screen, female, preg)} />}

      {screen === "home" && (
        <>
          <section className="gym-hero space-y-3">
            <Barbell />
            <span className="gym-eyebrow">🏋️ الصحة العلوية</span>
            <h1 className="gym-title">
              جسمك <em>أمانة</em>،<br />خلّه قوي.
            </h1>
            <p className="gym-small max-w-md">جدول جيم ونظام تغذية مبني على توصيات منظمة الصحة العالمية والكليات الطبية والمجلات العالمية، للرجل والمرأة، الحامل وغير الحامل. وبعدها يدخل في عاداتك ويتابع معك كل يوم.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="gym-btn" onClick={() => go("track")}>
                {plan ? "خطة جديدة" : "يلا نبدأ 💪"}
              </button>
              <Link href="/mahdi/health/research" className="gym-btn ghost">
                📚 البحث والمصادر
              </Link>
            </div>
          </section>

          <section className="gym-card flex items-start gap-3">
            <RobotFace id="sabaa" size={64} />
            <div className="space-y-1">
              <b className="text-lg font-black">هلا! أنا {COACH} 🦁</b>
              <p className="gym-small">مدربك في «الصحة العلوية». أسوي لك جدول تمارين ونظام تغذية على مقاسك من توصيات المنظمات الطبية العالمية، للرجل والمرأة والحامل والمرضعة، وأدخله في عاداتك عشان تتابعه كل يوم. ما أبي منك إلا الالتزام!</p>
            </div>
          </section>

          {plan && <PlanSummary plan={plan} onOpen={() => go("plan")} onHabits={() => go("habits")} onEdit={() => go("track")} />}
          <Disclaimer />
        </>
      )}

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
          <h2 className="gym-title">وش هدفك؟</h2>
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
              <Choice key={g} on={p.goal === g} onClick={() => set("goal", g)} big={icon} title={LABELS.goal[g]} hint={hint} />
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
            <Choice on={p.place === "gym"} onClick={() => set("place", "gym")} big="🏟️" title="في النادي" hint="أجهزة وأوزان حرة" />
            <Choice on={p.place === "home"} onClick={() => set("place", "home")} big="🏠" title="في البيت" hint="دمبلز ومطاط ووزن الجسم" />
          </div>
          <div className="gym-field">
            <span>أيام التمرين ({p.days.length} بالأسبوع)</span>
            <div className="gym-chips">
              {WEEKDAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  className="gym-chip"
                  aria-pressed={p.days.includes(i)}
                  onClick={() => set("days", p.days.includes(i) ? (p.days.length > 1 ? p.days.filter((x) => x !== i) : p.days) : [...p.days, i].sort())}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="gym-small">التوصية: كل عضلات الجسم يومين على الأقل بالأسبوع. المبتدئ 2–3 أيام كفاية.</p>
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
            <Choice on={false} onClick={() => start("ready")} big="🚀" title="جدول جاهز كامل" hint="نعطيك الخطة كاملة مرة وحدة، وتقدر تعدّل عليها" />
            <Choice on={false} onClick={() => start("steps")} big="🧱" title="نبنيه مع بعض شوي شوي" hint="نمشي خطوة خطوة: كل هدف غذائي وكل يوم تمرين، وتختار وتعدّل" />
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
          <h2 className="gym-title">{WEEKDAYS[plan.workout.days[dayIdx].weekday]}: {FOCUS[plan.workout.days[dayIdx].focus].name}</h2>
          <p className="gym-small">هذي التمارين المقترحة. بدّل أي تمرين (🔄)، احذفه، غيّر المجموعات، أو أضف تمرين من تحت.</p>
          <DayCard plan={plan} day={plan.workout.days[dayIdx]} save={save} editable />
          <Nav
            back={() => (dayIdx ? setDayIdx(dayIdx - 1) : plan.food ? (setFoodIdx(FOOD_STEPS.length - 1), go("build-food")) : go("mode"))}
            next={() => (dayIdx < plan.workout!.days.length - 1 ? setDayIdx(dayIdx + 1) : go("plan"))}
            nextLabel={dayIdx < plan.workout.days.length - 1 ? "اعتمد اليوم ←" : "اعتمد الجدول ✓"}
          />
        </section>
      )}

      {screen === "plan" && plan && <PlanView plan={plan} save={save} onHabits={() => go("habits")} onHome={() => go("home")} />}

      {screen === "habits" && plan && (
        <ToHabits
          plan={plan}
          projects={state.snap.projects.filter((x) => !x.archivedAt)}
          back={() => go("plan")}
          apply={async (body) => {
            try {
              const r = await store.mutate<{ made: number; projectId: string }>("/api/mahdi/health/apply", "POST", { plan, ...body });
              toast(`تمت إضافة ${r.made} عادة 💪`);
              return r.projectId;
            } catch (e) {
              toast((e as Error).message);
              return null;
            }
          }}
        />
      )}
    </div>
  );
}

function Nav({ back, next, nextLabel = "التالي ←" }: { back?: () => void; next?: () => void; nextLabel?: string }) {
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

function Disclaimer() {
  return <p className="gym-small text-center">هذي توصيات عامة للأصحاء من المصادر العالمية، ما تغني عن طبيبك. عندك مرض أو إصابة أو حمل؟ استشر طبيبك قبل ما تبدأ.</p>;
}

function PlanSummary({ plan, onOpen, onHabits, onEdit }: { plan: HealthPlan; onOpen: () => void; onHabits: () => void; onEdit: () => void }) {
  const w = plan.workout;
  return (
    <section className="gym-card hot space-y-3">
      <div className="flex items-center justify-between">
        <span className="gym-eyebrow">خطتي</span>
        <span className="gym-small">{LABELS.track[plan.profile.track]} · {LABELS.goal[plan.profile.goal]}</span>
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
          <div className="gym-stat"><b>{Math.round((f.kcal * (plan.profile.goal === "muscle" ? 0.25 : 0.3)) / 9)}</b><span>غ دهون تقريبًا</span></div>
          <div className="gym-stat"><b>{n.fiberG}</b><span>غ ألياف</span></div>
          <div className="gym-stat orange"><b>&lt;{n.sugarG}</b><span>غ سكر مضاف</span></div>
          <div className="gym-stat orange"><b>&lt;{n.saltG}</b><span>غ ملح</span></div>
        </div>
      )}
      <Nav back={back} next={next} nextLabel="اعتمد ←" />
    </section>
  );
}

function DayCard({ plan, day, save, editable }: { plan: HealthPlan; day: PlanDay; save: (p: HealthPlan) => void; editable?: boolean }) {
  const [adding, setAdding] = useState("");
  const w = plan.workout!;
  const p = plan.profile;
  const setDay = (d: PlanDay) => save({ ...plan, workout: { ...w, days: w.days.map((x) => (x.weekday === d.weekday ? d : x)) } });
  const pool = EXERCISES.filter((e) => (p.place === "gym" ? e.gym : e.home) && (!gentle(p) || e.preg) && !day.items.some((i) => i.exId === e.id));
  return (
    <article className="gym-day">
      <header>
        <h3>{WEEKDAYS[day.weekday]}</h3>
        <span className="tag">{FOCUS[day.focus].name}</span>
      </header>
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
                <button type="button" className="gym-icon-btn" aria-label="مجموعات أقل" onClick={() => setDay({ ...day, items: day.items.map((x) => (x.exId === it.exId ? { ...x, sets: Math.max(1, x.sets - 1) } : x)) })}>−</button>
                <button type="button" className="gym-icon-btn" aria-label="مجموعات أكثر" onClick={() => setDay({ ...day, items: day.items.map((x) => (x.exId === it.exId ? { ...x, sets: Math.min(10, x.sets + 1) } : x)) })}>+</button>
                <button
                  type="button"
                  className="gym-icon-btn"
                  aria-label="بدّل التمرين"
                  title="بدّل بتمرين ثاني لنفس العضلة"
                  onClick={() => {
                    const alts = candidates(ex.muscle, p).filter((e) => e.id === it.exId || !day.items.some((x) => x.exId === e.id));
                    const next = alts[(alts.findIndex((e) => e.id === it.exId) + 1) % alts.length];
                    if (next && next.id !== it.exId) setDay({ ...day, items: day.items.map((x) => (x.exId === it.exId ? { exId: next.id, ...dose(next, p) } : x)) });
                  }}
                >
                  🔄
                </button>
                <button type="button" className="gym-icon-btn" aria-label="احذف" onClick={() => setDay({ ...day, items: day.items.filter((x) => x.exId !== it.exId) })}>✕</button>
              </span>
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
        <div className="flex gap-2 p-3">
          <select className="gym-select" value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="أضف تمرين">
            <option value="">➕ أضف تمرين…</option>
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
          <button
            type="button"
            className="gym-btn sm"
            disabled={!adding}
            onClick={() => {
              const ex = exerciseById(adding);
              if (ex) setDay({ ...day, items: [...day.items, { exId: ex.id, ...dose(ex, p) }] });
              setAdding("");
            }}
          >
            أضف
          </button>
        </div>
      )}
    </article>
  );
}

function PlanView({ plan, save, onHabits, onHome }: { plan: HealthPlan; save: (p: HealthPlan) => void; onHabits: () => void; onHome: () => void }) {
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
            <div className="gym-stat"><b>{Math.round((plan.food.kcal * (plan.profile.goal === "muscle" || plan.profile.goal === "strength" ? 0.25 : 0.3)) / 9)}</b><span>غ دهون</span></div>
            <div className="gym-stat"><b>{Math.max(0, Math.round((plan.food.kcal - plan.food.proteinG * 4 - Math.round((plan.food.kcal * (plan.profile.goal === "muscle" || plan.profile.goal === "strength" ? 0.25 : 0.3)) / 9) * 9) / 4))}</b><span>غ كربوهيدرات</span></div>
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
            <DayCard key={d.weekday} plan={plan} day={d} save={save} editable={edit} />
          ))}
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

function ToHabits({ plan, projects, back, apply }: { plan: HealthPlan; projects: { id: string; name: string; icon: string }[]; back: () => void; apply: (b: { gym: GymWay | null; food: FoodHabit[]; where: string; projectId?: string }) => Promise<string | null> }) {
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
              {h.icon} {h.name}{h.key.startsWith("day-") ? "" : " — "}{h.key.startsWith("day-") ? "" : h.freq === "weekly" ? `${h.target}${h.unit ? ` ${h.unit}` : " أيام"} بالأسبوع` : h.freq === "days" ? (h.key.startsWith("day-") ? "يومه" : h.days.map((d) => WEEKDAYS[d]).join("، ")) : "كل يوم"}
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
