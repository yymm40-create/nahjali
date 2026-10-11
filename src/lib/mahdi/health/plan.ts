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
export type Place = "gym" | "home";
export type Activity = keyof typeof REF.activity;

export interface HealthProfile {
  track: Track;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: Goal;
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
  /** training weekdays, 0 = Sunday … 6 = Saturday */
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
  goal: "fit",
  stage: "none",
  pregWeek: 12,
  babyMonths: 2,
  wasActive: false,
  clearance: false,
  redFlags: [],
  level: "beginner",
  place: "gym",
  days: [0, 2, 4],
  minutes: 60,
  meals: 3,
};

export const LABELS = {
  goal: { lose: "نزول وزن (حرق دهون)", muscle: "بناء عضل", strength: "قوة", fit: "لياقة وشكل متناسق", health: "صحة عامة" } as Record<Goal, string>,
  activity: { sedentary: "قليل الحركة (مكتب)", light: "حركة خفيفة", moderate: "نشيط (شغل فيه حركة)", active: "نشيط جدًا", very: "شغل بدني شاق" } as Record<Activity, string>,
  level: { beginner: "مبتدئ", intermediate: "متوسط", advanced: "متقدم" } as Record<Level, string>,
  place: { gym: "النادي (جيم)", home: "البيت" } as Record<Place, string>,
  stage: { none: "لا", pregnant: "حامل", postpartum: "بعد الولادة", breastfeeding: "مرضعة" } as Record<Stage, string>,
  track: { gym: "الجيم بس", food: "التغذية بس", both: "الجيم والتغذية" } as Record<Track, string>,
};

export const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

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
    if (p.goal === "lose") {
      kcal -= 300;
      notes.push("نزول هادي أثناء الرضاعة (حوالي نصف كيلو بالأسبوع كحد أعلى) عشان الحليب وصحتك.");
    }
  } else if (minor) {
    notes.push("تحت 18 سنة: بدون رجيم أو عجز في السعرات إلا بإشراف طبيب؛ ركّز على الحركة والأكل الصحي.");
  } else if (p.goal === "lose") {
    kcal = tdee * (1 - REF.deficit);
    notes.push("عجز حوالي 20%: نزول تقريبًا 0.5–1% من وزنك بالأسبوع مع الحفاظ على عضلك (بشرط البروتين والمقاومة).");
  } else if (p.goal === "muscle") {
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
  else if (p.goal === "lose" && !minor) perKg = REF.protein.cut;
  else if ((p.goal === "muscle" || p.goal === "strength") && trains) perKg = REF.protein.muscle;
  else if (trains || p.activity !== "sedentary") perKg = REF.protein.active;
  let proteinG = r5(perKg * refKg);
  if (preg) proteinG = Math.max(proteinG, REF.proteinPregnancyMinG);
  const proteinMealG = Math.min(40, Math.max(20, r5(proteinG / Math.max(3, p.meals))));

  const fatShare = p.goal === "muscle" || p.goal === "strength" ? REF.fatShareMuscle : REF.fatShare;
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
  gym: boolean;
  home: boolean;
  /** suitable in pregnancy (no lying on the back, no heavy bracing, no fall risk) */
  preg: boolean;
  cue: string;
}

const X = (id: string, name: string, muscle: Muscle, compound: boolean, where: "g" | "h" | "gh", preg: boolean, cue: string): Exercise => ({
  id, name, muscle, compound, gym: where.includes("g"), home: where.includes("h"), preg, cue,
});

