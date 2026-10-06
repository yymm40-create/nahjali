import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { emptyTimeline } from "@/lib/editor/model";
import { lib, main, sound, video } from "./helpers";

const assets = lib(video("v", 6000), video("mute", 3000, false), sound("m", 9000));

describe("taking a video's sound out", () => {
  const t0 = applyAll(emptyTimeline(), [{ type: "add_clip", assetId: "v" }, { type: "trim_clip", clipId: "$1", edge: "end", to: 4000 }], assets).timeline;
  const v = main(t0).clips[0];
  const r = apply(t0, { type: "extract_audio", clipId: v.id }, assets);
  const t = r.timeline;
  const out = t.tracks.find((x) => x.kind === "audio")!.clips[0];

  it("puts the same part of the sound on a sound track, in step", () => {
    expect([out.assetId, out.start, out.in, out.out]).toEqual(["v", 0, 0, 4000]);
    expect(r.select).toEqual([out.id]);
  });

  it("leaves the video quiet, once", () => {
    expect(main(t).clips[0].volume).toBe(0);
    expect(() => apply(t, { type: "extract_audio", clipId: v.id }, assets)).toThrow(/مطلّع/);
  });

  it("lets the sound move like sound (to another sound track)", () => {
    const t2 = apply(t, { type: "add_track", kind: "audio" }, assets).timeline;
    const other = t2.tracks.filter((x) => x.kind === "audio")[1];
    const moved = apply(t2, { type: "move_clip", clipId: out.id, trackId: other.id, start: 1000 }, assets).timeline;
    expect(moved.tracks.find((x) => x.id === other.id)!.clips[0].start).toBe(1000);
    expect(() => apply(t2, { type: "move_clip", clipId: out.id, trackId: main(t2).id, start: 0 }, assets)).toThrow();
  });

  it("refuses a video without sound", () => {
    const t3 = apply(emptyTimeline(), { type: "add_clip", assetId: "mute" }, assets).timeline;
    expect(() => apply(t3, { type: "extract_audio", clipId: main(t3).clips[0].id }, assets)).toThrow(/ما فيه صوت/);
  });
});

describe("tracks", () => {
  it("adds media on a new track of its kind, stacked above the pictures", () => {
    const t = applyAll(emptyTimeline(), [{ type: "add_clip", assetId: "v" }, { type: "add_clip", assetId: "v", at: 0, trackId: "new" }, { type: "add_clip", assetId: "v", at: 0, trackId: "new" }], assets).timeline;
    const pictures = t.tracks.filter((x) => x.kind === "video");
    expect(pictures.map((x) => x.clips.length)).toEqual([1, 1, 1]);
    expect(pictures.map((x) => x.clips[0].start)).toEqual([0, 0, 0]);
  });
});

describe("captions changed together, or one apart", () => {
  const items = ["واحد", "اثنين", "ثلاثة"].map((body, i) => ({ start: i * 1000, end: i * 1000 + 900, body }));
  const t0 = apply(emptyTimeline(), { type: "add_captions", items, style: "classic" }, assets).timeline;
  const track = t0.tracks.find((x) => x.kind === "text")!;
  const [a, b] = track.clips;

  it("a group change reaches every caption", () => {
    const t = apply(t0, { type: "style_track", trackId: track.id, text: { size: 0.08 }, y: 0.6 }, assets).timeline;
    expect(t.tracks.find((x) => x.id === track.id)!.clips.map((c) => [c.text!.size, c.transform.y])).toEqual([[0.08, 0.6], [0.08, 0.6], [0.08, 0.6]]);
  });

  it("one set apart keeps its own look, and keeps it after joining again", () => {
    let t = applyAll(t0, [{ type: "update_clip", clipId: b.id, patch: { own: true } }, { type: "update_clip", clipId: b.id, patch: { text: { color: "#ff0000", size: 0.1 } } }], assets).timeline;
    t = apply(t, { type: "style_track", trackId: track.id, text: { size: 0.04, font: "kufi" } }, assets).timeline;
    const get = (tl: typeof t, id: string) => tl.tracks.find((x) => x.id === track.id)!.clips.find((c) => c.id === id)!;
    expect([get(t, b.id).text!.size, get(t, b.id).text!.font, get(t, b.id).text!.color]).toEqual([0.1, "readex", "#ff0000"]);
    expect(get(t, a.id).text!.size).toBe(0.04);
    // back in the group: still red and big; the next group change (font) reaches it, its colour stays
    t = applyAll(t, [{ type: "update_clip", clipId: b.id, patch: { own: false } }, { type: "style_track", trackId: track.id, text: { font: "naskh" } }], assets).timeline;
    expect([get(t, b.id).text!.size, get(t, b.id).text!.font, get(t, b.id).text!.color]).toEqual([0.1, "naskh", "#ff0000"]);
  });

  it("only texts can be set apart", () => {
    const t = apply(emptyTimeline(), { type: "add_clip", assetId: "v" }, assets).timeline;
    expect(() => apply(t, { type: "update_clip", clipId: main(t).clips[0].id, patch: { own: true } }, assets)).toThrow();
  });
});

describe("track colours", () => {
  it("takes one of the 15 colours, or none, and refuses others", () => {
    const t = emptyTimeline();
    const id = t.tracks[0].id;
    const red = apply(t, { type: "update_track", trackId: id, patch: { color: "#ef4444" } }, assets).timeline;
    expect(red.tracks[0].color).toBe("#ef4444");
    expect(apply(red, { type: "update_track", trackId: id, patch: { color: null } }, assets).timeline.tracks[0].color).toBeNull();
    expect(() => apply(t, { type: "update_track", trackId: id, patch: { color: "#123456" } }, assets)).toThrow(/لون/);
  });
});
