// «الصحة العلوية»: the plan engine. From what the person entered (body, goal, pregnancy, days, place) it computes the
// nutrition targets and builds the training table, and it turns a plan into habits of «لأجل المهدي». Every number
// comes from the research (config/mahdi/health-research.ts → REF). Pure, no AI and no cost: the same input always
// gives the same plan, and the person can change any part of it.

import { REF } from "@config/mahdi/health-research";

export type Sex = "male" | "female";
export type Stage = "none" | "pregnant" | "postpartum" | "breastfeeding";
export type Goal = "lose" | "muscle" | "strength" | "fit" | "health";
export type Track = "gym" | "food" | "both";
export type Level = "beginner" | "intermediate" | "advanced";
export type Place = "gym" | "home" | "body";
export type SplitPreference = "auto" | "full" | "upper-lower" | "ppl";
export type Activity = keyof typeof REF.activity;

export interface HealthProfile {
  track: Track;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  /** one or more goals together (losing fat and building muscle is a «recomposition») */
  goals: Goal[];
  stage: Stage;
  /** pregnancy week (1–42) */
  pregWeek: number;
  /** months since the birth (postpartum / breastfeeding) */
  babyMonths: number;
  /** trained regularly before the pregnancy */
  wasActive: boolean;
  /** the doctor did not forbid exercise (needed in pregnancy and the first months after birth) */
  clearance: boolean;
  /** ACOG contraindications the person ticked */
  redFlags: string[];
  level: Level;
  place: Place;
  /** the training system the person chose; auto picks the safest fit for their number of days */
  splitPreference: SplitPreference;
  /**
   * the training days of the plan: their ids (0…6), one per day — «اليوم ١، اليوم ٢…». They are NOT weekdays: the plan is a
   * rotation the person follows whenever they train (an old plan saved weekdays; the same numbers now just name its days).
   */
  days: number[];
  minutes: number;
  meals: number;
}

export const DEFAULT_PROFILE: HealthProfile = {
  track: "both",
  sex: "male",
  age: 28,
  heightCm: 172,
  weightKg: 75,
  activity: "light",
  goals: ["fit"],
  stage: "none",
  pregWeek: 12,
  babyMonths: 2,
  wasActive: false,
  clearance: false,
  redFlags: [],
  level: "beginner",
  place: "gym",
  splitPreference: "auto",
  days: [0, 2, 4],
  minutes: 60,
  meals: 3,
};

export const LABELS = {
  goal: { lose: "نزول وزن (حرق دهون)", muscle: "بناء عضل", strength: "قوة", fit: "لياقة وشكل متناسق", health: "صحة عامة" } as Record<Goal, string>,
  activity: { sedentary: "قليل الحركة (مكتب)", light: "حركة خفيفة", moderate: "نشيط (شغل فيه حركة)", active: "نشيط جدًا", very: "شغل بدني شاق" } as Record<Activity, string>,
  level: { beginner: "مبتدئ", intermediate: "متوسط", advanced: "متقدم" } as Record<Level, string>,
  place: { gym: "جيم (نادي)", home: "جيم بيتي (عندي أدوات)", body: "بدون أدوات (وزن الجسم)" } as Record<Place, string>,
  stage: { none: "لا", pregnant: "حامل", postpartum: "بعد الولادة", breastfeeding: "مرضعة" } as Record<Stage, string>,
  track: { gym: "الجيم بس", food: "التغذية بس", both: "الجيم والتغذية" } as Record<Track, string>,
};

export const SPLIT_CHOICES: Record<SplitPreference, { name: string; hint: string; minDays: number }> = {
  auto: { name: "اقترح الأنسب لي", hint: "نختار النظام حسب عدد أيامك ومستواك", minDays: 1 },
  full: { name: "جسم كامل", hint: "أشهر تمرين لكل عضلة؛ ممتاز لـ2–3 أيام", minDays: 1 },
  "upper-lower": { name: "علوي / سفلي", hint: "يوم للجزء العلوي ويوم للسفلي؛ ممتاز لـ4 أيام", minDays: 2 },
  ppl: { name: "Push / Pull / Legs", hint: "دفع، سحب، أرجل؛ يحتاج 3 أيام على الأقل", minDays: 3 },
};

export const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export const arNum = (n: number) => String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);
/** «اليوم ١» … the plan's days by their place in the rotation (no calendar). */
export const dayLabel = (i: number) => `اليوم ${arNum(i + 1)}`;
/** n training days → their ids 0…n−1 */
export const daysOfCount = (n: number) => Array.from({ length: Math.min(7, Math.max(1, Math.round(n))) }, (_, i) => i);

/** ACOG 804: absolute contraindications to aerobic exercise in pregnancy */
export const RED_FLAGS = [
  { id: "heart", text: "مرض قلب أو رئة مهم" },
  { id: "cervix", text: "ضعف عنق الرحم أو ربطه" },
  { id: "twins", text: "حمل توأم مع خطر ولادة مبكرة" },
  { id: "bleed", text: "نزيف مستمر في الثلث الثاني أو الثالث" },
  { id: "previa", text: "مشيمة منزاحة بعد الأسبوع 26" },
  { id: "preterm", text: "طلق مبكر في هذا الحمل" },
  { id: "membranes", text: "نزول ماء (تمزق الأغشية)" },
  { id: "preeclampsia", text: "تسمم حمل أو ضغط حمل غير منضبط" },
  { id: "anemia", text: "فقر دم شديد" },
];

/** ACOG 804: stop and call the doctor */
export const STOP_SIGNS = ["نزيف من المهبل", "انقباضات منتظمة مؤلمة", "نزول ماء", "ضيق تنفس قبل الجهد", "دوخة", "صداع", "ألم في الصدر", "ضعف عضلات يأثر على التوازن", "ألم أو تورم في السمانة"];

export const GOALS: Goal[] = ["lose", "muscle", "strength", "fit", "health"];
export const has = (p: HealthProfile, g: Goal) => p.goals.includes(g);
/** fat share 25% when the plan builds muscle or strength without a cut */
export const buildsMuscle = (p: HealthProfile) => (has(p, "muscle") || has(p, "strength")) && !has(p, "lose");
/** the goals a saved or sent profile asks for (an old profile had one «goal») */
function goalsOf(o: Record<string, unknown>): Goal[] {
  const raw = Array.isArray(o.goals) ? o.goals : typeof o.goal === "string" ? [o.goal] : [];
  const out = GOALS.filter((g) => raw.includes(g));
  return out.length ? out : ["fit"];
}

