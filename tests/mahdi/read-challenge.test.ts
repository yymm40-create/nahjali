import { describe, expect, it } from "vitest";
import { rankReaders, readDays, readPhase } from "@/lib/mahdi/read-challenge";

const c = { startsOn: "2026-11-17", endsOn: "2026-11-23" };
const e = (userId: string, pages: number, days = 1) => ({ userId, displayName: userId, avatarUrl: null, pages, days });

describe("reading challenge", () => {
  it("knows its phase on a person's day", () => {
    expect(readPhase(c, "2026-11-16")).toBe("soon");
    expect(readPhase(c, "2026-11-17")).toBe("live");
    expect(readPhase(c, "2026-11-23")).toBe("live");
    expect(readPhase(c, "2026-11-24")).toBe("over");
  });
  it("lasts exactly 7 days", () => {
    expect(readDays(c, "2026-11-17")).toEqual({ day: 1, length: 7, left: 6 });
    expect(readDays(c, "2026-11-23")).toEqual({ day: 7, length: 7, left: 0 });
    expect(readDays(c, "2026-11-30")).toEqual({ day: 7, length: 7, left: 0 });
    expect(readDays(c, "2026-11-10")).toEqual({ day: 0, length: 7, left: 7 });
  });
  it("ranks by pages and lets equal pages share a place", () => {
    const r = rankReaders([e("a", 40), e("b", 120), e("c", 40, 3), e("d", 0)]);
    expect(r.map((x) => [x.userId, x.rank])).toEqual([
      ["b", 1],
      ["c", 2],
      ["a", 2],
      ["d", 4],
    ]);
  });
});
