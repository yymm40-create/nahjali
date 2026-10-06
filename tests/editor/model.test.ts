import { describe, expect, it } from "vitest";
import { stretch } from "@/components/jawad/editor/stretch";
import { applyAll } from "@/lib/editor/commands";
import { DUCK, duckAt, emptyTimeline, fadeAt, gainAt, transformAt, voiceSpans, wordAt } from "@/lib/editor/model";
import { lib, main, sound, video } from "./helpers";

const assets = lib(video("v", 10000), sound("m", 10000));

describe("sound over time", () => {
  const t = applyAll(emptyTimeline(), [{ type: "add_clip", assetId: "v" }, { type: "add_clip", assetId: "m", at: 0 }, { type: "update_clip", clipId: "$2", patch: { fadeIn: 1000, fadeOut: 1000 } }], assets).timeline;
  const music = t.tracks.find((x) => x.kind === "audio")!;
  const m = music.clips[0];

  it("fades in and out", () => {
    expect(fadeAt(m, 0)).toBe(0);
    expect(fadeAt(m, 500)).toBeCloseTo(0.5, 1);
    expect(fadeAt(m, 5000)).toBe(1);
    expect(fadeAt(m, 9999)).toBeLessThan(0.01);
  });

  it("ducks the music while someone speaks, smoothly", () => {
    const spans = voiceSpans(t, (c) => c.assetId === "v");
    expect(spans).toEqual([[0, 10000]]);
    expect(duckAt(spans, 5000)).toBe(DUCK.level);
    expect(duckAt([[2000, 3000]], 0)).toBe(1);
    const ducked = { ...music, duck: true };
    expect(gainAt(ducked, m, 5000, spans)).toBeCloseTo(DUCK.level, 5);
  });
});

describe("motion and words", () => {
  it("moves between motion points", () => {
    const t = applyAll(emptyTimeline(), [{ type: "add_clip", assetId: "v" }, { type: "set_key", clipId: "$1", at: 0, transform: { x: 0 } }, { type: "set_key", clipId: "$1", at: 10000, transform: { x: 1 } }], assets).timeline;
    const c = main(t).clips[0];
    expect(transformAt(c, 0).x).toBeCloseTo(0);
    expect(transformAt(c, 5000).x).toBeGreaterThan(0.3);
    expect(transformAt(c, 5000).x).toBeLessThan(0.7);
    expect(transformAt(c, 10000).x).toBeCloseTo(1);
  });

  it("finds the caption word being said", () => {
    const t = applyAll(emptyTimeline(), [{ type: "add_captions", items: [{ start: 1000, end: 3000, body: "واحد اثنين", words: [{ s: 0, e: 900, w: "واحد" }, { s: 1000, e: 2000, w: "اثنين" }] }], style: "karaoke" }], assets).timeline;
    const c = t.tracks.find((x) => x.kind === "text")!.clips[0];
    expect(wordAt(c, 1500)).toBe(0);
    expect(wordAt(c, 2500)).toBe(1);
  });
});

describe("changing speed keeps the voice", () => {
  it("makes the asked length and keeps a tone's pitch", () => {
    const rate = 48000;
    const tone = new Float32Array(rate).map((_, i) => Math.sin((2 * Math.PI * 440 * i) / rate));
    const [out] = stretch([tone], 0, 2, rate / 2);
    const part = out.subarray(2000, rate / 2 - 2000);
    let crossings = 0;
    for (let i = 1; i < part.length; i++) if (part[i - 1] < 0 && part[i] >= 0) crossings++;
    // 440 Hz still: about 440 rises per second of output
    expect((crossings / part.length) * rate).toBeGreaterThan(400);
    expect((crossings / part.length) * rate).toBeLessThan(480);
  });
});
