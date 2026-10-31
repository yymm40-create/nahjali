import { describe, expect, it } from "vitest";
import { dealTeams, finalPoints, inkOn, leaderOf, pickSpies, raceCode, raceScore, type RacePlayerLite } from "@/lib/mahdi/race";

const people = (adults: number, kids: number): RacePlayerLite[] => [
  ...Array.from({ length: adults }, (_, i) => ({ id: `a${i}`, team: null, kid: false })),
  ...Array.from({ length: kids }, (_, i) => ({ id: `k${i}`, team: null, kid: true })),
];

describe("race rules", () => {
  it("deals even teams and shares the kids out", () => {
    for (let run = 0; run < 50; run++) {
      const t = dealTeams(people(8, 2), ["a", "b"]);
      const vals = Object.entries(t);
      expect(vals.filter(([, v]) => v === "a").length).toBe(5);
      expect(vals.filter(([k, v]) => k.startsWith("k") && v === "a").length).toBe(1);
    }
    const odd = Object.values(dealTeams(people(6, 1), ["a", "b"]));
    expect(Math.abs(odd.filter((v) => v === "a").length - odd.filter((v) => v === "b").length)).toBe(1);
  });

  it("picks one adult spy per team with different missions", () => {
    const ps = people(4, 2).map((p, i) => ({ ...p, team: (i % 2 ? "a" : "b") as "a" | "b" }));
    for (let run = 0; run < 50; run++) {
      const spies = pickSpies(ps, ["1", "2", "3", "4", "5"], ["a", "b"]);
      const ids = Object.keys(spies);
      expect(ids).toHaveLength(2);
      expect(ids.every((id) => id.startsWith("a"))).toBe(true);
      expect(new Set(ids.map((id) => ps.find((p) => p.id === id)!.team)).size).toBe(2);
      expect(new Set(Object.values(spies).flat()).size).toBe(4);
    }
  });

  it("adds and takes away points", () => {
    expect(raceScore([{ team: "a", points: 30 }, { team: "b", points: 5 }, { team: "a", points: -2 }], ["a", "b"])).toEqual({ a: 28, b: 5 });
  });

  it("scores the final", () => {
    expect(finalPoints({ a: 3, b: 1 }).map((p) => [p.team, p.points])).toEqual([["a", 45], ["b", 15], ["a", 30]]);
    expect(finalPoints({ a: 0, b: 0 })).toEqual([]);
    expect(finalPoints({ a: 2, b: 2 }).map((p) => p.points)).toEqual([30, 30]);
  });

  it("works with more than two teams", () => {
    const t = Object.values(dealTeams(people(9, 3), ["a", "b", "c", "d"]));
    expect(["a", "b", "c", "d"].map((x) => t.filter((v) => v === x).length)).toEqual([3, 3, 3, 3]);
    const ps = people(12, 0).map((p, i) => ({ ...p, team: "abcdef"[i % 6] }));
    const spies = pickSpies(ps, ["1", "2", "3"], ["a", "b", "c", "d", "e", "f"]);
    expect(Object.keys(spies)).toHaveLength(6);
    expect(Object.values(spies).every((m) => m.length === 2)).toBe(true);
    expect(leaderOf({ a: 5, b: 9, c: 2 })).toBe("b");
    expect(leaderOf({ a: 9, b: 9, c: 2 })).toBeNull();
    expect(finalPoints({ a: 1, b: 3, c: 2 }).map((p) => [p.team, p.points])).toEqual([["a", 15], ["b", 45], ["c", 30], ["b", 30]]);
  });

  it("picks readable text for a team colour", () => {
    expect(inkOn("#F5C542")).toBe("#141414");
    expect(inkOn("#123560")).toBe("#FFFFFF");
  });

  it("makes readable codes", () => {
    expect(raceCode()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  });
});
