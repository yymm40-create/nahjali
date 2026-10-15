import { describe, expect, it, vi } from "vitest";
import { frameCost, reviewTimes } from "@/components/jawad/editor/scene-render";
import type { SceneHost } from "@/components/jawad/editor/scene-host";

/** A scene host that takes `ms` of make-believe time per frame, and remembers what it was asked for. */
function host(ms: number) {
  const asked: { t: number; scale?: number; sub?: number }[] = [];
  let clock = 0;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  return {
    asked,
    host: {
      w: 1080,
      h: 1920,
      fps: 30,
      frame: async (t: number, o: { scale?: number; sub?: number } = {}) => {
        asked.push({ t, ...o });
        clock += ms * (o.sub ?? 1);
        return { close: () => {} } as unknown as ImageBitmap;
      },
    } as unknown as SceneHost,
  };
}

describe("«مختبر الموشن»: what a frame really costs before hundreds of them are made", () => {
  it("measures across the piece at full size, and ignores the first (cold) frame", async () => {
    const h = host(120);
    const cost = await frameCost(h.host, 10, 1);
    expect(cost).toBe(120);
    expect(h.asked).toHaveLength(3);
    expect(h.asked.every((a) => a.scale === 1)).toBe(true);
    // spread over the piece, not three times the same moment
    expect(new Set(h.asked.map((a) => a.t)).size).toBe(3);
    vi.restoreAllMocks();
  });

  it("counts the sub-frames of motion blur, which is what makes a render long", async () => {
    const h = host(100);
    expect(await frameCost(h.host, 10, 6)).toBe(600);
    expect(h.asked.every((a) => a.sub === 6)).toBe(true);
    vi.restoreAllMocks();
  });

  it("stops when the person stops it", async () => {
    const h = host(10);
    const stop = new AbortController();
    stop.abort();
    await expect(frameCost(h.host, 10, 1, stop.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(h.asked).toHaveLength(0);
    vi.restoreAllMocks();
  });

  it("never asks for a frame past the end of the piece", async () => {
    const h = host(1);
    await frameCost(h.host, 4, 1);
    for (const a of h.asked) expect(a.t).toBeLessThan(4);
    expect(reviewTimes(4).every((t) => t >= 0 && t <= 4)).toBe(true);
    vi.restoreAllMocks();
  });
});
