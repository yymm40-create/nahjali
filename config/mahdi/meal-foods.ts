// «الصحة العلوية» · «شنو أكلت؟»: the foods a person picks from to log a meal — every common kind of rice and egg, the
// Gulf dishes, breads, meats, fish, dairy, legumes, vegetables, fruit, sweets, drinks and fast food — each with what
// 100 g of it gives and the HOUSEHOLD MEASURES people actually use («لقمة يد»، «ملعقة طعام عادية»، «كوب»، «صحن
// متوسط»، «حبة»، «رغيف»…), so nobody has to weigh anything: pick the food, pick the measure and how many, and the page
// counts the calories, protein, carbs and fat. Values are rounded from the USDA FoodData Central tables and typical
// Gulf home recipes (a dish cooked with oil or ghee counts it); they differ with the recipe, so every number is
// approximate. Pure data.

export interface MealUnit {
  id: string;
  label: string;
  /** grams in one of it */
  g: number;
}
export type MealCat = "rice" | "egg" | "bread" | "meat" | "fish" | "dish" | "dairy" | "legume" | "veg" | "fruit" | "sweet" | "drink" | "fast" | "nut";
export interface MealFood {
  id: string;
  name: string;
  cat: MealCat;
  /** per 100 g: calories, protein, carbs, fat */
  per100: { kcal: number; p: number; c: number; f: number };
  units: MealUnit[];
}

export const MEAL_CATS: Record<MealCat, { label: string; icon: string }> = {
  rice: { label: "الرز", icon: "🍚" },
  egg: { label: "البيض", icon: "🥚" },
  bread: { label: "الخبز", icon: "🫓" },
  meat: { label: "اللحم والدجاج", icon: "🍗" },
  fish: { label: "السمك", icon: "🐟" },
  dish: { label: "أطباق البيت", icon: "🍲" },
  dairy: { label: "الألبان", icon: "🥛" },
  legume: { label: "البقوليات", icon: "🫘" },
  veg: { label: "الخضار والسلطة", icon: "🥗" },
  fruit: { label: "الفواكه والتمر", icon: "🍎" },
  sweet: { label: "الحلويات", icon: "🍰" },
  drink: { label: "المشروبات", icon: "☕" },
  fast: { label: "الوجبات السريعة", icon: "🍔" },
  nut: { label: "المكسرات", icon: "🥜" },
};

const u = (id: string, label: string, g: number): MealUnit => ({ id, label, g });
/** the grams unit every food also has, for whoever weighs */
const GRAM = u("g", "غرام", 1);
/** cooked rice, grains and mixed dishes eaten by spoon or by hand */
const SCOOP = [u("spoon", "ملعقة طعام عادية", 15), u("hand", "لقمة يد", 30), u("cup", "كوب", 160), u("plate-s", "صحن صغير", 200), u("plate-m", "صحن متوسط", 300), u("plate-l", "صحن كبير", 450)];
/** a stew, a soup or a dip */
const BOWL = [u("spoon", "ملعقة طعام عادية", 15), u("ladle", "مغرفة", 120), u("bowl-s", "صحن شوربة صغير", 200), u("bowl-m", "صحن متوسط", 300)];
const MEAT = [u("hand", "لقمة يد", 30), u("piece-s", "قطعة صغيرة", 50), u("palm", "حصة بحجم الكف", 100), u("plate-m", "صحن متوسط", 200)];
const SPREAD = [u("tsp", "ملعقة صغيرة", 5), u("spoon", "ملعقة طعام عادية", 15), u("spoon2", "ملعقتين", 30)];
const NUTS = [u("piece", "حبة", 1.2), u("hand", "حفنة (قبضة يد)", 28), u("spoon", "ملعقة طعام عادية", 9), u("cup-q", "ربع كوب", 35)];
const DRINK = [u("finjan", "فنجان", 50), u("cup-tea", "استكانة / كوب شاي", 120), u("mug", "كوب كبير", 250), u("can", "علبة / قارورة صغيرة", 330)];

