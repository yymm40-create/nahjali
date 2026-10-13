import { describe, expect, it } from "vitest";
import { journeyIntakeText, normalizeJourneyIntake } from "@/lib/film/intake";

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
});
