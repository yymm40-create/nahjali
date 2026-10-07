import { describe, expect, it } from "vitest";
import { applyAll } from "@/lib/editor/commands";
import { emptyTimeline } from "@/lib/editor/model";
import { timelineChecks } from "@/lib/editor/diagnose";
import { lib, video } from "./helpers";

describe("«🩺 تشخيص» timeline checks", () => {
  const assets = lib(video("a", 5000));
  it("finds a missing file, a file not ready, a clip past its file, a log, a muted track", () => {
    let t = applyAll(emptyTimeline("16:9"), [{ type: "add_clip", assetId: "a" }], assets).timeline;
    const main = t.tracks.find((x) => x.kind === "video")!;
    t = applyAll(t, [{ type: "update_clip", clipId: main.clips[0].id, patch: { grade: { log: "clog3" } } }, { type: "update_track", trackId: main.id, patch: { muted: true } }], assets).timeline;
    const got = timelineChecks(t, [{ id: "a", status: "uploading", durationMs: 4000, kind: "video" }]);
    expect(got.some((x) => x.includes('status is "uploading"'))).toBe(true);
    expect(got.some((x) => x.includes("but its file is 4000 ms"))).toBe(true);
    expect(got.some((x) => x.includes("clog3/camera/video"))).toBe(true);
    expect(got.some((x) => x.includes("is muted"))).toBe(true);
    expect(timelineChecks(t, []).some((x) => x.includes("not in the library"))).toBe(true);
  });
  it("an empty timeline says so", () => {
    expect(timelineChecks(emptyTimeline("9:16"), [])).toContain("the timeline is empty");
  });
});
