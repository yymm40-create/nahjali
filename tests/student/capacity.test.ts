import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KIND_YIELD, capacityLine, capacityOf, fitsPages, readCapacity } from "@/lib/jawad/student/capacity";
import { nextAuto } from "@/components/jawad/student/autopilot";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

// «ويسأل عن الصفحات قبل يكتب المحتوى عشان يحدد هل يكفي المحتوى للصفحات ولا»
describe("does the material fill the pages the student asked for — measured BEFORE anything is written", () => {
  it("says a small material cannot fill many pages (600 words, a book of 37 pages)", () => {
    const c = capacityOf("book", 600, 37, "A4")!;
    expect(c.verdict).toBe("short");
    expect(c.pages).toBe(37);
    // 600 words make a page or two of text, nowhere near 37
    expect(c.most).toBeLessThan(10);
    expect(c.best).toBeLessThan(c.pages);
    expect(fitsPages(c)).toBe(false);
  });

  it("says a big material squeezed into a few pages loses most of it (20,000 words, 3 pages)", () => {
    const c = capacityOf("explain", 20_000, 3, "A4")!;
    expect(c.verdict).toBe("long");
    expect(c.least).toBeGreaterThan(c.pages);
    expect(c.best).toBeGreaterThan(c.pages);
  });

  it("says a material that fits the number fits (the middle of the range is always within it)", () => {
    for (const kind of Object.keys(KIND_YIELD)) {
      for (const words of [800, 3000, 12_000, 40_000]) {
        const best = capacityOf(kind, words, 10, "A4")!.best;
        // asking for what the material makes is never a mismatch
        const c = capacityOf(kind, words, best, "A4")!;
        expect(c.verdict, `${kind} ${words} words → ${best} pages`).toBe("fits");
        expect(fitsPages(c)).toBe(true);
      }
    }
  });

  it("is ordered: least ≤ best ≤ most, and a bigger material never makes fewer pages", () => {
    for (const kind of Object.keys(KIND_YIELD)) {
      let before = 0;
      for (const words of [200, 1000, 4000, 16_000, 64_000]) {
        const c = capacityOf(kind, words, 5, "A4")!;
        expect(c.least, kind).toBeLessThanOrEqual(c.best);
        expect(c.best, kind).toBeLessThanOrEqual(c.most);
        expect(c.most, kind).toBeGreaterThanOrEqual(before);
        before = c.most;
      }
    }
    // an A5 page holds fewer words: the same material fills more of them
    expect(capacityOf("explain", 5000, 5, "A5")!.most).toBeGreaterThan(capacityOf("explain", 5000, 5, "A4")!.most);
    // a summary makes fewer pages than an explanation of the same material
    expect(capacityOf("summary", 5000, 5, "A4")!.most).toBeLessThan(capacityOf("explain", 5000, 5, "A4")!.most);
  });

  it("measures nothing when there is nothing to measure: no number chosen, or a kind with no page question", () => {
    expect(capacityOf("summary", 5000, 0, "A4")).toBeNull();
    expect(capacityOf("quiz", 5000, 5, "A4")).toBeNull();
    expect(capacityOf("transcript", 5000, 5, "A4")).toBeNull();
    expect(fitsPages(null)).toBe(true);
    expect(fitsPages(undefined)).toBe(true);
    // junk in is a measured nothing, never a throw or a NaN
    expect(capacityOf("summary", Number.NaN, 5, "A4")).toMatchObject({ words: 0 });
  });

  it("reads back only a well-formed measure from the settings, and says it in words", () => {
    const c = capacityOf("book", 600, 37, "A4")!;
    expect(readCapacity({ _capacity: c })).toEqual(c);
    expect(readCapacity({})).toBeNull();
    expect(readCapacity({ _capacity: { words: 1 } })).toBeNull();
    expect(readCapacity({ _capacity: { ...c, verdict: "maybe" } })).toBeNull();
    expect(readCapacity(null)).toBeNull();
    expect(capacityLine(c, false)).toContain("مادتك");
    expect(capacityLine(c, false)).toContain("طلبت");
    expect(capacityLine(c, true)).toContain("مُعلَّمة «إضافة»");
    expect(capacityLine({ ...c, verdict: "fits" }, true)).toBe("");
    expect(capacityLine(capacityOf("explain", 20_000, 3, "A4")!, false)).toContain("اختصارًا شديدًا");
  });
});

describe("the plan stage asks, the autopilot waits, and the output says so", () => {
  const stateAt = (settings: Record<string, unknown>) =>
    ({
      project: { id: "p1", stage: "outputs", level: "ثانوي" },
      sources: [],
      coverage: { missing: [], approved: 0, total: 0, complete: true },
      outputs: [{ id: "o1", kind: "book", ord: 0, title: "كتاب", status: "plan_review", settings, files: [], plan: { chapters: [] }, planApproved: false }],
    }) as never;

  it("approves the plan by itself when the material fits, and stops for the student when it does not", () => {
    const fits = capacityOf("book", 6000, capacityOf("book", 6000, 10, "A4")!.best, "A4")!;
    const short = capacityOf("book", 600, 37, "A4")!;
    expect(nextAuto(stateAt({ pages: 10, _capacity: fits }))?.label).toContain("اعتماد الخطة");
    expect(nextAuto(stateAt({ pages: 10 }))?.label).toContain("اعتماد الخطة");
    expect(nextAuto(stateAt({ pages: 37, _capacity: short }))).toBeNull();
  });

  it("measures in the plan step before anything is written, and keeps the measure with the output", () => {
    const outputs = read("src/lib/jawad/student/outputs.ts");
    const at = outputs.indexOf("BEFORE anything is written: does the material fill");
    const block = outputs.slice(at, at + 900);
    expect(block).toContain("capacityOf(o.kind, countWords(allText(c)) + countWords(researchText(c)), pages, pageSize(o))");
    expect(block).toContain('status: "plan_review"');
    expect(block).toContain("_capacity: capacity");
    // the plan is saved with `content: null`: nothing has been written yet when the question comes
    expect(block).toContain("content: null");
  });

  it("asks in the plan review with a button that takes the honest number, changing it only once agreed", () => {
    const ask = read("src/components/jawad/student/CapacityAsk.tsx");
    expect(ask).toContain("هل المادة تكفي للصفحات؟");
    expect(ask).toContain("pages: c.best");
    expect(ask).toContain("if (b.confirm) await act");
    expect(ask).toContain('act({ action: "plan", ...b })');
    expect(read("src/components/jawad/student/OutputPanel.tsx")).toContain("<CapacityAsk");
    expect(read("src/components/jawad/student/OutputsStep.tsx")).toContain("المادة ما توافق عدد الصفحات");
  });
});
