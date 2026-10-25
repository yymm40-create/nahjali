// «الصحة العلوية» · from the numbers to the plate: which foods give a target («٧٠ غ بروتين»), in how many grams, with
// what each one carries (protein, carbs, fat, fibre, vitamins), and a sample day built from them that changes with a
// number (variant) so the person sees variety. Pure; the food table is config/mahdi/foods.ts. Every number is approximate.

import { DAILY_NEED, FOODS, foodById, type Food, type FoodGroup, type Micros } from "@config/mahdi/foods";

export interface Amount {
  food: Food;
  grams: number;
}

export interface Totals {
  kcal: number;
  p: number;
  c: number;
  f: number;
  fib: number;
  micro: Required<Micros>;
}

const NO_MICRO: Required<Micros> = { a: 0, c: 0, d: 0, b12: 0, ca: 0, fe: 0, fol: 0 };

/** What an amount of one food carries. */
export function amountTotals(a: Amount): Totals {
  const k = a.grams / 100;
  const m = { ...NO_MICRO };
  for (const key of Object.keys(m) as (keyof Micros)[]) m[key] = (a.food.micro[key] ?? 0) * k;
  const p = a.food.per100;
  return { kcal: p.kcal * k, p: p.p * k, c: p.c * k, f: p.f * k, fib: p.fib * k, micro: m };
}

export function sumTotals(list: Amount[]): Totals {
  const out: Totals = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, micro: { ...NO_MICRO } };
  for (const a of list) {
    const t = amountTotals(a);
    out.kcal += t.kcal;
    out.p += t.p;
    out.c += t.c;
    out.f += t.f;
    out.fib += t.fib;
    for (const key of Object.keys(out.micro) as (keyof Micros)[]) out.micro[key] += t.micro[key];
  }
  return out;
}

const r5 = (n: number) => Math.round(n / 5) * 5;

// ───────────────────────── foods that give a number ─────────────────────────

export type Nutrient = "p" | "c" | "f" | "fib";

/** The groups a nutrient is looked for in (so the list is varied and sensible: oil is not a source of protein). */
const SOURCES: Record<Nutrient, FoodGroup[]> = {
  p: ["meat", "fish", "egg", "dairy", "legume", "other"],
  c: ["grain", "legume", "fruit"],
  f: ["fat", "nut", "fish", "egg"],
  fib: ["legume", "veg", "grain", "fruit", "nut"],
};

export interface Source {
  food: Food;
  /** grams that give the wanted amount of the nutrient */
  grams: number;
  totals: Totals;
}

/**
 * Foods that give `target` grams of a nutrient: for each, how many grams that takes and what comes with it. At most
 * `perGroup` of each group (the usual ones first, in the table's order), none that would need more than `maxGrams`.
 */
export function sourcesFor(nutrient: Nutrient, target: number, o: { perGroup?: number; maxGrams?: number } = {}): Source[] {
  const perGroup = o.perGroup ?? 4;
  const maxGrams = o.maxGrams ?? 600;
  const per = (f: Food) => f.per100[nutrient];
  const byGroup = new Map<FoodGroup, Food[]>();
  for (const f of FOODS) {
    if (!SOURCES[nutrient].includes(f.group) || per(f) < (nutrient === "fib" ? 2 : 3)) continue;
    byGroup.set(f.group, [...(byGroup.get(f.group) ?? []), f]);
  }
  const out: Source[] = [];
  for (const [, list] of byGroup) {
    for (const f of list.slice(0, perGroup)) {
      const grams = r5((target / per(f)) * 100);
      if (grams < 5 || grams > maxGrams) continue;
      out.push({ food: f, grams, totals: amountTotals({ food: f, grams }) });
    }
  }
  return out.sort((a, b) => SOURCES[nutrient].indexOf(a.food.group) - SOURCES[nutrient].indexOf(b.food.group) || a.grams - b.grams);
}

/** Foods rich in a vitamin or mineral: the share of the day's need that a usual serving covers, the richest first. */
export function richIn(key: keyof Micros, sex: "male" | "female", minShare = 0.15): { food: Food; share: number; amount: number }[] {
  const need = DAILY_NEED[sex][key];
  return FOODS.flatMap((food) => {
    const amount = ((food.micro[key] ?? 0) * food.serving.g) / 100;
    const share = amount / need;
    return share >= minShare ? [{ food, share, amount }] : [];
  }).sort((a, b) => b.share - a.share);
}

// ───────────────────────── a sample day ─────────────────────────

export interface Targets {
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  fiberG: number;
}

export interface Meal {
  name: string;
  items: Amount[];
  totals: Totals;
}