export const trimester = (week: number): 1 | 2 | 3 => (week <= 13 ? 1 : week <= 27 ? 2 : 3);
/** pregnancy, or the first 3 months after birth: the gentle table */
export const gentle = (p: HealthProfile) => p.sex === "female" && (p.stage === "pregnant" || (p.stage !== "none" && p.babyMonths < 3));
const isPreg = (p: HealthProfile) => p.sex === "female" && p.stage === "pregnant";
const isLact = (p: HealthProfile) => p.sex === "female" && p.stage === "breastfeeding";
const r5 = (n: number) => Math.round(n / 5) * 5;
const r50 = (n: number) => Math.round(n / 50) * 50;

// ─── nutrition ─────────────────────────────────────────────────────────────

export interface Nutrition {
  bmi: number;
  bmr: number;
  tdee: number;
  kcal: number;
  proteinG: number;
  /** per meal */
  proteinMealG: number;
  fatG: number;
  carbG: number;
  fiberG: number;
  waterCups: number;
  waterL: number;
  produce: number;
  saltG: number;
  sugarG: number;
  steps: number;
  /** pregnancy: the IOM range of total gain for her BMI */
  gwg: { label: string; min: number; max: number } | null;
  notes: string[];
}

export const bmiOf = (kg: number, cm: number) => Math.round((kg / (cm / 100) ** 2) * 10) / 10;

export function nutrition(p: HealthProfile): Nutrition {
  const M = REF.mifflin;
  const bmi = bmiOf(p.weightKg, p.heightCm);
  const bmr = Math.round(M.weight * p.weightKg + M.height * p.heightCm - M.age * p.age + (p.sex === "male" ? M.male : M.female));
  const tdee = Math.round(bmr * REF.activity[p.activity]);
  const notes: string[] = [];
  const minor = p.age < 18;
  const preg = isPreg(p);
  const lact = isLact(p);

  let kcal = tdee;
  if (preg) {
    kcal += REF.pregnancyKcal[`t${trimester(p.pregWeek)}` as "t1" | "t2" | "t3"];
    notes.push("الحمل مو وقت رجيم: ما فيه عجز في السعرات حتى لو الهدف نزول وزن. السعرات الإضافية تبدأ من الثلث الثاني.");
  } else if (lact) {
    kcal += p.babyMonths < 6 ? REF.lactationKcal.early : REF.lactationKcal.late;
    if (has(p, "lose")) {
      kcal -= 300;
      notes.push("نزول هادي أثناء الرضاعة (حوالي نصف كيلو بالأسبوع كحد أعلى) عشان الحليب وصحتك.");
    }
  } else if (minor) {
    notes.push("تحت 18 سنة: بدون رجيم أو عجز في السعرات إلا بإشراف طبيب؛ ركّز على الحركة والأكل الصحي.");
  } else if (has(p, "lose") && has(p, "muscle")) {
    kcal = tdee * (1 - REF.deficit / 2);
    notes.push("حرق دهون وبناء عضل مع بعض (إعادة تشكيل الجسم): عجز بسيط 10% مع بروتين عالي ومقاومة منتظمة، والوزن ينزل ببطء والشكل يتحسن.");
  } else if (has(p, "lose")) {
    kcal = tdee * (1 - REF.deficit);
    notes.push("عجز حوالي 20%: نزول تقريبًا 0.5–1% من وزنك بالأسبوع مع الحفاظ على عضلك (بشرط البروتين والمقاومة).");
  } else if (has(p, "muscle")) {
    kcal = tdee * (1 + REF.surplus);
    notes.push("زيادة بسيطة 10% فوق حاجتك: عضل أكثر ودهون أقل من التضخيم القوي.");
  }
  const floor = REF.kcalFloor[p.sex];
  if (kcal < floor) {
    kcal = floor;
    notes.push(`ما ننزل تحت ${floor} سعرة بدون إشراف طبي.`);
  }
  kcal = r50(kcal);

  // protein on a reference weight (BMI 25) when the BMI is 30+, so it is not inflated by fat mass
  const refKg = bmi >= 30 ? 25 * (p.heightCm / 100) ** 2 : p.weightKg;
  const trains = p.track !== "food";
  let perKg: number = REF.protein.health;
  if (preg) perKg = REF.proteinPregnancy;
  else if (lact) perKg = REF.proteinLactation;
  else if (has(p, "lose") && !minor) perKg = REF.protein.cut;
  else if ((has(p, "muscle") || has(p, "strength")) && trains) perKg = REF.protein.muscle;
  else if (trains || p.activity !== "sedentary") perKg = REF.protein.active;
  let proteinG = r5(perKg * refKg);
  if (preg) proteinG = Math.max(proteinG, REF.proteinPregnancyMinG);
  const proteinMealG = Math.min(40, Math.max(20, r5(proteinG / Math.max(3, p.meals))));

  const fatShare = buildsMuscle(p) ? REF.fatShareMuscle : REF.fatShare;
  const fatG = r5((kcal * fatShare) / 9);
  const carbG = Math.max(0, r5((kcal - proteinG * 4 - fatG * 9) / 4));
  const fiberG = Math.round((kcal / 1000) * REF.fiberPer1000);

  const W = REF.waterL;
  const waterTotal = W[p.sex] + (preg ? W.pregnancy : 0) + (lact ? W.lactation : 0);
  const waterL = Math.round(waterTotal * REF.drinkShare * 10) / 10;
  const waterCups = Math.round((waterL * 1000) / REF.cupMl);

  let gwg: Nutrition["gwg"] = null;
  if (preg) {
    const g = REF.gwg.find((x) => bmi < x.maxBmi) ?? REF.gwg[REF.gwg.length - 1];
    gwg = { label: g.label, min: g.min, max: g.max };
    notes.push(`حمض الفوليك ${REF.folicAcidUg} ميكروغرام يوميًا، والحديد والفيتامينات حسب وصف طبيبتك.`);
    notes.push(`الكافيين أقل من ${REF.caffeinePregnancyMg} ملغ يوميًا، وسمك قليل الزئبق 2–3 مرات بالأسبوع، وبدون لحم أو بيض نيّ أو أجبان غير مبسترة.`);
  }
  if (p.sex === "female" && p.stage === "none" && p.age >= 18 && p.age < 50) notes.push("المرأة تحتاج حديد أكثر (18 ملغ يوميًا): لحم أحمر، عدس، سبانخ مع فيتامين C.");

  return {
    bmi,
    bmr,
    tdee,
    kcal,
    proteinG,
    proteinMealG,
    fatG,
    carbG,
    fiberG,
    waterCups,
    waterL,
    produce: REF.produceServings,
    saltG: REF.saltMaxG,
    sugarG: Math.round((kcal * REF.sugarShareMax) / 4),
    steps: p.age >= 60 ? REF.steps.over60 : REF.steps.under60,
    gwg,
    notes,
  };
}

