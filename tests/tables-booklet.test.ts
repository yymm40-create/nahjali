import { describe, expect, it } from "vitest";
import { bookletUsd, cleanSpec, legacyGender, LIMITS, pagesOf, posesOf, readAudience, readSpec } from "@config/tables-booklet";
import { characterPrompt, posePrompt } from "@config/prompts";
import { bookletTemplate } from "@/lib/tables-booklet/layout";

const kid = { kind: "child", gender: "female", age: 7, name: "زينب" } as const;

describe("«كتيب الجداول الذكي» — who it is for", () => {
  it("takes a child or a grown-up with a sensible age and a name of letters", () => {
    expect(readAudience(kid)).toEqual(kid);
    expect(readAudience({ ...kid, kind: "adult", age: 35 })).toMatchObject({ kind: "adult", age: 35 });
    expect(readAudience({ ...kid, age: 30 })).toBeNull();
    expect(readAudience({ ...kid, kind: "adult", age: 9 })).toBeNull();
    expect(readAudience({ ...kid, name: "<script>" })).toBeNull();
    expect(readAudience({ ...kid, gender: "x" })).toBeNull();
    expect(legacyGender(kid)).toBe("girl");
  });

  it("draws a grown-up as a grown-up, a woman still in a full abaya", () => {
    const woman = characterPrompt("pixar", "girl", { adult: true, age: 35 });
    expect(woman).toMatch(/abaya/i);
    expect(woman).not.toMatch(/\bchild\b/i);
    expect(posePrompt("praying", "pixar", "girl", { adult: true, age: 35 })).toMatch(/abaya/i);
  });
});

describe("«نور»'s design", () => {
  const reply = 'تمام، هذا ملخص كتيبك.\n```json\n{"title":"كتيب زينب","theme":"mint","photo":true,"style":"anime","tables":[{"title":"صلاتي","rows":["الفجر","الظهر","العصر","المغرب","العشاء"],"columns":"week","mark":"star","copies":4,"pose":"praying"},{"title":"","rows":["x"]},{"title":"قراءتي","rows":["  سورة   الملك "],"columns":"bogus","mark":"heart","pose":"flying"}],"rewards":["٣٠ نجمة = نزهة"]}\n```';

  it("is read from the json block and cleaned to the limits", () => {
    const s = readSpec(reply)!;
    expect(s.title).toBe("كتيب زينب");
    expect(s.theme).toBe("mint");
    expect(s.tables).toHaveLength(2);
    expect(s.tables[1]).toMatchObject({ rows: ["سورة الملك"], columns: "week", mark: "heart", pose: null, copies: 1 });
    expect(s.certificate).toBe(true);
    expect(readSpec("no block")).toBeNull();
    expect(readSpec("```json\n{oops\n```")).toBeNull();
    expect(cleanSpec({ tables: [] })).toBeNull();
  });

  it("knows its poses, pages and price (free without a photo)", () => {
    const s = readSpec(reply)!;
    expect(posesOf(s)).toEqual(["happy", "praying"]);
    expect(pagesOf(s)).toBe(1 + 4 + 1 + 1 + 1);
    expect(posesOf({ ...s, photo: false })).toEqual([]);
    expect(bookletUsd(0)).toBe(0);
    expect(bookletUsd(2)).toBeGreaterThan(0);
  });

  it("never grows past the page limit", () => {
    const tables = Array.from({ length: 12 }, (_, i) => ({ title: `جدول ${i}`, rows: ["بند"], copies: 5 }));
    const s = cleanSpec({ tables, message: "مرحبا", rewards: ["هدية"] })!;
    expect(s.tables).toHaveLength(LIMITS.tables);
    expect(pagesOf(s)).toBeLessThanOrEqual(LIMITS.pages);
  });

  it("lays out every page, with a slot for the character only where there is a picture", () => {
    const s = readSpec(reply)!;
    const t = bookletTemplate(s);
    expect(t.pages).toHaveLength(pagesOf(s));
    expect(t.poses).toEqual(posesOf(s));
    for (const p of t.pages) {
      expect(p.overlaySvg).toMatch(/^<svg/);
      expect(p.sceneSvg).toMatch(/^<svg/);
    }
    const noPhoto = bookletTemplate({ ...s, photo: false });
    expect(noPhoto.pages.flatMap((p) => p.slots)).toEqual([]);
    expect(noPhoto.poses).toEqual([]);
  });
});
