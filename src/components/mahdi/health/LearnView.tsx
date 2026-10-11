"use client";

// «تعلّم» in «الصحة العلوية»: the muscles of the gym in plain words (on a body map), and every exercise with how to do
// it right — the muscles it works, the steps, the common mistakes, the breathing — plus the person's own record in it.

import Link from "next/link";
import { useMemo, useState } from "react";
import { GROUPS, GUIDE, MUSCLES, muscleInfo, type MuscleGroup } from "@config/mahdi/exercise-guide";
import { EXERCISES, MUSCLE_NAMES, candidates, exerciseById, type Muscle } from "@/lib/mahdi/health/plan";
import { history, record } from "@/lib/mahdi/health/tracker";
import BodyMap from "./BodyMap";
import { useHealth } from "./HealthProvider";

const where = (e: (typeof EXERCISES)[number]) => [e.gym && !e.body && "🏟️ جيم", e.home && !e.body && "🏠 جيم بيتي", e.body && "🤸 بدون أدوات"].filter(Boolean).join(" · ");

export function LearnView() {
  const { plan } = useHealth();
  const [sel, setSel] = useState<string>("lats");
  const [q, setQ] = useState("");
  const m = muscleInfo(sel);
  const inPlan = useMemo(() => new Set(plan?.workout?.days.flatMap((d) => d.items.map((i) => i.exId)) ?? []), [plan]);
  const trains = EXERCISES.filter((e) => GUIDE[e.id]?.primary.includes(sel));
  const list = EXERCISES.filter((e) => !q.trim() || e.name.includes(q.trim()) || MUSCLE_NAMES[e.muscle].includes(q.trim()));

  return (
    <div className="space-y-4">
      <section className="gym-hero space-y-2">
        <span className="gym-eyebrow">🧠 تعلّم</span>
        <h1 className="gym-title">
          اعرف <em>عضلاتك</em>
        </h1>
        <p className="gym-small">اضغط على أي عضلة تحت وتعرف وش هي ووينها ووش تسوي لك، وأي تمارين تقويها. وكل تمرين له صفحة تشرح التكنيك الصحيح خطوة خطوة.</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-[1fr_1.2fr]">
        <BodyMap main={[sel]} />
        {m && (
          <div className="gym-card hot space-y-2">
            <span className="gym-eyebrow">{GROUPS[m.group].icon} {GROUPS[m.group].name}</span>
            <h2 className="text-xl font-black">{m.name}</h2>
            <small className="gym-small" dir="ltr">{m.aka}</small>
            <p className="text-sm leading-7"><b>وينها؟</b> {m.where}</p>
            <p className="text-sm leading-7"><b>وش تسوي لك؟</b> {m.does}</p>
            <p className="gym-small">💡 {m.tip}</p>
            {trains.length > 0 && (
              <div className="gym-chips">
                {trains.map((e) => (
                  <Link key={e.id} href={`/mahdi/health/learn/${e.id}`} className="gym-chip">
                    {e.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {(Object.keys(GROUPS) as MuscleGroup[]).map((g) => (
        <section key={g} className="gym-card space-y-2">
          <h2 className="text-lg font-black">
            {GROUPS[g].icon} {GROUPS[g].name}
          </h2>
          <p className="gym-small">{GROUPS[g].intro}</p>
          <div className="gym-chips">
            {MUSCLES.filter((x) => x.group === g).map((x) => (
              <button key={x.id} type="button" className="gym-chip" aria-pressed={sel === x.id} onClick={() => (setSel(x.id), window.scrollTo({ top: 0, behavior: "smooth" }))}>
                {x.name}
              </button>
            ))}
          </div>
        </section>
      ))}

      <section className="space-y-2">
        <h2 className="gym-title text-2xl">
          كل <em>التمارين</em>
        </h2>
        <input className="gym-input" placeholder="🔎 ابحث عن تمرين أو عضلة…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="gym-list-ex">
          {list.map((e) => (
            <Link key={e.id} href={`/mahdi/health/learn/${e.id}`}>
              <b>{e.name}</b>
              <small>
                {MUSCLE_NAMES[e.muscle]} · {where(e)}
                {e.preg ? " · 🤰 آمن للحامل" : ""}
              </small>
              {inPlan.has(e.id) && <span className="tag">في خطتك</span>}
            </Link>
          ))}
        </div>
      </section>
      <Link href="/mahdi/health/research" className="gym-btn ghost w-full">📚 البحث والمصادر العالمية</Link>
    </div>
  );
}

export function ExerciseView({ id }: { id: string }) {
  const { plan, days } = useHealth();
  const ex = exerciseById(id);
  const g = GUIDE[id];
  const all = useMemo(() => Object.values(days), [days]);
  if (!ex || !g)
    return (
      <p className="gym-card">
        ما لقيت هالتمرين. <Link href="/mahdi/health/learn" className="underline">ارجع للتمارين</Link>
      </p>
    );
  const pr = record(all, id);
  const h = history(all, id);
  const alts = (plan ? candidates(ex.muscle as Muscle, plan.profile) : EXERCISES.filter((e) => e.muscle === ex.muscle)).filter((e) => e.id !== id);
  return (
    <div className="space-y-4">
      <Link href="/mahdi/health/learn" className="gym-btn ghost sm">→ كل التمارين</Link>
      <section className="gym-card hot space-y-2">
        <span className="gym-eyebrow">{MUSCLE_NAMES[ex.muscle]}</span>
        <h1 className="gym-title">{ex.name}</h1>
        <p className="gym-small">
          {where(ex)}
          {ex.preg ? " · 🤰 مناسب للحامل" : " · ⚠️ مو مناسب في الحمل"}
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-[1fr_1.2fr]">
        <BodyMap main={g.primary} help={g.secondary} />
        <div className="gym-card space-y-2">
          <b>العضلات اللي يشغّلها</b>
          {[...g.primary.map((x) => [x, true] as const), ...g.secondary.map((x) => [x, false] as const)].map(([x, main]) => {
            const info = muscleInfo(x);
            return info ? (
              <p key={x} className="text-sm leading-7">
                <span className={main ? "text-[#c6ff1a]" : "text-[#ff7a1a]"}>●</span> <b>{info.name}</b> {main ? "(أساسية)" : "(مساعدة)"} — {info.does}
              </p>
            ) : null;
          })}
        </div>
      </div>

      <section className="gym-card space-y-2">
        <h2 className="text-lg font-black">🎓 الطريقة الصحيحة</h2>
        <ol className="gym-steps">
          {g.steps.map((s, i) => (
            <li key={s}>
              <b>{i + 1}</b>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <p className="gym-small">🫁 التنفس: {g.breath}</p>
        <p className="gym-small">🎯 تذكّر: {ex.cue}</p>
      </section>

      <section className="gym-card warn space-y-1">
        <h2 className="font-black">🚫 أخطاء شائعة</h2>
        <ul className="gym-list text-sm">
          {g.mistakes.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      {(pr || h.length > 0) && (
        <section className="gym-card space-y-1">
          <h2 className="font-black">📈 أنت في هالتمرين</h2>
          {pr && (
            <p className="text-sm">
              🏆 أفضل مجموعة: <b dir="ltr">{pr.kg ? `${pr.kg} كغ × ${pr.reps}` : `${pr.reps} تكرار`}</b>
            </p>
          )}
          <p className="gym-small">سجّلته {h.length} مرة. <Link href={`/mahdi/health/progress?ex=${id}`} className="underline">شوف الرسم البياني</Link></p>
        </section>
      )}

      {alts.length > 0 && (
        <section className="space-y-2">
          <b>بدائل لنفس العضلة</b>
          <div className="gym-chips">
            {alts.map((e) => (
              <Link key={e.id} href={`/mahdi/health/learn/${e.id}`} className="gym-chip">
                {e.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
