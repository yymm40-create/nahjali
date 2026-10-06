import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { emptyTimeline, readTimeline, TRANSITIONS } from "@/lib/editor/model";
import { TR_CATS, TR_LIST, transitionLook } from "@/lib/editor/transitions";
import { lib, main, video } from "./helpers";

const assets = lib(video("v", 4000));

describe("the 100 transitions", () => {
  it("are 100, unique, in the ten groups, and keep the editor's old six", () => {
    expect(TR_LIST).toHaveLength(100);
    expect(new Set(TR_LIST.map((t) => t.id)).size).toBe(100);
    expect(new Set(TR_LIST.map((t) => t.cat))).toEqual(new Set(Object.keys(TR_CATS)));
    for (const old of ["fade", "black", "white", "slide", "zoom", "wipe"]) expect(TRANSITIONS[old]).toBeTruthy();
  });

  it("each ends with the new clip in place and showing", () => {
    for (const t of TR_LIST) {
      const f = transitionLook(t.id, 1);
      const b = f.b;
      expect(Math.abs(b.dx ?? 0), t.id).toBeLessThan(1e-6);
      expect(Math.abs(b.dy ?? 0), t.id).toBeLessThan(1e-6);
      expect(Math.abs((b.scale ?? 1) - 1), t.id).toBeLessThan(1e-6);
      expect(Math.abs(b.rotate ?? 0), t.id).toBeLessThan(1e-6);
      expect(b.alpha ?? 1, t.id).toBeGreaterThan(0.99);
      if (b.mask) expect(b.mask.p, t.id).toBeCloseTo(1);
      if (f.solid) expect(f.solid.alpha, t.id).toBeLessThan(0.05);
    }
  });

  it("each starts on the old clip (the new one not yet seen)", () => {
    for (const t of TR_LIST) {
      const f = transitionLook(t.id, 0);
      const hidden = f.bUnder || (f.b.alpha ?? 1) < 0.01 || (f.b.mask?.p ?? 1) < 0.01 || Math.abs(f.b.dx ?? 0) >= 0.99 || Math.abs(f.b.dy ?? 0) >= 0.99 || (f.b.sx ?? 1) < 0.01 || (f.b.sy ?? 1) < 0.01;
      expect(hidden, t.id).toBe(true);
    }
  });

  it("take any length from 0.1 to 4 s, and refuse unknown ones", () => {
    let t = applyAll(emptyTimeline(), [{ type: "add_clip", assetId: "v" }, { type: "add_clip", assetId: "v" }], assets).timeline;
    const a = main(t).clips[0];
    t = apply(t, { type: "update_clip", clipId: a.id, patch: { transition: { kind: "heart", ms: 9000 } } }, assets).timeline;
    expect(main(t).clips[0].transition).toEqual({ kind: "heart", ms: 4000 });
    t = apply(t, { type: "update_clip", clipId: a.id, patch: { transition: { kind: "glitchT", ms: 50 } } }, assets).timeline;
    expect(main(t).clips[0].transition?.ms).toBe(100);
    expect(() => apply(t, { type: "update_clip", clipId: a.id, patch: { transition: { kind: "nope" } } }, assets)).toThrow();
    expect(main(readTimeline(JSON.parse(JSON.stringify(t)))).clips[0].transition?.kind).toBe("glitchT");
  });
});
