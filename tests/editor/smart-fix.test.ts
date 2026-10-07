import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { emptyTimeline, readTimeline, FIX_TRACK, type Timeline } from "@/lib/editor/model";
import { fixCut, fixedOffset, pieceRange } from "@/lib/editor/smart-fix";
import { lib, main, video } from "./helpers";

const assets = lib(video("v", 10_000), video("new", 6000), video("redo", 10_000));
const red = (t: Timeline) => t.tracks.find((x) => x.role === "fix")!;
const green = (t: Timeline) => t.tracks.find((x) => x.role === "fixed")!;

/** A 10 s video cut at 3 s and 5 s, magnetic on (the default). */
function cutUp() {
  return applyAll(emptyTimeline(), [{ type: "add_clip", assetId: "v" }, { type: "split", at: 3000 }, { type: "split", at: 5000 }], assets).timeline;
}

describe("lifting a piece onto the red track", () => {
  const t0 = cutUp();
  const piece = main(t0).clips[1];
  const r = apply(t0, { type: "lift_fix", clipId: piece.id }, assets);
  const t = r.timeline;

  it("moves it straight up, in the very same place", () => {
    expect(red(t).clips.map((c) => [c.id, c.start, c.in, c.out])).toEqual([[piece.id, 3000, 3000, 5000]]);
    expect(red(t)).toMatchObject({ name: FIX_TRACK.fix.name, color: "#ef4444", kind: "video" });
    expect(red(t).clips[0].fix).toEqual({ note: "", mode: "parts", job: null, from: null, state: "draft" });
    expect(r.select).toEqual([piece.id]);
  });

  it("leaves the gap on the main track (nothing slides left)", () => {
    expect(main(t).clips.map((c) => [c.start, c.in])).toEqual([[0, 0], [5000, 5000]]);
    expect(t.magnetic).toBe(false);
  });

  it("puts the red track above the video", () => {
    expect(t.tracks.indexOf(red(t))).toBeGreaterThan(t.tracks.indexOf(main(t)));
  });

  it("keeps a dragged piece in place and refuses an overlap", () => {
    const right = main(t).clips[1];
    const t2 = apply(t, { type: "move_clip", clipId: right.id, trackId: red(t).id, start: 0 }, assets).timeline;
    expect(red(t2).clips.map((c) => c.start)).toEqual([3000, 5000]);
    expect(() => apply(t, { type: "lift_fix", clipId: piece.id }, assets)).toThrow(/من قبل/);
    const back = apply(t, { type: "move_clip", clipId: piece.id, trackId: main(t).id, start: 3000 }, assets).timeline;
    expect(main(back).clips.find((c) => c.id === piece.id)!.fix).toBeNull();
  });

  it("keeps the note, kind and job, and survives a save", () => {
    const t2 = apply(t, { type: "update_clip", clipId: piece.id, patch: { fix: { note: "الوجه يتغير", mode: "whole" } } }, assets).timeline;
    const back = readTimeline(JSON.parse(JSON.stringify(t2)));
    expect(red(back).clips[0].fix).toEqual({ note: "الوجه يتغير", mode: "whole", job: null, from: null, state: "draft", error: null });
    expect(() => apply(t, { type: "update_clip", clipId: main(t).clips[0].id, patch: { fix: { note: "x" } } }, assets)).toThrow(/الأحمر/);
  });
});

describe("laying what was made on the green track", () => {
  const t0 = cutUp();
  const piece = main(t0).clips[1];
  const t1 = apply(t0, { type: "lift_fix", clipId: piece.id }, assets).timeline;
  const r = apply(t1, { type: "place_fixed", clipId: piece.id, assetId: "new", offset: 1000 }, assets);
  const t = r.timeline;

  it("fills the same place, the same length, from the right moment of the new video", () => {
    expect(green(t).clips.map((c) => [c.assetId, c.start, c.in, c.out])).toEqual([["new", 3000, 1000, 3000]]);
    expect(green(t)).toMatchObject({ name: FIX_TRACK.fixed.name, color: "#22c55e" });
    expect(t.tracks.indexOf(green(t))).toBeGreaterThan(t.tracks.indexOf(red(t)));
  });

  it("marks the piece done and quietens the red track", () => {
    expect(red(t).clips[0].fix!.state).toBe("done");
    expect(red(t).muted).toBe(true);
  });

  it("replaces an older result in the same place", () => {
    const t2 = apply(t, { type: "place_fixed", clipId: piece.id, assetId: "redo", offset: 3000 }, assets).timeline;
    expect(green(t2).clips.map((c) => [c.assetId, c.start, c.in])).toEqual([["redo", 3000, 3000]]);
  });
});

describe("what is made for a piece", () => {
  it("«جزئي»: whole seconds around the piece, at least the shortest clip; the green clip starts on the piece", () => {
    const c = { in: 3000, out: 5000 };
    expect(pieceRange(c)).toEqual({ from: 3, to: 5 });
    const cut = fixCut(c, "parts", 10, 4, 15)!;
    expect(cut).toEqual({ start: 2, end: 6, seconds: 4 });
    expect(fixedOffset(c, cut)).toBe(1000);
  });

  it("«كامل»: the whole video again, the piece at its own time", () => {
    const c = { in: 3000, out: 5000 };
    const cut = fixCut(c, "whole", 10, 4, 15)!;
    expect(fixedOffset(c, cut)).toBe(3000);
  });

  it("refuses a part longer than the generator's longest clip, or a video too short", () => {
    expect(fixCut({ in: 0, out: 20_000 }, "parts", 30, 4, 15)).toBeNull();
    expect(fixCut({ in: 0, out: 1000 }, "parts", 3, 4, 15)).toBeNull();
  });
});

describe("the yellow track (continuity)", () => {
  const t0 = cutUp();
  const before = main(t0).clips[0];
  const r = apply(t0, { type: "copy_cont", clipId: before.id }, assets);
  const yellow = r.timeline.tracks.find((x) => x.role === "cont")!;

  it("copies the seconds straight up, the main track untouched, hidden and quiet", () => {
    expect(yellow.clips.map((c) => [c.start, c.in, c.out])).toEqual([[0, 0, 3000]]);
    expect(yellow).toMatchObject({ name: FIX_TRACK.cont.name, color: "#eab308", hidden: true, muted: true });
    expect(main(r.timeline).clips).toHaveLength(3);
  });

  it("refuses less than 2 s, and survives reading back", () => {
    const piece = main(t0).clips[1];
    const short = applyAll(t0, [{ type: "split", at: 4000 }], assets).timeline;
    expect(() => apply(short, { type: "copy_cont", clipId: main(short).clips[1].id }, assets)).toThrow();
    void piece;
    expect(readTimeline(JSON.parse(JSON.stringify(r.timeline)), new Set(["v", "new", "redo"])).tracks.some((x) => x.role === "cont")).toBe(true);
  });
});

describe("continuity ranges around a cut", () => {
  it("takes up to 3 s before and after, each only when 2 s fit", async () => {
    const { continuityRanges, readContinuity } = await import("@/lib/jawad/smart-edit");
    expect(continuityRanges({ start: 5, end: 9 }, 10)).toEqual([{ at: "before", from: 2, to: 5 }]);
    expect(continuityRanges({ start: 1, end: 5 }, 10)).toEqual([{ at: "after", from: 5, to: 8 }]);
    expect(readContinuity([{ at: "before", from: 0, to: 1 }], 10)).toBeNull();
    expect(readContinuity([{ at: "after", from: 6, to: 9 }], 10)).toEqual([{ at: "after", from: 6, to: 9 }]);
  });
});
