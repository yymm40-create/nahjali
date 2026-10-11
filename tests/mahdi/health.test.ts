import { describe, expect, it } from "vitest";
import { RESEARCH, SOURCES } from "@config/mahdi/health-research";
import { applyCoach } from "@/lib/mahdi/health/coach";
import { DEFAULT_PROFILE, EXERCISES, cleanPlan, cleanProfile, exerciseById, habitsFor, makePlan, nutrition, workout, type HealthProfile } from "@/lib/mahdi/health/plan";

const P = (o: Partial<HealthProfile>): HealthProfile => ({ ...DEFAULT_PROFILE, ...o });

describe("«الصحة العلوية» research", () => {
  it("every point names sources that exist", () => {
    for (const s of RESEARCH) for (const pt of s.points) for (const id of pt.src) expect(SOURCES.some((x) => x.id === id), `${s.id}: ${id}`).toBe(true);
  });
});

describe("nutrition", () => {
  it("Mifflin–St Jeor for a man and a woman", () => {
    expect(nutrition(P({ sex: "male", weightKg: 80, heightCm: 180, age: 30 })).bmr).toBe(1780);
    expect(nutrition(P({ sex: "female", weightKg: 60, heightCm: 165, age: 30 })).bmr).toBe(1320);
  });
  it("a cut is ~20% under maintenance, never below the floor", () => {
    const n = nutrition(P({ goals: ["lose"], activity: "moderate" }));
    expect(n.kcal).toBeLessThan(n.tdee);
    expect(n.kcal).toBeGreaterThanOrEqual(1500);
    expect(nutrition(P({ sex: "female", weightKg: 45, heightCm: 150, age: 60, goals: ["lose"], activity: "sedentary" })).kcal).toBe(1200);
  });
  it("pregnancy: no deficit even when the goal is to lose, + calories from the 2nd trimester, protein ≥71 g", () => {
    const base = P({ sex: "female", weightKg: 60, heightCm: 160, age: 28, goals: ["lose"], stage: "pregnant" });
    const t1 = nutrition({ ...base, pregWeek: 10 });
    const t3 = nutrition({ ...base, pregWeek: 32 });
    expect(t1.kcal).toBeGreaterThanOrEqual(Math.round(t1.tdee / 50) * 50 - 25);
    expect(t3.kcal - t1.kcal).toBeGreaterThanOrEqual(400);
    expect(t1.proteinG).toBeGreaterThanOrEqual(71);
    expect(t1.gwg).toEqual({ label: expect.any(String), min: 11.5, max: 16 });
  });
  it("under 18: no deficit", () => {
    const n = nutrition(P({ age: 16, goals: ["lose"] }));
    expect(n.kcal).toBe(Math.round(n.tdee / 50) * 50);
  });
});

describe("training table", () => {
  it("3 days → full body, 4 → upper/lower, 6 → push/pull/legs", () => {
    expect(workout(P({ days: [0, 2, 4] })).days.map((d) => d.focus)).toEqual(["full", "full", "full"]);
    expect(workout(P({ days: [0, 1, 3, 4] })).split).toBe("upper-lower");
    expect(workout(P({ days: [0, 1, 2, 3, 4, 5] })).split).toBe("ppl");
  });
  it("home uses home exercises only, and no exercise repeats within a day", () => {
    for (const d of workout(P({ place: "home", days: [0, 1, 2, 3, 4] })).days) {
      expect(d.items.every((it) => exerciseById(it.exId)!.home)).toBe(true);
      expect(new Set(d.items.map((i) => i.exId)).size).toBe(d.items.length);
    }
  });
  it("pregnancy: blocked without the doctor's ok or with a red flag; then only pregnancy-safe exercises", () => {
    const preg = P({ sex: "female", stage: "pregnant", pregWeek: 24 });
    expect(workout(preg).blocked).toBeTruthy();
    expect(workout({ ...preg, clearance: true, redFlags: ["previa"] }).blocked).toBeTruthy();
    const w = workout({ ...preg, clearance: true });
    expect(w.blocked).toBeNull();
    expect(w.weeklyCardioMin).toBe(150);
    for (const d of w.days) for (const it of d.items) expect(exerciseById(it.exId)!.preg).toBe(true);
  });
  it("every exercise has a unique id", () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
  });
});

