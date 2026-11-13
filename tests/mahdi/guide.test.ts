import { describe, expect, it } from "vitest";
import { GUIDE, GUIDE_BOOKS, guideBook, guideCount, isGuideKey, nextUp, normGuide, sameAuthor, searchGuide } from "@/lib/mahdi/guide";

describe("«مسبار القارئ» guide", () => {
  it("has three dimensions, 13 fields with pictures, and fixed unique ids", () => {
    expect(GUIDE).toHaveLength(3);
    expect(GUIDE.flatMap((d) => d.domains)).toHaveLength(13);
    const ids = GUIDE_BOOKS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    // the database checks the same shape (migration 0105)
    for (const id of ids) expect(id).toMatch(/^[a-z]{2,20}-[0-9]{1,4}$/);
    expect(GUIDE_BOOKS.length).toBeGreaterThan(300);
    for (const b of GUIDE_BOOKS) expect([0, 1, 2]).toContain(b.level);
  });

  it("a book listed twice shares one key", () => {
    for (const b of GUIDE_BOOKS) {
      expect(isGuideKey(b.key)).toBe(true);
      expect(guideBook(b.key)?.title).toBe(b.title);
    }
    expect(guideCount()).toBeLessThanOrEqual(GUIDE_BOOKS.length);
    expect(isGuideKey("nope-1")).toBe(false);
    expect(isGuideKey(5)).toBe(false);
  });

  it("search ignores hamza forms and ta marbuta, and matches every word", () => {
    expect(normGuide("أصول الفقه")).toBe(normGuide("اصول الفقة"));
    const r = searchGuide("المغالطات المنطقية");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].title).toContain("المغالطات");
    expect(searchGuide("")).toEqual([]);
    expect(new Set(searchGuide("الفقه").map((b) => b.key)).size).toBe(searchGuide("الفقه").length);
  });

  it("suggests the next books of the topic and the author's other books", () => {
    const b = GUIDE_BOOKS[0];
    for (const x of nextUp(b)) {
      expect(x.ti).toBe(b.ti);
      expect([b.level, b.level + 1]).toContain(x.level);
    }
    for (const x of sameAuthor(b)) expect(x.author).toBe(b.author);
  });
});
