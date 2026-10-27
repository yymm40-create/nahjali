// «الصحة العلوية» · «شنو أكلت؟» written in the person's own words («صحن كبسة دجاج متوسط وبيضتين مقلية وكوب لبن»):
// the light model matches each thing to the catalogue (config/mahdi/meal-foods.ts) with its household measure and
// how many, and the numbers are then COUNTED HERE from the catalogue — never taken from the model — so «بيضتين»
// always give the same as two eggs picked by hand. Only a food the catalogue lacks keeps the model's estimate
// (clamped), marked as estimated. Server only.

import { MEAL_FOODS, mealFoodById, mealOf } from "@config/mahdi/meal-foods";
import type { MealItem } from "./tracker";

export const MEAL_TASK = `You read what a person in the Gulf says they ate (Gulf Arabic, often without amounts) and list each food separately with a household measure.

Rules:
- Match each food to ONE catalogue id below when it is the same food (pick the closest kind: «رز كبسة» → rice-kabsa, «بيض مقلي» → egg-fried-oil). Use its unit ids only.
- No amount said → the usual one (one plate of a rice dish = plate-m; one egg = 1 egg; tea = 1 cup-tea). «صحن» alone = plate-m, «صحن كبير» = plate-l, «ملعقة» = spoon, «لقمة» = hand.
- A dish of rice with chicken or meat («كبسة دجاج») is TWO items: the rice and the chicken/meat (a usual plate-m of rice and a quarter chicken / a palm of meat).
- A food not in the catalogue: foodId "" and your own estimate of grams, kcal, protein p, carbs c and fat f for the amount eaten.
- qty may be 0.5, 1, 1.5, 2, 3…
- name: the food in short Gulf Arabic as the person would say it.

Catalogue (id | name | units as id:label:grams):
${MEAL_FOODS.map((f) => `${f.id} | ${f.name} | ${f.units.map((u) => `${u.id}:${u.label}:${u.g}`).join(", ")}`).join("\n")}`;

export const MEAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["foodId", "name", "unitId", "unitLabel", "qty", "grams", "kcal", "p", "c", "f"],
        properties: {
          foodId: { type: "string" },
          name: { type: "string" },
          unitId: { type: "string" },
          unitLabel: { type: "string" },
          qty: { type: "number" },
          grams: { type: "number" },
          kcal: { type: "number" },
          p: { type: "number" },
          c: { type: "number" },
          f: { type: "number" },
        },
      },
    },
  },
} as const;

export interface ParsedMeal {
  foodId: string;
  name: string;
  unitId: string;
  unitLabel: string;
  qty: number;
  grams: number;
  kcal: number;
  p: number;
  c: number;
  f: number;
}

const clamp = (v: unknown, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
};
const id = () => Math.random().toString(36).slice(2, 12);

/** The model's list made into the day's meal items: catalogue foods counted from the table, the rest clamped. */
export type ParsedItem = MealItem & { estimated: boolean; unitId: string };
export function mealsFrom(items: ParsedMeal[]): ParsedItem[] {
  return items.slice(0, 20).flatMap((it): ParsedItem[] => {
    const qty = Math.round(clamp(it.qty, 0.25, 20) * 4) / 4;
    const food = it.foodId ? mealFoodById(it.foodId) : undefined;
    if (food) {
      const unitId = food.units.some((x) => x.id === it.unitId) ? it.unitId : food.units[0].id;
      const m = mealOf(food, unitId, qty);
      return [{ id: id(), foodId: food.id, name: food.name, unit: m.unit.label, unitId, qty, g: m.g, kcal: m.kcal, p: m.p, c: m.c, f: m.f, estimated: false }];
    }
    const name = String(it.name ?? "").trim().slice(0, 60);
    if (!name) return [];
    return [{ id: id(), foodId: null, name, unit: String(it.unitLabel ?? "").trim().slice(0, 40) || "حصة", unitId: "", qty, g: Math.round(clamp(it.grams, 0, 3000)), kcal: Math.round(clamp(it.kcal, 0, 4000)), p: Math.round(clamp(it.p, 0, 300) * 10) / 10, c: Math.round(clamp(it.c, 0, 600) * 10) / 10, f: Math.round(clamp(it.f, 0, 300) * 10) / 10, estimated: true }];
  });
}
