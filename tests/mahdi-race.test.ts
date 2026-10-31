import { describe, expect, it } from "vitest";
import { dealTeams, finalPoints, pickSpies, raceCode, raceScore, type RacePlayerLite } from "@/lib/mahdi/race";

const people = (adults: number, kids: number): RacePlayerLite[] => [
  ...Array.from({ length: adults }, (_, i) => ({ id: `a${i}`, team: null, kid: false })),
  ...Array.from({ length: kids }, (_, i) => ({ id: `k${i}`, team: null, kid: true })),
];

describe("race rules", () => {
  it("deals even teams and shares the kids out", () => {
    for (let run = 0; run < 50; run++) {
      const t = dealTeams(people(8, 2));
      const vals = Object.entries(t);
      expect(vals.filter(([, v]) => v === "a").length).toBe(5);
      expect(vals.filter(([k, v]) => k.startsWith("k") && v === "a").length).toBe(1);
    }
    const odd = Object.values(dealTeams(people(6, 1)));
    expect(Math.abs(odd.filter((v) => v === "a").length - odd.filter((v) => v === "b").length)).toBe(1);
  });

  it("picks one adult spy per team with different missions", () => {
    const ps = people(4, 2).map((p, i) => ({ ...p, team: (i % 2 ? "a" : "b") as "a" | "b" }));
    for (let run = 0; run < 50; run++) {
      const spies = pickSpies(ps, ["1", "2", "3", "4", "5"]);
      const ids = Object.keys(spies);
      expect(ids).toHaveLength(2);
      expect(ids.every((id) => id.startsWith("a"))).toBe(true);
      expect(new Set(ids.map((id) => ps.find((p) => p.id === id)!.team)).size).toBe(2);
      expect(new Set(Object.values(spies).flat()).size).toBe(4);
    }
  });

  it("adds and takes away points", () => {
    expect(raceScore([{ team: "a", points: 30 }, { team: "b", points: 5 }, { team: "a", points: -2 }])).toEqual({ a: 28, b: 5 });
  });

  it("scores the final", () => {
    expect(finalPoints(3, 1).map((p) => [p.team, p.points])).toEqual([["a", 45], ["b", 15], ["a", 30]]);
    expect(finalPoints(0, 0)).toEqual([]);
    expect(finalPoints(2, 2).map((p) => p.points)).toEqual([30, 30]);
  });

  it("makes readable codes", () => {
    expect(raceCode()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  });
});