// ─── exercises ─────────────────────────────────────────────────────────────

export type Muscle =
  | "quads" | "hinge" | "glutes" | "hams" | "calves" | "chest" | "backV" | "backH" | "shoulders" | "laterals" | "rear" | "biceps" | "triceps" | "core" | "pelvic";

export interface Exercise {
  id: string;
  name: string;
  muscle: Muscle;
  compound: boolean;
  /** a full gym (machines, cables, barbells) */
  gym: boolean;
  /** a home gym: dumbbells, an adjustable bench, bands, a pull-up bar */
  home: boolean;
  /** nothing at all: the body, a chair, a towel, a step, a wall */
  body: boolean;
  /** suitable in pregnancy (no lying on the back, no heavy bracing, no fall risk) */
  preg: boolean;
  cue: string;
}

/** where: g = gym, h = home gym, b = no equipment (what needs nothing works everywhere) */
const X = (id: string, name: string, muscle: Muscle, compound: boolean, where: string, preg: boolean, cue: string): Exercise => {
  const b = where.includes("b");
  return { id, name, muscle, compound, gym: b || where.includes("g"), home: b || where.includes("h"), body: b, preg, cue };
};

export const EXERCISES: Exercise[] = [
  // الفخذ الأمامي
  X("back-squat", "سكوات بالبار", "quads", true, "g", false, "الصدر مرفوع، انزل لين الفخذ موازي الأرض"),
  X("leg-press", "ليق برس (دفع الأرجل)", "quads", true, "g", true, "لا تقفل الركبة فوق"),
  X("goblet-squat", "سكوات بالدمبل (جوبلت)", "quads", true, "gh", true, "الدمبل قدام صدرك، الركب مع اتجاه الأصابع"),
  X("bw-squat", "سكوات بوزن الجسم", "quads", true, "b", false, "انزل ببطء ثلاث ثواني، واطلع بقوة"),
  X("box-squat", "سكوات على كرسي", "quads", true, "b", true, "اقعد على الكرسي بهدوء وقوم"),
  X("split-squat", "سبليت سكوات (طعن ثابت)", "quads", true, "b", true, "مسك شي للتوازن لو تحتاج"),
  X("bulgarian", "بلغاري سبليت سكوات (رجل على الكنبة)", "quads", true, "b", false, "الرجل الخلفية على الكنبة، انزل بالأمامية"),
  X("leg-ext", "ليق إكستنشن", "quads", false, "g", true, "نزول بطيء"),
  // الخلفية والورك
  X("rdl", "رومانيان ديدلفت", "hinge", true, "gh", false, "ظهر مستقيم والورك لورا"),
  X("deadlift", "ديدلفت", "hinge", true, "g", false, "البار قريب من جسمك، ادفع الأرض"),
  X("hip-hinge-band", "انحناء الورك بالمطاط", "hinge", true, "gh", true, "حركة من الورك بدون ثقل كبير"),
  X("sl-rdl", "رومانيان على رجل وحدة (بدون وزن)", "hinge", true, "b", false, "ظهرك مستقيم، ومسك الجدار لو تحتاج"),
  X("good-morning", "جود مورنينق بوزن الجسم", "hinge", true, "b", true, "اليدين ورا الراس والورك لورا"),
  // المؤخرة
  X("hip-thrust", "هيب ثرست", "glutes", true, "gh", false, "اعصر المؤخرة فوق ثانية"),
  X("glute-bridge", "جسر المؤخرة على الأرض", "glutes", true, "b", false, "اعصر فوق ثانيتين"),
  X("cable-kickback", "ركلة للخلف بالكيبل", "glutes", false, "g", true, "واقف وماسك الجهاز"),
  X("step-up", "طلوع على درجة", "glutes", true, "b", true, "درجة منخفضة في الحمل"),
  X("side-clam", "تمرين الصدفة على الجنب", "glutes", false, "b", true, "على جنبك، افتح الركبة وارجع"),
  // الفخذ الخلفي
  X("leg-curl", "ليق كيرل جالس", "hams", false, "g", true, "نزول بطيء"),
  X("db-leg-curl", "ليق كيرل بالدمبل على البطن", "hams", false, "h", false, "الدمبل بين القدمين، نزول بطيء"),
  X("ham-slide", "سحب الكعب بالمنشفة على الأرض", "hams", false, "b", false, "الورك فوق والكعب على منشفة"),
  // السمانة
  X("calf-raise", "رفع السمانة واقف", "calves", false, "b", true, "ثانية فوق وثانية تحت، على درجة لو تقدر"),
  // الصدر
  X("bench", "بنش برس بالبار", "chest", true, "g", false, "الكتف لورا والقدم ثابتة"),
  X("incline-db", "ضغط دمبل على مقعد مائل", "chest", true, "gh", true, "المقعد مائل (مو مسطح) في الحمل"),
  X("chest-press", "جهاز ضغط الصدر جالس", "chest", true, "g", true, "ظهرك على المسند"),
  X("pushup", "ضغط (بوش أب)", "chest", true, "b", false, "جسمك خط مستقيم، وعلى الركب لو صعب"),
  X("incline-pushup", "ضغط على طاولة أو جدار", "chest", true, "b", true, "كل ما ارتفعت اليد صار أسهل"),
  X("decline-pushup", "ضغط والرجلين على الكنبة", "chest", true, "b", false, "أصعب من العادي، للأعلى الصدر"),
  X("cable-fly", "فراشة بالكيبل", "chest", false, "g", true, "ضمّ اليدين قدامك"),
  X("db-fly", "فراشة دمبل على مقعد مائل", "chest", false, "h", true, "الكوع مثني شوي"),
  // الظهر (عرض)
  X("pulldown", "سحب أمامي (لات بول داون)", "backV", true, "g", true, "اسحب للصدر والكتف تحت"),
  X("pullup", "عقلة", "backV", true, "gh", false, "بالمطاط المساعد أو الجهاز لو تحتاج"),
  X("band-pulldown", "سحب المطاط من فوق", "backV", true, "h", true, "اربط المطاط فوق الباب"),
  X("towel-pulldown", "سحب المنشفة لتحت (شد ثابت)", "backV", true, "b", true, "شد المنشفة للجنبين وأنت تنزلها ورا راسك"),
  X("superman", "سوبرمان على البطن", "backV", false, "b", false, "ارفع اليدين والرجلين وثبّت ثانيتين"),
  // الظهر (سماكة)
  X("seated-row", "سحب جالس بالكيبل", "backH", true, "g", true, "ظهرك مستقيم والكوع لورا"),
  X("db-row", "سحب دمبل بيد وحدة", "backH", true, "gh", true, "ساند يدك وركبتك على مقعد"),
  X("band-row", "سحب المطاط جالس", "backH", true, "h", true, "اعصر بين الكتفين"),
  X("barbell-row", "سحب بالبار منحني", "backH", true, "g", false, "ظهر مستقيم"),
  X("table-row", "سحب تحت طاولة قوية", "backH", true, "b", false, "تأكد إن الطاولة ثابتة، اسحب صدرك لها"),
  X("door-row", "سحب على إطار الباب بالمنشفة", "backH", true, "b", true, "لف المنشفة على مقبض الباب واسحب جسمك"),
  // الكتف
  X("ohp", "ضغط كتف واقف بالبار", "shoulders", true, "g", false, "شد البطن ولا تقوّس الظهر"),
  X("seated-db-press", "ضغط كتف دمبل جالس", "shoulders", true, "gh", true, "ظهرك على المسند"),
  X("pike-pushup", "ضغط الكتف (بايك بوش أب)", "shoulders", true, "b", false, "الورك فوق والراس ينزل بين اليدين"),
  X("wall-press", "ضغط كتف على الجدار", "shoulders", true, "b", true, "واقف مايل على الجدار، ادفع للأعلى"),
  X("lateral-raise", "رفرفة جانبي", "laterals", false, "gh", true, "لين مستوى الكتف"),
  X("bottle-raise", "رفرفة جانبي بقناني ماء", "laterals", false, "b", true, "قنينتين مليانة، لين مستوى الكتف"),
  X("face-pull", "فيس بول (كيبل للوجه)", "rear", false, "g", true, "اسحب لعيونك والكوع عالي"),
  X("band-pull-apart", "فتح المطاط قدامك", "rear", false, "h", true, "اعصر بين الكتفين"),
  X("rear-fly", "رفرفة خلفي جالس", "rear", false, "gh", true, "خفيف وبتحكم"),
  X("ytw", "رفع Y-T-W على البطن", "rear", false, "b", false, "اليدين بشكل الحروف، ثانية فوق"),
  X("wall-angel", "ملاك الجدار", "rear", false, "b", true, "ظهرك على الجدار وحرك يدينك فوق وتحت"),
  // الذراع
  X("db-curl", "بايسبس دمبل", "biceps", false, "gh", true, "الكوع ثابت جنبك"),
  X("cable-curl", "بايسبس كيبل", "biceps", false, "g", true, "نزول بطيء"),
  X("hammer-curl", "بايسبس هامر", "biceps", false, "gh", true, "الكف يقابل الجسم"),
  X("towel-curl", "بايسبس بالمنشفة (رجلك تقاوم)", "biceps", false, "b", true, "المنشفة تحت قدمك، اسحب وقاوم بالرجل"),
  X("bag-curl", "بايسبس بشنطة فيها أغراض", "biceps", false, "b", true, "عبّها كتب أو ماي، الكوع ثابت"),
  X("pushdown", "ترايسبس كيبل للأسفل", "triceps", false, "g", true, "الكوع ثابت"),
  X("overhead-ext", "ترايسبس دمبل فوق الراس", "triceps", false, "gh", true, "جالس وظهرك مسنود"),
  X("bench-dip", "ترايسبس على الكرسي", "triceps", false, "b", false, "الكرسي ثابت"),
  X("diamond-pushup", "ضغط ضيق (للترايسبس)", "triceps", true, "b", false, "اليدين قريبة والكوع لصق الجسم"),
  X("wall-tri", "ترايسبس على الجدار", "triceps", false, "b", true, "الساعدين على الجدار وادفع بالكف"),
  // البطن والثبات
  X("plank", "بلانك", "core", false, "b", false, "جسمك خط مستقيم"),
  X("pallof", "بالوف برس (ثبات البطن)", "core", false, "gh", true, "قاوم الدوران"),
  X("dead-bug", "ديد بق", "core", false, "b", false, "أسفل الظهر لاصق بالأرض"),
  X("bird-dog", "بيرد دوق (على الأربع)", "core", false, "b", true, "يد ورجل عكسية ببطء"),
  X("side-plank-knee", "بلانك جانبي على الركبة", "core", false, "b", true, "الورك مرفوع"),
  X("kegel", "تمارين قاع الحوض (كيجل)", "pelvic", false, "b", true, "شد 3–5 ثواني وارخِ، 10 مرات"),
];

