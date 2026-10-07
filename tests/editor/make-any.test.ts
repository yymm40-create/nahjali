import { describe, expect, it } from "vitest";
import { applyAll } from "@/lib/editor/commands";
import { emptyTimeline } from "@/lib/editor/model";
import { placeMade } from "@/lib/editor/make";
import { makeSettings, nearestAspect, type MakeSpec } from "@/lib/editor/make-any";
import { image, lib, sound, video } from "./helpers";

const spec = (o: Partial<MakeSpec>): MakeSpec => ({ makeKind: "image", prompt: "x", aspect: "", seconds: 0, voice: "", withSound: false, quality: "", place: "over", at: 0, name: "", ...o });

describe("«اصنع لي…» settings", () => {
  it("the shape follows the project unless asked", () => {
    expect(nearestAspect("", ["1:1", "16:9", "9:16"], 9 / 16)).toBe("9:16");
    expect(nearestAspect("4:5", ["1:1", "16:9", "9:16", "3:2", "2:3"], 16 / 9)).toBe("2:3");
    expect(makeSettings(spec({ makeKind: "image" }), 16 / 9, null)).toMatchObject({ aspect: "16:9", quality: "high", count: 1 });
  });
  it("videos, effects and music are kept in their lengths", () => {
    expect(makeSettings(spec({ makeKind: "video", seconds: 40, withSound: true }), 1, null)).toMatchObject({ ratio: "1:1", duration: 15, audio: true, resolution: "720p" });
    expect(makeSettings(spec({ makeKind: "sfx", seconds: 0 }), 1, null)).toMatchObject({ duration: 3 });
    expect(makeSettings(spec({ makeKind: "music", seconds: 33 }), 1, null)).toMatchObject({ duration: 35, instrumental: true });
    expect(makeSettings(spec({ makeKind: "speech" }), 1, "p:abc")).toEqual({ voice: "p:abc" });
  });
});

describe("«اصنع لي…» placing", () => {
  const assets = lib(video("v", 6000), image("i"), sound("m", 30000), video("g", 5000));
  const base = () => applyAll(emptyTimeline("16:9"), [{ type: "add_clip", assetId: "v" }], assets).timeline;
  it("a picture goes over the video for 4 s, covering it", () => {
    const t = applyAll(base(), placeMade("image", "i", "over", 1000), assets).timeline;
    const over = t.tracks.filter((x) => x.kind === "video").find((x) => x.clips.some((c) => c.assetId === "i"))!;
    const c = over.clips[0];
    expect(c.start).toBe(1000);
    expect(c.out - c.in).toBe(4000);
    expect(c.fit).toBe("cover");
  });
  it("a video into the main track, music on its own ducking track, the library only", () => {
    const t1 = applyAll(base(), placeMade("video", "g", "main", 6000), assets).timeline;
    const t = applyAll(t1, placeMade("music", "m", "audio", 0), assets).timeline;
    expect(t.tracks.find((x) => x.kind === "video")!.clips.map((c) => c.assetId)).toEqual(["v", "g"]);
    const music = t.tracks.find((x) => x.clips.some((c) => c.assetId === "m"))!;
    expect(music.duck).toBe(true);
    expect(placeMade("speech", "m", "library", 0)).toEqual([]);
  });
});

describe("captions by «حيدرة»", () => {
  it("its follow-ups land on the new caption track and on every caption", async () => {
    const { expandThen } = await import("@/lib/editor/make");
    const cmds = expandThen(
      [
        '{"type":"style_track","trackId":"$CAPTIONS","text":{"font":"cairo"},"y":0.7}',
        '{"type":"update_clip","clipId":"$EACH","patch":{"anim":{"in":"pop","out":"fade"}}}',
        "not json",
      ],
      "t9",
      ["c1", "c2"],
    );
    expect(cmds).toHaveLength(3);
    expect(cmds[0]).toMatchObject({ type: "style_track", trackId: "t9" });
    expect(cmds.slice(1).map((c) => (c as { clipId: string }).clipId)).toEqual(["c1", "c2"]);
    // and they really run on captions
    const t0 = applyAll(emptyTimeline("9:16"), [{ type: "add_captions", items: [{ start: 0, end: 900, body: "السلام" }, { start: 1000, end: 2000, body: "عليكم" }], style: "karaoke" }], lib()).timeline;
    const tr = t0.tracks.find((x) => x.kind === "text")!;
    const t1 = applyAll(t0, expandThen(['{"type":"style_track","trackId":"$CAPTIONS","text":{"font":"cairo"}}', '{"type":"update_clip","clipId":"$EACH","patch":{"anim":{"in":"pop","out":"fade","inMs":250,"outMs":200}}}'], tr.id, tr.clips.map((c) => c.id)), lib()).timeline;
    const cl = t1.tracks.find((x) => x.id === tr.id)!.clips;
    expect(cl.every((c) => c.text?.font === "cairo" && c.anim?.in === "pop")).toBe(true);
  });
});
