import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { clipEnd, emptyTimeline, type Timeline } from "@/lib/editor/model";
import { lib, sound, video } from "./helpers";

const assets = lib(video("a", 60_000), video("b", 60_000), video("c", 60_000), sound("m", 90_000));

/** three cameras of one moment on three tracks: A 0–60 s, B 5–35 s, C 20–60 s */
function shoot(): Timeline {
  let t = apply({ ...emptyTimeline(), magnetic: false }, { type: "add_clip", assetId: "a" }, assets).timeline;
  for (const [id, from, to] of [["b", 5000, 35_000], ["c", 20_000, 60_000]] as const) {
    t = apply(t, { type: "add_track", kind: "video" }, assets).timeline;
    const track = t.tracks.filter((x) => x.kind === "video").at(-1)!;
    t = applyAll(t, [{ type: "add_clip", assetId: id, trackId: track.id, at: from }, { type: "trim_clip", clipId: "$1", edge: "end", to }], assets).timeline;
  }
  return t;
}
const cam = (t: Timeline, asset: string) => t.tracks.flatMap((x) => x.clips).find((c) => c.assetId === asset && !c.angle)!;
const program = (t: Timeline) => t.tracks.find((x) => x.clips.some((c) => c.angle));
const cuts = (t: Timeline) => (program(t)?.clips ?? []).map((c) => [c.assetId, c.start, clipEnd(c)]);

describe("«شبكة الكاميرات»: cut to a camera from the playhead", () => {
  const t = shoot();
  const [A, B, C] = ["a", "b", "c"].map((x) => cam(t, x));

  it("the first cut makes the «المونتاج» track over every camera; the cameras stay as they were", () => {
    const r = apply(t, { type: "multicam_cut", cam: B.id, at: 10_000 }, assets);
    const p = program(r.timeline)!;
    expect(p.name).toBe("المونتاج");
    expect(r.timeline.tracks.filter((x) => x.kind === "video").at(-1)).toBe(p);
    // B from 10 s to its end
    expect(cuts(r.timeline)).toEqual([["b", 10_000, 35_000]]);
    expect(p.clips[0].in).toBe(5000);
    expect(p.clips[0].volume).toBe(0);
    for (const c of [A, B, C]) expect(cam(r.timeline, c.assetId!)).toEqual(c);
    expect(r.label).toMatch(/قطعت على/);
  });

  it("a cut inside a cut splits it: the old camera before, the new one after, the old one again when the new one ends", () => {
    let x = apply(t, { type: "multicam_cut", cam: A.id, at: 0 }, assets).timeline;
    expect(cuts(x)).toEqual([["a", 0, 60_000]]);
    x = apply(x, { type: "multicam_cut", cam: B.id, at: 12_000 }, assets).timeline;
    expect(cuts(x)).toEqual([["a", 0, 12_000], ["b", 12_000, 35_000], ["a", 35_000, 60_000]]);
    x = apply(x, { type: "multicam_cut", cam: C.id, at: 25_000 }, assets).timeline;
    expect(cuts(x)).toEqual([["a", 0, 12_000], ["b", 12_000, 25_000], ["c", 25_000, 35_000], ["a", 35_000, 60_000]]);
    // every cut shows its camera's own moment (in step with the camera's clip)
    for (const c of program(x)!.clips) {
      const origin = cam(x, c.assetId!);
      expect(c.in - origin.in, `${c.assetId} at ${c.start}`).toBe(c.start - origin.start);
    }
  });

  it("pressed right at a cut's start, the whole cut changes camera; the same camera changes nothing", () => {
    let x = applyAll(t, [{ type: "multicam_cut", cam: A.id, at: 0 }, { type: "multicam_cut", cam: B.id, at: 12_000 }], assets).timeline;
    const same = apply(x, { type: "multicam_cut", cam: B.id, at: 20_000 }, assets);
    expect(same.label).toMatch(/هي المعروضة/);
    expect(cuts(same.timeline)).toEqual(cuts(x));
    x = apply(x, { type: "multicam_cut", cam: A.id, at: 12_050 }, assets).timeline;
    expect(cuts(x)).toEqual([["a", 0, 12_000], ["a", 12_000, 35_000], ["a", 35_000, 60_000]]);
  });

  it("a cut can be pressed again from a cut itself, and a camera that did not film the moment is refused", () => {
    const x = apply(t, { type: "multicam_cut", cam: B.id, at: 10_000 }, assets).timeline;
    const viaCut = apply(x, { type: "multicam_cut", cam: program(x)!.clips[0].id, at: 6000 }, assets).timeline;
    expect(cuts(viaCut)).toEqual([["b", 6000, 10_000], ["b", 10_000, 35_000]]);
    expect(() => apply(t, { type: "multicam_cut", cam: B.id, at: 2000 }, assets)).toThrow(/ما صوّرت/);
    expect(() => apply(t, { type: "multicam_cut", cam: C.id, at: 59_990 }, assets)).toThrow(/ما صوّرت/);
  });

  it("pressed a breath before a cut, it is that cut that changes camera (no error, no sliver)", () => {
    const x = applyAll(t, [{ type: "multicam_cut", cam: A.id, at: 0 }, { type: "multicam_cut", cam: B.id, at: 12_000 }], assets).timeline;
    // 80 ms before the cut at 12 s
    const r = apply(x, { type: "multicam_cut", cam: C.id, at: 34_920 }, assets).timeline;
    expect(cuts(r)).toEqual([["a", 0, 12_000], ["b", 12_000, 35_000], ["c", 35_000, 60_000]]);
  });

  it("a later cut stops where the next one begins", () => {
    let x = apply(t, { type: "multicam_cut", cam: C.id, at: 30_000 }, assets).timeline;
    x = apply(x, { type: "multicam_cut", cam: A.id, at: 8000 }, assets).timeline;
    expect(cuts(x)).toEqual([["a", 8000, 30_000], ["c", 30_000, 60_000]]);
  });
});

