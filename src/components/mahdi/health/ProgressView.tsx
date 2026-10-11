"use client";

// «التقدم» in «الصحة العلوية»: what the tracker shows over time — the week (workouts, sets, cardio), the hard sets
// every muscle got this week against the research's 10, each exercise's strength over time (best set and estimated
// max), the body weight, and how close the days came to the nutrition targets.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { GROUPS, MUSCLES, type MuscleGroup } from "@config/mahdi/exercise-guide";
import { exerciseById } from "@/lib/mahdi/health/plan";
import { history, record, setsByMuscle, weekOf, WEEK_TARGET, FOOD_KEYS, type FoodKey } from "@/lib/mahdi/health/tracker";
import { useHealth } from "./HealthProvider";

function Line({ points, unit }: { points: { x: string; y: number }[]; unit: string }) {
  if (points.length < 2) return <p className="gym-small">سجّل مرتين على الأقل وتطلع لك الرسمة.</p>;
  const W = 320;
  const H = 130;
  const ys = points.map((p) => p.y);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const span = hi - lo || 1;
  const xy = points.map((p, i) => [16 + (i * (W - 32)) / (points.length - 1), H - 22 - ((p.y - lo) / span) * (H - 44)] as const);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`من ${lo} إلى ${hi} ${unit}`}>
      <path d={xy.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ")} fill="none" stroke="#c6ff1a" strokeWidth="2.5" strokeLinejoin="round" />
      <path d={`${xy.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ")} L${xy[xy.length - 1][0]},${H - 18} L${xy[0][0]},${H - 18} Z`} fill="rgba(198,255,26,0.1)" />
      {xy.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.5" fill="#0c0e11" stroke="#c6ff1a" strokeWidth="2" />
      ))}
      <text x={xy[xy.length - 1][0]} y={xy[xy.length - 1][1] - 8} fill="#f3f4f1" fontSize="11" fontWeight="800" textAnchor="middle">
        {points[points.length - 1].y}
      </text>
      <text x="16" y={H - 4} fill="#9aa3ad" fontSize="9">{points[0].x.slice(5)}</text>
      <text x={W - 16} y={H - 4} fill="#9aa3ad" fontSize="9" textAnchor="end">{points[points.length - 1].x.slice(5)}</text>
    </svg>
  );
}

const FOOD_NAMES: Record<FoodKey, string> = { kcal: "🔥 السعرات", proteinG: "🥩 البروتين", waterCups: "💧 الماء", produce: "🥗 خضار وفواكه", steps: "👟 الخطوات" };
const FOOD_LINKS: Record<FoodKey, string> = { kcal: "kcal", proteinG: "protein", waterCups: "water", produce: "produce", steps: "steps" };

