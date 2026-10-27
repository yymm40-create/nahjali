import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { CROP_MAX, emptyTimeline, findClip, fitCrop, readTimeline } from "@/lib/editor/model";
import { lib, video } from "./helpers";

const assets = lib(video("a", 6000), video("b", 4000));
const base = () => applyAll(emptyTimeline("9:16"), [{ type: "add_clip", assetId: "a" }, { type: "add_clip", assetId: "b", trackId: "new", at: 1000 }], assets).timeline;

describe("⌘ / Ctrl / Alt + drag: a copy where it is dropped, the clip stays", () => {
  it("copies a clip onto the track above, at the time it was dropped", () => {
    const t = base();
    const main = t.tracks[0];
    const above = t.tracks[1];
    const src = main.clips[0];
    const r = apply(t, { type: "copy_clip", clipId: src.id, trackId: above.id, start: 3000 }, assets);
    const copy = findClip(r.timeline, r.select![0])!;
    expect(copy.track.id).toBe(above.id);
    expect(copy.clip.id).not.toBe(src.id);
    expect(copy.clip.assetId).toBe(src.assetId);
    expect(r.label).toBe("نسخت مقطعًا");
    // the original is still on the main track, unchanged
    expect(findClip(r.timeline, src.id)).toMatchObject({ track: { id: main.id }, clip: { start: src.start, in: src.in, out: src.out } });
  });

  it("copies to a new track above everything, and undoing is one step", () => {
    const t = base();
    const src = t.tracks[0].clips[0];
    const r = apply(t, { type: "copy_clip", clipId: src.id, trackId: "new", start: 0 }, assets);
    expect(r.timeline.tracks.length).toBe(t.tracks.length + 1);
    expect(r.timeline.tracks.flatMap((x) => x.clips).length).toBe(t.tracks.flatMap((x) => x.clips).length + 1);
  });
});

describe("«✂️ القص»: any side, up to half the picture and more, like Premiere", () => {
  it("allows half the picture (a split screen) and more, but never opposite sides meeting", () => {
    expect(fitCrop({ l: 0.5 })).toEqual({ l: 0.5, t: 0, r: 0, b: 0 });
    expect(fitCrop({ t: 0.8 })!.t).toBe(0.8);
    expect(fitCrop({ l: 2 })!.l).toBe(CROP_MAX);
    expect(fitCrop({ l: 0, t: 0 })).toBeNull();
    // the side being changed wins; the other gives way
    expect(fitCrop({ l: 0.7, r: 0.5 }, "l")).toMatchObject({ l: 0.7, r: 0.25 });
    const even = fitCrop({ t: 0.6, b: 0.6 })!;
    expect(even.t + even.b).toBeCloseTo(CROP_MAX, 5);
  });

  it("sets each side by its own counter, keeps the rest, and survives saving", () => {
    const t = base();
    const id = t.tracks[0].clips[0].id;
    const r = applyAll(t, [
      { type: "update_clip", clipId: id, patch: { crop: { l: 0.5 } } },
      { type: "update_clip", clipId: id, patch: { crop: { t: 0.1 } } },
      { type: "update_clip", clipId: id, patch: { crop: { r: 0.6 } } },
    ], assets).timeline;
    const crop = findClip(r, id)!.clip.crop!;
    expect(crop).toMatchObject({ t: 0.1, r: 0.6, b: 0 });
    expect(crop.l).toBeCloseTo(0.35, 5);
    expect(findClip(readTimeline(JSON.parse(JSON.stringify(r))), id)!.clip.crop).toEqual(crop);
    expect(findClip(apply(r, { type: "update_clip", clipId: id, patch: { crop: null } }, assets).timeline, id)!.clip.crop).toBeNull();
  });
});

describe("the crop is measured on what is seen in the frame", () => {
  it("a wide video filling a tall frame: 30٪ from the left takes 30٪ of what shows, not the edges outside", async () => {
    const { cropView } = await import("@/components/jawad/editor/render");
    // a 16:9 picture covering a 1080 × 1920 frame is 3413 px wide, centred
    const v = cropView({ x: 0.5, y: 0.5 }, { dx: 0, dy: 0 }, 3413, 1920, 1080, 1920);
    expect(v.w).toBeCloseTo(1080, 0);
    expect(v.x0).toBeCloseTo(-540, 0);
    // a small picture-in-picture is all in the frame: the whole picture
    expect(cropView({ x: 0.25, y: 0.2 }, { dx: 0, dy: 0 }, 400, 300, 1080, 1920)).toEqual({ x0: -200, y0: -150, w: 400, h: 300 });
  });
});
