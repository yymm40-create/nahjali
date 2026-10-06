import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { emptyTimeline, readTimeline } from "@/lib/editor/model";
import { lib, main, sound, spans, video } from "./helpers";

const assets = lib(video("a", 4000), video("b", 3000), sound("m", 10000));

describe("paste_clips", () => {
  it("pastes copies at the playhead, keeping their spacing and their tracks", () => {
    let t = applyAll(emptyTimeline("16:9"), [{ type: "add_clip", assetId: "a" }, { type: "add_clip", assetId: "m", at: 0 }], assets).timeline;
    t = apply(t, { type: "set_magnetic", on: false }, assets).timeline;
    const v = main(t).clips[0];
    const music = t.tracks.find((x) => x.kind === "audio")!;
    const r = apply(t, { type: "paste_clips", clips: [{ clip: v, trackId: main(t).id }, { clip: music.clips[0], trackId: music.id }], at: 20000 }, assets);
    expect(r.select).toHaveLength(2);
    expect(spans(r.timeline)).toEqual([
      ["a", 0, 4000],
      ["a", 20000, 24000],
    ]);
    const sounds = r.timeline.tracks.find((x) => x.kind === "audio")!.clips;
    expect(sounds.map((c) => c.start)).toEqual([0, 20000]);
    // new ids, not the copied ones
    expect(r.select).not.toContain(v.id);
  });
  it("on the magnetic main track the paste goes in between", () => {
    const t = applyAll(emptyTimeline("16:9"), [{ type: "add_clip", assetId: "a" }, { type: "add_clip", assetId: "b" }], assets).timeline;
    const b = main(t).clips[1];
    const r = apply(t, { type: "paste_clips", clips: [{ clip: b, trackId: main(t).id }], at: 1000 }, assets);
    expect(spans(r.timeline).map((x) => x[0])).toEqual(["b", "a", "b"]);
  });
  it("refuses a clip whose file isn't in this project", () => {
    const t = apply(emptyTimeline("16:9"), { type: "add_clip", assetId: "a" }, assets).timeline;
    const c = { ...main(t).clips[0], assetId: "elsewhere" };
    expect(() => apply(t, { type: "paste_clips", clips: [{ clip: c, trackId: main(t).id }], at: 0 }, assets)).toThrow();
  });
});

describe("crop", () => {
  it("sets, clamps, clears, and survives a save", () => {
    let t = apply(emptyTimeline("16:9"), { type: "add_clip", assetId: "a" }, assets).timeline;
    const id = main(t).clips[0].id;
    t = apply(t, { type: "update_clip", clipId: id, patch: { crop: { l: 0.1, b: 0.9 } } }, assets).timeline;
    expect(main(t).clips[0].crop).toEqual({ l: 0.1, t: 0, r: 0, b: 0.45 });
    expect(readTimeline(JSON.parse(JSON.stringify(t))).tracks[0].clips[0].crop).toEqual({ l: 0.1, t: 0, r: 0, b: 0.45 });
    t = apply(t, { type: "update_clip", clipId: id, patch: { crop: null } }, assets).timeline;
    expect(main(t).clips[0].crop).toBeNull();
  });
  it("is for pictures only", () => {
    const t = apply(emptyTimeline("16:9"), { type: "add_clip", assetId: "m", at: 0 }, assets).timeline;
    const c = t.tracks.find((x) => x.kind === "audio")!.clips[0];
    expect(() => apply(t, { type: "update_clip", clipId: c.id, patch: { crop: { l: 0.2 } } }, assets)).toThrow();
  });
});
