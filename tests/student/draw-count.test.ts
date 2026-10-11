import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COUNTED_KINDS, capSlides, chosenPages, drawNote, mayAutoDraw } from "@/lib/jawad/student/draw";
import { pagesOf, picturesPlan } from "@/lib/jawad/student/pictures";
import { nextAuto } from "@/components/jawad/student/autopilot";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

const words = (n: number) => Array.from({ length: n }, (_, i) => `كلمة${i}`).join(" ");
const doc = { chapters: Array.from({ length: 8 }, (_, c) => ({ title: `فصل ${c + 1}`, blocks: Array.from({ length: 6 }, () => ({ t: "p", title: "", text: words(90), items: [], rows: [] })) })) };
const mk = (kind: string, settings: Record<string, unknown>, content: unknown) => ({ id: "o", user_id: "u", project_id: "p", kind, settings, content, files: {} }) as never;

// «قلت له سو ٥ صفحات سوى ٣٧!! بجي بي تي إيمج ٢ — انتبه، الأمر يروح بعدد الرقم اللي يختاره الشخص»
describe("the pages GPT Image 2 draws are the number the student chose", () => {
  it("is EXACTLY that number for every written output, whatever the length of the text", () => {
    for (const kind of COUNTED_KINDS) {
      for (const n of [1, 2, 5, 10, 20]) expect(pagesOf(mk(kind, { pages: n, pictures: "high" }, doc)).length, `${kind} ${n}`).toBe(n);
      // a number kept as text is still the number
      expect(pagesOf(mk(kind, { pages: "5" }, doc)).length).toBe(5);
    }
    expect(picturesPlan(mk("summary", { pages: 5 }, doc), "high").todo).toBe(5);
  });

  it("is only worded by the text when no number was chosen — and that is when the count runs away (48 here for 5 pages' worth)", () => {
    expect(pagesOf(mk("summary", { pages: 0 }, doc)).length).toBeGreaterThan(30);
    // a transcript and a quiz have no «كم صفحة» question at all: their count is whatever the text makes
    const segs = { segments: Array.from({ length: 40 }, (_, i) => ({ label: `ج${i}`, text: words(100) })) };
    expect(pagesOf(mk("transcript", { pages: 5 }, segs)).length).toBeGreaterThan(30);
    expect(chosenPages("transcript", { pages: 5 })).toBe(0);
    expect(chosenPages("quiz", { pages: 5 })).toBe(0);
    expect(chosenPages("summary", { pages: 5 })).toBe(5);
    expect(chosenPages("summary", { pages: 0 })).toBe(0);
  });
});

describe("drawing never starts, and never charges, on its own without a chosen number", () => {
  it("lets the autopilot draw only when the student chose the number of pages", () => {
    expect(mayAutoDraw("summary", { pages: 5 })).toBe(true);
    expect(mayAutoDraw("book", { pages: 20 })).toBe(true);
    expect(mayAutoDraw("summary", { pages: 0 })).toBe(false);
    expect(mayAutoDraw("explain", {})).toBe(false);
    expect(mayAutoDraw("transcript", { pages: 5 })).toBe(false);
    expect(mayAutoDraw("quiz", { pages: 5 })).toBe(false);
  });

  const stateWith = (kind: string, settings: Record<string, unknown>) =>
    ({
      project: { id: "p1", stage: "outputs", level: "ثانوي" },
      sources: [],
      coverage: { missing: [], approved: 0, total: 0, complete: true },
      outputs: [{ id: "o1", kind, ord: 0, title: "ناتج", status: "done", settings, files: [], plan: null, planApproved: false }],
    }) as never;

  it("the autopilot draws a finished output whose pages were chosen, and leaves every other one to the button", () => {
    expect(nextAuto(stateWith("summary", { pages: 5, pictures: "high" }))?.label).toContain("رسم الصفحات بـ GPT Image 2");
    for (const [kind, settings] of [
      ["summary", { pages: 0, pictures: "high" }],
      ["transcript", { pictures: "high" }],
      ["quiz", { pictures: "high", count: 5 }],
    ] as const) expect(nextAuto(stateWith(kind, { ...settings }))?.label ?? null, kind).toBeNull();
  });

  it("is refused by the server when the drawing would not be the chosen number, and the price is said with the count", () => {
    const actions = read("src/lib/jawad/student/actions.ts");
    const at = actions.indexOf('case "pictures":');
    const block = actions.slice(at, actions.indexOf('case "quiz_attempt"'));
    expect(block).toContain("chosenPages(o.kind, o.settings)");
    expect(block).toContain("plan.pages.length !== want");
    expect(block).toContain("throw new UserError");
    expect(block).toContain("drawNote(plan.pages.length, plan.todo)");
    // the quote carries the note to the dialog, which shows it before the student agrees
    expect(actions).toContain("...(o.note ? { note: o.note } : {})");
    expect(read("src/components/jawad/student/ui.tsx")).toContain("{quote.note && ");
  });

  it("says how many pages will be drawn, and how many are already drawn", () => {
    expect(drawNote(5, 5)).toBe("ستُرسم 5 صفحات بـ GPT Image 2");
    expect(drawNote(1, 1)).toBe("ستُرسم 1 صفحة بـ GPT Image 2");
    expect(drawNote(5, 2)).toBe("ستُرسم 2 من 5 صفحات (الباقي مرسوم ولم يتغيّر)");
  });

  it("warns, where the choice is made, that a drawing with no page number does not start by itself", () => {
    const q = read("src/components/jawad/student/Questions.tsx");
    expect(q).toContain("ما حدّدت عدد الصفحات");
    expect(q).toContain("s.pictures && !chosenPages(kind, s)");
  });
});

describe("slides drawn as pictures keep the student's number too", () => {
  it("cuts a map that came out longer than asked to the number, keeping the closing slide", () => {
    const s = (n: number) => Array.from({ length: n }, (_, i) => `s${i + 1}`);
    expect(capSlides(s(37), 5)).toEqual(["s1", "s2", "s3", "s4", "s37"]);
    expect(capSlides(s(12), 12)).toEqual(s(12));
    // fewer than asked: nothing is invented
    expect(capSlides(s(3), 5)).toEqual(s(3));
    expect(capSlides(s(9), 1)).toEqual(["s1"]);
    expect(capSlides(s(9), 0)).toEqual(s(9));
    expect(read("src/lib/jawad/student/outputs.ts")).toContain("capSlides(r.data.slides, want)");
  });
});
