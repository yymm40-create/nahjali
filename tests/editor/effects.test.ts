import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { FX_CATS, FX_LIST } from "@/lib/editor/effects";
import { emptyTimeline, readFx } from "@/lib/editor/model";
import { fxPlan } from "@/components/jawad/editor/fx";
import { lib, main, sound, video } from "./helpers";

const assets = lib(video("v", 4000), sound("m", 4000));

describe("the 100 effects", () => {
  it("are 100, unique, in the ten groups, each drawable", () => {
    expect(FX_LIST).toHaveLength(100);
    expect(new Set(FX_LIST.map((f) => f.id)).size).toBe(100);
    expect(new Set(FX_LIST.map((f) => f.cat))).toEqual(new Set(Object.keys(FX_CATS)));
    // every recipe answers (motion, a filter, a way of drawing, or something over the picture)
    for (const f of FX_LIST) {
      const plans = [0.1, 0.5, 1.3, 2.7].map((t) => fxPlan([{ id: f.id, amount: 1 }], t, 4));
      const does = plans.some((p) => p.dx || p.dy || p.scale !== 1 || p.rotate || p.sx !== 1 || p.sy !== 1 || p.filter || p.draw || p.over.length);
      expect(does, f.id).toBe(true);
    }
  });

  it("do nothing at strength 0 and stay the same for the same moment", () => {
    expect(fxPlan([{ id: "shakeStrong", amount: 0 }], 1, 4)).toMatchObject({ dx: 0, dy: 0, scale: 1, filter: "", draw: null, over: [] });
    const a = fxPlan([{ id: "shakeStrong", amount: 1 }], 1.234, 4);
    const b = fxPlan([{ id: "shakeStrong", amount: 1 }], 1.234, 4);
    expect([a.dx, a.dy, a.rotate]).toEqual([b.dx, b.dy, b.rotate]);
  });

  it("are kept to three known ones, without repeats", () => {
    expect(readFx([{ id: "vhs" }, { id: "vhs" }, { id: "nope" }, { id: "rain", amount: 3 }, { id: "snow" }, { id: "bw" }])).toEqual([
      { id: "vhs", amount: 0.8 },
      { id: "rain", amount: 1 },
      { id: "snow", amount: 0.8 },
    ]);
  });

  it("go on pictures and videos only", () => {
    const t = applyAll(emptyTimeline(), [{ type: "add_clip", assetId: "v" }, { type: "add_clip", assetId: "m" }, { type: "add_text", at: 0 }], assets).timeline;
    const v = main(t).clips[0];
    expect(main(apply(t, { type: "update_clip", clipId: v.id, patch: { fx: [{ id: "vhs", amount: 0.5 }] } }, assets).timeline).clips[0].fx).toEqual([{ id: "vhs", amount: 0.5 }]);
    const m = t.tracks.find((x) => x.kind === "audio")!.clips[0];
    expect(() => apply(t, { type: "update_clip", clipId: m.id, patch: { fx: [{ id: "vhs", amount: 1 }] } }, assets)).toThrow();
    expect(() => apply(t, { type: "update_clip", clipId: v.id, patch: { fx: [{ id: "made-up", amount: 1 }] } }, assets)).toThrow(/غير معروف/);
  });
});