export interface SampleDay {
  meals: Meal[];
  totals: Totals;
}

type Kind = "breakfast" | "main" | "light" | "snack";
const NAMES: Record<Kind, string> = { breakfast: "الفطور", main: "الغداء", light: "العشاء", snack: "سناك" };

/** The meals of a day by how many the person eats: the big ones carry more of the numbers than the snacks. */
function slots(meals: number): Kind[] {
  const m = Math.min(6, Math.max(2, Math.round(meals) || 3));
  const table: Record<number, Kind[]> = {
    2: ["main", "light"],
    3: ["breakfast", "main", "light"],
    4: ["breakfast", "main", "snack", "light"],
    5: ["breakfast", "snack", "main", "snack", "light"],
    6: ["breakfast", "snack", "main", "snack", "light", "snack"],
  };
  return table[m];
}
const WEIGHT: Record<Kind, number> = { breakfast: 3, main: 4, light: 3, snack: 1.2 };

const need = (id: string) => {
  const f = foodById(id);
  if (!f) throw new Error(`unknown food ${id}`);
  return f;
};

/**
 * The foods of each kind of meal: [the main protein food, the side items kept in fixed amounts, the carb food (filled by
 * what is left of the carbs), the vegetables]. The options turn with the variant, so another number gives another day.
 */
interface Recipe {
  protein: string;
  side?: { id: string; grams: number }[];
  carb?: string;
  veg?: string[];
}

const RECIPES: Record<Kind, Recipe[]> = {
  breakfast: [
    { protein: "egg", side: [{ id: "tomato", grams: 120 }, { id: "olive-oil", grams: 5 }], carb: "wholewheat-bread" },
    { protein: "greek-yogurt", side: [{ id: "banana", grams: 120 }, { id: "almonds", grams: 15 }], carb: "oats" },
    { protein: "fava", side: [{ id: "tomato", grams: 100 }, { id: "olive-oil", grams: 10 }], carb: "pita" },
    { protein: "cottage", side: [{ id: "cucumber", grams: 100 }, { id: "dates", grams: 24 }], carb: "wholewheat-bread" },
  ],
  main: [
    { protein: "chicken-breast", carb: "rice", veg: ["spinach", "tomato"], side: [{ id: "olive-oil", grams: 10 }] },
    { protein: "salmon", carb: "sweet-potato", veg: ["broccoli", "lettuce"], side: [{ id: "olive-oil", grams: 5 }] },
    { protein: "beef-lean", carb: "bulgur", veg: ["red-pepper", "cucumber"], side: [{ id: "olive-oil", grams: 10 }] },
    { protein: "lentils", carb: "brown-rice", veg: ["carrot", "lettuce"], side: [{ id: "olive-oil", grams: 10 }, { id: "laban", grams: 150 }] },
    { protein: "shrimp", carb: "pasta", veg: ["zucchini", "tomato"], side: [{ id: "olive-oil", grams: 10 }] },
    { protein: "lamb", carb: "potato", veg: ["okra", "cucumber"], side: [{ id: "olive-oil", grams: 5 }] },
    { protein: "chickpeas", carb: "rice", veg: ["eggplant", "tomato"], side: [{ id: "tahini", grams: 20 }] },
  ],
  light: [
    { protein: "tuna", carb: "pita", veg: ["lettuce", "cucumber", "tomato"], side: [{ id: "olive-oil", grams: 10 }] },
    { protein: "chicken-thigh", carb: "potato", veg: ["broccoli"], side: [{ id: "olive-oil", grams: 5 }] },
    { protein: "cod", carb: "rice", veg: ["zucchini", "spinach"], side: [{ id: "olive-oil", grams: 10 }] },
    { protein: "egg", carb: "wholewheat-bread", veg: ["tomato", "cucumber"], side: [{ id: "avocado", grams: 50 }] },
    { protein: "white-beans", carb: "pita", veg: ["lettuce", "red-pepper"], side: [{ id: "olive-oil", grams: 10 }] },
    { protein: "tofu", carb: "brown-rice", veg: ["broccoli", "carrot"], side: [{ id: "olive-oil", grams: 5 }] },
  ],
  snack: [
    { protein: "greek-yogurt", side: [{ id: "strawberry", grams: 100 }] },
    { protein: "laban", side: [{ id: "cucumber", grams: 80 }, { id: "walnuts", grams: 15 }] },
    { protein: "egg", side: [{ id: "orange", grams: 150 }] },
    { protein: "cottage", side: [{ id: "apple", grams: 150 }] },
    { protein: "whey", side: [{ id: "banana", grams: 120 }] },
  ],
};