export default function ProgressView() {
  const { plan, days, today, habitValue } = useHealth();
  const params = useSearchParams();
  const all = useMemo(() => Object.values(days).sort((a, b) => a.date.localeCompare(b.date)), [days]);
  const logged = useMemo(() => [...new Set(all.flatMap((d) => Object.keys(d.sets)))].filter((id) => exerciseById(id)), [all]);
  const [ex, setEx] = useState<string>(() => params.get("ex") ?? "");
  const shown = ex && logged.includes(ex) ? ex : logged[0] ?? "";

  const week = weekOf(today);
  const weekDays = all.filter((d) => week.includes(d.date));
  const workouts = weekDays.filter((d) => d.done || Object.keys(d.sets).length).length;
  const sets = weekDays.reduce((t, d) => t + Object.values(d.sets).reduce((u, s) => u + s.filter((x) => x.reps > 0).length, 0), 0);
  const cardio = weekDays.reduce((t, d) => t + d.cardioMin, 0);
  const perMuscle = setsByMuscle(weekDays);
  const h = shown ? history(all, shown) : [];
  const pr = shown ? record(all, shown) : null;
  const weighted = h.some((p) => p.best.kg > 0);
  const weights = all.filter((d) => d.bodyKg).map((d) => ({ x: d.date, y: d.bodyKg! }));

  if (!plan) return <p className="gym-card">سوّ خطتك أول، وبعدها تسجّل وتشوف تقدمك هنا. <Link href="/mahdi/health/setup" className="underline">يلا نبدأ</Link></p>;

  return (
    <div className="space-y-4">
      <h1 className="gym-title">
        تقدمك <em>📈</em>
      </h1>

      <section className="gym-stats">
        <div className="gym-stat"><b>{workouts}/{plan.workout?.days.length ?? 0}</b><span>تمارين هالأسبوع</span></div>
        <div className="gym-stat"><b>{sets}</b><span>مجموعة</span></div>
        <div className="gym-stat orange"><b>{cardio}</b><span>دقيقة كارديو</span></div>
      </section>

      <section className="gym-card space-y-3">
        <div>
          <h2 className="text-lg font-black">💪 مجموعات كل عضلة (آخر 7 أيام)</h2>
          <p className="gym-small">الهدف حسب الأبحاث: {WEEK_TARGET} مجموعات أو أكثر للعضلة بالأسبوع لأفضل نمو (المساعدة تنحسب نص).</p>
        </div>
        {(Object.keys(GROUPS) as MuscleGroup[]).map((g) => {
          const list = MUSCLES.filter((m) => m.group === g && m.id !== "pelvic");
          return (
            <div key={g} className="space-y-1.5">
              <b className="text-sm">{GROUPS[g].icon} {GROUPS[g].name}</b>
              {list.map((m) => {
                const v = Math.round((perMuscle[m.id] ?? 0) * 10) / 10;
                return (
                  <div key={m.id} className="gym-mbar">
                    <span>{m.name}</span>
                    <div aria-hidden>
                      <i style={{ width: `${Math.min(100, (v / WEEK_TARGET) * 100)}%` }} className={v >= WEEK_TARGET ? "full" : ""} />
                    </div>
                    <b>{v}</b>
                  </div>
                );
              })}
            </div>
          );
        })}
      </section>

      <section className="gym-card space-y-3">
        <h2 className="text-lg font-black">🏋️ قوتك في كل تمرين</h2>
        {logged.length ? (
          <>
            <select className="gym-select" value={shown} onChange={(e) => setEx(e.target.value)} aria-label="التمرين">
              {logged.map((id) => (
                <option key={id} value={id}>{exerciseById(id)?.name}</option>
              ))}
            </select>
            <Line points={h.map((p) => ({ x: p.date, y: weighted ? p.e1rm : p.best.reps }))} unit={weighted ? "كغ" : "تكرار"} />
            <p className="gym-small">{weighted ? "الرسمة = أقصى وزن تقدر ترفعه مرة وحدة (تقدير من أفضل مجموعة)." : "الرسمة = أكثر تكرار في مجموعة."}</p>
            {pr && <p className="text-sm">🏆 رقمك القياسي: <b dir="ltr">{pr.kg ? `${pr.kg} كغ × ${pr.reps}` : `${pr.reps} تكرار`}</b></p>}
            <div className="gym-hist">
              {h.slice(-6).reverse().map((p) => (
                <div key={p.date}>
                  <span>{p.date.slice(5)}</span>
                  <b dir="ltr">{p.best.kg ? `${p.best.kg}×${p.best.reps}` : `${p.best.reps}`}</b>
                  <small>{p.sets} مجموعات</small>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="gym-small">للحين ما سجّلت أوزان. افتح «اليوم» وسجّل مجموعاتك وتطلع لك الرسمات هنا.</p>
        )}
      </section>

      <section className="gym-card space-y-2">
        <h2 className="text-lg font-black">⚖️ وزن جسمك</h2>
        <Line points={weights.map((p) => ({ x: p.x, y: p.y }))} unit="كغ" />
      </section>

      <section className="gym-card space-y-2">
        <h2 className="text-lg font-black">🥗 التغذية (آخر 7 أيام)</h2>
        {FOOD_KEYS.filter((k) => plan.food?.[k]).map((k) => {
          const target = plan.food![k];
          const vals = week.map((d) => habitValue(FOOD_LINKS[k], d) ?? days[d]?.food[k] ?? 0);
          const hit = vals.filter((v) => v >= target).length;
          return (
            <div key={k} className="space-y-1">
              <div className="flex justify-between text-sm">
                <b>{FOOD_NAMES[k]}</b>
                <span className="gym-small">وصلت الهدف {hit} من 7 أيام</span>
              </div>
              <div className="gym-days7">
                {vals.map((v, i) => (
                  <i key={week[i]} style={{ height: `${Math.max(6, Math.min(100, (v / target) * 100))}%` }} className={v >= target ? "full" : ""} title={`${week[i]}: ${v}`} />
                ))}
              </div>
            </div>
          );
        })}
        {!plan.food && <p className="gym-small">خطتك جيم بس. تبي تتابع أكلك؟ أضف التغذية من «خطتي».</p>}
      </section>
    </div>
  );
}
