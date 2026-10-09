import { describe, expect, it } from "vitest";
import { freeSlot, movedLabel, nearestPoint } from "@/lib/editor/snap";

describe("dragging clips: where they land", () => {
  const track = [
    { start: 1000, end: 3000 },
    { start: 5000, end: 7000 },
  ];
  it("stays put when the spot is free", () => {
    expect(freeSlot(track, 3200, 1500)).toBe(3200);
    expect(freeSlot([], 4000, 900)).toBe(4000);
  });
  it("sticks to the neighbour when the wanted spot is taken (nothing is covered or pushed)", () => {
    // wanted 2500..4000 overlaps the first clip: after it (3000) is nearer than before it (-1000: not possible)
    expect(freeSlot(track, 2500, 1500)).toBe(3000);
    // wanted 4200..6200 overlaps the second: before it would start at 3500 (free: 3500..5000), after it is 7000
    expect(freeSlot(track, 4200, 1500)).toBe(3500);
    // dragged past the middle of the blocker, it jumps to its other side
    expect(freeSlot([{ start: 2000, end: 4000 }], 3600, 1000)).toBe(4000);
    expect(freeSlot([{ start: 2000, end: 4000 }], 2200, 1000)).toBe(1000);
  });
  it("never goes before zero and never lands on another clip", () => {
    expect(freeSlot([{ start: 0, end: 2000 }], 500, 1000)).toBe(2000);
    for (let want = 0; want < 9000; want += 137) {
      const at = freeSlot(track, want, 1200);
      expect(at).toBeGreaterThanOrEqual(0);
      for (const o of track) expect(at + 1200 <= o.start || at >= o.end, `${want} → ${at}`).toBe(true);
    }
  });
});

describe("the magnet", () => {
  it("finds the nearest point within the reach, skipping the clip's own edges", () => {
    expect(nearestPoint([0, 1000, 3000], 2950, 100)).toBe(3000);
    expect(nearestPoint([0, 1000, 3000], 2500, 100)).toBeNull();
    expect(nearestPoint([1000, 1040], 1030, 100, [1040])).toBe(1000);
  });
});

describe("the seconds counter", () => {
  it("reads like «+2.4 ث»", () => {
    expect(movedLabel(2400)).toBe("+2.4 ث");
    expect(movedLabel(-800)).toBe("−0.8 ث");
    expect(movedLabel(12_340)).toBe("+12.3 ث");
    expect(movedLabel(20)).toBe("0 ث");
    expect(movedLabel(0)).toBe("0 ث");
  });
});
