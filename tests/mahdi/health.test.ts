import { describe, expect, it } from "vitest";
import { RESEARCH, SOURCES } from "@config/mahdi/health-research";
import { DEFAULT_PROFILE, EXERCISES, cleanPlan, exerciseById, habitsFor, makePlan, nutrition, workout, type HealthProfile } from "@/lib/mahdi/health/plan";

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
    const n = nutrition(P({ goal: "lose", activity: "moderate" }));
    expect(n.kcal).toBeLessThan(n.tdee);
    expect(n.kcal).toBeGreaterThanOrEqual(1500);
    expect(nutrition(P({ sex: "female", weightKg: 45, heightCm: 150, age: 60, goal: "lose", activity: "sedentary" })).kcal).toBe(1200);
  });
  it("pregnancy: no deficit even when the goal is to lose, + calories from the 2nd trimester, protein ≥71 g", () => {
    const base = P({ sex: "female", weightKg: 60, heightCm: 160, age: 28, goal: "lose", stage: "pregnant" });
    const t1 = nutrition({ ...base, pregWeek: 10 });
    const t3 = nutrition({ ...base, pregWeek: 32 });
    expect(t1.kcal).toBeGreaterThanOrEqual(Math.round(t1.tdee / 50) * 50 - 25);
    expect(t3.kcal - t1.kcal).toBeGreaterThanOrEqual(400);
    expect(t1.proteinG).toBeGreaterThanOrEqual(71);
    expect(t1.gwg).toEqual({ label: expect.any(String), min: 11.5, max: 16 });
  });
  it("under 18: no deficit", () => {
    const n = nutrition(P({ age: 16, goal: "lose" }));
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