export const EXERCISES: Exercise[] = [
  X("back-squat", "سكوات بالبار", "quads", true, "g", false, "الصدر مرفوع، انزل لين الفخذ موازي الأرض"),
  X("leg-press", "ليق برس (دفع الأرجل)", "quads", true, "g", true, "لا تقفل الركبة فوق"),
  X("goblet-squat", "سكوات بالدمبل (جوبلت)", "quads", true, "gh", true, "الدمبل قدام صدرك، الركب مع اتجاه الأصابع"),
  X("box-squat", "سكوات على كرسي", "quads", true, "gh", true, "اقعد على الكرسي بهدوء وقوم"),
  X("split-squat", "سبليت سكوات (طعن ثابت)", "quads", true, "gh", true, "مسك شي للتوازن لو تحتاج"),
  X("leg-ext", "ليق إكستنشن", "quads", false, "g", true, "نزول بطيء"),
  X("rdl", "رومانيان ديدلفت", "hinge", true, "gh", false, "ظهر مستقيم والورك لورا"),
  X("deadlift", "ديدلفت", "hinge", true, "g", false, "البار قريب من جسمك، ادفع الأرض"),
  X("hip-hinge-band", "انحناء الورك بالمطاط", "hinge", true, "gh", true, "حركة من الورك بدون ثقل كبير"),
  X("hip-thrust", "هيب ثرست", "glutes", true, "gh", false, "اعصر المؤخرة فوق ثانية"),
  X("cable-kickback", "ركلة للخلف بالكيبل", "glutes", false, "g", true, "واقف وماسك الجهاز"),
  X("step-up", "طلوع على درجة", "glutes", true, "gh", true, "درجة منخفضة في الحمل"),
  X("side-clam", "تمرين الصدفة على الجنب", "glutes", false, "gh", true, "على جنبك، افتح الركبة وارجع"),
  X("leg-curl", "ليق كيرل جالس", "hams", false, "g", true, "نزول بطيء"),
  X("ham-slide", "سحب الكعب على الأرض", "hams", false, "h", false, "الورك فوق"),
  X("calf-raise", "رفع السمانة واقف", "calves", false, "gh", true, "ثانية فوق وثانية تحت"),
  X("bench", "بنش برس بالبار", "chest", true, "g", false, "الكتف لورا والقدم ثابتة"),
  X("incline-db", "ضغط دمبل على مقعد مائل", "chest", true, "g", true, "المقعد مائل (مو مسطح) في الحمل"),
  X("chest-press", "جهاز ضغط الصدر جالس", "chest", true, "g", true, "ظهرك على المسند"),
  X("pushup", "ضغط (بوش أب)", "chest", true, "h", false, "جسمك خط مستقيم"),
  X("incline-pushup", "ضغط على طاولة أو جدار", "chest", true, "gh", true, "كل ما ارتفعت اليد صار أسهل"),
  X("cable-fly", "فراشة بالكيبل", "chest", false, "g", true, "ضمّ اليدين قدامك"),
  X("pulldown", "سحب أمامي (لات بول داون)", "backV", true, "g", true, "اسحب للصدر والكتف تحت"),
  X("pullup", "عقلة", "backV", true, "g", false, "استعن بالجهاز المساعد لو تحتاج"),
  X("band-pulldown", "سحب المطاط من فوق", "backV", true, "h", true, "اربط المطاط فوق الباب"),
  X("seated-row", "سحب جالس بالكيبل", "backH", true, "g", true, "ظهرك مستقيم والكوع لورا"),
  X("db-row", "سحب دمبل بيد وحدة", "backH", true, "gh", true, "ساند يدك وركبتك على مقعد"),
  X("band-row", "سحب المطاط جالس", "backH", true, "h", true, "اعصر بين الكتفين"),
  X("barbell-row", "سحب بالبار منحني", "backH", true, "g", false, "ظهر مستقيم"),
  X("ohp", "ضغط كتف واقف بالبار", "shoulders", true, "g", false, "شد البطن ولا تقوّس الظهر"),
  X("seated-db-press", "ضغط كتف دمبل جالس", "shoulders", true, "gh", true, "ظهرك على المسند"),
  X("lateral-raise", "رفرفة جانبي", "laterals", false, "gh", true, "لين مستوى الكتف"),
  X("face-pull", "فيس بول (كيبل للوجه)", "rear", false, "g", true, "اسحب لعيونك والكوع عالي"),
  X("band-pull-apart", "فتح المطاط قدامك", "rear", false, "h", true, "اعصر بين الكتفين"),
  X("rear-fly", "رفرفة خلفي جالس", "rear", false, "gh", true, "خفيف وبتحكم"),
  X("db-curl", "بايسبس دمبل", "biceps", false, "gh", true, "الكوع ثابت جنبك"),
  X("cable-curl", "بايسبس كيبل", "biceps", false, "g", true, "نزول بطيء"),
  X("hammer-curl", "بايسبس هامر", "biceps", false, "gh", true, "الكف يقابل الجسم"),
  X("pushdown", "ترايسبس كيبل للأسفل", "triceps", false, "g", true, "الكوع ثابت"),
  X("overhead-ext", "ترايسبس دمبل فوق الراس", "triceps", false, "gh", true, "جالس وظهرك مسنود"),
  X("bench-dip", "ترايسبس على الكرسي", "triceps", false, "h", false, "الكرسي ثابت"),
  X("plank", "بلانك", "core", false, "gh", false, "جسمك خط مستقيم"),
  X("pallof", "بالوف برس (ثبات البطن)", "core", false, "gh", true, "قاوم الدوران"),
  X("dead-bug", "ديد بق", "core", false, "gh", false, "أسفل الظهر لاصق بالأرض"),
  X("bird-dog", "بيرد دوق (على الأربع)", "core", false, "gh", true, "يد ورجل عكسية ببطء"),
  X("side-plank-knee", "بلانك جانبي على الركبة", "core", false, "gh", true, "الورك مرفوع"),
  X("kegel", "تمارين قاع الحوض (كيجل)", "pelvic", false, "gh", true, "شد 3–5 ثواني وارخِ، 10 مرات"),
];

export const exerciseById = (id: string) => EXERCISES.find((e) => e.id === id);

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
  weekday: number;
  focus: Focus;
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