const MAX_GRAMS: Record<string, number> = { rice: 450, "brown-rice": 450, pasta: 450, potato: 500, "sweet-potato": 450, bulgur: 450, pita: 240, "wholewheat-bread": 200, oats: 120 };

/** One meal: the side items first, then the main protein food sized to what the meal still needs, then the carb food. */
function buildMeal(kind: Kind, r: Recipe, share: { p: number; c: number }): Meal {
  const items: Amount[] = [];
  for (const s of r.side ?? []) items.push({ food: need(s.id), grams: s.grams });
  for (const v of r.veg ?? []) items.push({ food: need(v), grams: need(v).serving.g });
  const main = need(r.protein);
  const withoutMain = sumTotals(items);
  const carbFood = r.carb ? need(r.carb) : null;
  // the carb food gives protein too (bread, oats, rice…): the main protein food covers the rest
  const pCarbGuess = carbFood ? Math.max(0, share.c - withoutMain.c) * (carbFood.per100.p / Math.max(1, carbFood.per100.c)) : 0;
  const pLeft = Math.max(0, share.p - withoutMain.p - pCarbGuess);
  let mainG = main.per100.p > 0 ? r5((pLeft / main.per100.p) * 100) : main.serving.g;
  mainG = Math.min(Math.max(mainG, r.protein === "egg" ? 50 : 30), main.group === "legume" ? 500 : 350);
  // eggs and whole eggs come in whole pieces
  if (r.protein === "egg") mainG = Math.max(50, Math.round(mainG / 50) * 50);
  items.unshift({ food: main, grams: mainG });
  if (carbFood) {
    const have = sumTotals(items).c;
    const g = r5(((Math.max(0, share.c - have) / Math.max(1, carbFood.per100.c)) * 100));
    items.push({ food: carbFood, grams: Math.min(Math.max(g, 30), MAX_GRAMS[carbFood.id] ?? 400) });
  }
  return { name: NAMES[kind], items, totals: sumTotals(items) };
}

/** Keeps the day near its targets: the main protein foods up or down to the protein, then oil and nuts up to the fat. */
function balance(meals: Meal[], t: Targets) {
  const total = () => sumTotals(meals.flatMap((m) => m.items));
  const mains = meals.map((m) => m.items[0]).filter((a) => a.food.id !== "egg" && a.food.id !== "whey" && a.food.per100.p >= 8);
  // protein: spread what is missing (or too much) over the main foods, never below a taste of them
  for (let pass = 0; pass < 3 && mains.length; pass++) {
    const gap = t.proteinG - total().p;
    if (Math.abs(gap) < t.proteinG * 0.04) break;
    for (const a of mains) {
      const cap = a.food.group === "legume" ? 500 : 350;
      a.grams = Math.min(cap, Math.max(30, r5(a.grams + ((gap / mains.length) / a.food.per100.p) * 100)));
    }
  }
  // fat: oil in the meals that have it (up to 30 g each), then a handful of nuts in the breakfast / a snack
  let gap = t.fatG - total().f;
  const oils = meals.map((m) => m.items.find((a) => a.food.id === "olive-oil")).filter((a): a is Amount => !!a);
  for (let pass = 0; pass < 3 && gap > 6 && oils.length; pass++) {
    for (const a of oils) a.grams = Math.min(30, r5(a.grams + gap / oils.length));
    gap = t.fatG - total().f;
  }
  const nutty = meals.filter((m) => m.name === "الفطور" || m.name === "سناك");
  for (const m of nutty) {
    if (gap <= 10) break;
    const grams = Math.min(30, r5(gap / 0.5));
    m.items.push({ food: need("almonds"), grams: Math.max(15, grams) });
    gap = t.fatG - total().f;
  }
  for (const m of meals) m.totals = sumTotals(m.items);
}

/** A sample day for the targets, in `meals` meals; another `variant` picks other foods (the same one always gives the same day). */
export function suggestDay(t: Targets, meals: number, variant: number): SampleDay {
  const kinds = slots(meals);
  const sum = kinds.reduce((s, k) => s + WEIGHT[k], 0);
  const used: Record<Kind, number> = { breakfast: 0, main: 0, light: 0, snack: 0 };
  const out: Meal[] = kinds.map((kind) => {
    const list = RECIPES[kind];
    const r = list[(Math.abs(Math.round(variant)) + used[kind]) % list.length];
    used[kind]++;
    const w = WEIGHT[kind] / sum;
    return buildMeal(kind, r, { p: t.proteinG * w, c: t.carbG * w });
  });
  balance(out, t);
  return { meals: out, totals: sumTotals(out.flatMap((m) => m.items)) };
}
