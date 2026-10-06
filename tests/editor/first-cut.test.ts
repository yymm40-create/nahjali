import { describe, expect, it } from "vitest";
import { applyAll } from "@/lib/editor/commands";
import { firstCut } from "@/lib/editor/first-cut";
import { duration, emptyTimeline, ratioOf } from "@/lib/editor/model";
import { lib, main, video } from "./helpers";

const assets = lib(video("s1", 5000), video("s2", 10000), video("s3", 5300));

describe("a film's first cut", () => {
  const tl = emptyTimeline("16:9");
  const cmds = firstCut(tl, [{ assetId: "s1", plannedMs: 5000 }, { assetId: "s2", plannedMs: 6000 }, { assetId: "s3", plannedMs: 5000 }], assets, { title: "رحلة الغوص", ratio: "9:16" });
  const t = applyAll(tl, cmds, assets).timeline;

  it("keeps the director's order and the film's shape", () => {
    expect(main(t).clips.map((c) => c.assetId)).toEqual(["s1", "s2", "s3"]);
    expect(ratioOf(t)).toBe("9:16");
  });

  it("cuts a scene that came out longer than planned, and keeps a small overrun", () => {
    expect(main(t).clips.map((c) => c.out - c.in)).toEqual([5000, 6000, 5300]);
    expect(duration(t)).toBe(16300);
  });

  it("dissolves between scenes and eases the sound in and out", () => {
    const c = main(t).clips;
    expect(c.map((x) => x.transition?.kind ?? null)).toEqual(["fade", "fade", null]);
    expect([c[0].fadeIn, c[2].fadeOut]).toEqual([300, 900]);
  });

  it("puts the film's name over the opening", () => {
    const title = t.tracks.find((x) => x.kind === "text")!.clips[0];
    expect(title.text?.body).toBe("رحلة الغوص");
    expect([title.start, title.out - title.in, title.text?.font]).toEqual([0, 3000, "kufi"]);
  });

  it("runs the same on the server (fresh ids every time)", () => {
    const again = applyAll(tl, cmds, assets).timeline;
    expect(main(again).clips.map((c) => [c.assetId, c.in, c.out, c.start])).toEqual(main(t).clips.map((c) => [c.assetId, c.in, c.out, c.start]));
  });

  it("skips what isn't in the library and does nothing without videos", () => {
    expect(firstCut(tl, [{ assetId: "missing" }], assets)).toEqual([]);
    const one = applyAll(tl, firstCut(tl, [{ assetId: "s1" }], assets), assets).timeline;
    expect(main(one).clips[0].transition).toBeNull();
  });
});
