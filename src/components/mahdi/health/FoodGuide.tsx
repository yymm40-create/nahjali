"use client";

// «الصحة العلوية» · «وش تاكل عشان توصل أرقامك؟»: the nutrition targets as foods and grams. A sample day (with a button for
// another one), the foods that give the protein, the carbs, the fat and the fibre, and the foods rich in each vitamin.
// Numbers are approximate (config/mahdi/foods.ts); the page says so, and to ask the doctor about any condition.
import { useMemo, useState } from "react";
import { DAILY_NEED, FOOD_GROUPS, MICRO_LABELS, type Food, type Micros } from "@config/mahdi/foods";
import { amountTotals, richIn, sourcesFor, suggestDay, type Amount, type Nutrient, type Totals } from "@/lib/mahdi/health/meals";

type Tab = "day" | Nutrient | "micro";
const TABS: { id: Tab; label: string }[] = [
  { id: "day", label: "يوم مقترح" },
  { id: "p", label: "🥩 بروتين" },
  { id: "c", label: "🍚 كارب" },
  { id: "f", label: "🥑 دهون" },
  { id: "fib", label: "🌾 ألياف" },
  { id: "micro", label: "💊 فيتامينات" },
];

const NUTRIENT_NAME: Record<Nutrient, string> = { p: "بروتين", c: "كربوهيدرات", f: "دهون", fib: "ألياف" };
const n0 = (n: number) => Math.round(n).toLocaleString("en");
const n1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en");

/** «٢ بيضة» / «١٥٠ غ»: the grams, and the usual serving when it is a whole number of them. */
function amountText(food: Food, grams: number) {
  const k = grams / food.serving.g;
  const whole = Math.round(k * 2) / 2;
  const pieces = ["egg", "egg-white", "dates", "orange", "apple", "banana", "tomato", "carrot", "red-pepper", "cucumber"].includes(food.id);
  return pieces && whole >= 1 && Math.abs(k - whole) < 0.26 ? `${n0(grams)} غ ≈ ${whole === 1 ? "1" : n1(whole)} (${food.serving.label})` : `${n0(grams)} غ`;
}

function Macros({ t }: { t: Totals }) {
  return (
    <span className="gym-small" dir="rtl">
      {n0(t.kcal)} سعرة · بروتين {n1(t.p)} · كارب {n1(t.c)} · دهون {n1(t.f)} · ألياف {n1(t.fib)}
    </span>
  );
}

export interface FoodTargets {
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  fiberG: number;
  meals: number;
  sex: "male" | "female";
}

