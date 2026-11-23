import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { coversFrame, liveTracks } from "@/lib/editor/cover";
import { emptyTimeline, flatten, readTimeline, type Clip, type Timeline } from "@/lib/editor/model";
import { lib, sound, video } from "./helpers";

const assets = lib(video("v", 6000), video("w", 6000), sound("m", 9000));
const frame = { width: 1080, height: 1920 };
const tall = { kind: "video" as const, width: 1080, height: 1920, name: "cam.mp4" };
const wide = { kind: "video" as const, width: 1920, height: 1080, name: "cam.mov" };

function clip(patch: Partial<Clip> = {}): Clip {
  const t = apply({ ...emptyTimeline(), magnetic: false }, { type: "add_clip", assetId: "v" }, assets).timeline;
  return { ...t.tracks[0].clips[0], ...patch };
}

describe("coversFrame: a clip that hides everything under it", () => {
  it("a plain video that fills the frame does", () => {
    expect(coversFrame(frame, clip(), tall)).toBe(true);
    // a wide video on «cover» fills a tall frame too
    expect(coversFrame(frame, clip({ fit: "cover" }), wide)).toBe(true);
  });
  it("a video shown whole with bars beside it does not", () => {
    expect(coversFrame(frame, clip({ fit: "contain" }), wide)).toBe(false);
    expect(coversFrame(frame, clip({ fit: "contain" }), tall)).toBe(true);
  });
  it("anything that lets the layer under show through does not", () => {
    const base = clip();
    const t = base.transform;
    for (const patch of [
      { transform: { ...t, opacity: 0.9 } },
      { transform: { ...t, scale: 0.8 } },
      { transform: { ...t, x: 0.6 } },
      { transform: { ...t, rotate: 3 } },
      { blend: "screen" },
      { crop: { l: 0.1, r: 0, t: 0, b: 0 } },
      { shape: "circle" },
      { keys: [{ t: 0 }] },
      { fx: [{ id: "x" }] },
      { anim: { in: "fade" } },
      { key: { on: true } },
      { bg: { mode: "none" } },
    ] as unknown as Partial<Clip>[])
      expect(coversFrame(frame, { ...base, ...patch }, tall), JSON.stringify(patch)).toBe(false);
    // zoomed in still covers
    expect(coversFrame(frame, { ...base, transform: { ...t, scale: 1.4 } }, tall)).toBe(true);
  });
  it("a picture, a transparent file or a file of unknown size does not", () => {
    expect(coversFrame(frame, clip(), { kind: "image", width: 1080, height: 1920 })).toBe(false);
    expect(coversFrame(frame, clip(), { ...tall, name: "piece.webm" })).toBe(false);
    expect(coversFrame(frame, clip(), { kind: "video", width: null, height: null })).toBe(false);
    expect(coversFrame(frame, clip(), undefined)).toBe(false);
  });
});

/** main + two picture tracks + a text track + two sound tracks */
function project(): Timeline {
  return applyAll({ ...emptyTimeline(), magnetic: false }, [{ type: "add_clip", assetId: "v" }, { type: "add_track", kind: "video" }, { type: "add_track", kind: "video" }, { type: "add_track", kind: "text" }, { type: "add_track", kind: "audio" }, { type: "add_track", kind: "audio" }], assets).timeline;
}
const state = (t: Timeline) => Object.fromEntries(liveTracks(t.tracks).map((x) => [x.name, `${x.hidden ? "hidden" : "seen"}/${x.muted ? "quiet" : "heard"}`]));

describe("«S» and «H» on the tracks", () => {
  const t = project();
  const [main, v1, v2] = t.tracks.filter((x) => x.kind === "video");
  const [a1, a2] = t.tracks.filter((x) => x.kind === "audio");
  const text = t.tracks.find((x) => x.kind === "text")!;

  it("changes nothing while nothing is soloed or off", () => {
    expect(liveTracks(t.tracks)).toBe(t.tracks);
  });
  it("«S» on a camera: the only video seen; texts stay, and no sound is touched", () => {
    const s = apply(t, { type: "update_track", trackId: v1.id, patch: { solo: true } }, assets).timeline;
    const live = liveTracks(s.tracks);
    expect(live.filter((x) => x.kind === "video" && !x.hidden).map((x) => x.id)).toEqual([v1.id]);
    expect(live.find((x) => x.id === text.id)!.hidden).toBe(false);
    expect(live.some((x) => x.muted)).toBe(false);
  });
  it("«S» on a sound track: the only sound heard (the videos' own sound too), no picture is touched", () => {
    const s = apply(t, { type: "update_track", trackId: a2.id, patch: { solo: true } }, assets).timeline;
    const live = liveTracks(s.tracks);
    expect(live.filter((x) => !x.muted).map((x) => x.id)).toEqual([a2.id]);
    expect(live.some((x) => x.hidden)).toBe(false);
  });
  it("two soloed tracks play together; a soloed camera and a soloed sound do not disturb each other", () => {
    const s = applyAll(t, [{ type: "update_track", trackId: v1.id, patch: { solo: true } }, { type: "update_track", trackId: v2.id, patch: { solo: true } }, { type: "update_track", trackId: a1.id, patch: { solo: true } }], assets).timeline;
    const live = liveTracks(s.tracks);
    expect(live.filter((x) => x.kind === "video" && !x.hidden).map((x) => x.id)).toEqual([v1.id, v2.id]);
    expect(live.filter((x) => !x.muted).map((x) => x.id)).toEqual([a1.id]);
  });
  it("«H»: the track is not there for now — not seen, not heard — and comes back as it was", () => {
    const off = apply(t, { type: "update_track", trackId: main.id, patch: { off: true } }, assets).timeline;
    expect(state(off)[main.name]).toBe("hidden/quiet");
    // what the player and the export read
    const flat = flatten(off).tracks.find((x) => x.id === main.id)!;
    expect([flat.hidden, flat.muted]).toEqual([true, true]);
    const on = apply(off, { type: "update_track", trackId: main.id, patch: { off: false } }, assets).timeline;
    expect(on.tracks.find((x) => x.id === main.id)).toEqual(main);
  });
  it("a soloed track that is off does not silence the others", () => {
    const s = applyAll(t, [{ type: "update_track", trackId: v1.id, patch: { solo: true } }, { type: "update_track", trackId: v1.id, patch: { off: true } }], assets).timeline;
    expect(liveTracks(s.tracks).filter((x) => x.kind === "video" && !x.hidden).map((x) => x.id)).toEqual([main.id, v2.id]);
  });
  it("⌥: every track off at once, and a text track cannot be soloed", () => {
    const all = apply(t, { type: "update_tracks", trackIds: t.tracks.map((x) => x.id), patch: { off: true } }, assets).timeline;
    expect(all.tracks.every((x) => x.off)).toBe(true);
    expect(() => apply(t, { type: "update_track", trackId: text.id, patch: { solo: true } }, assets)).toThrow(/السولو/);
  });
  it("is saved with the project", () => {
    const s = applyAll(t, [{ type: "update_track", trackId: v1.id, patch: { solo: true } }, { type: "update_track", trackId: a1.id, patch: { off: true } }], assets).timeline;
    const again = readTimeline(JSON.parse(JSON.stringify(s)));
    expect(again.tracks.map((x) => [!!x.solo, !!x.off])).toEqual(s.tracks.map((x) => [!!x.solo, !!x.off]));
  });
});
