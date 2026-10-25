import { describe, expect, it } from "vitest";
import { DAILY_NEED, FOODS, foodById } from "@config/mahdi/foods";
import { amountTotals, richIn, sourcesFor, suggestDay } from "@/lib/mahdi/health/meals";

describe("the food table", () => {
  it("has unique foods with sane numbers (the calories agree with the macros within reason)", () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
    for (const f of FOODS) {
      const { kcal, p, c, f: fat, fib } = f.per100;
      expect(f.serving.g, f.id).toBeGreaterThan(0);
      expect(p + c + fat, f.id).toBeLessThanOrEqual(101);
      expect(fib, f.id).toBeLessThanOrEqual(c + 0.1);
      // 4/4/9 (fibre counted in the carbs): within 25 % or 40 kcal of the table's own calories
      const calc = p * 4 + c * 4 + fat * 9;
      expect(Math.abs(calc - kcal), f.id).toBeLessThanOrEqual(Math.max(40, kcal * 0.25));
    }
  });
});

describe("foods that give a number", () => {
  it("protein: grams of each food that give the wanted protein, several groups, none absurd", () => {
    const list = sourcesFor("p", 30);
    expect(new Set(list.map((s) => s.food.group)).size).toBeGreaterThanOrEqual(4);
    for (const s of list) {
      expect(s.totals.p, s.food.id).toBeGreaterThan(26);
      expect(s.totals.p, s.food.id).toBeLessThan(35);
      expect(s.grams).toBeLessThanOrEqual(600);
    }
    // ~30 g of protein from chicken breast is ~95 g
    expect(list.find((s) => s.food.id === "chicken-breast")?.grams).toBe(95);
    // oil is not a source of protein
    expect(list.some((s) => s.food.group === "fat")).toBe(false);
  });
  it("carbs, fat and fibre have their own lists", () => {
    expect(sourcesFor("c", 50).some((s) => s.food.id === "rice")).toBe(true);
    expect(sourcesFor("f", 15).some((s) => s.food.id === "olive-oil" || s.food.id === "almonds")).toBe(true);
    expect(sourcesFor("fib", 8).some((s) => s.food.id === "lentils")).toBe(true);
  });
  it("vitamins: the richest foods first, by the share of the day's need", () => {
    const b12 = richIn("b12", "male");
    expect(b12.length).toBeGreaterThan(3);
    expect(b12.map((x) => x.share)).toEqual([...b12.map((x) => x.share)].sort((a, b) => b - a));
    expect(richIn("fe", "female").every((x) => x.share >= 0.15)).toBe(true);
    expect(DAILY_NEED.female.fe).toBeGreaterThan(DAILY_NEED.male.fe);
    expect(amountTotals({ food: foodById("egg")!, grams: 100 }).micro.d).toBeCloseTo(2.2);
  });
});

describe("a sample day", () => {
  const cases = [
    { kcal: 1600, proteinG: 90, carbG: 160, fatG: 50, fiberG: 22, meals: 3 },
    { kcal: 2000, proteinG: 110, carbG: 210, fatG: 60, fiberG: 28, meals: 4 },
    { kcal: 2500, proteinG: 150, carbG: 290, fatG: 70, fiberG: 35, meals: 4 },
    { kcal: 3200, proteinG: 180, carbG: 400, fatG: 90, fiberG: 45, meals: 5 },
    { kcal: 2200, proteinG: 70, carbG: 300, fatG: 65, fiberG: 31, meals: 3 },
  ];
  it("lands near the protein and the calories whichever variant is shown", () => {
    for (const c of cases)
      for (let v = 0; v < 6; v++) {
        const d = suggestDay(c, c.meals, v).totals;
        expect(Math.abs(d.p / c.proteinG - 1), `${c.kcal}/${v} protein`).toBeLessThan(0.25);
        expect(Math.abs(d.kcal / c.kcal - 1), `${c.kcal}/${v} kcal`).toBeLessThan(0.25);
        expect(d.fib, `${c.kcal}/${v} fibre`).toBeGreaterThan(c.fiberG * 0.6);
      }
  });
  it("has the wanted number of meals, and another number gives other foods", () => {
    const c = cases[1];
    expect(suggestDay(c, 4, 0).meals).toHaveLength(4);
    expect(suggestDay(c, 3, 0).meals).toHaveLength(3);
    const a = suggestDay(c, 4, 0).meals.map((m) => m.items[0].food.id).join();
    const b = suggestDay(c, 4, 1).meals.map((m) => m.items[0].food.id).join();
    expect(a).not.toBe(b);
    expect(suggestDay(c, 4, 0).meals.map((m) => m.items[0].food.id).join()).toBe(a);
  });
});
