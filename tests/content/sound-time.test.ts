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
