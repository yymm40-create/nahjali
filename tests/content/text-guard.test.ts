import { describe, expect, it } from "vitest";
import { missingWords } from "@/components/claude-code/draw";

const approved = "ثانيًا: علاقات على أساس العلم\nفي نوادي القراءة ومجموعات القراءة تتكون بين محبي القراءة زمالات وصداقات.";

describe("every approved word is in the slide's program", () => {
  it("finds what إيمان's slide left out and reworded", () => {
    const code = `K.text("اثنين:", …); K.text("علاقات", …); K.text("بين القراء", …); K.text("على أساس العلم", …);`;
    const m = missingWords(code, approved);
    expect(m).toEqual(expect.arrayContaining(["ثانيا", "نوادي", "زمالات", "وصداقات"]));
  });
  it("passes a program with the whole text, whatever its diacritics or splitting", () => {
    const code = `const lines = ["ثانياً:", "علاقات على أساس العلم"]; const body = "في نوادي القراءة ومجموعات القراءة تتكوّن بين محبّي القراءة زمالات وصداقات.";`;
    expect(missingWords(code, approved)).toEqual([]);
  });
});
