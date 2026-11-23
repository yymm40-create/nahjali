import { describe, expect, it } from "vitest";
import { journeyIntakeText, normalizeJourneyIntake, normalizeLessonPlan } from "@/lib/film/intake";

describe("film journey intake", () => {
  it("normalizes plans and keeps blocking questions", () => {
    const intake = normalizeJourneyIntake({
      title: "فيلم ألف",
      concept: "قصة مكتملة",
      understanding: "فهم واضح",
      fixedFacts: ["البطل عمره 12"],
      targetDurationSec: 120,
      characters: [{ name: "علي", description: "البطل" }],
      places: [],
      scenePlan: [{ number: 9, title: "البداية", summary: "يبدأ الحدث", goal: "التعريف", transition: "قطع" }],
      episodePlan: [],
      questions: [{ id: "ending", question: "كيف تنتهي؟", why: "تؤثر على الذروة", options: ["ينجح", "يفشل"], required: true }],
    });
    expect(intake.scenePlan[0].number).toBe(1);
    expect(intake.questions[0].required).toBe(true);
    expect(journeyIntakeText(intake)).toContain("خريطة المشاهد");
  });

  it("drops invalid duration instead of guessing", () => {
    const intake = normalizeJourneyIntake({ title: "س", concept: "ص", understanding: "ع", fixedFacts: [], targetDurationSec: 99999, characters: [], places: [], scenePlan: [], episodePlan: [], questions: [] });
    expect(intake.targetDurationSec).toBeNull();
  });

  it("a lesson keeps its plan («🎓 درس لطلابك»), a known shape and a few points", () => {
    const base = { title: "القلب", concept: "درس", understanding: "فهمت", fixedFacts: [], targetDurationSec: 60, characters: [], places: [], scenePlan: [], episodePlan: [], questions: [] };
    const intake = normalizeJourneyIntake({ ...base, lesson: { format: "hypermotion", question: "  كيف يصل الأكسجين للخلية؟ ", points: ["الرئة", "", "الحويصلات", "كريات الدم"], audience: "الصف السادس" } });
    expect(intake.lesson).toEqual({ format: "hypermotion", question: "كيف يصل الأكسجين للخلية؟", points: ["الرئة", "الحويصلات", "كريات الدم"], audience: "الصف السادس" });
    expect(journeyIntakeText(intake)).toContain("هايبرموشن لأدق التفاصيل (hypermotion)");
    expect(journeyIntakeText(intake)).toContain("الستايل: الانحراف الأسلوبي (ثابت)");
    // an unknown shape falls back to a story; no plan, no lesson
    expect(normalizeLessonPlan({ format: "anime" })?.format).toBe("story");
    expect("lesson" in normalizeJourneyIntake(base)).toBe(false);
  });
});
