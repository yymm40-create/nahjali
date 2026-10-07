import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { defaultDesign, emptyBrief, pagesOf, readBrief, readWish, wantsDocx, wishGiven } from "@config/jawad/student";
import type { Block, Doc } from "@/lib/jawad/student/model";
import { FIT_SCALE, frontPages, maxChapters, nextScale, PAGE_WORDS, refitRatio, wordBudget } from "@/lib/jawad/student/pages";
import { docDocx } from "@/lib/jawad/student/render/docx";

describe("«الطالب الذكي» · page count", () => {
  it("adds a cover from 4 pages and contents from 6", () => {
    expect(frontPages(1, 3)).toEqual({ cover: false, toc: false, count: 0 });
    expect(frontPages(4, 3)).toEqual({ cover: true, toc: false, count: 1 });
    expect(frontPages(6, 3)).toEqual({ cover: true, toc: true, count: 2 });
    expect(frontPages(6, 1).toc).toBe(false);
  });

  it("shares the body words of the pages over the chapters by weight", () => {
    const b = wordBudget(10, "A4", [1, 1, 2]);
    expect(b.total).toBe((10 - 2) * PAGE_WORDS.A4);
    expect(b.chapters[2]).toBe(b.chapters[0] * 2);
    expect(b.chapters.reduce((a, x) => a + x, 0)).toBeCloseTo(b.total, -1);
    // one page: no cover, all of it is body
    expect(wordBudget(1, "A5", [1]).total).toBe(PAGE_WORDS.A5);
  });

  it("keeps few chapters for few pages", () => {
    expect(maxChapters(1)).toBe(1);
    expect(maxChapters(3)).toBe(2);
    expect(maxChapters(300)).toBe(40);
  });

  it("bisects the type scale and stops when the bounds meet", () => {
    expect(nextScale(FIT_SCALE.min, 1)).toBeCloseTo((FIT_SCALE.min + 1) / 2, 3);
    expect(nextScale(1, 1.01)).toBeNull();
  });

  it("asks for fewer words when too long and more when too short", () => {
    expect(refitRatio(5, 10, 1)).toBeCloseTo(4 / 9, 3);
    expect(refitRatio(10, 5, 2)).toBeCloseTo(8 / 3, 3);
    expect(refitRatio(1, 100, 0)).toBe(0.3);
  });

  it("reads the settings the student gave", () => {
    expect(pagesOf({ pages: 7 })).toBe(7);
    expect(pagesOf({ pages: "x" })).toBe(0);
    expect(pagesOf({ pages: 9999 })).toBe(300);
    expect(wantsDocx({ format: "docx" })).toBe(true);
    expect(wantsDocx({ format: "both" })).toBe(true);
    expect(wantsDocx({})).toBe(false);
  });
});

describe("«الطالب الذكي» · the student's choices", () => {
  it("keeps صادق on unless turned off", () => {
    expect(emptyBrief().auto).toBe(true);
    expect(readBrief({}).auto).toBe(true);
    expect(readBrief({ auto: false }).auto).toBe(false);
  });

  it("reads a design wish and drops what isn't a style or a font", () => {
    const w = readWish({ style: "bento", ideas: "كحلي وذهبي", heading: "nope", body: "plex", frame: false });
    expect(w).toEqual({ style: "bento", ideas: "كحلي وذهبي", heading: "", body: "plex", frame: false });
    expect(wishGiven(w)).toBe(true);
    expect(wishGiven(readWish(null))).toBe(false);
    expect(readWish(null).frame).toBe(true);
  });
});

describe("«الطالب الذكي» · Word file", () => {
  const b = (t: Block["t"], text: string, extra: Partial<Block> = {}): Block => ({ t, text, title: "", items: [], rows: [], sources: [], segments: [], ...extra });
  const doc: Doc = {
    title: "الخلية",
    subtitle: "ملخص للصف الثاني متوسط",
    chapters: [
      { title: "أجزاء الخلية", blocks: [b("h", "الغشاء"), b("p", "نص **مهم** و==مظلل==."), b("compare", "", { rows: [["العضية", "الوظيفة"], ["النواة", "التحكم"]] }), b("list", "", { items: [{ title: "", text: "بند" }] })] },
      { title: "الطاقة", blocks: [b("p", "فقرة.")] },
    ],
  };

  it("uses Word's own title, subtitle and heading styles, right to left, with a page frame", async () => {
    const buf = await docDocx(doc, { ...defaultDesign("editorial"), frame: true }, { page: "A4", pages: 6 });
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file("word/document.xml")!.async("string");
    for (const style of ["Title", "Subtitle", "Heading1", "Heading2"]) expect(xml).toContain(`w:val="${style}"`);
    expect(xml).toContain("<w:bidi/>");
    expect(xml).toContain("<w:pgBorders");
    expect(xml).toContain("<w:tbl>");
    // 6 pages: a cover and a contents page, chapters flowing on (no page per chapter)
    expect(xml).toContain("المحتويات");
    expect(xml).not.toContain('<w:pageBreakBefore/>');
  });

  it("leaves the frame out when the student turned it off", async () => {
    const buf = await docDocx(doc, { ...defaultDesign("notebook"), frame: false }, { page: "A5" });
    const xml = await (await JSZip.loadAsync(buf)).file("word/document.xml")!.async("string");
    expect(xml).not.toContain("<w:pgBorders");
    expect(xml).toContain("<w:pageBreakBefore/>");
  });
});
