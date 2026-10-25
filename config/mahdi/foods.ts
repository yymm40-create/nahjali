// «الصحة العلوية» · the food table behind the nutrition page: real foods with what 100 g of each gives (calories, protein,
// carbs, fat, fibre) and its notable vitamins and minerals, so the targets («٧٠ غ بروتين») become foods and grams.
// Reference values rounded from the USDA FoodData Central tables (cooked where the name says so); they differ with the
// brand and the way of cooking, so the page calls every number approximate. Halal foods only; nothing here is a medical
// advice (the page says to ask the doctor for a condition, pregnancy or a deficiency).

export type FoodGroup = "meat" | "fish" | "egg" | "dairy" | "legume" | "grain" | "veg" | "fruit" | "nut" | "fat" | "other";

/** What the page counts of the vitamins and minerals (units: µg for a, d, b12, fol · mg for c, ca, fe). */
export interface Micros {
  /** vitamin A, µg RAE */
  a?: number;
  /** vitamin C, mg */
  c?: number;
  /** vitamin D, µg */
  d?: number;
  /** vitamin B12, µg */
  b12?: number;
  /** calcium, mg */
  ca?: number;
  /** iron, mg */
  fe?: number;
  /** folate, µg DFE */
  fol?: number;
}

export interface Food {
  id: string;
  name: string;
  group: FoodGroup;
  /** a usual serving, in grams, and how it is said */
  serving: { g: number; label: string };
  /** per 100 g: calories, protein, carbs, fat, fibre */
  per100: { kcal: number; p: number; c: number; f: number; fib: number };
  micro: Micros;
}

export const FOOD_GROUPS: Record<FoodGroup, string> = {
  meat: "اللحوم والدواجن",
  fish: "السمك والبحريات",
  egg: "البيض",
  dairy: "الألبان",
  legume: "البقوليات",
  grain: "الحبوب والنشويات",
  veg: "الخضار",
  fruit: "الفواكه",
  nut: "المكسرات والبذور",
  fat: "الدهون والزيوت",
  other: "أخرى",
};

const F = (id: string, name: string, group: FoodGroup, g: number, label: string, kcal: number, p: number, c: number, f: number, fib: number, micro: Micros = {}): Food => ({
  id,
  name,
  group,
  serving: { g, label },
  per100: { kcal, p, c, f, fib },
  micro,
});

