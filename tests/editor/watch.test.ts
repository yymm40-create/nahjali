import { describe, expect, it } from "vitest";
import { asksToSee, findCuts, motionPerSecond, pickTimes, readWatch, spansOf, watchText, WATCH, type FrameStat } from "@/lib/editor/watch";

/** A clip of `n` frames at 30 fps from `start`: calm with a little noise, a new shot at each `cutAt` frame. */
const clip = (n: number, cutAt: number[] = [], start = 0): FrameStat[] =>
  Array.from({ length: n }, (_, i) => ({ t: Math.round(start + (i * 1000) / 30), luma: 120, diff: i === 0 ? 0 : cutAt.includes(i) ? 60 : 1 + (i % 3) * 0.3 }));

describe("«👁️ حيدرة يشوف المقطع كامل» — what every frame tells", () => {
  it("finds the cuts in all the frames, once each, and nothing in a calm shot", () => {
    expect(findCuts(clip(300, [90, 200]))).toEqual([3000, 6667]);
    expect(findCuts(clip(300))).toEqual([]);
    // two big changes a few frames apart are one cut (the biggest)
    const s = clip(120, [40, 43]);
    s[43].diff = 80;
    expect(findCuts(s)).toEqual([1433]);
    expect(findCuts(clip(2))).toEqual([]);
  });

  it("finds black and frozen moments that last, not a single dark frame", () => {
    const s = clip(120).map((f, i) => (i >= 30 && i < 60 ? { ...f, luma: 4 } : i === 90 ? { ...f, luma: 2 } : f));
    expect(spansOf(s, (f) => f.luma < 16, 300)).toEqual([[1000, 1967]]);
    const still = clip(90).map((f, i) => (i >= 10 && i < 80 ? { ...f, diff: 0 } : f));
    expect(spansOf(still, (f) => f.diff < 0.4, 1000)).toEqual([[333, 2633]]);
  });

  it("says how much happens in each second", () => {
    const m = motionPerSecond(clip(90, [45]), 0, 3000);
    expect(m).toHaveLength(3);
    expect(m[1]).toBeGreaterThan(m[0]);
  });

  it("shows a frame right after every cut and spreads the rest — many a second for a short clip", () => {
    const t = pickTimes(0, 10_000, [3000, 6000]);
    expect(t.length).toBeLessThanOrEqual(WATCH.tiles);
    expect(t).toContain(3080);
    expect(t).toContain(6080);
    expect(t.length).toBeGreaterThan(60);
    expect([...t].sort((a, b) => a - b)).toEqual(t);
    // a long clip: still every part of it, evenly
    const long = pickTimes(0, 600_000, []);
    expect(long).toHaveLength(WATCH.tiles);
    expect(long[0]).toBeLessThan(5000);
    expect(long[long.length - 1]).toBeGreaterThan(590_000);
  });
});

describe("what the page sends, read on the server", () => {
  const ok = { clipId: "c1", sheets: [{ data: "QUJD", times: [0, 500, 1000] }], analysed: 300, from: 0, to: 10_000, cuts: [3000], black: [[1000, 1500]], frozen: [], motion: [3, 50, 120] };

  it("keeps a clip of this timeline, plain base64 sheets and numbers only", () => {
    const w = readWatch(ok, new Set(["c1"]))!;
    expect(w.sheets).toHaveLength(1);
    expect(w.motion).toEqual([3, 50, 100]);
    expect(readWatch({ ...ok, clipId: "nope" }, new Set(["c1"]))).toBeNull();
    expect(readWatch({ ...ok, sheets: [{ data: "<script>", times: [] }] }, new Set(["c1"]))).toBeNull();
    expect(readWatch({ ...ok, sheets: Array.from({ length: 20 }, () => ok.sheets[0]) }, new Set(["c1"]))!.sheets).toHaveLength(WATCH.sheets);
  });

  it("tells him what was measured, what was found, and to name moments by the tiles' times", () => {
    const text = watchText(readWatch(ok, new Set(["c1"]))!);
    expect(text).toContain("WATCHED WHOLE");
    expect(text).toContain("300 frames");
    expect(text).toContain("3.0s");
    expect(text).toContain("1.0s–1.5s");
    expect(text).toContain("TIMELINE time");
  });

  it("knows a request that needs to see what happens in the clip", () => {
    for (const m of ["شوف المقطع وقولي وش فيه", "متى يدخل الولد؟", "قص لما يضحك", "اوصف اللقطات", "describe this clip"]) expect(asksToSee(m), m).toBe(true);
    for (const m of ["خل الصوت أعلى", "سرّع المقطع ×2", "ركّب موسيقى هادية"]) expect(asksToSee(m), m).toBe(false);
  });
});
