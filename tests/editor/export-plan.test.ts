import { describe, expect, it } from "vitest";
import {
  AUDIO_BITRATE,
  BITRATE_MAX,
  BITRATE_MIN,
  bitrateFor,
  exportName,
  exportPlan,
  fmtBytes,
  fpsFor,
  RES_LIST,
  shortSideOf,
  sizeFor,
  sourceFromTimeline,
  sourceLine,
  type PlanAsset,
  type SourceInfo,
} from "@/lib/editor/export-plan";
import { emptyTimeline, type Timeline } from "@/lib/editor/model";
import { applyAll } from "@/lib/editor/commands";
import type { AssetInfo } from "@/lib/editor/model";

const reel = { ...emptyTimeline("9:16"), fps: 30 } as Timeline;
const wide = { ...emptyTimeline("16:9"), fps: 24 } as Timeline;
const src4k: SourceInfo = { width: 3840, height: 2160, fps: 59.94, mbps: 45, name: "a.mp4" };

describe("the size of the exported file", () => {
  it("puts the chosen resolution on the SHORT side, in even numbers, keeping the shape", () => {
    expect(sizeFor(reel, 1080)).toEqual({ width: 1080, height: 1920 });
    expect(sizeFor(reel, 2160)).toEqual({ width: 2160, height: 3840 });
    expect(sizeFor(wide, 2160)).toEqual({ width: 3840, height: 2160 });
    expect(sizeFor(wide, 720)).toEqual({ width: 1280, height: 720 });
    for (const r of RES_LIST) {
      const s = sizeFor({ width: 1080, height: 1350 }, r, src4k);
      expect(s.width % 2, String(r)).toBe(0);
      expect(s.height % 2, String(r)).toBe(0);
    }
  });
  it("«نفس المصدر» takes the source's own short side (never past 4K), and 1080p without one", () => {
    expect(shortSideOf("source", src4k)).toBe(2160);
    expect(shortSideOf("source", { width: 1920, height: 1080, fps: null, mbps: null })).toBe(1080);
    expect(shortSideOf("source", { width: 7680, height: 4320, fps: null, mbps: null })).toBe(2160);
    expect(shortSideOf("source", null)).toBe(1080);
    expect(sizeFor(wide, "source", src4k)).toEqual({ width: 3840, height: 2160 });
  });
});

describe("the frame rate", () => {
  it("is the project's, or the source's when asked, always whole and sane", () => {
    expect(fpsFor(reel, "project")).toBe(30);
    expect(fpsFor(wide, "project")).toBe(24);
    expect(fpsFor(reel, "source", src4k)).toBe(60);
    expect(fpsFor(reel, "source", null)).toBe(30);
    expect(fpsFor({ fps: 240 }, "project")).toBe(60);
    expect(fpsFor({ fps: 0 }, "project")).toBe(30);
  });
});

describe("the bitrate", () => {
  it("grows with the picture, the frame rate and the level", () => {
    const hd = bitrateFor(1920, 1080, 30, "high");
    const uhd = bitrateFor(3840, 2160, 30, "high");
    expect(uhd).toBeGreaterThan(hd * 3.5);
    expect(bitrateFor(1920, 1080, 60, "high")).toBeGreaterThan(hd * 1.9);
    expect(bitrateFor(1920, 1080, 30, "low")).toBeLessThan(bitrateFor(1920, 1080, 30, "medium"));
    expect(bitrateFor(1920, 1080, 30, "medium")).toBeLessThan(hd);
    expect(hd).toBeLessThan(bitrateFor(1920, 1080, 30, "max"));
    // the usual practice: about 7–9 Mbps for 1080p30 «high», about 35 for 4K30
    expect(hd / 1e6).toBeGreaterThan(5);
    expect(hd / 1e6).toBeLessThan(10);
    expect(uhd / 1e6).toBeGreaterThan(25);
  });
  it("a typed number is used as it is, inside the limits", () => {
    expect(bitrateFor(1920, 1080, 30, { mbps: 40 })).toBe(40_000_000);
    expect(bitrateFor(1920, 1080, 30, { mbps: 0 })).toBe(BITRATE_MIN);
    expect(bitrateFor(1920, 1080, 30, { mbps: 9999 })).toBe(BITRATE_MAX);
  });
  it("«نفس المصدر» never comes out weaker than the source, nor weaker than «high»", () => {
    // the same size as the source: its own rate is kept
    expect(bitrateFor(3840, 2160, 60, "source", src4k)).toBeGreaterThanOrEqual(45_000_000);
    // a smaller file than the source: the rate scales with the pixels, but never under «high»
    const small = bitrateFor(1920, 1080, 30, "source", src4k);
    expect(small).toBeGreaterThanOrEqual(bitrateFor(1920, 1080, 30, "high"));
    expect(small).toBeLessThan(45_000_000);
    // a source with a poor rate still gets a proper export
    expect(bitrateFor(1920, 1080, 30, "source", { width: 1920, height: 1080, fps: 30, mbps: 1 })).toBe(bitrateFor(1920, 1080, 30, "high"));
    expect(bitrateFor(1920, 1080, 30, "source", null)).toBe(bitrateFor(1920, 1080, 30, "high"));
  });
});

