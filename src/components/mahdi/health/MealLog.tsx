"use client";

// «الصحة العلوية» · «🍽️ شنو أكلت؟»: the person says what they ate — in their own words («صحن كبسة وبيضتين»), counted
// from the catalogue, or picked by hand: the kind (every rice, every egg…), the household measure («لقمة يد»،
// «ملعقة طعام عادية»، «صحن متوسط»، «بيضة») and how many — and the page counts the calories, protein, carbs and fat.
// Nothing needs weighing. What is added goes into the day's calories and protein (and the habits linked to them).

import { useMemo, useState } from "react";
import { MEAL_CATS, MEAL_FOODS, MEAL_QTYS, mealFoodById, mealOf, type MealCat } from "@config/mahdi/meal-foods";
import { mealTotals, type MealItem } from "@/lib/mahdi/health/tracker";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";

const newId = () => Math.random().toString(36).slice(2, 12);
const qtyText = (q: number) => (q === 0.5 ? "نص" : q === 1.5 ? "واحد ونص" : String(q).replace(".5", "½").replace(".25", "¼").replace(".75", "¾"));

export default function MealLog({ meals, onChange }: { meals: MealItem[]; onChange: (next: MealItem[]) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [found, setFound] = useState<MealItem[] | null>(null);
  const [cat, setCat] = useState<MealCat>("rice");
  const [foodId, setFoodId] = useState(MEAL_FOODS.find((f) => f.cat === "rice")!.id);
  const food = mealFoodById(foodId) ?? MEAL_FOODS[0];
  const [unitId, setUnitId] = useState(food.units[0].id);
  const [qty, setQty] = useState(1);
  const shown = useMemo(() => mealOf(food, unitId, qty), [food, unitId, qty]);
  const total = mealTotals(meals);

  const pickCat = (c: MealCat) => {
    setCat(c);
    const first = MEAL_FOODS.find((f) => f.cat === c)!;
    setFoodId(first.id);
    setUnitId(first.units[0].id);
    setQty(1);
  };
  const pickFood = (id: string) => {
    const f = mealFoodById(id);
    if (!f) return;
    setFoodId(id);
    setUnitId(f.units[0].id);
  };
  const addPicked = () => {
    onChange([...meals, { id: newId(), foodId: food.id, name: food.name, unit: shown.unit.label, qty, g: shown.g, kcal: shown.kcal, p: shown.p, c: shown.c, f: shown.f }]);
    setNote(`✅ انضاف: ${qtyText(qty)} ${shown.unit.label} ${food.name} · ${shown.kcal} سعرة`);
  };
  const read = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setNote("");
    try {
      const r = await mahdiFetch<{ items: (MealItem & { estimated?: boolean })[] }>("/api/mahdi/health/meal", { method: "POST", json: { text } });
      setFound(r.items);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "ما قدرت أحسبها الحين.");
    } finally {
      setBusy(false);
    }
  };
  // a found item's amount changed by hand: counted again from the catalogue (an estimated one scales)
  const tweak = (i: number, q: number) =>
    setFound((list) =>
      (list ?? []).map((m, j) => {
        if (j !== i) return m;
        const f = m.foodId ? mealFoodById(m.foodId) : undefined;
        const unit = f?.units.find((x) => x.label === m.unit);
        if (f && unit) {
          const n = mealOf(f, unit.id, q);
          return { ...m, qty: q, g: n.g, kcal: n.kcal, p: n.p, c: n.c, f: n.f };
        }
        const k = m.qty ? q / m.qty : 1;
        return { ...m, qty: q, g: Math.round(m.g * k), kcal: Math.round(m.kcal * k), p: Math.round(m.p * k * 10) / 10, c: Math.round(m.c * k * 10) / 10, f: Math.round(m.f * k * 10) / 10 };
      }),
    );
  const addFound = () => {
    if (!found?.length) return;
    onChange([...meals, ...found.map((m) => ({ ...m, id: newId() }))]);
    setNote(`✅ انضاف ${found.length} · ${mealTotals(found).kcal} سعرة`);
    setFound(null);
    setText("");
  };

  return (
    <div className="gym-card space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <b>🍽️ شنو أكلت؟</b>
        {meals.length > 0 && (
          <span className="gym-small" dir="ltr">
            {total.kcal} kcal · P {total.p}g · C {total.c}g · F {total.f}g
          </span>
        )}
      </div>

      <label className="gym-field">
        <span>اكتب شنو أكلت وكم تقريبًا — بكلامك</span>
        <textarea className="gym-input min-h-[70px] py-2" dir="auto" maxLength={800} value={text} placeholder="مثلًا: صحن كبسة دجاج متوسط، بيضتين مقلية، كوب لبن، ٣ تمرات" onChange={(e) => setText(e.target.value)} />
      </label>
      <button type="button" className="gym-btn sm" disabled={busy || !text.trim()} onClick={() => void read()}>
        {busy ? "أحسب…" : "🧮 احسبها لي"}
      </button>

      {found && (
        <div className="space-y-2 rounded-xl border border-[#2a3038] p-2.5">
          <p className="gym-small">هذا اللي فهمته — عدّل الكمية لو تبي، بعدين أضفه:</p>
          {found.map((m, i) => (
            <div key={m.id} className="flex flex-wrap items-center gap-1.5 text-sm">
              <b className="min-w-0 flex-1">
                {m.name}
                {!m.foodId && <small className="gym-small"> (تقدير)</small>}
              </b>
              <select className="gym-input !min-h-8 w-20" value={m.qty} onChange={(e) => tweak(i, Number(e.target.value))} aria-label={`كمية ${m.name}`}>
                {[...new Set([...MEAL_QTYS, m.qty])].sort((a, b) => a - b).map((q) => (
                  <option key={q} value={q}>
                    {qtyText(q)}
                  </option>
                ))}
              </select>
              <span className="gym-small">{m.unit}</span>
              <span className="gym-small" dir="ltr">
                {m.kcal} kcal · P {m.p}g
              </span>
              <button type="button" className="gym-chip" onClick={() => setFound((l) => (l ?? []).filter((_, j) => j !== i))} aria-label={`شيل ${m.name}`}>
                ×
              </button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="gym-btn sm" disabled={!found.length} onClick={addFound}>
              ✓ أضفها ({mealTotals(found).kcal} سعرة)
            </button>
            <button type="button" className="gym-btn ghost sm" onClick={() => setFound(null)}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      <details className="space-y-2">
        <summary className="cursor-pointer text-sm font-bold">أو اختر من القائمة (كل أنواع الرز والبيض وغيرها)</summary>
        <div className="flex flex-wrap gap-1.5 pt-2" role="tablist" aria-label="نوع الأكل">
          {(Object.entries(MEAL_CATS) as [MealCat, (typeof MEAL_CATS)[MealCat]][]).map(([id, c]) => (
            <button key={id} type="button" role="tab" aria-selected={cat === id} className="gym-chip" style={cat === id ? { borderColor: "#c6ff1a", color: "#c6ff1a" } : undefined} onClick={() => pickCat(id)}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
        <label className="gym-field">
          <span>الأكل</span>
          <select className="gym-input" value={foodId} onChange={(e) => pickFood(e.target.value)}>
            {MEAL_FOODS.filter((f) => f.cat === cat).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-[1fr_6.5rem] gap-2">
          <label className="gym-field">
            <span>المقياس</span>
            <select className="gym-input" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              {food.units.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                  {x.id !== "g" ? ` (≈ ${x.g} غ)` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="gym-field">
            <span>كم؟</span>
            {unitId === "g" ? (
              <input className="gym-input" inputMode="numeric" dir="ltr" value={qty} onChange={(e) => setQty(Math.max(0, Math.min(3000, Number(e.target.value.replace(/\D/g, "")) || 0)))} />
            ) : (
              <select className="gym-input" value={qty} onChange={(e) => setQty(Number(e.target.value))}>
                {MEAL_QTYS.map((q) => (
                  <option key={q} value={q}>
                    {qtyText(q)}
                  </option>
                ))}
              </select>
            )}
          </label>
        </div>
        <p className="gym-small" dir="auto">
          = تقريبًا <b>{shown.kcal}</b> سعرة · بروتين {shown.p} غ · نشويات {shown.c} غ · دهون {shown.f} غ ({shown.g} غ)
        </p>
        <button type="button" className="gym-btn sm" disabled={shown.g <= 0} onClick={addPicked}>
          + أضفها لأكل اليوم
        </button>
      </details>

      {note && <p className="gym-small" role="status">{note}</p>}

      {meals.length > 0 && (
        <ul className="space-y-1.5">
          {meals.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {qtyText(m.qty)} {m.unit} · {m.name}
              </span>
              <span className="gym-small" dir="ltr">
                {m.kcal} kcal · P {m.p}g
              </span>
              <button type="button" className="gym-chip" onClick={() => onChange(meals.filter((x) => x.id !== m.id))} aria-label={`احذف ${m.name}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="gym-small">الأرقام تقريبية وتختلف حسب الطبخة. اللي تضيفه ينحسب في سعرات وبروتين اليوم فوق.</p>
    </div>
  );
}
