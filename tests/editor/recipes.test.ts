import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { duration, emptyTimeline } from "@/lib/editor/model";
import { beatMontage, calmExplainer, jumpZoom, onTimeline, reelCaptions, silentSpans } from "@/lib/editor/recipes";
import { lib, main, sound, video } from "./helpers";

const R = 100;
/** loudness: speech (120) with quiet stretches at the given seconds */
const peaks = (secs: number, quiet: [number, number][]) => new Uint8Array(secs * R).map((_, k) => (quiet.some(([a, b]) => k >= a * R && k < b * R) ? 2 : 120));

describe("silence cutting (majed-video's numbers)", () => {
  it("cuts long silences, keeping 0.13 s of air on each side", () => {
    expect(silentSpans(peaks(10, [[2, 3]]), R, 0, 10000)).toEqual([[2130, 2870]]);
  });

  it("leaves pauses shorter than 0.35 s", () => {
    expect(silentSpans(peaks(10, [[2, 2.3]]), R, 0, 10000)).toEqual([]);
  });

  it("cuts silence at the very start and end to the edge", () => {
    expect(silentSpans(peaks(10, [[0, 1], [9, 10]]), R, 0, 10000)).toEqual([[0, 870], [9130, 10000]]);
  });

  it("drops a stranded piece shorter than 0.3 s (with its air) between two cuts", () => {
    // 0.02 s of sound + 0.13 s of air on each side = 0.28 s
    expect(silentSpans(peaks(10, [[2, 3], [3.02, 4]]), R, 0, 10000)).toEqual([[2130, 3870]]);
    // 0.2 s of sound + its air = 0.46 s stays
    expect(silentSpans(peaks(10, [[2, 3], [3.2, 4]]), R, 0, 10000)).toEqual([[2130, 2870], [3330, 3870]]);
  });

  it("places a clip's spans on the timeline", () => {
    expect(onTimeline({ start: 5000, in: 1000, out: 9000, speed: 2 }, [[0, 2000], [8000, 12000]])).toEqual([[5000, 5500], [8500, 9000]]);
  });
});

const assets = lib(video("v", 3000), video("w", 3000), sound("m", 20000));
const reel = () => applyAll(emptyTimeline(), [{ type: "add_clip", assetId: "v" }, { type: "add_clip", assetId: "w" }, { type: "add_clip", assetId: "v" }], assets).timeline;

describe("the styles", () => {
  it("jump-cut zoom: a different scale per piece, the face kept 30 % from the top", () => {
    const tl = reel();
    const cmds = jumpZoom(tl);
    const t = applyAll(tl, cmds, assets).timeline;
    expect(cmds.map((c) => (c.type === "update_clip" ? c.patch.transform : null))).toEqual([
      { scale: 1, y: 0.5 },
      { scale: 1.08, y: 0.3 + 0.2 * 1.08 },
      { scale: 1, y: 0.5 },
    ]);
    expect(main(t).clips.map((c) => c.transform.scale)).toEqual([1, 1.08, 1]);
  });

  it("calm explainer: soft dissolves and a light zoom held 4 s", () => {
    const tl = reel();
    const t = applyAll(tl, calmExplainer(tl), assets).timeline;
    expect(main(t).clips.map((c) => c.transition?.kind ?? null)).toEqual(["fade", "fade", null]);
    expect(main(t).clips.map((c) => c.transform.scale)).toEqual([1, 1, 1]);
  });

  it("reel captions: bold, lit word, low in the safe zone, rising in", () => {
    let t = apply(reel(), { type: "add_captions", items: [{ start: 0, end: 1000, body: "واحد اثنين", words: [{ s: 0, e: 400, w: "واحد" }, { s: 500, e: 900, w: "اثنين" }] }], style: "classic" }, assets).timeline;
    t = applyAll(t, reelCaptions(t), assets).timeline;
    const c = t.tracks.find((x) => x.kind === "text")!.clips[0];
    expect([c.text!.weight, c.text!.highlight, c.transform.y, c.anim?.in]).toEqual([900, "#facc15", 0.72, "rise"]);
    expect(reelCaptions(reel())).toEqual([]);
  });

  it("beat montage: shots trimmed and ending on beats, music ducked", () => {
    let t = applyAll(reel(), [{ type: "add_clip", assetId: "m", at: 0 }, { type: "set_markers", markers: Array.from({ length: 30 }, (_, i) => i * 500), mode: "replace" }], assets).timeline;
    const before = duration({ ...t, tracks: [main(t)] });
    t = applyAll(t, beatMontage(t, assets), assets).timeline;
    const shots = main(t).clips;
    expect(shots.every((c) => (c.start + (c.out - c.in)) % 500 === 0)).toBe(true);
    expect(shots[0].in).toBe(333);
    expect(duration({ ...t, tracks: [main(t)] })).toBeLessThan(before);
    expect(t.tracks.find((x) => x.kind === "audio")!.duck).toBe(true);
  });
});