describe("a track up or down", () => {
  const t = shoot();
  const [main, v1, v2] = t.tracks.filter((x) => x.kind === "video");
  const order = (x: Timeline) => x.tracks.filter((k) => k.kind === "video").map((k) => k.id);
  it("swaps a picture track with its neighbour; the main track stays under", () => {
    expect(order(apply(t, { type: "move_track", trackId: v1.id, dir: "up" }, assets).timeline)).toEqual([main.id, v2.id, v1.id]);
    expect(order(apply(t, { type: "move_track", trackId: v2.id, dir: "down" }, assets).timeline)).toEqual([main.id, v2.id, v1.id]);
    expect(() => apply(t, { type: "move_track", trackId: v2.id, dir: "up" }, assets)).toThrow(/أعلى مسار/);
    expect(() => apply(t, { type: "move_track", trackId: v1.id, dir: "down" }, assets)).toThrow(/الرئيسي/);
  });
  it("without a main track the first one moves like the others", () => {
    const free = apply(t, { type: "set_main_track", on: false }, assets).timeline;
    expect(order(apply(free, { type: "move_track", trackId: v1.id, dir: "down" }, assets).timeline)).toEqual([v1.id, main.id, v2.id]);
  });
});

describe("«تقطيع ذكي»: where to cut and which camera", () => {
  it("cuts at the breaths of the sound, each shot within the pace", async () => {
    const { breathCuts } = await import("@/lib/editor/smart-cut");
    // loud all along, with breaths at 3.1 s, 6.4 s, 9.0 s and 12.7 s (a step every 20 ms)
    const loud = new Float32Array(800).fill(1);
    for (const at of [3100, 6400, 9000, 12_700]) for (let k = -4; k <= 4; k++) loud[at / 20 + k] = 0;
    const cuts = breathCuts(loud, 20, 0, 16_000, 2000, 4000);
    expect(cuts).toEqual([0, 3100, 6400, 9000, 12_700, 16_000]);
    // with nothing to listen to: even steps, and no sliver at the end
    const even = breathCuts(null, 20, 0, 10_000, 2000, 4000);
    expect(even[0]).toBe(0);
    expect(even.at(-1)).toBe(10_000);
    for (let i = 1; i < even.length; i++) expect(even[i] - even[i - 1]).toBeGreaterThanOrEqual(2000);
  });
  it("gives every camera its turn and never the same one twice running", async () => {
    const { planShots } = await import("@/lib/editor/smart-cut");
    const cams = ["a", "b", "c"].map((id) => ({ id, start: 0, end: 30_000 }));
    const shots = planShots(cams, [0, 3000, 6000, 9000, 12_000, 15_000, 18_000]);
    expect(shots.map((s) => s.cam).join("")).toMatch(/^(?!.*(.)\1)[abc]{6}$/);
    expect(new Set(shots.slice(0, 3).map((s) => s.cam)).size).toBe(3);
    expect(shots.map((s) => [s.from, s.to])).toEqual([[0, 3000], [3000, 6000], [6000, 9000], [9000, 12_000], [12_000, 15_000], [15_000, 18_000]]);
  });
  it("only uses a camera while it films; a moment nobody films gets no shot", async () => {
    const { planShots } = await import("@/lib/editor/smart-cut");
    // a: 0–5 s, b: 4–20 s; then nothing until c at 25–30 s
    const shots = planShots([{ id: "a", start: 0, end: 5000 }, { id: "b", start: 4000, end: 20_000 }, { id: "c", start: 25_000, end: 30_000 }], [0, 6000, 12_000, 22_000, 30_000]);
    for (const s of shots) {
      const cam = { a: [0, 5000], b: [4000, 20_000], c: [25_000, 30_000] }[s.cam]!;
      expect(s.from >= cam[0] && s.to <= cam[1], JSON.stringify(s)).toBe(true);
    }
    expect(shots[0]).toEqual({ cam: "a", from: 0, to: 5000 });
    expect(shots.some((s) => s.from >= 20_000 && s.from < 25_000)).toBe(false);
    expect(shots.at(-1)).toEqual({ cam: "c", from: 25_000, to: 30_000 });
  });
  it("reads a time as people write it", async () => {
    const { parseTime } = await import("@/lib/editor/smart-cut");
    expect([parseTime("1:23"), parseTime("83"), parseTime("1:23.5"), parseTime("٢:٠٥"), parseTime("1:02:03"), parseTime("abc")]).toEqual([83_000, 83_000, 83_500, 125_000, 3_723_000, null]);
  });
});