export default function FoodGuide({ t }: { t: FoodTargets }) {
  const [tab, setTab] = useState<Tab>("day");
  const [variant, setVariant] = useState(0);
  const [perMeal, setPerMeal] = useState(true);
  const day = useMemo(() => suggestDay(t, t.meals, variant), [t, variant]);
  const meals = Math.max(2, t.meals);
  // the wanted amount of a nutrient: one meal's share of the day, or the whole day
  const wanted = (k: Nutrient) => {
    const day = { p: t.proteinG, c: t.carbG, f: t.fatG, fib: t.fiberG }[k];
    return perMeal ? Math.max(5, Math.round(day / meals / 5) * 5) : day;
  };

  return (
    <div className="gym-card space-y-3" id="food-guide">
      <span className="gym-eyebrow">🍽️ وش تاكل عشان توصل أرقامك؟</span>
      <div className="gym-chips" role="group" aria-label="دليل الأكل">
        {TABS.map((x) => (
          <button key={x.id} type="button" aria-pressed={tab === x.id} className="gym-chip" onClick={() => setTab(x.id)}>
            {x.label}
          </button>
        ))}
      </div>

      {tab === "day" && (
        <div className="space-y-3">
          <p className="gym-small">يوم مثال يوصّلك قريب من أرقامك ({n0(t.kcal)} سعرة · {n0(t.proteinG)} غ بروتين). الكميات تقريبية: عدّلها على شهيتك.</p>
          {day.meals.map((m, i) => (
            <div key={`${m.name}-${i}`} className="gym-card space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <b>{m.name}</b>
                <Macros t={m.totals} />
              </div>
              <ul className="gym-list gym-small">
                {m.items.map((a: Amount) => {
                  const x = amountTotals(a);
                  return (
                    <li key={a.food.id}>
                      <b>{a.food.name}</b> · {amountText(a.food, a.grams)}
                      <span className="opacity-70"> — بروتين {n1(x.p)} · كارب {n1(x.c)} · دهون {n1(x.f)} · ألياف {n1(x.fib)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div className="gym-stats">
            <div className="gym-stat"><b>{n0(day.totals.kcal)}</b><span>سعرة (المطلوب {n0(t.kcal)})</span></div>
            <div className="gym-stat"><b>{n0(day.totals.p)}</b><span>غ بروتين ({n0(t.proteinG)})</span></div>
            <div className="gym-stat"><b>{n0(day.totals.c)}</b><span>غ كارب ({n0(t.carbG)})</span></div>
            <div className="gym-stat"><b>{n0(day.totals.f)}</b><span>غ دهون ({n0(t.fatG)})</span></div>
            <div className="gym-stat"><b>{n0(day.totals.fib)}</b><span>غ ألياف ({n0(t.fiberG)})</span></div>
          </div>
          <MicroBar totals={day.totals} sex={t.sex} />
          <button type="button" className="gym-btn sm ghost" onClick={() => setVariant((v) => v + 1)}>🔄 يوم ثاني بأكل مختلف</button>
        </div>
      )}

      {(tab === "p" || tab === "c" || tab === "f" || tab === "fib") && (
        <div className="space-y-3">
          <div className="gym-chips">
            <button type="button" className="gym-chip" aria-pressed={perMeal} onClick={() => setPerMeal(true)}>لوجبة وحدة</button>
            <button type="button" className="gym-chip" aria-pressed={!perMeal} onClick={() => setPerMeal(false)}>لليوم كله</button>
          </div>
          <p className="gym-small">
            عشان تاخذ <b className="text-white">{n0(wanted(tab))} غ {NUTRIENT_NAME[tab]}</b> {perMeal ? "في الوجبة" : "في اليوم"}، اختر واحد من هذي (نوّع بينها):
          </p>
          {Object.entries(groupBy(sourcesFor(tab, wanted(tab)), (s) => s.food.group)).map(([g, list]) => (
            <div key={g} className="space-y-1">
              <b className="gym-small">{FOOD_GROUPS[g as keyof typeof FOOD_GROUPS]}</b>
              <ul className="gym-list gym-small">
                {list.map((s) => (
                  <li key={s.food.id}>
                    <b>{s.food.name}</b> · {amountText(s.food, s.grams)}
                    <span className="opacity-70"> — {n0(s.totals.kcal)} سعرة · بروتين {n1(s.totals.p)} · كارب {n1(s.totals.c)} · دهون {n1(s.totals.f)} · ألياف {n1(s.totals.fib)}</span>
                    <MicroLine food={s.food} grams={s.grams} sex={t.sex} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {tab === "micro" && <MicroTab sex={t.sex} />}

      <p className="gym-small">القيم تقريبية من جداول الأغذية المرجعية (USDA) وتتغيّر بالطبخ والماركة. لأي حالة طبية أو حمل أو نقص فيتامين، استشر طبيبك أو أخصائي التغذية.</p>
    </div>
  );
}

function groupBy<T, K extends string>(list: T[], key: (x: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const x of list) (out[key(x)] ??= []).push(x);
  return out;
}

/** The vitamins and minerals a food gives in an amount, as a share of the day's need (only the notable ones). */
function MicroLine({ food, grams, sex }: { food: Food; grams: number; sex: "male" | "female" }) {
  const t = amountTotals({ food, grams });
  const rows = richRows(t.micro, sex).slice(0, 4);
  if (!rows.length) return null;
  return <span className="gym-small block opacity-70">{rows.join(" · ")}</span>;
}

function richRows(m: Required<Micros>, sex: "male" | "female", min = 0.1): string[] {
  return (Object.keys(MICRO_LABELS) as (keyof Micros)[])
    .map((k) => ({ k, share: m[k] / DAILY_NEED[sex][k] }))
    .filter((x) => x.share >= min)
    .sort((a, b) => b.share - a.share)
    .map((x) => `${MICRO_LABELS[x.k].name} ${Math.min(999, Math.round(x.share * 100))}٪`);
}

/** The day's vitamins and minerals against the day's need. */
function MicroBar({ totals, sex }: { totals: Totals; sex: "male" | "female" }) {
  return (
    <div className="space-y-1">
      <b className="gym-small">الفيتامينات والمعادن في هذا اليوم (من حاجتك اليومية)</b>
      <div className="gym-chips">
        {(Object.keys(MICRO_LABELS) as (keyof Micros)[]).map((k) => {
          const pct = Math.round((totals.micro[k] / DAILY_NEED[sex][k]) * 100);
          return (
            <span key={k} className="gym-chip" aria-pressed={pct >= 100}>
              {MICRO_LABELS[k].name} {Math.min(999, pct)}٪
            </span>
          );
        })}
      </div>
    </div>
  );
}

function MicroTab({ sex }: { sex: "male" | "female" }) {
  const keys = Object.keys(MICRO_LABELS) as (keyof Micros)[];
  return (
    <div className="space-y-3">
      <p className="gym-small">أغذية غنية بكل فيتامين أو معدن، ومعها كم تغطّي حصة عادية من حاجتك اليومية ({sex === "female" ? "للمرأة" : "للرجل"}).</p>
      {keys.map((k) => {
        const list = richIn(k, sex).slice(0, 6);
        return (
          <div key={k} className="space-y-1">
            <b className="gym-small">
              {MICRO_LABELS[k].name} (الحاجة {DAILY_NEED[sex][k].toLocaleString("en")} {MICRO_LABELS[k].unit})
            </b>
            <ul className="gym-list gym-small">
              {list.map((x) => (
                <li key={x.food.id}>
                  <b>{x.food.name}</b> · {n0(x.food.serving.g)} غ ({x.food.serving.label}) → {n1(x.amount)} {MICRO_LABELS[k].unit} ≈ {Math.round(x.share * 100)}٪
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
