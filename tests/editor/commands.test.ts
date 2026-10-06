import { describe, expect, it } from "vitest";
import { apply, applyAll, CommandError, type Command } from "@/lib/editor/commands";
import { duration, emptyTimeline, readTimeline } from "@/lib/editor/model";
import { lib, main, sound, spans, video } from "./helpers";

const assets = lib(video("a", 4000), video("b", 6000), video("c", 2000), sound("m", 20000));
const three = () => applyAll(emptyTimeline("16:9"), [{ type: "add_clip", assetId: "a" }, { type: "add_clip", assetId: "b" }, { type: "add_clip", assetId: "c" }], assets).timeline;

describe("the magnetic main track", () => {
  it("puts added clips one after another, in order", () => {
    expect(spans(three())).toEqual([["a", 0, 4000], ["b", 4000, 10000], ["c", 10000, 12000]]);
  });

  it("inserts at a time without reversing what was added there", () => {
    const t = applyAll(three(), [{ type: "add_clip", assetId: "c", at: 4000 }, { type: "add_clip", assetId: "c", at: 6000 }], assets).timeline;
    expect(spans(t).map((s) => s[0])).toEqual(["a", "c", "c", "b", "c"]);
    expect(duration(t)).toBe(16000);
  });

  it("splits a clip in two that play the same picture", () => {
    const t = apply(three(), { type: "split", at: 5000 }, assets).timeline;
    const [, left, right] = main(t).clips;
    expect([left.in, left.out, right.in, right.out]).toEqual([0, 1000, 1000, 6000]);
    expect(duration(t)).toBe(12000);
  });

  it("closes the gap on a ripple delete and keeps it on a lift", () => {
    const t = three();
    const b = main(t).clips[1].id;
    expect(duration(apply(t, { type: "delete", clipIds: [b], ripple: true }, assets).timeline)).toBe(6000);
    // the main track is magnetic, so even a lift closes up there; a free track keeps the hole
    const free = apply(t, { type: "set_magnetic", on: false }, assets).timeline;
    expect(duration(apply(free, { type: "delete", clipIds: [b], ripple: false }, assets).timeline)).toBe(12000);
  });

  it("trims an edge and the next clips follow", () => {
    const t = three();
    const a = main(t).clips[0].id;
    expect(spans(apply(t, { type: "trim_clip", clipId: a, edge: "end", to: 2500 }, assets).timeline)[1]).toEqual(["b", 2500, 8500]);
  });
});

describe("several commands as one change", () => {
  it('refers to a clip made earlier in the same list as "$N"', () => {
    const cmds: Command[] = [{ type: "add_clip", assetId: "a" }, { type: "update_clip", clipId: "$1", patch: { volume: 0.5, speed: 2 } }];
    const c = main(applyAll(emptyTimeline(), cmds, assets).timeline).clips[0];
    expect([c.volume, c.speed]).toEqual([0.5, 2]);
  });

  it("cuts spans out of every track at once and keeps picture and sound together", () => {
    let t = three();
    t = apply(t, { type: "add_clip", assetId: "m", at: 0 }, assets).timeline;
    t = apply(t, { type: "remove_ranges", ranges: [[1000, 2000], [8000, 9000]] }, assets).timeline;
    // the 12 s of pictures and the 20 s of music both lose the same 2 s
    expect(duration({ ...t, tracks: [main(t)] })).toBe(10000);
    // the music is cut at the same moments, so it stays under the same pictures
    expect(spans(t, "audio")).toEqual([["m", 0, 1000], ["m", 1000, 7000], ["m", 7000, 18000]]);
    expect(t.tracks.find((x) => x.kind === "audio")!.clips.map((c) => c.in)).toEqual([0, 2000, 9000]);
  });

  it("puts the same transition at every cut", () => {
    const t = apply(three(), { type: "transition_all", kind: "fade", ms: 400 }, assets).timeline;
    expect(main(t).clips.map((c) => c.transition?.kind ?? null)).toEqual(["fade", "fade", null]);
  });

  it("refuses with a clear Arabic message and leaves the timeline alone", () => {
    const t = three();
    const before = JSON.stringify(t);
    expect(() => apply(t, { type: "add_clip", assetId: "nope" }, assets)).toThrow(CommandError);
    expect(() => apply(t, { type: "add_clip", assetId: "nope" }, assets)).toThrow(/مكتبة/);
    expect(JSON.stringify(t)).toBe(before);
  });
});

describe("reading a saved timeline", () => {
  it("drops what doesn't belong and keeps what does", () => {
    const t = three();
    const raw = JSON.parse(JSON.stringify(t));
    raw.tracks[0].clips[0].assetId = "gone";
    raw.tracks[0].clips[1].volume = 99;
    raw.evil = "<script>";
    const clean = readTimeline(raw, new Set(["a", "b", "c"]));
    expect(main(clean).clips.map((c) => c.assetId)).toEqual(["b", "c"]);
    expect(main(clean).clips[0].volume).toBeLessThanOrEqual(2);
    expect("evil" in clean).toBe(false);
  });

  it("gives an empty timeline for anything that isn't one", () => {
    expect(readTimeline("garbage").tracks.length).toBeGreaterThan(0);
    expect(duration(readTimeline(null))).toBe(0);
  });
});
