import { describe, expect, it } from "vitest";
import { applyAll } from "@/lib/editor/commands";
import { emptyTimeline, type AssetInfo } from "@/lib/editor/model";
import { upscaleFactor, upscaledSize } from "@/lib/editor/upscale";

describe("«رفع الدقة»", () => {
  it("how much bigger: up to the target's long side, at most ×4, nothing when it is already there", () => {
    expect(upscaleFactor(1280, 720, "4k")).toBe(3);
    expect(upscaleFactor(720, 1280, "4k")).toBe(3);
    expect(upscaleFactor(1920, 1080, "4k")).toBe(2);
    expect(upscaleFactor(640, 360, "4k")).toBe(4);
    expect(upscaleFactor(1280, 720, "1080p")).toBe(1.5);
    expect(upscaleFactor(3840, 2160, "4k")).toBeNull();
    expect(upscaleFactor(1920, 1080, "1080p")).toBeNull();
    expect(upscaledSize(1280, 720, 3)).toEqual({ width: 3840, height: 2160 });
    expect(upscaledSize(721, 1281, 3)).toEqual({ width: 2164, height: 3844 });
  });

  it("every clip of the original plays the new copy, at the same moments", () => {
    const a: AssetInfo = { id: "orig", kind: "video", durationMs: 10_000, width: 1280, height: 720, hasAudio: true };
    const b: AssetInfo = { id: "up", kind: "video", durationMs: 9_990, width: 3840, height: 2160, hasAudio: true };
    const infos = new Map([[a.id, a], [b.id, b]]);
    let tl = applyAll(emptyTimeline("16:9"), [{ type: "add_clip", assetId: "orig" }, { type: "split", at: 4000 }], infos).timeline;
    const before = tl.tracks[0].clips.map((c) => [c.start, c.in, c.out]);
    tl = applyAll(tl, [{ type: "swap_asset", from: "orig", to: "up" }], infos).timeline;
    expect(tl.tracks[0].clips.every((c) => c.assetId === "up")).toBe(true);
    expect(tl.tracks[0].clips.map((c) => [c.start, c.in])).toEqual(before.map(([s, i]) => [s, i]));
    expect(Math.max(...tl.tracks[0].clips.map((c) => c.out))).toBeLessThanOrEqual(9_990);
    expect(() => applyAll(tl, [{ type: "swap_asset", from: "orig", to: "up" }], infos)).toThrow();
  });
});
