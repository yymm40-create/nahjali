import { describe, expect, it } from "vitest";
import { emptyTimeline } from "@/lib/editor/model";
import { drawFrame } from "@/components/jawad/editor/render";

/** A canvas context that only records the rectangles painted. */
const recorder = () => {
  const fills: unknown[][] = [];
  const noop = () => {};
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k: string) => (k === "fillRect" ? (...a: unknown[]) => fills.push(a) : k in t ? t[k] : noop),
    set: (t, k: string, v) => ((t[k] = v), true),
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills };
};

describe("a transparent export keeps the empty places empty", () => {
  it("paints the timeline's background by default, and nothing under the clips when transparent", () => {
    const tl = emptyTimeline("9:16");
    const a = recorder();
    drawFrame(a.ctx, tl, 0, () => null);
    expect(a.fills).toHaveLength(1);
    expect(a.fills[0]).toEqual([0, 0, tl.width, tl.height]);
    const b = recorder();
    drawFrame(b.ctx, tl, 0, () => null, { transparent: true });
    expect(b.fills).toHaveLength(0);
  });
});