describe("into the habits", () => {
  const plan = makePlan(P({ days: [0, 2, 4] }), "ready");
  it("by days: one habit per training day on that weekday", () => {
    const h = habitsFor(plan, "days", []).filter((x) => x.key.startsWith("day-"));
    expect(h.map((x) => x.days)).toEqual([[0], [2], [4]]);
  });
  it("by exercises: one per exercise, counted in sets", () => {
    const h = habitsFor(plan, "exercises", []).filter((x) => x.key.startsWith("ex-"));
    expect(h.length).toBeGreaterThan(3);
    expect(h.every((x) => x.measure === "count" && x.target >= 1 && x.days.length >= 1)).toBe(true);
  });
  it("weekly: 3 days a week, plus the cardio minutes", () => {
    const h = habitsFor(plan, "weekly", []);
    expect(h.find((x) => x.key === "weekly")?.target).toBe(3);
    expect(h.find((x) => x.key === "cardio")?.target).toBe(150);
  });
  it("nutrition habits only those ticked; names fit", () => {
    const h = habitsFor(plan, null, ["protein", "water"]);
    expect(h.map((x) => x.key)).toEqual(["protein", "water"]);
    for (const x of habitsFor(plan, "exercises", ["protein", "water", "produce", "kcal", "steps", "nosugar"])) expect(x.name.length).toBeLessThanOrEqual(60);
  });
  it("cleanPlan drops unknown exercises and keeps edits", () => {
    const c = cleanPlan({ ...plan, food: { ...plan.food, proteinG: 150 }, workout: { ...plan.workout, days: [{ weekday: 1, focus: "upper", items: [{ exId: "nope", sets: 3 }, { exId: "bench", sets: 4, reps: "5", restSec: 120 }] }] } })!;
    expect(c.food?.proteinG).toBe(150);
    expect(c.workout?.days).toHaveLength(1);
    expect(c.workout?.days[0].items.map((i) => i.exId)).toEqual(["bench"]);
  });
});

describe("places and goals", () => {
  it("no equipment: every day is filled with bodyweight exercises only", () => {
    for (const days of [[0, 2, 4], [0, 1, 3, 4], [0, 1, 2, 3, 4, 5]]) {
      const w = workout(P({ place: "body", days }));
      for (const d of w.days) {
        expect(d.items.length).toBeGreaterThanOrEqual(4);
        expect(d.items.every((it) => exerciseById(it.exId)!.body)).toBe(true);
      }
    }
  });
  it("home gym uses home-gym exercises; an old «home» profile stays the home gym", () => {
    for (const d of workout(P({ place: "home", days: [0, 2, 4] })).days) expect(d.items.every((it) => exerciseById(it.exId)!.home)).toBe(true);
    expect(cleanProfile({ place: "home" }).place).toBe("home");
    expect(cleanProfile({ place: "body" }).place).toBe("body");
  });
  it("pregnant with no equipment: still a gentle table of safe exercises", () => {
    const w = workout(P({ sex: "female", stage: "pregnant", pregWeek: 20, clearance: true, place: "body" }));
    for (const d of w.days) {
      expect(d.items.length).toBeGreaterThan(2);
      expect(d.items.every((it) => exerciseById(it.exId)!.preg && exerciseById(it.exId)!.body)).toBe(true);
    }
  });
  it("several goals: losing fat + muscle is a gentler cut than losing alone", () => {
    const lose = nutrition(P({ goals: ["lose"], activity: "moderate" })).kcal;
    const recomp = nutrition(P({ goals: ["lose", "muscle"], activity: "moderate" })).kcal;
    const keep = nutrition(P({ goals: ["fit"], activity: "moderate" })).kcal;
    expect(lose).toBeLessThan(recomp);
    expect(recomp).toBeLessThan(keep);
    expect(cleanProfile({ goal: "muscle" }).goals).toEqual(["muscle"]);
  });
});

describe("«عباس سبع القنطرة» changes the plan", () => {
  const base = P({ days: [0, 2, 4] });
  const plan = makePlan(base, "ready");
  it("changes the wizard's answers and rebuilds the plan", () => {
    const r = applyCoach(base, plan, { profile: [{ field: "place", value: "body" }, { field: "goals", value: "lose,muscle" }] });
    expect(r.changed).toBe(true);
    expect(r.profile.place).toBe("body");
    expect(r.profile.goals).toEqual(["lose", "muscle"]);
    expect(r.plan!.workout!.days.every((d) => d.items.every((i) => exerciseById(i.exId)!.body))).toBe(true);
  });
  it("can never tick the doctor's ok or clear the warning signs", () => {
    const preg = P({ sex: "female", stage: "pregnant", redFlags: ["previa"] });
    const r = applyCoach(preg, null, { profile: [{ field: "stage", value: "pregnant" }, { field: "age", value: "30" }] });
    expect(r.profile.clearance).toBe(false);
    expect(r.profile.redFlags).toEqual(["previa"]);
  });
  it("swaps, removes and changes sets; refuses an exercise that does not fit", () => {
    const day = plan.workout!.days[0];
    const first = day.items[0].exId;
    const r = applyCoach(base, plan, {
      edits: [
        { op: "sets", weekday: day.weekday, exId: first, newExId: "", sets: 5 },
        { op: "add", weekday: day.weekday, exId: "no-such", newExId: "", sets: 0 },
        { op: "remove", weekday: day.weekday, exId: day.items[1].exId, newExId: "", sets: 0 },
      ],
    });
    const d = r.plan!.workout!.days[0];
    expect(d.items[0].sets).toBe(5);
    expect(d.items).toHaveLength(day.items.length - 1);
    // in pregnancy, an unsafe exercise is refused
    const preg = P({ sex: "female", stage: "pregnant", clearance: true, days: [0, 2, 4] });
    const pp = makePlan(preg, "ready");
    const r2 = applyCoach(preg, pp, { edits: [{ op: "add", weekday: 0, exId: "deadlift", newExId: "", sets: 0 }] });
    expect(r2.plan!.workout!.days[0].items.some((i) => i.exId === "deadlift")).toBe(false);
  });
  it("food targets never go under the safe floor", () => {
    const r = applyCoach(base, plan, { food: [{ field: "kcal", value: 800 }, { field: "proteinG", value: 150 }] });
    expect(r.plan!.food!.kcal).toBeGreaterThanOrEqual(1500);
    expect(r.plan!.food!.proteinG).toBe(150);
  });
});

