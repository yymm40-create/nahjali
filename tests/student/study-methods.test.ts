import { describe, expect, it } from "vitest";
import { methodLine, studyAudience } from "@config/jawad/study-methods";
import { OUTPUT_KINDS, PURPOSES } from "@config/jawad/student";

describe("«الطالب الذكي»: the researched methods by audience", () => {
  it("picks the audience from the level and the purpose", () => {
    expect(studyAudience("ابتدائي")).toBe("child");
    expect(studyAudience("متوسط")).toBe("school");
    expect(studyAudience("ثانوي")).toBe("school");
    expect(studyAudience("جامعي")).toBe("university");
    expect(studyAudience("دراسات عليا")).toBe("university");
    expect(studyAudience("")).toBe("adult");
    expect(studyAudience("جامعي", "debate")).toBe("debate");
  });

  it("gives each output its method: recall questions in summaries, guiding questions before the lesson, claim–warrant–impact for debate", () => {
    expect(methodLine("summary", "school")).toMatch(/recall questions/);
    expect(methodLine("preread", "school")).toMatch(/SQ3R/);
    expect(methodLine("preread", "child")).toMatch(/KWL/);
    expect(methodLine("summary", "university")).toMatch(/Feynman/);
    expect(methodLine("summary", "debate")).toMatch(/claim → warrant/);
    expect(methodLine("chat", "adult")).toMatch(/summarise|prepare/);
  });

  it("offers the two new outputs and the debate purpose", () => {
    expect(OUTPUT_KINDS.map((o) => o.kind)).toEqual(expect.arrayContaining(["preread", "chat"]));
    expect(PURPOSES.some((p) => p.id === "debate")).toBe(true);
  });
});