const M = (id: string, name: string, cat: MealCat, kcal: number, p: number, c: number, f: number, units: MealUnit[]): MealFood => ({ id, name, cat, per100: { kcal, p, c, f }, units: [...units, GRAM] });

export const MEAL_FOODS: MealFood[] = [
  // ── الرز (مطبوخ)
  M("rice-white", "رز أبيض مطبوخ (عادي)", "rice", 130, 2.7, 28.2, 0.3, SCOOP),
  M("rice-basmati", "رز بسمتي مطبوخ", "rice", 121, 3.5, 25.2, 0.4, SCOOP),
  M("rice-jasmine", "رز ياسمين مطبوخ", "rice", 129, 2.7, 28, 0.3, SCOOP),
  M("rice-egyptian", "رز مصري / حبة قصيرة مطبوخ", "rice", 130, 2.4, 28.7, 0.2, SCOOP),
  M("rice-brown", "رز بني مطبوخ", "rice", 123, 2.7, 25.6, 1, SCOOP),
  M("rice-hassawi", "رز حساوي أحمر مطبوخ", "rice", 140, 3, 29, 1, SCOOP),
  M("rice-kabsa", "رز كبسة (الرز بزيته)", "rice", 180, 4, 28, 6, SCOOP),
  M("rice-mandi", "رز مندي", "rice", 175, 3.5, 27, 6, SCOOP),
  M("rice-majboos", "رز مجبوس", "rice", 170, 4, 27, 5, SCOOP),
  M("rice-bukhari", "رز بخاري", "rice", 170, 4, 27, 5.5, SCOOP),
  M("rice-biryani", "برياني (رز مع لحم أو دجاج)", "rice", 190, 8, 25, 7, SCOOP),
  M("rice-vermicelli", "رز بالشعيرية", "rice", 160, 3, 27, 4.5, SCOOP),
  M("rice-ghee", "رز مشخول بالسمن / بالزعفران", "rice", 175, 3, 28, 6, SCOOP),
  M("rice-fried", "رز مقلي (صيني)", "rice", 163, 4, 25, 5, SCOOP),
  M("rice-mashkhool", "رز أبيض بالبهارات والبصل", "rice", 150, 3, 27, 3.5, SCOOP),
  M("rice-pudding", "رز بالحليب (حلا)", "rice", 120, 3.6, 20, 3, [u("spoon", "ملعقة طعام عادية", 20), u("bowl-s", "صحن صغير", 150), u("bowl-m", "صحن متوسط", 250)]),
  // ── البيض
  M("egg-boiled", "بيض مسلوق", "egg", 155, 12.6, 1.1, 10.6, [u("egg", "بيضة", 50), u("half", "نص بيضة", 25)]),
  M("egg-fried-oil", "بيض مقلي بالزيت (عيون)", "egg", 196, 13.6, 0.8, 15, [u("egg", "بيضة", 55)]),
  M("egg-fried-ghee", "بيض مقلي بالسمن / الزبدة", "egg", 210, 13.5, 0.8, 17, [u("egg", "بيضة", 55)]),
  M("egg-scrambled", "بيض مخفوق (مقلقل)", "egg", 149, 10, 1.6, 11, [u("egg", "بيضة", 60), u("spoon", "ملعقة طعام عادية", 15), u("plate-s", "صحن صغير", 120)]),
  M("egg-omelette", "أومليت", "egg", 154, 10.6, 0.6, 11.7, [u("egg", "بيضة (من الأومليت)", 60), u("plate-s", "أومليت بيضتين", 120), u("plate-m", "أومليت ثلاث بيضات", 180)]),
  M("egg-tomato", "بيض بالطماط", "egg", 115, 7, 4, 8, [u("spoon", "ملعقة طعام عادية", 20), u("hand", "لقمة يد", 30), u("plate-s", "صحن صغير", 200)]),
  M("egg-shakshuka", "شكشوكة", "egg", 120, 7, 5, 8, [u("spoon", "ملعقة طعام عادية", 20), u("hand", "لقمة يد", 30), u("plate-s", "صحن صغير", 200), u("plate-m", "صحن متوسط", 300)]),
  M("egg-white", "بياض بيض مسلوق", "egg", 52, 11, 0.7, 0.2, [u("white", "بياضة", 33)]),
  M("egg-yolk", "صفار بيض", "egg", 322, 15.9, 3.6, 26.5, [u("yolk", "صفار", 17)]),
  M("egg-quail", "بيض سمان", "egg", 158, 13, 0.4, 11, [u("egg", "بيضة سمان", 9)]),
  M("egg-mayo", "بيض بالمايونيز (ساندويتش)", "egg", 230, 9, 2, 21, [u("spoon", "ملعقة طعام عادية", 20)]),
  // ── الخبز
  M("bread-pita", "خبز عربي أبيض", "bread", 275, 9.1, 55.7, 1.2, [u("loaf", "رغيف", 60), u("half", "نص رغيف", 30), u("hand", "لقمة", 10)]),
  M("bread-tamees", "خبز تميس", "bread", 290, 8.5, 56, 3.5, [u("loaf", "رغيف", 150), u("quarter", "ربع رغيف", 38), u("hand", "لقمة", 15)]),
  M("bread-samoon", "خبز صامولي", "bread", 280, 9, 53, 3.5, [u("piece", "حبة", 70), u("half", "نص حبة", 35)]),
  M("bread-raqaq", "خبز رقاق", "bread", 300, 9, 62, 1.5, [u("sheet", "رقاقة", 25)]),
  M("bread-toast", "توست أبيض", "bread", 265, 9, 49, 3.2, [u("slice", "شريحة", 28)]),
  M("bread-brown", "توست بر / أسمر", "bread", 247, 13, 41, 3.4, [u("slice", "شريحة", 30)]),
  M("bread-chapati", "خبز شباتي / نان", "bread", 297, 9.8, 49, 7.5, [u("piece", "حبة", 60)]),
  M("bread-paratha", "براتا", "bread", 326, 6.4, 45, 13.2, [u("piece", "حبة", 80)]),
  // ── اللحم والدجاج (مطبوخ)
  M("chicken-grilled", "دجاج مشوي", "meat", 190, 28, 0, 8, [...MEAT, u("quarter", "ربع دجاجة", 250), u("half", "نص دجاجة", 500)]),
  M("chicken-breast", "صدر دجاج مشوي", "meat", 165, 31, 0, 3.6, [...MEAT, u("breast", "صدر كامل", 170)]),
  M("chicken-fried", "دجاج مقلي (بروستد)", "meat", 260, 20, 10, 15, [u("piece", "قطعة", 110), ...MEAT]),
  M("chicken-mandi", "دجاج مندي / كبسة (الدجاج)", "meat", 215, 25, 0, 12.5, [...MEAT, u("quarter", "ربع دجاجة", 250)]),
  M("lamb-mandi", "لحم غنم مندي / مطبوخ", "meat", 260, 25, 0, 17.5, MEAT),
  M("beef-lean", "لحم بقر قليل الدهن", "meat", 217, 26, 0, 11.8, MEAT),
  M("camel", "لحم حاشي مطبوخ", "meat", 165, 27, 0, 6, MEAT),
  M("kebab", "كباب لحم مشوي", "meat", 250, 18, 3, 18.5, [u("skewer", "سيخ", 80), ...MEAT]),
  M("liver", "كبدة مقلية", "meat", 190, 26, 5, 7, [u("spoon", "ملعقة طعام عادية", 20), ...MEAT]),
  M("sausage", "نقانق", "meat", 300, 12, 3, 27, [u("piece", "حبة", 45)]),
  // ── السمك
  M("hamour-fried", "هامور مقلي", "fish", 200, 22, 6, 10, [u("piece", "قطعة", 120), ...MEAT]),
  M("safi-grilled", "صافي / سمك مشوي", "fish", 130, 24, 0, 3.5, [u("piece", "سمكة متوسطة", 200), ...MEAT]),
  M("salmon", "سلمون مشوي", "fish", 206, 22, 0, 12.4, [u("fillet", "شريحة", 120), ...MEAT]),
  M("tuna-water", "تونة بالماء", "fish", 116, 25.5, 0, 0.8, [u("can", "علبة صغيرة", 120), u("spoon", "ملعقة طعام عادية", 15)]),
  M("tuna-oil", "تونة بالزيت", "fish", 198, 29, 0, 8.2, [u("can", "علبة صغيرة", 120), u("spoon", "ملعقة طعام عادية", 15)]),
  M("shrimp", "ربيان مطبوخ", "fish", 99, 24, 0.2, 0.3, [u("piece", "حبة كبيرة", 15), ...MEAT]),
  M("shrimp-fried", "ربيان مقلي", "fish", 242, 21, 11.5, 12.3, [u("piece", "حبة كبيرة", 18), ...MEAT]),
  // ── أطباق البيت
  M("harees", "هريس", "dish", 120, 6.5, 15, 3.8, BOWL),
  M("jareesh", "جريش", "dish", 115, 4.5, 16, 3.5, BOWL),
  M("margoog", "مرقوق", "dish", 110, 6, 13, 3.5, BOWL),
  M("thareed", "ثريد", "dish", 130, 7, 14, 5, BOWL),
  M("saloona", "صالونة / مرق خضار باللحم", "dish", 85, 5.5, 6, 4.5, BOWL),
  M("lentil-soup", "شوربة عدس", "dish", 70, 4, 10, 1.5, BOWL),
  M("oats-soup", "شوربة شوفان / حب", "dish", 60, 2.5, 8, 2, BOWL),
  M("molokhia", "ملوخية", "dish", 55, 3, 5, 2.5, BOWL),
  M("pasta", "مكرونة مطبوخة بالصلصة", "dish", 150, 5, 25, 3.5, SCOOP),
  M("macaroni-bechamel", "مكرونة بشاميل", "dish", 180, 8, 18, 8.5, [u("piece", "قطعة", 200), ...SCOOP]),
  M("samboosa", "سمبوسة مقلية", "dish", 300, 7, 28, 18, [u("piece", "حبة", 35)]),
  M("balaleet", "بلاليط", "dish", 210, 5, 33, 6.5, SCOOP),
  M("mutabbaq", "مطبق", "dish", 270, 9, 25, 15, [u("piece", "حبة", 200), u("quarter", "ربع", 50)]),
  // ── الألبان
  M("laban", "لبن (روب)", "dairy", 63, 3.4, 4.7, 3.3, [u("cup", "كوب", 240), u("small", "علبة صغيرة", 180)]),
  M("milk-full", "حليب كامل الدسم", "dairy", 61, 3.2, 4.8, 3.3, [u("cup", "كوب", 245), u("spoon", "ملعقة طعام عادية", 15)]),
  M("milk-low", "حليب قليل الدسم", "dairy", 50, 3.4, 4.8, 2, [u("cup", "كوب", 245)]),
  M("yogurt", "زبادي", "dairy", 61, 3.5, 4.7, 3.3, [u("tub", "علبة", 170), u("spoon", "ملعقة طعام عادية", 15)]),
  M("labneh", "لبنة", "dairy", 160, 6, 4, 13.5, SPREAD),
  M("cheese-white", "جبن أبيض (فيتا / عكاوي)", "dairy", 264, 14, 4, 21, [u("slice", "شريحة / مكعب", 25), u("spoon", "ملعقة طعام عادية", 15)]),
  M("cheese-cheddar", "جبن شيدر / شرائح", "dairy", 403, 25, 1.3, 33, [u("slice", "شريحة", 20)]),
  M("cheese-cream", "جبن كريمي (مثلثات / بيضاء)", "dairy", 290, 6, 5, 28, [u("triangle", "مثلث", 15), u("spoon", "ملعقة طعام عادية", 15)]),
  // ── البقوليات
  M("foul", "فول مدمس", "legume", 110, 7.6, 19.7, 0.4, BOWL),
  M("foul-oil", "فول بالزيت والطحينة", "legume", 160, 7.5, 17, 7, BOWL),
  M("hummus", "حمص بالطحينة", "legume", 177, 4.9, 14.3, 9.6, SPREAD.concat([u("bowl-s", "صحن صغير", 120)])),
  M("falafel", "فلافل", "legume", 333, 13.3, 31.8, 17.8, [u("piece", "حبة", 17)]),
  M("lentils", "عدس مطبوخ", "legume", 116, 9, 20, 0.4, BOWL),
  M("beans-red", "فاصوليا حمراء مطبوخة", "legume", 127, 8.7, 22.8, 0.5, BOWL),
  // ── الخضار والسلطة
  M("salad-green", "سلطة خضراء بدون صوص", "veg", 20, 1.2, 3.5, 0.2, [u("plate-s", "صحن صغير", 150), u("plate-m", "صحن متوسط", 250)]),
  M("salad-dressing", "سلطة بزيت زيتون / صوص", "veg", 80, 1.2, 4, 6.5, [u("plate-s", "صحن صغير", 150), u("plate-m", "صحن متوسط", 250)]),
  M("fattoush", "فتوش", "veg", 110, 2, 11, 6.5, [u("plate-s", "صحن صغير", 150), u("plate-m", "صحن متوسط", 250)]),
  M("tabbouleh", "تبولة", "veg", 120, 2, 10, 8, [u("spoon", "ملعقة طعام عادية", 20), u("plate-s", "صحن صغير", 150)]),
  M("cucumber", "خيار", "veg", 15, 0.7, 3.6, 0.1, [u("piece", "حبة", 100)]),
  M("tomato", "طماطم", "veg", 18, 0.9, 3.9, 0.2, [u("piece", "حبة", 120)]),
  M("potato-fried", "بطاطس مقلية", "veg", 312, 3.4, 41, 15, [u("piece", "أصبع", 5), u("hand", "حفنة", 50), u("small", "علبة صغيرة", 80), u("medium", "علبة وسط", 115), u("large", "علبة كبيرة", 155)]),
  M("potato-boiled", "بطاطس مسلوقة", "veg", 87, 1.9, 20, 0.1, [u("piece", "حبة متوسطة", 150), u("spoon", "ملعقة طعام عادية", 20)]),
  // ── الفواكه والتمر
  M("dates", "تمر", "fruit", 277, 1.8, 75, 0.2, [u("piece", "حبة", 8), u("hand", "حفنة", 40)]),
  M("dates-sukkari", "تمر سكري", "fruit", 300, 2, 80, 0.3, [u("piece", "حبة", 10)]),
  M("banana", "موز", "fruit", 89, 1.1, 22.8, 0.3, [u("piece", "حبة", 120)]),
  M("apple", "تفاح", "fruit", 52, 0.3, 13.8, 0.2, [u("piece", "حبة", 180)]),
  M("orange", "برتقال", "fruit", 47, 0.9, 11.8, 0.1, [u("piece", "حبة", 150)]),
  M("grapes", "عنب", "fruit", 69, 0.7, 18, 0.2, [u("hand", "حفنة", 80), u("cup", "كوب", 150)]),
  M("watermelon", "بطيخ (حبحب)", "fruit", 30, 0.6, 7.6, 0.2, [u("slice", "شريحة", 280), u("cup", "كوب مكعبات", 150)]),
  M("mango", "مانجو", "fruit", 60, 0.8, 15, 0.4, [u("piece", "حبة", 200), u("cup", "كوب مكعبات", 165)]),
  // ── الحلويات
  M("luqaimat", "لقيمات", "sweet", 330, 4.5, 50, 12.5, [u("piece", "حبة", 15)]),
  M("kunafa", "كنافة", "sweet", 380, 7, 45, 19, [u("piece", "قطعة", 100), u("spoon", "ملعقة طعام عادية", 20)]),
  M("basbousa", "بسبوسة", "sweet", 360, 5, 55, 13, [u("piece", "قطعة", 60)]),
  M("cake", "كيك", "sweet", 370, 5, 50, 17, [u("slice", "شريحة", 70)]),
  M("chocolate", "شوكولاتة بالحليب", "sweet", 535, 7.7, 59, 30, [u("piece", "مربع / قطعة صغيرة", 10), u("bar", "لوح", 45)]),
  M("ice-cream", "آيس كريم", "sweet", 207, 3.5, 24, 11, [u("scoop", "كورة", 65), u("cup", "كوب", 130)]),
  M("halwa", "حلوى عمانية / بحرينية", "sweet", 330, 2, 55, 12, [u("spoon", "ملعقة طعام عادية", 25)]),
  M("biscuit", "بسكويت", "sweet", 480, 6.5, 66, 21, [u("piece", "حبة", 10)]),
  // ── المشروبات
  M("tea-sugar", "شاي بالسكر", "drink", 30, 0, 7.5, 0, DRINK),
  M("tea-milk", "شاي حليب / كرك", "drink", 70, 1.8, 10, 2.5, DRINK),
  M("arabic-coffee", "قهوة عربية", "drink", 2, 0.1, 0.3, 0, DRINK),
  M("coffee-latte", "لاتيه / كابتشينو", "drink", 55, 3, 5, 2.5, DRINK),
  M("juice-orange", "عصير برتقال طبيعي", "drink", 45, 0.7, 10.4, 0.2, DRINK),
  M("juice-packed", "عصير معلّب محلّى", "drink", 50, 0.1, 12.5, 0, DRINK),
  M("soda", "مشروب غازي", "drink", 42, 0, 10.6, 0, DRINK),
  M("laban-up", "لبن مخيض", "drink", 40, 3.3, 4.8, 0.9, DRINK),
  // ── الوجبات السريعة
  M("burger", "برجر لحم (ساندويتش)", "fast", 260, 13, 25, 12, [u("piece", "ساندويتش", 220)]),
  M("burger-chicken", "برجر دجاج مقلي", "fast", 270, 12, 27, 13, [u("piece", "ساندويتش", 200)]),
  M("shawarma-chicken", "شاورما دجاج (ساندويتش)", "fast", 220, 14, 22, 9, [u("piece", "ساندويتش", 250), u("plate", "صحن عربي", 450)]),
  M("shawarma-meat", "شاورما لحم (ساندويتش)", "fast", 240, 13, 21, 12, [u("piece", "ساندويتش", 250)]),
  M("pizza", "بيتزا", "fast", 270, 11, 33, 10, [u("slice", "شريحة", 110)]),
  M("nuggets", "ناجتس دجاج", "fast", 296, 15, 16, 19, [u("piece", "قطعة", 16)]),
  // ── المكسرات
  M("almonds", "لوز", "nut", 579, 21.2, 21.6, 49.9, NUTS),
  M("peanuts", "فول سوداني", "nut", 567, 25.8, 16.1, 49.2, NUTS),
  M("cashew", "كاجو", "nut", 553, 18.2, 30.2, 43.9, NUTS),
  M("pistachio", "فستق", "nut", 562, 20.2, 27.2, 45.3, NUTS),
  M("seeds-sunflower", "حب شمسي (مقشر)", "nut", 584, 20.8, 20, 51.5, NUTS),
];

export const mealFoodById = (id: string) => MEAL_FOODS.find((f) => f.id === id);

/** The common amounts offered next to a measure (half a spoon, a spoon and a half…). */
export const MEAL_QTYS = [0.5, 1, 1.5, 2, 3, 4, 5, 6] as const;

/** What `qty` of a food's `unit` gives (grams and the four numbers, rounded for showing). */
export function mealOf(food: MealFood, unitId: string, qty: number) {
  const unit = food.units.find((x) => x.id === unitId) ?? food.units[0];
  const g = Math.max(0, unit.g * qty);
  const k = g / 100;
  return { g: Math.round(g), kcal: Math.round(food.per100.kcal * k), p: Math.round(food.per100.p * k * 10) / 10, c: Math.round(food.per100.c * k * 10) / 10, f: Math.round(food.per100.f * k * 10) / 10, unit };
}
