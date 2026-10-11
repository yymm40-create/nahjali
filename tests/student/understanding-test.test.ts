import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEVELS_OF_UNDERSTANDING, isAutoMarked, levelOf, mark, verdict, type SelfMark } from "@/lib/jawad/student/level";
import type { Question } from "@/lib/jawad/student/model";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

const mcq = (answer = "ب", n = 1): Question => ({ type: "mcq", question: `س${n}`, options: ["أ", "ب", "ج", "د"], answer, explanation: "لأن…", segments: [] });
const tf = (answer = "صح"): Question => ({ type: "tf", question: "صح أو خطأ؟", options: ["صح", "خطأ"], answer, explanation: "", segments: [] });
const written = (type = "short"): Question => ({ type, question: "اشرح", options: [], answer: "الشرح النموذجي", explanation: "", segments: [] });

// «اختبر فهمي»: a test of the student's understanding that says what their LEVEL is.
describe("the levels of understanding", () => {
  it("run from the beginning to mastery, lowest first, each with what it means and what to do next", () => {
    expect(LEVELS_OF_UNDERSTANDING.map((l) => l.id)).toEqual(["start", "partial", "good", "strong", "master"]);
    expect(LEVELS_OF_UNDERSTANDING.map((l) => l.from)).toEqual([0, 40, 60, 75, 90]);
    for (const l of LEVELS_OF_UNDERSTANDING) for (const f of [l.name, l.emoji, l.says, l.next]) expect(f.length, l.id).toBeGreaterThan(1);
    // the thresholds only rise: a percentage can never fall in two levels
    for (let i = 1; i < LEVELS_OF_UNDERSTANDING.length; i++) expect(LEVELS_OF_UNDERSTANDING[i].from).toBeGreaterThan(LEVELS_OF_UNDERSTANDING[i - 1].from);
  });

  it("puts a percentage in its level, exactly on the edges", () => {
    const at = (n: number) => levelOf(n).id;
    expect([0, 39, 40, 59, 60, 74, 75, 89, 90, 100].map(at)).toEqual(["start", "start", "partial", "partial", "good", "good", "strong", "strong", "master", "master"]);
  });

  it("never throws or invents a level from junk: out of range is clamped, not-a-number is the lowest", () => {
    expect(levelOf(-20).id).toBe("start");
    expect(levelOf(250).id).toBe("master");
    expect(levelOf(Number.NaN).id).toBe("start");
    expect(levelOf(Number.POSITIVE_INFINITY).id).toBe("start");
  });
});

describe("marking an answer", () => {
  it("marks a choice answer by the site: right only when it is the model answer, trimmed", () => {
    expect(isAutoMarked(mcq())).toBe(true);
    expect(isAutoMarked(tf())).toBe(true);
    expect(isAutoMarked(written())).toBe(false);
    expect(mark(mcq("ب"), 0, "ب")).toMatchObject({ points: 1, by: "site" });
    expect(mark(mcq("ب"), 0, "  ب ")).toMatchObject({ points: 1 });
    expect(mark(mcq("ب"), 0, "أ")).toMatchObject({ points: 0, by: "site" });
    expect(mark(mcq("ب"), 0, "")).toMatchObject({ points: 0 });
    // a choice question with no options is written, whatever its type says: nobody can pick from nothing
    expect(isAutoMarked({ type: "mcq", options: [] })).toBe(false);
  });

  it("marks a written answer by the student's own mark: one, a half or nothing — and nothing when they gave none", () => {
    const pts = (s?: SelfMark) => mark(written(), 0, "كلامي", s).points;
    expect([pts("right"), pts("partly"), pts("wrong"), pts()]).toEqual([1, 0.5, 0, 0]);
    expect(mark(written("essay"), 3, "x", "right")).toMatchObject({ by: "self", index: 3 });
  });
});

describe("the verdict", () => {
  it("is the share of points earned, rounded, and its level", () => {
    const all = [mark(mcq("ب"), 0, "ب"), mark(tf("صح"), 1, "صح"), mark(mcq("ب"), 2, "ب"), mark(mcq("ب"), 3, "أ")];
    const v = verdict(all);
    expect(v).toMatchObject({ percent: 75, points: 3, total: 4, bySite: 4, bySelf: 0 });
    expect(v.level.id).toBe("strong");
    // everything right is mastery, nothing right is the start
    expect(verdict([mark(mcq("ب"), 0, "ب")]).level.id).toBe("master");
    expect(verdict([mark(mcq("ب"), 0, "أ")]).level.id).toBe("start");
  });

  it("counts a half for a partly right written answer, and says who marked what", () => {
    const v = verdict([mark(mcq("ب"), 0, "ب"), mark(written(), 1, "x", "partly")]);
    expect(v).toMatchObject({ points: 1.5, total: 2, percent: 75, bySite: 1, bySelf: 1 });
  });

  it("lists the weak spots worst first, in the order asked among equals, and none when all is right", () => {
    const v = verdict([
      mark(mcq("ب", 1), 0, "ب"),
      mark(written(), 1, "x", "partly"),
      mark(mcq("ب", 3), 2, "أ"),
      mark(mcq("ب", 4), 3, "ج"),
    ]);
    // wrong ones (0 points) first by their position, then the partly right one
    expect(v.weak.map((m) => m.index)).toEqual([2, 3, 1]);
    expect(verdict([mark(mcq("ب"), 0, "ب"), mark(tf("صح"), 1, "صح")]).weak).toEqual([]);
  });

  it("is zero, not a division by nothing, when nothing was asked", () => {
    expect(verdict([])).toMatchObject({ percent: 0, points: 0, total: 0 });
    expect(verdict([]).level.id).toBe("start");
  });
});

describe("«🧪 اختبر فهمي» in the quiz", () => {
  const results = read("src/components/jawad/student/Results.tsx");
  const test = read("src/components/jawad/student/UnderstandingTest.tsx");

  it("is the quiz's third way, beside the plain quiz and the review cards", () => {
    expect(results).toContain("🧪 اختبر فهمي");
    expect(results).toContain('"quiz" | "cards" | "test"');
    expect(results).toContain("<UnderstandingTest");
    // one switch for all three, not three copies of it
    expect(results.match(/aria-label="طريقة المراجعة"/g)?.length).toBe(1);
  });

  it("costs nothing and calls no model: it is arithmetic, and the attempt is kept like a plain quiz's", () => {
    expect(test).not.toMatch(/PaidButton|callClaude|anthropic/i);
    expect(test).toContain('action: "quiz_attempt"');
  });

  it("shows the verdict only after the last question's marking has been seen, and keeps the attempt once", () => {
    expect(test).toContain("const [finished, setFinished]");
    expect(test).toContain("if (finished)");
    // the attempt is saved from a handler, never from the render (a render can run twice)
    const render = test.slice(test.indexOf("if (finished)"), test.indexOf("const q = qs[at]"));
    expect(render).not.toContain("post(");
    expect(test.match(/post\(`\/api\/jawad\/student\/outputs\//g)?.length).toBe(1);
  });

  it("tells the student how it was marked, and that the level is an estimate, not a judgement of them", () => {
    expect(test).toContain("صحّحها الموقع");
    expect(test).toContain("قيّمتها أنت بنفسك");
    expect(test).toContain("مو حكم على قدراتك");
  });

  it("also tells the level in the plain quiz's result", () => {
    expect(results).toContain("levelOf(result.score)");
    expect(results).toContain("مستواك:");
  });
});