export const exerciseById = (id: string) => EXERCISES.find((e) => e.id === id);

/** Familiar staples first: free weights and the common machines, never novelty exercises unless they are the fallback. */
const POPULAR: Record<Muscle, string[]> = {
  quads: ["back-squat", "goblet-squat", "leg-press", "split-squat", "leg-ext", "bw-squat", "box-squat", "bulgarian"],
  hinge: ["rdl", "deadlift", "hip-hinge-band", "good-morning", "sl-rdl"],
  glutes: ["hip-thrust", "glute-bridge", "step-up", "cable-kickback", "side-clam"],
  hams: ["leg-curl", "db-leg-curl", "ham-slide"],
  calves: ["calf-raise"],
  chest: ["bench", "incline-db", "chest-press", "pushup", "cable-fly", "db-fly", "incline-pushup", "decline-pushup"],
  backV: ["pulldown", "pullup", "band-pulldown", "superman", "towel-pulldown"],
  backH: ["db-row", "barbell-row", "seated-row", "band-row", "table-row", "door-row"],
  shoulders: ["seated-db-press", "ohp", "pike-pushup", "wall-press"],
  laterals: ["lateral-raise", "bottle-raise"],
  rear: ["rear-fly", "face-pull", "band-pull-apart", "wall-angel", "ytw"],
  biceps: ["db-curl", "hammer-curl", "cable-curl", "bag-curl", "towel-curl"],
  triceps: ["pushdown", "overhead-ext", "diamond-pushup", "bench-dip", "wall-tri"],
  core: ["plank", "pallof", "dead-bug", "bird-dog", "side-plank-knee"],
  pelvic: ["kegel"],
};