describe("multicam_plan: the plan on the «المونتاج» track", () => {
  const t = shoot();
  const [A, B, C] = ["a", "b", "c"].map((x) => cam(t, x));
  it("lays the shots between from and to, in step with their cameras", () => {
    const r = apply(t, { type: "multicam_plan", from: 10_000, to: 30_000, shots: [{ cam: A.id, from: 10_000, to: 16_000 }, { cam: B.id, from: 16_000, to: 22_000 }, { cam: C.id, from: 22_000, to: 30_000 }] }, assets);
    expect(cuts(r.timeline)).toEqual([["a", 10_000, 16_000], ["b", 16_000, 22_000], ["c", 22_000, 30_000]]);
    expect(r.label).toBe("تقطيع ذكي: 3 لقطة من 3 كاميرات");
    for (const c of program(r.timeline)!.clips) expect(c.in - cam(r.timeline, c.assetId!).in).toBe(c.start - cam(r.timeline, c.assetId!).start);
  });
  it("replaces only what was cut inside the stretch", () => {
    const hand = apply(t, { type: "multicam_cut", cam: A.id, at: 0 }, assets).timeline;
    const r = apply(hand, { type: "multicam_plan", from: 20_000, to: 30_000, shots: [{ cam: C.id, from: 20_000, to: 25_000 }, { cam: B.id, from: 25_000, to: 30_000 }] }, assets).timeline;
    expect(cuts(r)).toEqual([["a", 0, 20_000], ["c", 20_000, 25_000], ["b", 25_000, 30_000], ["a", 30_000, 60_000]]);
  });
  it("refuses a shot outside its camera or outside the stretch", () => {
    expect(() => apply(t, { type: "multicam_plan", from: 0, to: 10_000, shots: [{ cam: B.id, from: 0, to: 10_000 }] }, assets)).toThrow(/برا وقت كاميرتها/);
    expect(() => apply(t, { type: "multicam_plan", from: 0, to: 10_000, shots: [{ cam: A.id, from: 0, to: 12_000 }] }, assets)).toThrow(/برا الوقت/);
  });
});

describe("the number keys of «شبكة الكاميرات»", () => {
  it("cut by the physical key: top row, number pad, and an Arabic keyboard", async () => {
    const { camKey } = await import("@/components/jawad/editor/CameraGrid");
    expect(camKey({ key: "3", code: "Digit3" })).toBe(2);
    expect(camKey({ key: "7", code: "Numpad7" })).toBe(6);
    // an Arabic layout types «٣» on the 3 key
    expect(camKey({ key: "٣", code: "Digit3" })).toBe(2);
    // a browser that does not say which key: the digit it typed, Western or Arabic
    expect(camKey({ key: "٥", code: "" })).toBe(4);
    expect(camKey({ key: "9", code: "" })).toBe(8);
    // 0 is the tenth camera
    expect(camKey({ key: "0", code: "Digit0" })).toBe(9);
    for (const e of [{ key: "a", code: "KeyA" }, { key: " ", code: "Space" }, { key: "F1", code: "F1" }, { key: "Enter", code: "Enter" }]) expect(camKey(e)).toBeNull();
  });
});
