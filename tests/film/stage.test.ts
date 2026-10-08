import { describe, expect, it } from "vitest";
import { overallPercent, runningPercent, TYPICAL_MS } from "@/lib/film/progress-math";
import { STEPS } from "@/app/film/stage/FilmStage";
import { FILM_STAGES } from "@config/film";

describe("«العداد»", () => {
  it("a running piece ticks from 1 to 99 and never says done by itself", () => {
    const start = new Date(1_000_000).toISOString();
    expect(runningPercent(start, "image", 1_000_000).percent).toBe(1);
    const mid = runningPercent(start, "image", 1_000_000 + TYPICAL_MS.image / 2);
    expect(mid.percent).toBeGreaterThan(30);
    expect(mid.percent).toBeLessThan(90);
    expect(mid.etaSec).toBe(TYPICAL_MS.image / 2000);
    const late = runningPercent(start, "image", 1_000_000 + TYPICAL_MS.image * 5);
    expect(late.percent).toBe(99);
    expect(late.etaSec).toBe(0);
  });
  it("the scene's number weighs the steps, 0 at the start and 100 at the end", () => {
    const s = (p: number) => ({ done: p, of: 100, percent: p });
    const none = { story: s(0), script: s(0), sheets: s(0), director: s(0), videos: s(0), voices: s(0), edit: s(0) };
    const all = { story: s(100), script: s(100), sheets: s(100), director: s(100), videos: s(100), voices: s(100), edit: s(100) };
    expect(overallPercent(none)).toBe(0);
    expect(overallPercent(all)).toBe(100);
    const half = overallPercent({ ...none, story: s(100), script: s(100), sheets: s(100) });
    expect(half).toBeGreaterThan(40);
    expect(half).toBeLessThan(50);
  });
});

describe("«المشهد»: the rail", () => {
  it("lists every step once, in the journey's order, each reaching a real stage", () => {
    expect(STEPS.map((s) => s.key)).toEqual(["story", "script", "sheets", "director", "videos", "voices", "edit"]);
    for (const s of STEPS) expect(FILM_STAGES.some((x) => x.key === s.reached)).toBe(true);
    expect(new Set(STEPS.map((s) => s.path)).size).toBe(STEPS.length);
  });
});
