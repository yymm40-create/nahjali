import { describe, expect, it } from "vitest";
import { applyAll } from "@/lib/editor/commands";
import { emptyTimeline } from "@/lib/editor/model";
import { cutsOnTimeline, findCuts, frameFeature, sharpenCut } from "@/lib/editor/scenes";
import { lib, main, video } from "./helpers";

/** A small frame: a coloured scene with a moving bright square (motion that is not a cut). */
function frame(scene: [number, number, number], t: number, noise = 0) {
  const w = 32, h = 18;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const sq = Math.abs(x - ((t * 6) % w)) < 3 && Math.abs(y - 9) < 3;
      const grad = x * 2 + y;
      px[i] = sq ? 250 : Math.min(255, scene[0] + grad + noise);
      px[i + 1] = sq ? 250 : Math.min(255, scene[1] + grad);
      px[i + 2] = sq ? 250 : Math.min(255, scene[2] + grad);
      px[i + 3] = 255;
    }
  return frameFeature(px, w, h);
}

const scenes: [number, number, number][] = [[20, 60, 120], [180, 120, 40], [40, 160, 60]];
/** 30 s sampled every 0.5 s; shots change at 10.2 s and 21.7 s. */
function clipSamples() {
  const times: number[] = [];
  const feats: Float32Array[] = [];
  for (let t = 0; t <= 30; t += 0.5) {
    times.push(t);
    feats.push(frame(scenes[t < 10.2 ? 0 : t < 21.7 ? 1 : 2], t, (t * 7) % 5));
  }
  return { times, feats };
}

describe("finding where the shot changes", () => {
  it("finds each change between the two samples around it, and nothing for motion", () => {
    const { times, feats } = clipSamples();
    const cuts = findCuts(times, feats);
    expect(cuts.map((c) => [c.before, c.after])).toEqual([[10, 10.5], [21.5, 22]]);
  });

  it("finds the exact frame from dense samples", () => {
    const times = Array.from({ length: 16 }, (_, i) => 10 + i / 30);
    const feats = times.map((t) => frame(scenes[t < 10.2 ? 0 : 1], t));
    expect(sharpenCut(times, feats)).toBeCloseTo(10.2, 1);
  });

  it("is quieter at low sensitivity than at high", () => {
    const { times, feats } = clipSamples();
    expect(findCuts(times, feats, "low").length).toBeLessThanOrEqual(findCuts(times, feats, "high").length);
  });
});

describe("cutting the clip there", () => {
  it("maps source moments to the timeline (trim and speed), leaving the clip's edges alone", () => {
    expect(cutsOnTimeline({ start: 1000, in: 2000, out: 30000, speed: 2 }, [1, 10.2, 21.7, 29.9])).toEqual([5100, 10850]);
  });

  it("splits the clip at every change in one go", () => {
    const assets = lib(video("v", 30_000));
    const t0 = applyAll(emptyTimeline(), [{ type: "add_clip", assetId: "v" }], assets).timeline;
    const c = main(t0).clips[0];
    const at = cutsOnTimeline(c, [10.2, 21.7]);
    const t = applyAll(t0, at.map((ms, i) => ({ type: "split" as const, at: ms, clipIds: [i ? `$${i}` : c.id] })), assets).timeline;
    expect(main(t).clips.map((x) => [x.start, x.in, x.out])).toEqual([[0, 0, 10200], [10200, 10200, 21700], [21700, 21700, 30000]]);
  });
});
