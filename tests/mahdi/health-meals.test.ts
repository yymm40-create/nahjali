import { describe, expect, it } from "vitest";
import { MEAL_CATS, MEAL_FOODS, mealFoodById, mealOf } from "@config/mahdi/meal-foods";
import { cleanDay, mealTotals } from "@/lib/mahdi/health/tracker";
import { MEAL_TASK, mealsFrom } from "@/lib/mahdi/health/meal-parse";

describe("«شنو أكلت؟»: pick a food and a household measure, the page counts", () => {
  it("has every common rice and egg, every food on a known shelf, each with a gram measure besides the household ones", () => {
    expect(MEAL_FOODS.filter((f) => f.cat === "rice").length).toBeGreaterThanOrEqual(12);
    expect(MEAL_FOODS.filter((f) => f.cat === "egg").length).toBeGreaterThanOrEqual(8);
    expect(new Set(MEAL_FOODS.map((f) => f.id)).size).toBe(MEAL_FOODS.length);
    for (const f of MEAL_FOODS) {
      expect(Object.keys(MEAL_CATS), f.id).toContain(f.cat);
      expect(f.units.some((x) => x.id === "g" && x.g === 1), f.id).toBe(true);
      expect(f.units.length, f.id).toBeGreaterThan(1);
      // energy roughly matches the macros (4/4/9), so no number is a typo
      const est = f.per100.p * 4 + f.per100.c * 4 + f.per100.f * 9;
      expect(Math.abs(est - f.per100.kcal) / Math.max(f.per100.kcal, 20), f.id).toBeLessThan(0.3);
    }
  });

  it("speaks the measures people use — a hand bite, a regular spoon, a plate — not only grams", () => {
    const rice = mealFoodById("rice-kabsa")!;
    expect(rice.units.map((x) => x.label)).toEqual(expect.arrayContaining(["لقمة يد", "ملعقة طعام عادية", "صحن متوسط"]));
    const spoon = mealOf(rice, "spoon", 2);
    expect(spoon.g).toBe(30);
    expect(spoon.kcal).toBe(54);
    const eggs = mealOf(mealFoodById("egg-fried-oil")!, "egg", 2);
    expect(eggs).toMatchObject({ g: 110, kcal: 216 });
    expect(mealOf(rice, "g", 250).g).toBe(250);
  });

  it("keeps the meals with the day, and adds them up", () => {
    const day = cleanDay({ date: "2026-10-26", meals: [{ id: "abc12345", foodId: "egg-boiled", name: "بيض مسلوق", unit: "بيضة", qty: 2, g: 100, kcal: 155, p: 12.6, c: 1.1, f: 10.6 }, { name: "" }, { name: "شي غريب", kcal: 99999 }] })!;
    expect(day.meals).toHaveLength(2);
    expect(day.meals![1].kcal).toBe(6000);
    expect(mealTotals(day.meals)).toMatchObject({ kcal: 6155, p: 13 });
    expect(cleanDay({ date: "2026-10-26" })!.meals).toBeUndefined();
  });

  it("counts what was written from the catalogue, never from the model's own numbers", () => {
    expect(MEAL_TASK).toContain("rice-kabsa");
    expect(MEAL_TASK).toContain("لقمة يد");
    const items = mealsFrom([
      { foodId: "egg-fried-oil", name: "بيض", unitId: "egg", unitLabel: "بيضة", qty: 2, grams: 999, kcal: 9999, p: 0, c: 0, f: 0 },
      { foodId: "rice-kabsa", name: "كبسة", unitId: "nope", unitLabel: "", qty: 1, grams: 0, kcal: 0, p: 0, c: 0, f: 0 },
      { foodId: "", name: "سلطة شيف", unitId: "", unitLabel: "صحن", qty: 1, grams: 250, kcal: 220, p: 9, c: 10, f: 15 },
      { foodId: "", name: "", unitId: "", unitLabel: "", qty: 1, grams: 0, kcal: 0, p: 0, c: 0, f: 0 },
    ]);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ foodId: "egg-fried-oil", kcal: 216, g: 110, estimated: false });
    expect(items[1]).toMatchObject({ foodId: "rice-kabsa", unit: "ملعقة طعام عادية", estimated: false });
    expect(items[2]).toMatchObject({ foodId: null, name: "سلطة شيف", kcal: 220, estimated: true });
  });
});