// ─── training table ────────────────────────────────────────────────────────

export type Focus = "full" | "upper" | "lower" | "push" | "pull" | "legs" | "gentle";

export const FOCUS: Record<Focus, { name: string; slots: Muscle[] }> = {
  full: { name: "جسم كامل", slots: ["quads", "backV", "chest", "hinge", "backH", "shoulders", "core", "laterals"] },
  upper: { name: "الجزء العلوي", slots: ["chest", "backV", "shoulders", "backH", "triceps", "biceps", "laterals", "rear"] },
  lower: { name: "الجزء السفلي", slots: ["quads", "hinge", "glutes", "hams", "calves", "core", "quads"] },
  push: { name: "دفع (صدر · كتف · ترايسبس)", slots: ["chest", "shoulders", "chest", "laterals", "triceps", "triceps", "core"] },
  pull: { name: "سحب (ظهر · بايسبس)", slots: ["backV", "backH", "rear", "biceps", "backH", "biceps", "core"] },
  legs: { name: "أرجل", slots: ["quads", "hinge", "glutes", "hams", "calves", "core", "quads"] },
  gentle: { name: "مقاومة خفيفة آمنة", slots: ["quads", "backH", "chest", "glutes", "backV", "core", "pelvic"] },
};

export interface PlanItem {
  exId: string;
  sets: number;
  reps: string;
  restSec: number;
}

export interface PlanDay {
  /** the day's id in the rotation (0…6); the name is historical — it is not a weekday any more */
  weekday: number;
  focus: Focus;
  /** more than one type on the same day (e.g. push + legs); the first is `focus` */
  focuses?: Focus[];
  /** A / B … when the same focus repeats in the week */
  variant: number;
  items: PlanItem[];
  cardioMin: number;
}

export interface Workout {
  split: string;
  days: PlanDay[];
  weeklyCardioMin: number;
  /** null = no training table (a reason to see the doctor first) */
  blocked: string | null;
  notes: string[];
}

export const placeOk = (e: Exercise, place: Place) => (place === "gym" ? e.gym : place === "home" ? e.home : e.body);

export function candidates(muscle: Muscle, p: HealthProfile): Exercise[] {
  const soft = gentle(p);
  const rank = POPULAR[muscle];
  return EXERCISES.filter((e) => e.muscle === muscle && placeOk(e, p.place) && (!soft || e.preg)).sort((a, b) => {
    const ai = rank.indexOf(a.id);
    const bi = rank.indexOf(b.id);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });
}

export function splitFor(p: HealthProfile): Focus[] {
  const n = p.days.length;
  if (gentle(p)) return Array(n).fill("gentle");
  const chosen = SPLIT_CHOICES[p.splitPreference].minDays <= n ? p.splitPreference : "auto";
  if (chosen === "full") return Array(n).fill("full");
  if (chosen === "upper-lower") return Array.from({ length: n }, (_, i) => (i % 2 ? "lower" : "upper"));
  if (chosen === "ppl") return Array.from({ length: n }, (_, i) => (["push", "pull", "legs"] as Focus[])[i % 3]);
  if (n <= 3) return Array(n).fill("full");
  if (n === 4) return ["upper", "lower", "upper", "lower"];
  if (n === 5) return ["upper", "lower", "push", "pull", "legs"];
  // 6 or 7 days (no compulsory rest day): push / pull / legs in turn
  return Array.from({ length: n }, (_, i) => (["push", "pull", "legs"] as Focus[])[i % 3]);
}

export const SPLIT_NAMES: Record<string, string> = {
  full: "جسم كامل كل حصة",
  "upper-lower": "علوي / سفلي",
  "ul-ppl": "علوي / سفلي + دفع / سحب / أرجل",
  ppl: "دفع / سحب / أرجل",
  gentle: "مقاومة خفيفة آمنة + مشي",
};

/** sets, reps and rest for one exercise */
export function dose(ex: Exercise, p: HealthProfile): Omit<PlanItem, "exId"> {
  if (ex.muscle === "pelvic") return { sets: 3, reps: "10", restSec: 30 };
  if (gentle(p)) return { sets: 2, reps: "10–15", restSec: 60 };
  const sets = p.level === "beginner" ? (ex.compound ? 3 : 2) : p.level === "advanced" && ex.compound ? 4 : 3;
  if (ex.muscle === "core") return { sets: Math.min(sets, 3), reps: ex.id === "plank" ? "30–45 ث" : "10–12", restSec: 45 };
  if (has(p, "strength") && ex.compound) return { sets: p.level === "beginner" ? 3 : 4, reps: "4–6", restSec: 180 };
  if (ex.compound) return { sets, reps: has(p, "muscle") ? "6–10" : "8–12", restSec: 120 };
  return { sets, reps: "10–15", restSec: 75 };
}

/** how many exercises fit the session */
export const perSession = (minutes: number) => (minutes <= 30 ? 4 : minutes <= 45 ? 5 : minutes <= 60 ? 6 : 7);

/** Start with the smallest useful table. The person can add one familiar exercise later from the alternatives. */
export const exerciseLimit = (p: HealthProfile) => Math.min(perSession(p.minutes), p.level === "beginner" ? 4 : p.level === "intermediate" ? 5 : 6);

export function buildDay(p: HealthProfile, weekday: number, focus: Focus, variant: number): PlanDay {
  const slots = FOCUS[focus].slots.slice(0, exerciseLimit(p));
  const used = new Set<string>();
  const items: PlanItem[] = [];
  slots.forEach((m) => {
    const list = candidates(m, p).filter((e) => !used.has(e.id));
    if (!list.length) return;
    const ex = list[0];
    used.add(ex.id);
    items.push({ exId: ex.id, ...dose(ex, p) });
  });
  return { weekday, focus, variant, items, cardioMin: 0 };
}

/** every type the day trains (one or more) */
export const dayFocuses = (d: PlanDay): Focus[] => (d.focuses?.length ? d.focuses : [d.focus]);
/** «دفع + أرجل» */
export const focusName = (d: PlanDay) => dayFocuses(d).map((f) => FOCUS[f].name.replace(/ \(.*\)$/, "")).join(" + ");

/**
 * A day built from one or more types: their muscle slots taken in turn (push, legs, push, legs…) without repeating an
 * exercise; two types get a little more room than one.
 */
