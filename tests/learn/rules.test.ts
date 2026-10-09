import { describe, expect, it } from "vitest";
import { LEARN, cleanUnlock, dayCapReached, fmtDuration, hasAccess, manifestProblem, paceAllows, segmentAt, watermarkLabel, type Manifest } from "@config/learn";

const segs = (n: number, dur = 6) => Array.from({ length: n }, (_, i) => ({ n: i + 1, start: i * dur, dur, bytes: 1000 }));
const man = (over: Partial<Manifest> = {}): Manifest => ({ mime: 'video/mp4; codecs="avc1.64001f,mp4a.40.2"', duration: 60, initBytes: 900, segments: segs(10), ...over });

describe("segmentAt", () => {
  it("finds the piece that plays a second", () => {
    const s = segs(10);
    expect(segmentAt(s, 0)).toBe(0);
    expect(segmentAt(s, 5.99)).toBe(0);
    expect(segmentAt(s, 6)).toBe(1);
    expect(segmentAt(s, 59)).toBe(9);
    expect(segmentAt(s, 9999)).toBe(9);
    expect(segmentAt(s, -3)).toBe(0);
    expect(segmentAt([], 3)).toBe(-1);
  });
  it("copes with uneven pieces", () => {
    const s = [{ n: 1, start: 0, dur: 4, bytes: 99 }, { n: 2, start: 4, dur: 11, bytes: 99 }, { n: 3, start: 15, dur: 2, bytes: 99 }];
    expect([0, 3.9, 4, 14.9, 15, 16].map((t) => segmentAt(s, t))).toEqual([0, 0, 1, 1, 2, 2]);
  });
});

describe("manifestProblem", () => {
  it("accepts a good one and names what is wrong in a bad one", () => {
    expect(manifestProblem(man())).toBeNull();
    expect(manifestProblem(man({ mime: "video/webm" }))).toBeTruthy();
    expect(manifestProblem(man({ duration: 0 }))).toBeTruthy();
    expect(manifestProblem(man({ segments: [] }))).toBeTruthy();
    expect(manifestProblem(man({ segments: segs(3).map((s, i) => ({ ...s, n: i === 1 ? 5 : s.n })) }))).toBeTruthy();
    expect(manifestProblem(man({ segments: segs(3).map((s, i) => ({ ...s, start: 10 - i })) }))).toBeTruthy();
    expect(manifestProblem(man({ segments: [{ n: 1, start: 0, dur: 6, bytes: LEARN.maxSegBytes + 1 }] }))).toBeTruthy();
  });
});

describe("pacing", () => {
  it("lets a normal viewing through, and a script that asks for everything at once wait", () => {
    // 1 hour video, 6 s pieces: a ripper asking at once is stopped after the head start
    let served = 0;
    let allowed = 0;
    for (let i = 0; i < 600; i++) {
      if (!paceAllows({ elapsedSec: 5, servedSec: served, segSec: 6 })) break;
      served += 6;
      allowed++;
    }
    expect(allowed).toBeLessThan(30);
    // someone watching for 10 minutes has been served at most ~ 2×10 min + the head start
    expect(paceAllows({ elapsedSec: 600, servedSec: 600, segSec: 6 })).toBe(true);
    expect(paceAllows({ elapsedSec: 600, servedSec: 1350, segSec: 6 })).toBe(false);
  });
  it("the first buffering fits in the head start", () => {
    // the player asks for ~ 45 s ahead at once
    expect(paceAllows({ elapsedSec: 0, servedSec: 42, segSec: 6 })).toBe(true);
  });
  it("caps what one person is served a day", () => {
    expect(dayCapReached(100, 600)).toBe(false);
    expect(dayCapReached(600 * LEARN.dayTimes, 600)).toBe(true);
    expect(dayCapReached(120, 10)).toBe(false); // a very short lesson counts as a minute
  });
});

describe("access", () => {
  it("owner, granted, or a buyer of a product that unlocks it", () => {
    expect(hasAccess({ admin: true, granted: false, unlock: [], owned: [] })).toBe(true);
    expect(hasAccess({ admin: false, granted: true, unlock: [], owned: [] })).toBe(true);
    expect(hasAccess({ admin: false, granted: false, unlock: ["recorded"], owned: ["recorded"] })).toBe(true);
    expect(hasAccess({ admin: false, granted: false, unlock: ["recorded"], owned: ["live"] })).toBe(false);
    expect(hasAccess({ admin: false, granted: false, unlock: [], owned: ["live", "recorded", "combo"] })).toBe(false);
  });
  it("cleanUnlock keeps only known products", () => {
    expect(cleanUnlock(["recorded", "x", "combo", 4])).toEqual(["recorded", "combo"]);
    expect(cleanUnlock("recorded")).toEqual([]);
  });
});

describe("small helpers", () => {
  it("the name tag shows who is watching without the whole address", () => {
    expect(watermarkLabel("abdullah@gmail.com", "abcdef123")).toBe("abd…@gmail.com · ABCDEF");
    expect(watermarkLabel(null, "abcdef123")).toBe("ABCDEF");
  });
  it("durations", () => {
    expect(fmtDuration(65)).toBe("1:05");
    expect(fmtDuration(3725)).toBe("1:02:05");
  });
});
