import { describe, expect, it } from "vitest";
import { parseClock } from "@/components/jawad/content/ContentChat";

describe("«⏱️ وقت الصوت» typed times", () => {
  it("reads minutes:seconds, seconds and Arabic digits", () => {
    expect(parseClock("0:12")).toBe(12);
    expect(parseClock("1:05")).toBe(65);
    expect(parseClock("12")).toBe(12);
    expect(parseClock("١٢")).toBe(12);
    expect(parseClock("٠:٢٠")).toBe(20);
    expect(parseClock("12.5")).toBe(12.5);
    expect(parseClock("١٢٫٥")).toBe(12.5);
  });
  it("refuses what is not a time", () => {
    expect(parseClock("")).toBeNull();
    expect(parseClock("abc")).toBeNull();
    expect(parseClock("0:75")).toBeNull();
  });
});

import { addRule, SLIDE_RULES } from "@/components/jawad/content/ContentChat";

describe("«✏️ عدّل الشريحة» ready choices", () => {
  it("adds one line per rule and a second press of the same rule replaces it", () => {
    let said = addRule("", "حركة الدخول", "من اليمين");
    said = addRule(said, "السرعة", "أبطأ");
    said = addRule(said, "حركة الدخول", "من تحت");
    expect(said.split("\n")).toEqual(["السرعة: أبطأ", "حركة الدخول: من تحت"]);
  });
  it("keeps what the person wrote in words", () => {
    expect(addRule("خل العنوان أزرق", "مكان الصورة", "فوق")).toBe("خل العنوان أزرق\nمكان الصورة: فوق");
  });
  it("offers the entrance, speed and places", () => {
    expect(SLIDE_RULES.map((r) => r.label)).toEqual(expect.arrayContaining(["حركة الدخول", "السرعة", "مكان الصورة"]));
  });
});