describe("the exercise guide", () => {
  it("every exercise has its technique, and every muscle named exists", async () => {
    const { GUIDE, MUSCLES } = await import("@config/mahdi/exercise-guide");
    const ids = new Set(MUSCLES.map((m) => m.id));
    for (const e of EXERCISES) {
      const g = GUIDE[e.id];
      expect(g, e.id).toBeTruthy();
      expect(g.steps.length, e.id).toBeGreaterThanOrEqual(2);
      expect(g.primary.length, e.id).toBeGreaterThan(0);
      for (const m of [...g.primary, ...g.secondary]) expect(ids.has(m), `${e.id}: ${m}`).toBe(true);
    }
    for (const id of Object.keys(GUIDE)) expect(exerciseById(id), id).toBeTruthy();
  });
});

describe("the tracker", () => {
  it("keeps a day inside bounds", async () => {
    const { cleanDay } = await import("@/lib/mahdi/health/tracker");
    const d = cleanDay({ date: "2026-10-11", sets: { bench: [{ kg: 60, reps: 8 }, { kg: -5, reps: 0 }], "BAD id": [{ kg: 1, reps: 1 }] }, food: { proteinG: 140, nope: 3 }, cardioMin: 9999, done: true, bodyKg: 80.44 })!;
    expect(d.sets).toEqual({ bench: [{ kg: 60, reps: 8 }] });
    expect(d.food).toEqual({ proteinG: 140 });
    expect(d.cardioMin).toBe(600);
    expect(d.bodyKg).toBe(80.4);
    expect(cleanDay({ date: "yesterday" })).toBeNull();
  });
  it("estimated max, records and the suggestion for next time", async () => {
    const { e1rm, record, suggestion, history } = await import("@/lib/mahdi/health/tracker");
    expect(e1rm({ kg: 100, reps: 5 })).toBe(116.5);
    const days = [
      { date: "2026-10-01", sets: { bench: [{ kg: 60, reps: 10 }, { kg: 60, reps: 12 }] }, cardioMin: 0, done: true, food: {}, bodyKg: null },
      { date: "2026-10-04", sets: { bench: [{ kg: 62.5, reps: 8 }] }, cardioMin: 0, done: true, food: {}, bodyKg: null },
    ];
    expect(record(days, "bench")).toEqual({ kg: 60, reps: 12 }); // 60×12 ≈ 84 kg max, 62.5×8 ≈ 79
    expect(history(days, "bench").map((p) => p.date)).toEqual(["2026-10-01", "2026-10-04"]);
    expect(suggestion([{ kg: 60, reps: 12 }, { kg: 60, reps: 12 }], "8–12", false)).toContain("62.5");
    expect(suggestion([{ kg: 60, reps: 10 }, { kg: 60, reps: 12 }], "8–12", false)).toContain("نفس الوزن");
    expect(suggestion(undefined, "8–12", false)).toContain("أول مرة");
  });
  it("counts hard sets per muscle: main 1, helping ½", async () => {
    const { setsByMuscle } = await import("@/lib/mahdi/health/tracker");
    const m = setsByMuscle([{ date: "2026-10-01", sets: { bench: [{ kg: 60, reps: 10 }, { kg: 60, reps: 10 }, { kg: 60, reps: 0 }] }, cardioMin: 0, done: false, food: {}, bodyKg: null }]);
    expect(m.pec).toBe(2);
    expect(m["front-delt"]).toBe(1);
  });
});

describe("«عباس سبع القنطرة» starts again and keeps the habits linked", () => {
  it("restart, and a rebuilt plan keeps its links", () => {
    const base = P({ days: [0, 2, 4] });
    const plan = { ...makePlan(base, "ready"), links: { protein: "11111111-1111-1111-1111-111111111111" } };
    const r = applyCoach(base, plan, { restart: true, profile: [{ field: "place", value: "body" }] });
    expect(r.restart).toBe(true);
    expect(r.plan!.links).toEqual(plan.links);
    expect(cleanPlan(r.plan)!.links).toEqual(plan.links);
  });
});