export function buildDayFrom(p: HealthProfile, id: number, focuses: Focus[], variant = 0, cardioMin = 0): PlanDay {
  const list = [...new Set(focuses.filter((f) => FOCUS[f]))];
  const fs: Focus[] = list.length ? list : ["full"];
  if (fs.length === 1) return { ...buildDay(p, id, fs[0], variant), cardioMin };
  const limit = Math.min(9, exerciseLimit(p) + 2 * (fs.length - 1));
  const slots: Muscle[] = [];
  for (let i = 0; slots.length < limit && i < 10; i++) for (const f of fs) if (FOCUS[f].slots[i] && slots.length < limit) slots.push(FOCUS[f].slots[i]);
  const used = new Set<string>();
  const items: PlanItem[] = [];
  for (const m of slots) {
    const ex = candidates(m, p).find((e) => !used.has(e.id));
    if (!ex) continue;
    used.add(ex.id);
    items.push({ exId: ex.id, ...dose(ex, p) });
  }
  return { weekday: id, focus: fs[0], focuses: fs, variant, items, cardioMin };
}

export function workout(p: HealthProfile): Workout {
  const notes: string[] = [];
  if (p.sex === "female" && p.stage === "pregnant") {
    if (p.redFlags.length) return { split: "gentle", days: [], weeklyCardioMin: 0, blocked: "عندك حالة من الموانع الطبية للرياضة في الحمل؛ لازم طبيبتك تحدد لك وش المسموح قبل أي جدول.", notes: [] };
    if (!p.clearance) return { split: "gentle", days: [], weeklyCardioMin: 0, blocked: "قبل الجدول: تأكدي من طبيبتك إن ما عندك مانع من الرياضة، وبعدها أشّري على «طبيبتي ما منعتني».", notes: [] };
  }
  if (gentle(p) && p.stage !== "pregnant" && !p.clearance)
    return { split: "gentle", days: [], weeklyCardioMin: 0, blocked: "بعد الولادة: ابدئي بالمشي وتمارين قاع الحوض، والجدول يفتح بعد ما تسمح لك طبيبتك (غالبًا بعد مراجعة 6 أسابيع).", notes: [] };

  const days = [...p.days].sort((a, b) => a - b);
  const plan = { ...p, days };
  const focuses = splitFor(plan);
  const seen: Partial<Record<Focus, number>> = {};
  const built = days.map((d, i) => {
    const f = focuses[i];
    const v = seen[f] ?? 0;
    seen[f] = v + 1;
    return buildDay(plan, d, f, v);
  });

  const soft = gentle(p);
  const weeklyCardioMin = soft ? REF.pregnancyWeeklyMinutes : has(p, "lose") ? 200 : REF.aerobicModerateMin;
  const each = built.length ? r5(Math.min(30, weeklyCardioMin / Math.max(built.length, 3))) : 0;
  built.forEach((d) => (d.cardioMin = each));
  const outside = weeklyCardioMin - each * built.length;

  const split = soft ? "gentle" : focuses.includes("push") ? (focuses.includes("upper") ? "ul-ppl" : "ppl") : focuses.includes("upper") ? "upper-lower" : "full";
  if (built.length < REF.strengthDaysMin && !soft) notes.push("التوصية العالمية: كل العضلات الكبيرة مرتين بالأسبوع على الأقل؛ لو تقدر زِد يوم.");
  if (outside > 0) notes.push(`كمّل ${outside} دقيقة مشي سريع أو دراجة في باقي الأسبوع، عشان توصل ${weeklyCardioMin} دقيقة (توصية منظمة الصحة العالمية).`);
  if (soft) {
    notes.push("الشدة: تقدرين تتكلمين وأنتِ تتمرنين (اختبار الكلام). لا تستلقين على ظهرك فترة طويلة، ولا تحبسين نفسك مع الوزن.");
    notes.push("وقفي فورًا وكلمي الطبيبة لو صار: " + STOP_SIGNS.join("، ") + ".");
    if (p.stage === "pregnant" && !p.wasActive) notes.push("ما كنتِ تتمرنين قبل الحمل: ابدئي بـ10–15 دقيقة وزيدي تدريجيًا.");
  } else {
    notes.push(`بدأنا بأقل عدد مفيد (${exerciseLimit(p)} تمارين للحصة) من التمارين المعروفة. تقدر تضيف تمرين واحد أو تبدّل من البدائل بأي وقت.`);
    notes.push("خلِّ 1–3 تكرارات «في الخزان» في كل مجموعة، ولما تصير سهلة زِد الوزن شوي.");
    notes.push("سخّن 5–10 دقائق قبل، وأول مجموعة في كل تمرين خفيفة.");
  }
  return { split, days: built, weeklyCardioMin, blocked: null, notes };
}

/** weekly hard sets per muscle (to show the volume) */
export function weeklySets(w: Workout): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {};
  for (const d of w.days) for (const it of d.items) {
    const m = exerciseById(it.exId)?.muscle;
    if (m) out[m] = (out[m] ?? 0) + it.sets;
  }
  return out;
}

export const MUSCLE_NAMES: Record<Muscle, string> = {
  quads: "الفخذ الأمامي", hinge: "الظهر السفلي والخلفية", glutes: "المؤخرة", hams: "الفخذ الخلفي", calves: "السمانة", chest: "الصدر",
  backV: "الظهر (عرض)", backH: "الظهر (سماكة)", shoulders: "الكتف", laterals: "الكتف الجانبي", rear: "الكتف الخلفي", biceps: "البايسبس",
  triceps: "الترايسبس", core: "البطن والثبات", pelvic: "قاع الحوض",
};

// ─── the plan and the habits it becomes ────────────────────────────────────

export interface HealthPlan {
  profile: HealthProfile;
  /** "ready" = the whole plan at once, "steps" = built with the person one part at a time */
  mode: "ready" | "steps";
  /** the nutrition targets as the person kept or changed them */
  food: { kcal: number; proteinG: number; waterCups: number; produce: number; steps: number } | null;
  workout: Workout | null;
  /** the habits made from this plan («لأجل المهدي»): spec key (day-0, ex-bench, weekly, cardio, protein…) → habit id */
  links?: Record<string, string>;
  savedAt: string;
}

export function makePlan(p: HealthProfile, mode: HealthPlan["mode"]): HealthPlan {
  const n = p.track === "gym" ? null : nutrition(p);
  return {
    profile: p,
    mode,
    food: n ? { kcal: n.kcal, proteinG: n.proteinG, waterCups: n.waterCups, produce: n.produce, steps: n.steps } : null,
    workout: p.track === "food" ? null : workout(p),
    savedAt: new Date().toISOString(),
  };
}

