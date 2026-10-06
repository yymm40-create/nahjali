import { describe, expect, it } from "vitest";
import { applyAll } from "@/lib/editor/commands";
import { emptyTimeline, type AssetInfo } from "@/lib/editor/model";
import { placeHook, placeMusic, placeStems } from "@/lib/editor/make";
import { lib, main, sound, video } from "./helpers";

const hook: AssetInfo = { id: "h", kind: "image", durationMs: null, width: 1200, height: 500 };
const assets = lib(video("v", 8000), sound("m", 30000), sound("s1", 8000), sound("s2", 8000), sound("s3", 8000), hook);
const base = () => applyAll(emptyTimeline(), [{ type: "add_clip", assetId: "v" }], assets).timeline;

describe("placing what was made", () => {
  it("a hook: over the video at its moment, for its time, popping in", () => {
    const t = applyAll(base(), placeHook("h", 0, 2200), assets).timeline;
    const c = t.tracks.filter((x) => x.kind === "video")[1].clips[0];
    expect([c.start, c.out - c.in, c.fit, c.anim?.in, c.transform.y]).toEqual([0, 2200, "contain", "pop", 0.3]);
  });

  it("music: under the video, eased, ducking under talking", () => {
    const t = applyAll(base(), placeMusic("m", 0), assets).timeline;
    const tr = t.tracks.find((x) => x.kind === "audio" && x.clips.length)!;
    expect([tr.duck, tr.clips[0].fadeIn, tr.clips[0].volume]).toEqual([true, 800, 0.6]);
  });

  it("split sound: three tracks in step with the clip, the clip quiet", () => {
    let t = base();
    const v = main(t).clips[0];
    t = applyAll(t, placeStems(v, ["s1", "s2", "s3"]), assets).timeline;
    const parts = t.tracks.filter((x) => x.kind === "audio" && x.clips.length);
    expect(parts.map((x) => x.clips[0].assetId)).toEqual(["s1", "s2", "s3"]);
    expect(parts.every((x) => x.clips[0].start === v.start)).toBe(true);
    expect(main(t).clips[0].volume).toBe(0);
  });
});
