import { describe, expect, it } from "vitest";
import { labGate, type GateInput } from "@/lib/editor/scene/lab-gate";

// «مختبر الموشن»: what the page measures before a review (no Claude) — the facts the stills cannot show.

/** motion sampled every 0.25 s over `duration`: `d(t)` is the change since the sample before */
const motion = (duration: number, d: (t: number) => number) => Array.from({ length: Math.floor(duration / 0.25) }, (_, i) => ({ t: (i + 1) * 0.25, d: d((i + 1) * 0.25) }));
const good: GateInput = { duration: 10, sound: true, cues: [0, 3, 6.02], changes: [0, 3, 6], motion: motion(10, (t) => (t < 7.5 ? 0.05 : 0.001)) };

describe("the page's check before a review", () => {
  it("a sound(), a cue on every change, a held ending and no dead air: nothing to say", () => {
    expect(labGate(good)).toEqual([]);
  });

  it("names each problem with its times", () => {
    const got = labGate({ ...good, sound: false, cues: [0], motion: motion(10, (t) => (t > 2 && t < 4 ? 0 : t < 9.5 ? 0.05 : 0.002)) });
    expect(got[0]).toMatch(/no sound\(K, S\)/);
    expect(got[1]).toContain("3.00 s, 6.00 s");
    expect(got.find((g) => g.startsWith("The ending is held only 0.8 s (the picture still changes at 9.25 s)"))).toBeTruthy();
    expect(got.find((g) => g.startsWith("Nothing moves at all from 2.00 s to 3.75 s"))).toBeTruthy();
  });

  it("a piece on the person's video is not asked for a held card; too few samples say nothing about motion", () => {
    expect(labGate({ ...good, footage: true, motion: motion(10, () => 0.05) })).toEqual([]);
    expect(labGate({ ...good, motion: [] })).toEqual([]);
    expect(labGate({ ...good, duration: 0 })).toEqual([]);
  });
});