export const FOODS: Food[] = [
  // ── meat and poultry (cooked)
  F("chicken-breast", "صدر دجاج مشوي", "meat", 120, "صدر متوسط", 165, 31, 0, 3.6, 0, { b12: 0.3, fe: 1 }),
  F("chicken-thigh", "فخذ دجاج بدون جلد", "meat", 110, "فخذ", 209, 26, 0, 10.9, 0, { b12: 0.5, fe: 1.3 }),
  F("beef-lean", "لحم بقر قليل الدهن", "meat", 100, "حصة", 217, 26, 0, 11.8, 0, { b12: 2.5, fe: 2.7 }),
  F("lamb", "لحم غنم مشوي", "meat", 100, "حصة", 206, 28, 0, 9.5, 0, { b12: 2.6, fe: 1.9 }),
  // ── fish and seafood
  F("salmon", "سلمون مشوي", "fish", 120, "شريحة", 206, 22, 0, 12.4, 0, { d: 11, b12: 3.2, fol: 29 }),
  F("tuna", "تونة معلّبة بالماء", "fish", 100, "علبة صغيرة", 116, 25.5, 0, 0.8, 0, { d: 1.7, b12: 2.2, fe: 1.4 }),
  F("shrimp", "ربيان مطبوخ", "fish", 100, "حصة", 99, 24, 0.2, 0.3, 0, { b12: 1.2, ca: 64, fe: 0.5 }),
  F("cod", "سمك أبيض (هامور / حبّار) مشوي", "fish", 120, "شريحة", 105, 23, 0, 0.9, 0, { b12: 1, fe: 0.4 }),
  // ── eggs
  F("egg", "بيض مسلوق", "egg", 50, "بيضة", 155, 12.6, 1.1, 10.6, 0, { a: 160, d: 2.2, b12: 1.1, fol: 44, fe: 1.2, ca: 50 }),
  F("egg-white", "بياض بيض", "egg", 33, "بياضة", 52, 11, 0.7, 0.2, 0, { b12: 0.1 }),
  // ── dairy
  F("greek-yogurt", "زبادي يوناني قليل الدسم", "dairy", 170, "علبة", 73, 10, 4, 2, 0, { ca: 115, b12: 0.5 }),
  F("laban", "لبن / زبادي سادة", "dairy", 200, "كوب", 63, 5.3, 7, 1.6, 0, { ca: 183, b12: 0.5 }),
  F("milk", "حليب قليل الدسم", "dairy", 250, "كوب", 50, 3.4, 4.8, 2, 0, { ca: 120, b12: 0.5, a: 58 }),
  F("cottage", "جبن قريش", "dairy", 100, "نص كوب", 72, 12.4, 2.7, 1, 0, { ca: 61, b12: 0.4 }),
  // ── legumes (cooked)
  F("lentils", "عدس مطبوخ", "legume", 150, "كوب تقريبًا", 116, 9, 20, 0.4, 7.9, { fe: 3.3, fol: 181, ca: 19 }),
  F("chickpeas", "حمّص مطبوخ", "legume", 150, "كوب", 164, 8.9, 27.4, 2.6, 7.6, { fe: 2.9, fol: 172, ca: 49 }),
  F("fava", "فول مدمّس", "legume", 150, "كوب", 110, 7.6, 19.7, 0.4, 5.4, { fe: 1.5, fol: 104 }),
  F("kidney", "فاصوليا حمراء مطبوخة", "legume", 150, "كوب", 127, 8.7, 22.8, 0.5, 6.4, { fe: 2.2, fol: 130 }),
  F("white-beans", "فاصوليا بيضاء مطبوخة", "legume", 150, "كوب", 139, 9.7, 25, 0.4, 6.3, { fe: 3.7, fol: 140, ca: 90 }),
  F("tofu", "توفو صلب", "legume", 120, "قطعة", 144, 17, 2.8, 8.7, 2.3, { ca: 350, fe: 2.7 }),
  // ── grains and starches
  F("rice", "رز أبيض مطبوخ", "grain", 160, "كوب", 130, 2.7, 28.2, 0.3, 0.4),
  F("brown-rice", "رز بني مطبوخ", "grain", 160, "كوب", 123, 2.7, 25.6, 1, 1.6),
  F("oats", "شوفان (جاف)", "grain", 40, "نص كوب", 389, 16.9, 66.3, 6.9, 10.6, { fe: 4.7, ca: 54, fol: 56 }),
  F("wholewheat-bread", "خبز بر كامل", "grain", 60, "شريحتين", 247, 13, 41, 3.4, 6, { fe: 2.5, ca: 107 }),
  F("pita", "خبز عربي أبيض", "grain", 60, "رغيف صغير", 275, 9.1, 55.7, 1.2, 2.2, { fe: 1.7, ca: 86 }),
  F("potato", "بطاطس مسلوقة", "grain", 150, "حبة متوسطة", 87, 1.9, 20.1, 0.1, 1.8, { c: 9 }),
  F("sweet-potato", "بطاطا حلوة مشوية", "grain", 150, "حبة", 90, 2, 20.7, 0.2, 3.3, { a: 961, c: 20 }),
  F("pasta", "مكرونة مطبوخة", "grain", 160, "كوب", 158, 5.8, 30.9, 0.9, 1.8),
  F("bulgur", "برغل مطبوخ", "grain", 160, "كوب", 83, 3.1, 18.6, 0.2, 4.5, { fe: 1 }),
  // ── vegetables
  F("spinach", "سبانخ نيّئة", "veg", 100, "كوبين", 23, 2.9, 3.6, 0.4, 2.2, { a: 469, c: 28, fol: 194, fe: 2.7, ca: 99 }),
  F("broccoli", "بروكلي مطبوخ", "veg", 150, "كوب", 35, 2.4, 7.2, 0.4, 3.3, { c: 65, fol: 108, a: 77, ca: 40 }),
  F("tomato", "طماطم", "veg", 120, "حبة", 18, 0.9, 3.9, 0.2, 1.2, { c: 14, a: 42 }),
  F("cucumber", "خيار", "veg", 100, "حبة صغيرة", 15, 0.7, 3.6, 0.1, 0.5, { c: 3 }),
  F("carrot", "جزر", "veg", 80, "حبة", 41, 0.9, 9.6, 0.2, 2.8, { a: 835 }),
  F("red-pepper", "فلفل رومي أحمر", "veg", 120, "حبة", 31, 1, 6, 0.3, 2.1, { c: 128, a: 157, fol: 46 }),
  F("lettuce", "خس روماني", "veg", 80, "كوب ونص", 17, 1.2, 3.3, 0.3, 2.1, { a: 436, fol: 136, c: 4 }),
  F("zucchini", "كوسا مطبوخة", "veg", 150, "كوب", 17, 1.1, 3.1, 0.4, 1, { c: 5, fol: 24 }),
  F("okra", "بامية مطبوخة", "veg", 100, "نص كوب", 22, 1.9, 4.5, 0.2, 2.5, { c: 16, fol: 60, ca: 77 }),
  F("eggplant", "باذنجان مطبوخ", "veg", 100, "نص كوب", 35, 0.8, 8.7, 0.2, 2.5),
  // ── fruit
  F("orange", "برتقال", "fruit", 150, "حبة", 47, 0.9, 11.8, 0.1, 2.4, { c: 53, fol: 30 }),
  F("apple", "تفاح", "fruit", 180, "حبة", 52, 0.3, 13.8, 0.2, 2.4, { c: 5 }),
  F("banana", "موز", "fruit", 120, "حبة", 89, 1.1, 22.8, 0.3, 2.6, { c: 9, fol: 20 }),
  F("strawberry", "فراولة", "fruit", 150, "كوب", 32, 0.7, 7.7, 0.3, 2, { c: 59, fol: 24 }),
  F("watermelon", "بطيخ", "fruit", 280, "شريحة كبيرة", 30, 0.6, 7.6, 0.2, 0.4, { c: 8, a: 28 }),
  F("dates", "تمر", "fruit", 48, "ثلاث حبات", 277, 1.8, 75, 0.2, 6.7, { fe: 0.9, ca: 64 }),
  // ── nuts and seeds
  F("almonds", "لوز", "nut", 28, "حفنة", 579, 21.2, 21.6, 49.9, 12.5, { ca: 269, fe: 3.7 }),
  F("walnuts", "جوز", "nut", 28, "حفنة", 654, 15.2, 13.7, 65.2, 6.7, { fe: 2.9, fol: 98 }),
  F("tahini", "طحينة", "nut", 30, "ملعقتين", 595, 17, 21.2, 53.8, 9.3, { ca: 426, fe: 8.9, fol: 98 }),
  F("peanut-butter", "زبدة فول سوداني", "nut", 32, "ملعقتين", 588, 25, 20, 50, 6, { fe: 1.9, fol: 87 }),
  // ── fats
  F("olive-oil", "زيت زيتون", "fat", 13.5, "ملعقة كبيرة", 884, 0, 0, 100, 0),
  F("avocado", "أفوكادو", "fat", 100, "نص حبة", 160, 2, 8.5, 14.7, 6.7, { fol: 81, c: 10 }),
  // ── other
  F("whey", "مسحوق بروتين (واي)", "other", 30, "مغرفة", 400, 80, 10, 5, 0, { ca: 400 }),
];

export const foodById = (id: string) => FOODS.find((f) => f.id === id);

/** Adult daily needs the page measures vitamins and minerals against (US/EU adult reference values, rounded). */
export const DAILY_NEED = {
  male: { a: 900, c: 90, d: 15, b12: 2.4, ca: 1000, fe: 8, fol: 400 },
  female: { a: 700, c: 75, d: 15, b12: 2.4, ca: 1000, fe: 18, fol: 400 },
} as const;

export const MICRO_LABELS: Record<keyof Micros, { name: string; unit: string }> = {
  a: { name: "فيتامين A", unit: "µg" },
  c: { name: "فيتامين C", unit: "ملغ" },
  d: { name: "فيتامين D", unit: "µg" },
  b12: { name: "فيتامين B12", unit: "µg" },
  ca: { name: "الكالسيوم", unit: "ملغ" },
  fe: { name: "الحديد", unit: "ملغ" },
  fol: { name: "الفولات", unit: "µg" },
};
