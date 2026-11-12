import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { exportPlan, fpsFor, PLATFORM_IDS, PLATFORMS, platformCheck, platformOpts } from "@/lib/editor/export-plan";
import { emptyTimeline, RATIOS, type Timeline } from "@/lib/editor/model";
import { FEATURES } from "@config/feature-use";

const reel = { ...emptyTimeline("9:16"), fps: 30 } as Timeline;
const wide60 = { ...emptyTimeline("16:9"), fps: 60 } as Timeline;

describe("«مقاس جاهز للمنصة»", () => {
  it("has the six platforms, each a valid shape, size, frame rate, bitrate and length", () => {
    expect(PLATFORM_IDS).toEqual(["reels", "tiktok", "shorts", "youtube", "snap", "story"]);
    for (const id of PLATFORM_IDS) {
      const p = PLATFORMS[id];
      expect(p.label.length, id).toBeGreaterThan(2);
      for (const r of p.ratios) expect(RATIOS[r], id).toBeTruthy();
      expect(p.res, id).toBe(1080);
      expect(p.fps === "project" || (p.fps >= 24 && p.fps <= 60), id).toBe(true);
      for (const f of [24, 30, 60]) expect(p.mbps(f), id).toBeGreaterThanOrEqual(5);
      expect(p.maxMs, id).toBeGreaterThanOrEqual(60_000);
      expect(p.tooLong, id).toMatch(/[؀-ۿ]/);
    }
  });

  it("makes the platform's file: 1080×1920 at 30 fps for a reel, YouTube's own bitrate table for a wide video", () => {
    const r = exportPlan(reel, platformOpts("reels", reel), null, 30_000);
    expect([r.width, r.height, r.fps]).toEqual([1080, 1920, 30]);
    expect(r.mbps).toBe(12);
    // YouTube keeps the project's frame rate: 60 fps → 12 Mbps, 30 → 8 (support.google.com/youtube/answer/1722171)
    const y60 = exportPlan(wide60, platformOpts("youtube", wide60), null, 60_000);
    expect([y60.width, y60.height, y60.fps, y60.mbps]).toEqual([1920, 1080, 60, 12]);
    const wide30 = { ...wide60, fps: 30 } as Timeline;
    expect(exportPlan(wide30, platformOpts("youtube", wide30), null, 60_000).mbps).toBe(8);
    expect(fpsFor(reel, 25)).toBe(25);
  });

  it("never crops silently: a shape that differs is reported with the shape to change to", () => {
    expect(platformCheck("tiktok", reel, 10_000)).toEqual({ reshape: null, tooLong: null });
    expect(platformCheck("tiktok", wide60, 10_000).reshape).toBe("9:16");
    expect(platformCheck("youtube", reel, 10_000).reshape).toBe("16:9");
    // Shorts take a square too
    expect(platformCheck("shorts", emptyTimeline("1:1"), 10_000).reshape).toBeNull();
  });

  it("warns past the platform's length", () => {
    expect(platformCheck("snap", reel, 61_000).tooLong).toContain("٦٠");
    expect(platformCheck("reels", reel, 181_000).tooLong).toContain("٣ دقائق");
    expect(platformCheck("reels", reel, 179_000).tooLong).toBeNull();
    expect(platformCheck("tiktok", reel, 11 * 60_000).tooLong).toContain("١٠ دقائق");
  });

  it("the export window offers them, the reshape path and counts the use; the sources are noted", () => {
    const panel = readFileSync("src/components/jawad/editor/ExportPanel.tsx", "utf8");
    expect(panel).toContain("مقاس جاهز للمنصة");
    expect(panel).toContain("onReshape(fits.reshape!)");
    expect(panel).toContain('track("editor.export_preset")');
    expect(readFileSync("src/components/jawad/editor/Editor.tsx", "utf8")).toContain('run({ type: "set_ratio", ratio: r })');
    expect(readFileSync("src/lib/editor/export-plan.ts", "utf8")).toContain("https://support.google.com/youtube/answer/1722171");
    for (const id of ["editor.export_preset", "editor.speed_ramp", "editor.caption_translate"]) expect(FEATURES.some((f) => f.id === id && f.section === "editor"), id).toBe(true);
  });
});