export interface HabitSpec {
  key: string;
  name: string;
  icon: string;
  group: "gym" | "food";
  measure: "check" | "count" | "amount";
  target: number;
  unit: string;
  freq: "daily" | "days" | "weekly";
  days: number[];
  notes: string;
}

/** How the training table goes into the habits: one per training day, one per exercise, or one weekly count. */
export type GymWay = "days" | "exercises" | "weekly";
export const GYM_WAYS: { id: GymWay; title: string; hint: string }[] = [
  { id: "days", title: "بالأيام", hint: "عادة لكل يوم من جدولك (مثلًا «اليوم ١ · الجزء العلوي») مرة بالأسبوع، في أي يوم تتمرن فيه" },
  { id: "exercises", title: "بالتمارين", hint: "عادة لكل تمرين بعدد مرات حصصه في الأسبوع، في أي يوم تسويها" },
  { id: "weekly", title: "بالأسبوع", hint: "عادة وحدة «تمرين مقاومة» بعدد الأيام في الأسبوع، وأي يوم تتمرن يُحسب" },
];

export const FOOD_HABITS = ["protein", "water", "produce", "kcal", "steps", "nosugar", "folic", "pelvic"] as const;
export type FoodHabit = (typeof FOOD_HABITS)[number];

export function foodHabitsFor(plan: HealthPlan): { id: FoodHabit; label: string; on: boolean }[] {
  const p = plan.profile;
  const f = plan.food;
  const soft = p.sex === "female" && p.stage !== "none";
  const list: { id: FoodHabit; label: string; on: boolean }[] = [];
  if (f) {
    list.push({ id: "protein", label: `بروتين ${f.proteinG} غ يوميًا`, on: true });
    list.push({ id: "water", label: `ماء ${f.waterCups} أكواب يوميًا`, on: true });
    list.push({ id: "produce", label: `${f.produce} حصص خضار وفواكه يوميًا`, on: true });
    list.push({ id: "kcal", label: `السعرات ${f.kcal} يوميًا (تسجلها بنفسك)`, on: false });
    list.push({ id: "nosugar", label: "يوم بدون مشروبات محلّاة", on: false });
  }
  list.push({ id: "steps", label: `${(f?.steps ?? (p.age >= 60 ? REF.steps.over60 : REF.steps.under60)).toLocaleString("en")} خطوة يوميًا`, on: !f ? false : true });
  if (p.sex === "female" && p.stage === "pregnant") list.push({ id: "folic", label: "حمض الفوليك والفيتامينات (حسب الطبيبة)", on: true });
  if (soft) list.push({ id: "pelvic", label: "تمارين قاع الحوض (كيجل)", on: true });
  return list;
}

const short = (s: string, max = 60) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

export function habitsFor(plan: HealthPlan, gym: GymWay | null, food: FoodHabit[]): HabitSpec[] {
  const out: HabitSpec[] = [];
  const w = plan.workout;
  if (w && !w.blocked && w.days.length && gym) {
    if (gym === "days") {
      w.days.forEach((d, i) => {
        const names = d.items.map((it) => exerciseById(it.exId)?.name).filter(Boolean).join("، ");
        // no calendar: once a week, whatever day the person trains it
        out.push({
          key: `day-${d.weekday}`,
          name: short(`${dayLabel(i)} · ${focusName(d)}${dayLetter(w, d)}`),
          icon: "🏋️",
          group: "gym",
          measure: "check",
          target: 1,
          unit: "",
          freq: "weekly",
          days: [],
          notes: short(`${names}${d.cardioMin ? ` + ${d.cardioMin} دقيقة كارديو` : ""}`, 500),
        });
      });
    } else if (gym === "exercises") {
      const byEx = new Map<string, { sets: number; days: number[]; reps: string }>();
      for (const d of w.days) for (const it of d.items) {
        const cur = byEx.get(it.exId);
        if (cur) {
          cur.sets = Math.max(cur.sets, it.sets);
          if (!cur.days.includes(d.weekday)) cur.days.push(d.weekday);
        } else byEx.set(it.exId, { sets: it.sets, days: [d.weekday], reps: it.reps });
      }
      for (const [id, v] of byEx) {
        const ex = exerciseById(id);
        if (!ex) continue;
        out.push({ key: `ex-${id}`, name: short(ex.name), icon: "💪", group: "gym", measure: "check", target: Math.min(7, v.days.length), unit: "", freq: "weekly", days: [], notes: `${v.days.length > 1 ? `${v.days.length} مرات بالأسبوع · ` : ""}${v.sets} مجموعات × ${v.reps} تكرار · ${ex.cue}` });
      }
    } else {
      out.push({ key: "weekly", name: "تمرين مقاومة", icon: "🏋️", group: "gym", measure: "check", target: Math.min(7, w.days.length), unit: "", freq: "weekly", days: [], notes: SPLIT_NAMES[w.split] ?? "" });
    }
    if (w.weeklyCardioMin > 0) out.push({ key: "cardio", name: "مشي سريع أو كارديو", icon: "🚶", group: "gym", measure: "amount", target: w.weeklyCardioMin, unit: "دقيقة", freq: "weekly", days: [], notes: "توصية منظمة الصحة العالمية: 150–300 دقيقة بالأسبوع" });
  }
  const f = plan.food;
  const add = (key: FoodHabit, s: Omit<HabitSpec, "key" | "group" | "days" | "freq">) => food.includes(key) && out.push({ key, group: "food", freq: "daily", days: [], ...s });
  if (f) {
    add("protein", { name: "بروتين اليوم", icon: "🥩", measure: "amount", target: f.proteinG, unit: "غرام", notes: "وزّعه على الوجبات (20–40 غ في كل وجبة)" });
    add("water", { name: "شرب الماء", icon: "💧", measure: "count", target: f.waterCups, unit: "", notes: "كوب = 250 مل" });
    add("produce", { name: "خضار وفواكه", icon: "🥗", measure: "count", target: f.produce, unit: "", notes: "الحصة: حبة فاكهة أو كوب خضار ورقية أو نص كوب مطبوخ" });
    add("kcal", { name: "السعرات", icon: "🔥", measure: "amount", target: f.kcal, unit: "سعرة", notes: "سجّل مجموع سعرات اليوم" });
    add("nosugar", { name: "بدون مشروبات محلّاة", icon: "🚫", measure: "check", target: 1, unit: "", notes: "السكر الحر أقل من 10% من سعراتك (منظمة الصحة العالمية)" });
  }
  add("steps", { name: "خطوات اليوم", icon: "👟", measure: "amount", target: f?.steps ?? REF.steps.under60, unit: "خطوة", notes: "" });
  add("folic", { name: "حمض الفوليك والفيتامينات", icon: "💊", measure: "check", target: 1, unit: "", notes: "حسب وصف طبيبتك" });
  add("pelvic", { name: "تمارين قاع الحوض", icon: "🌸", measure: "count", target: 3, unit: "", notes: "كل مرة: 10 شدّات، 3–5 ثواني" });
  return out;
}