export function candidates(muscle: Muscle, p: HealthProfile): Exercise[] {
  const soft = gentle(p);
  return EXERCISES.filter((e) => e.muscle === muscle && (p.place === "gym" ? e.gym : e.home) && (!soft || e.preg));
}

export function splitFor(p: HealthProfile): Focus[] {
  const n = p.days.length;
  if (gentle(p)) return Array(n).fill("gentle");
  if (n <= 3) return Array(n).fill("full");
  if (n === 4) return ["upper", "lower", "upper", "lower"];
  if (n === 5) return ["upper", "lower", "push", "pull", "legs"];
  return ["push", "pull", "legs", "push", "pull", "legs"].slice(0, n) as Focus[];
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
  if (p.goal === "strength" && ex.compound) return { sets: p.level === "beginner" ? 3 : 4, reps: "4–6", restSec: 180 };
  if (ex.compound) return { sets, reps: p.goal === "muscle" ? "6–10" : "8–12", restSec: 120 };
  return { sets, reps: "10–15", restSec: 75 };
}

/** how many exercises fit the session */
export const perSession = (minutes: number) => (minutes <= 30 ? 4 : minutes <= 45 ? 5 : minutes <= 60 ? 6 : 7);

export function buildDay(p: HealthProfile, weekday: number, focus: Focus, variant: number): PlanDay {
  const slots = FOCUS[focus].slots.slice(0, perSession(p.minutes));
  const used = new Set<string>();
  const items: PlanItem[] = [];
  slots.forEach((m, i) => {
    const list = candidates(m, p).filter((e) => !used.has(e.id));
    if (!list.length) return;
    const ex = list[(variant + i) % list.length];
    used.add(ex.id);
    items.push({ exId: ex.id, ...dose(ex, p) });
  });
  return { weekday, focus, variant, items, cardioMin: 0 };
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
  const weeklyCardioMin = soft ? REF.pregnancyWeeklyMinutes : p.goal === "lose" ? 200 : REF.aerobicModerateMin;
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
  { id: "days", title: "بالأيام", hint: "عادة لكل يوم تمرين (مثلًا «تمرين الجزء العلوي» كل أحد)، تأشّر عليها لما تخلص الحصة" },
  { id: "exercises", title: "بالتمارين", hint: "عادة لكل تمرين بعدد مجموعاته في أيامه، تعدّ المجموعات وحدة وحدة" },
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
      for (const d of w.days) {
        const names = d.items.map((it) => exerciseById(it.exId)?.name).filter(Boolean).join("، ");
        out.push({
          key: `day-${d.weekday}`,
          name: short(`${FOCUS[d.focus].name}${dayLetter(w, d)} · ${WEEKDAYS[d.weekday]}`),
          icon: "🏋️",
          group: "gym",
          measure: "check",
          target: 1,
          unit: "",
          freq: "days",
          days: [d.weekday],
          notes: short(`${names}${d.cardioMin ? ` + ${d.cardioMin} دقيقة كارديو` : ""}`, 500),
        });
      }
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
        out.push({ key: `ex-${id}`, name: short(ex.name), icon: "💪", group: "gym", measure: "count", target: v.sets, unit: "", freq: "days", days: v.days.sort((a, b) => a - b), notes: `${v.sets} مجموعات × ${v.reps} تكرار · ${ex.cue}` });
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
  const same = w.days.filter((x) => x.focus === d.focus).length;
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
    goal: pick("goal", ["lose", "muscle", "strength", "fit", "health"] as const),
    stage: sex === "female" ? pick("stage", ["none", "pregnant", "postpartum", "breastfeeding"] as const) : "none",
    pregWeek: Math.round(num("pregWeek", 1, 42)),
    babyMonths: Math.round(num("babyMonths", 0, 24)),
    wasActive: o.wasActive === true,
    clearance: o.clearance === true,
    redFlags: Array.isArray(o.redFlags) ? o.redFlags.filter((x): x is string => RED_FLAGS.some((r) => r.id === x)) : [],
    level: pick("level", ["beginner", "intermediate", "advanced"] as const),
    place: pick("place", ["gym", "home"] as const),
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
      const items = (Array.isArray(raw.items) ? raw.items : [])
        .slice(0, 12)
        .map((it: Record<string, unknown>) => ({
          exId: String(it?.exId ?? ""),
          sets: n(it?.sets, 1, 10, 3),
          reps: String(it?.reps ?? "8–12").slice(0, 12),
          restSec: n(it?.restSec, 15, 600, 90),
        }))
        .filter((it) => exerciseById(it.exId));
      days.push({ weekday, focus, variant: n(raw.variant, 0, 6, 0), items, cardioMin: n(raw.cardioMin, 0, 180, 0) });
    }
    wk = { ...wk, days: days.sort((a, b) => a.weekday - b.weekday), weeklyCardioMin: n(w.weeklyCardioMin, 0, 1000, wk.weeklyCardioMin) };
  }
  return { profile, mode: fresh.mode, food, workout: wk, savedAt: new Date().toISOString() };
}