describe("the whole plan", () => {
  const infos = new Map<string, AssetInfo>([["v", { id: "v", kind: "video", durationMs: 60_000, width: 3840, height: 2160, hasAudio: true }]]);
  const withClip = applyAll(wide, [{ type: "add_clip", assetId: "v" }], infos).timeline;

  it("«المدخل = المخرج» matches the source in size, rate and bitrate", () => {
    const p = exportPlan(withClip, { res: "source", quality: "source", fps: "source" }, src4k);
    expect([p.width, p.height]).toEqual([3840, 2160]);
    expect(p.fps).toBe(60);
    expect(p.bitrate / 1e6).toBeGreaterThanOrEqual(45);
    expect(p.heavy).toBe(true);
    expect(p.noSource).toBe(false);
  });
  it("says so when «نفس المصدر» was asked for and there is no source", () => {
    const p = exportPlan(withClip, { res: "source", quality: "high", fps: "project" }, null);
    expect(p.noSource).toBe(true);
    expect([p.width, p.height]).toEqual([1920, 1080]);
  });
  it("estimates the file's size from its bitrates and its length", () => {
    const p = exportPlan(withClip, { res: 1080, quality: "high", fps: "project" });
    // one minute at its own rate, within a tenth
    expect(p.bytes).toBeCloseTo(((p.bitrate + p.audioBitrate) * 60) / 8, -5);
    expect(fmtBytes(p.bytes)).toMatch(/MB|GB/);
    expect(p.audioBitrate).toBe(AUDIO_BITRATE.high);
    expect(exportName("ريل", p)).toBe("ريل 1080p 24fps");
  });
  it("calls 4K heavy, and a short 1080p light", () => {
    expect(exportPlan(withClip, { res: 2160, quality: "high", fps: "project" }).heavy).toBe(true);
    expect(exportPlan(withClip, { res: 1080, quality: "high", fps: "project" }).heavy).toBe(false);
  });
});

describe("which file the export matches", () => {
  const assets: PlanAsset[] = [
    { id: "small", kind: "video", name: "small.mp4", bytes: 5_000_000, durationMs: 20_000, width: 1280, height: 720 },
    { id: "big", kind: "video", name: "big.mp4", bytes: 120_000_000, durationMs: 20_000, width: 3840, height: 2160 },
    { id: "unused", kind: "video", name: "unused.mp4", bytes: 400_000_000, durationMs: 20_000, width: 7680, height: 4320 },
    { id: "pic", kind: "image", name: "p.png", bytes: 900_000, durationMs: null, width: 4000, height: 4000 },
  ];
  const infos = new Map<string, AssetInfo>(assets.map((a) => [a.id, { id: a.id, kind: a.kind, durationMs: a.durationMs, width: a.width, height: a.height, hasAudio: true }]));
  const tl = applyAll(wide, [{ type: "add_clip", assetId: "small" }, { type: "add_clip", assetId: "big" }, { type: "add_clip", assetId: "pic" }], infos).timeline;

  it("is the biggest VIDEO used on the timeline, never a picture or an unused file", () => {
    const s = sourceFromTimeline(tl, assets)!;
    expect(s.name).toBe("big.mp4");
    expect([s.width, s.height]).toEqual([3840, 2160]);
    // 120 MB over 20 s ≈ 48 Mbps, less the sound
    expect(s.mbps).toBeGreaterThan(45);
    expect(s.mbps).toBeLessThan(48);
    expect(s.fps).toBeNull();
    expect(sourceLine(s)).toContain("3840×2160");
    expect(sourceLine(null)).toContain("ما فيه مقطع فيديو");
  });
  it("is nothing when the timeline has no video", () => {
    const only = applyAll(wide, [{ type: "add_clip", assetId: "pic" }], infos).timeline;
    expect(sourceFromTimeline(only, assets)).toBeNull();
  });
});