function dayLetter(w: Workout, d: PlanDay): string {
  const same = w.days.filter((x) => focusName(x) === focusName(d)).length;
  return same > 1 ? ` ${"أبجد"[d.variant] ?? d.variant + 1}` : "";
}

/** Keeps a profile inside sensible bounds (what the page and the server both accept). */
export function cleanProfile(v: unknown): HealthProfile {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const D = DEFAULT_PROFILE;
  const num = (k: keyof HealthProfile, lo: number, hi: number) => {
    const n = Number(o[k]);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : (D[k] as number);
  };
  const pick = <T extends string>(k: keyof HealthProfile, opts: readonly T[]): T => (opts.includes(o[k] as T) ? (o[k] as T) : (D[k] as T));
  const days = Array.isArray(o.days) ? [...new Set(o.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : D.days;
  const sex = pick("sex", ["male", "female"] as const);
  return {
    track: pick("track", ["gym", "food", "both"] as const),
    sex,
    age: Math.round(num("age", 13, 90)),
    heightCm: Math.round(num("heightCm", 120, 230)),
    weightKg: Math.round(num("weightKg", 30, 300) * 10) / 10,
    activity: pick("activity", Object.keys(REF.activity) as Activity[]),
    goals: goalsOf(o),
    stage: sex === "female" ? pick("stage", ["none", "pregnant", "postpartum", "breastfeeding"] as const) : "none",
    pregWeek: Math.round(num("pregWeek", 1, 42)),
    babyMonths: Math.round(num("babyMonths", 0, 24)),
    wasActive: o.wasActive === true,
    clearance: o.clearance === true,
    redFlags: Array.isArray(o.redFlags) ? o.redFlags.filter((x): x is string => RED_FLAGS.some((r) => r.id === x)) : [],
    level: pick("level", ["beginner", "intermediate", "advanced"] as const),
    // «home» was the home gym before «بدون أدوات» was added
    place: o.place === "home" || o.place === "homegym" ? "home" : pick("place", ["gym", "home", "body"] as const),
    splitPreference: pick("splitPreference", ["auto", "full", "upper-lower", "ppl"] as const),
    days: days.length ? days : D.days,
    minutes: Math.round(num("minutes", 20, 120)),
    meals: Math.round(num("meals", 2, 6)),
  };
}

/** A plan sent by the page, kept inside bounds before it is saved (unknown exercises and odd numbers are dropped). */
export function cleanPlan(v: unknown): HealthPlan | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const profile = cleanProfile(o.profile);
  const n = (x: unknown, lo: number, hi: number, d: number) => (Number.isFinite(Number(x)) ? Math.min(hi, Math.max(lo, Math.round(Number(x)))) : d);
  const f = o.food as Record<string, unknown> | null | undefined;
  const fresh = makePlan(profile, o.mode === "steps" ? "steps" : "ready");
  const food =
    profile.track === "gym" || !f || typeof f !== "object" || !fresh.food
      ? fresh.food
      : {
          kcal: n(f.kcal, 1000, 6000, fresh.food.kcal),
          proteinG: n(f.proteinG, 20, 400, fresh.food.proteinG),
          waterCups: n(f.waterCups, 2, 20, fresh.food.waterCups),
          produce: n(f.produce, 1, 15, fresh.food.produce),
          steps: n(f.steps, 1000, 40000, fresh.food.steps),
        };
  let wk = fresh.workout;
  const w = o.workout as Record<string, unknown> | null | undefined;
  if (wk && !wk.blocked && w && Array.isArray(w.days)) {
    const days: PlanDay[] = [];
    for (const raw of w.days.slice(0, 7) as Record<string, unknown>[]) {
      const weekday = Number(raw?.weekday);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || days.some((d) => d.weekday === weekday)) continue;
      const focus = (Object.keys(FOCUS) as Focus[]).includes(raw.focus as Focus) ? (raw.focus as Focus) : "full";
      const more = Array.isArray(raw.focuses) ? [...new Set((raw.focuses as unknown[]).filter((f): f is Focus => (Object.keys(FOCUS) as string[]).includes(f as string)))].slice(0, 3) : [];
      const items = (Array.isArray(raw.items) ? raw.items : [])
        .slice(0, 12)
        .map((it: Record<string, unknown>) => ({
          exId: String(it?.exId ?? ""),
          sets: n(it?.sets, 1, 10, 3),
          reps: String(it?.reps ?? "8–12").slice(0, 12),
          restSec: n(it?.restSec, 15, 600, 90),
        }))
        .filter((it) => exerciseById(it.exId));
      days.push({ weekday, focus: more[0] ?? focus, ...(more.length > 1 ? { focuses: more } : {}), variant: n(raw.variant, 0, 6, 0), items, cardioMin: n(raw.cardioMin, 0, 180, 0) });
    }
    // the order the person keeps is the rotation's order
    wk = { ...wk, days, weeklyCardioMin: n(w.weeklyCardioMin, 0, 1000, wk.weeklyCardioMin) };
  }
  const links: Record<string, string> = {};
  if (o.links && typeof o.links === "object")
    for (const [k, id] of Object.entries(o.links as Record<string, unknown>).slice(0, 200))
      if (/^[a-z0-9-]{1,50}$/.test(k) && typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)) links[k] = id;
  return { profile, mode: fresh.mode, food, workout: wk, links, savedAt: new Date().toISOString() };
}

/** fat and carbs of the day from the calories and protein the person kept */
export function macrosOf(food: { kcal: number; proteinG: number }, p: HealthProfile) {
  const fatG = Math.round((food.kcal * (buildsMuscle(p) ? REF.fatShareMuscle : REF.fatShare)) / 9);
  return { fatG, carbG: Math.max(0, Math.round((food.kcal - food.proteinG * 4 - fatG * 9) / 4)) };
}
