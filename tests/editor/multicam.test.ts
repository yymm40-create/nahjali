import { describe, expect, it } from "vitest";
import { apply, applyAll, type Command } from "@/lib/editor/commands";
import { clipEnd, clipLength, emptyTimeline, readTimeline, sourceTime, timelineTime, type Clip, type Timeline } from "@/lib/editor/model";
import { angleOptions, chooseShots, levelsOf, MULTICAM, shareOf, type CamInput, type Shot } from "@/lib/editor/multicam";
import { RAMP_PRESETS } from "@/lib/editor/ramp";
import { lib, video } from "./helpers";

const STEP = MULTICAM.stepMs;
const QUIET = -50;
const NEAR = -12;
const FAR = -24;

/**
 * Cameras over `sec` seconds: `who(t)` says who speaks at second t (camera indexes; [] = nobody). A speaker is heard
 * NEAR on their own camera and FAR on the others; nobody speaking (and a short breath every second) is QUIET.
 */
function cams(n: number, sec: number, who: (t: number) => number[], spans?: [number, number][]): CamInput[] {
  const steps = Math.round((sec * 1000) / STEP);
  return Array.from({ length: n }, (_, k) => {
    const [start, end] = spans?.[k] ?? [0, sec * 1000];
    return {
      start,
      end,
      levels: Array.from({ length: steps }, (_, i) => {
        const mid = i * STEP + STEP / 2;
        if (mid < start || mid >= end) return null;
        // a breath between words every second: the room's own quiet, as each microphone hears it
        if (i % 10 === 9) return QUIET;
        const s = who(mid / 1000);
        return s.includes(k) ? NEAR : s.length ? FAR : QUIET;
      }),
    };
  });
}
const runsOf = (shots: Shot[]) => shots.map((s) => [s.cam, s.from, s.to]);
const contiguous = (shots: Shot[]) => shots.slice(1).every((s, i) => s.from === shots[i].to);

describe("who is speaking", () => {
  it("cuts to the camera whose microphone hears the speaker loudest, on the turn", () => {
    // A speaks 0–5 s, a short breath, B 5.5–10, a breath, A again
    const c = cams(2, 15, (t) => (t < 5 ? [0] : t < 5.5 ? [] : t < 10 ? [1] : t < 10.5 ? [] : [0]));
    const shots = chooseShots(c, 0, 15_000);
    expect(shots.map((s) => s.cam)).toEqual([0, 1, 0]);
    expect(contiguous(shots)).toBe(true);
    expect(shots[0].from).toBe(0);
    expect(shots[2].to).toBe(15_000);
    // the cut lands where B starts (the breath stays on A)
    expect(Math.abs(shots[1].from - 5500)).toBeLessThanOrEqual(200);
    expect(shareOf(shots, 2)[1]).toBeGreaterThan(0.25);
  });

  it("does not follow a camera whose louder sound is only its own noise (each camera's own quiet level)", () => {
    // B's microphone hums 15 dB louder all along; A is the one speaking
    const c = cams(2, 10, () => [0]);
    c[1].levels = c[1].levels.map((v) => (v == null ? v : v + 15));
    expect(chooseShots(c, 0, 10_000).map((s) => s.cam)).toEqual([0]);
  });
});

describe("no flicker", () => {
  it("keeps a short interjection on the camera that was on (minimum shot)", () => {
    const c = cams(2, 12, (t) => (t >= 5 && t < 5.6 ? [1] : [0]));
    expect(runsOf(chooseShots(c, 0, 12_000))).toEqual([[0, 0, 12_000]]);
  });

  it("never makes a shot shorter than the minimum, however fast the talk goes back and forth", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const turns = Array.from({ length: 200 }, () => (rnd() < 0.5 ? 0 : rnd() < 0.5 ? 1 : 2));
    const c = cams(3, 60, (t) => [turns[Math.floor(t / 0.3)]]);
    for (const minShotMs of [1000, 2000, 3500]) {
      const shots = chooseShots(c, 0, 60_000, { minShotMs });
      expect(contiguous(shots)).toBe(true);
      for (const s of shots) expect(s.to - s.from).toBeGreaterThanOrEqual(minShotMs);
      // and no camera follows itself
      for (let i = 1; i < shots.length; i++) expect(shots[i].cam).not.toBe(shots[i - 1].cam);
    }
  });

  it("takes the minimum shot the person chose", () => {
    // turns of 2.5 s: kept with a 2 s minimum, swallowed with a 6 s one
    const c = cams(2, 20, (t) => [Math.floor(t / 2.5) % 2]);
    expect(chooseShots(c, 0, 20_000, { minShotMs: 2000 }).length).toBe(8);
    expect(chooseShots(c, 0, 20_000, { minShotMs: 6000 }).every((s) => s.to - s.from >= 6000)).toBe(true);
  });
});

describe("the wide camera", () => {
  it("goes wide when two speak at once", () => {
    // A, then A and B together, then B — camera 2 is the wide one (it hears everyone the same)
    const c = cams(3, 15, (t) => (t < 5 ? [0] : t < 10 ? [0, 1] : [1]));
    c[2].levels = c[2].levels.map((v) => (v == null ? v : v === QUIET ? QUIET : -18));
    const shots = chooseShots(c, 0, 15_000, { wide: 2 });
    expect(shots.map((s) => s.cam)).toEqual([0, 2, 1]);
  });

  it("goes wide when nobody speaks for a long while, and holds the speaker when there is no wide camera", () => {
    const c = cams(3, 16, (t) => (t < 4 ? [0] : t < 10 ? [] : [1]));
    expect(chooseShots(c, 0, 16_000, { wide: 2 }).map((s) => s.cam)).toEqual([0, 2, 1]);
    expect(chooseShots(c, 0, 16_000, { wide: null }).map((s) => s.cam)).toEqual([0, 1]);
    // a pause shorter than the quiet time is not a reason to leave the speaker
    const short = cams(3, 12, (t) => (t < 5 ? [0] : t < 6.5 ? [] : [0]));
    expect(chooseShots(short, 0, 12_000, { wide: 2 }).map((s) => s.cam)).toEqual([0]);
  });

  it("never shows the wide camera as a speaker by its loudness alone", () => {
    const c = cams(3, 10, () => [0]);
    c[2].levels = c[2].levels.map(() => -2);
    expect(chooseShots(c, 0, 10_000, { wide: 2 }).map((s) => s.cam)).toEqual([0]);
  });
});

describe("where the cameras filmed", () => {
  it("uses a camera only inside its own clip", () => {
    // B started recording 3 s late and stopped at 9 s; it is the one speaking from 2 s on
    const c = cams(2, 12, (t) => (t < 2 ? [0] : [1]), [
      [0, 12_000],
      [3000, 9000],
    ]);
    const shots = chooseShots(c, 0, 12_000);
    for (const s of shots) {
      expect(s.from).toBeGreaterThanOrEqual(c[s.cam].start);
      expect(s.to).toBeLessThanOrEqual(c[s.cam].end);
    }
    expect(shots.map((s) => s.cam)).toEqual([0, 1, 0]);
    expect(shots[1].from).toBe(3000);
    expect(shots[1].to).toBe(9000);
    expect(contiguous(shots)).toBe(true);
  });

  it("counts a camera with no face in sight a little less", () => {
    // both hear the speaker the same; only camera 1 shows a face
    const c = cams(2, 8, () => [0, 1]);
    c[0].faces = c[0].levels.map(() => false);
    c[1].faces = c[1].levels.map(() => true);
    expect(chooseShots(c, 0, 8000, { bothDb: 0 }).map((s) => s.cam)).toEqual([1]);
  });
});

describe("the sound read on the clip's own time", () => {
  const rate = 1000;
  // a 10 s file, loud from 2 s to 3 s
  const mono = new Float32Array(10 * rate).map((_, i) => (i >= 2 * rate && i < 3 * rate ? 0.5 : 0.001));
  const loud = (lv: (number | null)[]) => lv.flatMap((v, i) => (v != null && v > -20 ? [i] : []));

  it("follows the clip's place and speed", () => {
    const clip = { start: 1000, in: 0, out: 10_000, speed: 2 };
    // the file's 2–3 s play at 1000 + 1000…1500 on the timeline
    expect(loud(levelsOf(mono, rate, clip, 0, 60, 100))).toEqual([20, 21, 22, 23, 24]);
  });

  it("follows a speed curve through model.ts (sourceTime)", () => {
    const clip = { start: 0, in: 0, out: 10_000, speed: 1, ramp: RAMP_PRESETS.slowFast.points };
    const steps = loud(levelsOf(mono, rate, clip, 0, 120, 100));
    const from = timelineTime(clip, 2000);
    const to = timelineTime(clip, 3000);
    expect(steps.length).toBeGreaterThan(0);
    for (const i of steps) {
      expect(i * 100 + 100).toBeGreaterThan(from - 1);
      expect(i * 100).toBeLessThan(to + 1);
      expect(sourceTime(clip, i * 100 + 50)).toBeGreaterThan(1900);
    }
  });
});

// ───────── the cut list as clips ─────────

const ASSETS = lib(video("A", 60_000), video("B", 60_000), video("W", 60_000));
/** camera A on the main track at 0, camera B synced 500 ms later on a track above, camera W (wide) above that */
function synced(): Timeline {
  let t = emptyTimeline("16:9");
  t = apply(t, { type: "add_clip", assetId: "A" }, ASSETS).timeline;
  t = apply(t, { type: "add_clip", assetId: "B", trackId: "new", at: 500 }, ASSETS).timeline;
  t = apply(t, { type: "add_clip", assetId: "W", trackId: "new", at: 0 }, ASSETS).timeline;
  const trim = (c: Clip, out: number) => apply(t, { type: "trim_clip", clipId: c.id, edge: "end", to: c.start + out }, ASSETS).timeline;
  // ten seconds each
  for (const id of ["A", "B", "W"]) {
    const c = t.tracks.flatMap((x) => x.clips).find((x) => x.assetId === id)!;
    t = trim(c, 10_000);
  }
  return t;
}
const camId = (t: Timeline, asset: string) => t.tracks.flatMap((x) => x.clips).find((c) => c.assetId === asset && !c.angle)!.id;
const cutsOf = (t: Timeline) => t.tracks.flatMap((x) => x.clips.filter((c) => c.angle).map((c) => ({ c, track: x })));

describe("the multicam command", () => {
  it("turns the shots into ordinary clips on the main track, the cameras kept hidden and quiet", () => {
    const t0 = synced();
    const cams = [camId(t0, "A"), camId(t0, "B")];
    const r = apply(t0, { type: "multicam", cams, shots: [{ cam: 0, from: 0, to: 4000 }, { cam: 1, from: 4000, to: 7000 }, { cam: 0, from: 7000, to: 10_000 }] }, ASSETS);
    const t = r.timeline;
    const cuts = cutsOf(t);
    expect(cuts.map(({ c }) => [c.assetId, c.start, c.in, c.out])).toEqual([
      ["A", 0, 0, 4000],
      // B starts 500 ms later on the timeline: the timeline's 4 s is its file's 3.5 s
      ["B", 4000, 3500, 6500],
      ["A", 7000, 7000, 10_000],
    ]);
    // one track (the main one: it was free and its magnet keeps them in place)
    expect(new Set(cuts.map((x) => x.track.id)).size).toBe(1);
    expect(cuts[0].track).toBe(t.tracks.find((x) => x.kind === "video"));
    // the originals: each alone on a hidden «كاميرا N» track; the cuts carry the sound
    const angles = t.tracks.filter((x) => x.angles);
    expect(angles.map((x) => [x.name, x.hidden, x.muted, x.clips.map((c) => c.id)])).toEqual([
      ["كاميرا 1", true, true, [cams[0]]],
      ["كاميرا 2", true, true, [cams[1]]],
    ]);
    expect(cuts.every(({ c }) => c.volume === 1)).toBe(true);
    // W, which was not one of the cameras, is untouched
    expect(t.tracks.some((x) => !x.angles && x.clips.some((c) => c.assetId === "W" && !c.angle))).toBe(true);
    expect(r.label).toContain("3 لقطة");
    // what is stored reads back the same (the links to the cameras kept)
    const back = readTimeline(JSON.parse(JSON.stringify(t)), new Set(ASSETS.keys()));
    expect(cutsOf(back).map(({ c }) => c.angle)).toEqual([cams[0], cams[1], cams[0]]);
    expect(back.tracks.filter((x) => x.angles).length).toBe(2);
  });

  it("is one change (one undo), and a second run on the same cameras replaces the first cuts", () => {
    const t0 = synced();
    const cams = [camId(t0, "A"), camId(t0, "B")];
    const once = applyAll(t0, [{ type: "multicam", cams, shots: [{ cam: 0, from: 0, to: 5000 }, { cam: 1, from: 5000, to: 10_000 }] }], ASSETS);
    expect(cutsOf(once.timeline).length).toBe(2);
    const twice = apply(once.timeline, { type: "multicam", cams, shots: [{ cam: 1, from: 500, to: 10_000 }] }, ASSETS).timeline;
    expect(cutsOf(twice).map(({ c }) => [c.assetId, c.start])).toEqual([["B", 500]]);
    expect(twice.tracks.filter((x) => x.angles).length).toBe(2);
  });

  it("puts the cuts on a new track above the main one when the main track holds other work there", () => {
    let t0 = synced();
    // the cameras both on tracks of their own, and other work on the main track
    const a = camId(t0, "A");
    t0 = apply(t0, { type: "move_clip", clipId: a, trackId: "new", start: 0 }, ASSETS).timeline;
    t0 = apply(t0, { type: "add_clip", assetId: "W", trackId: t0.tracks[0].id }, ASSETS).timeline;
    const r = apply(t0, { type: "multicam", cams: [a, camId(t0, "B")], shots: [{ cam: 0, from: 0, to: 6000 }, { cam: 1, from: 6000, to: 10_000 }] }, ASSETS).timeline;
    const track = cutsOf(r)[0].track;
    expect(track.name).toBe("المونتاج");
    expect(r.tracks.indexOf(track)).toBe(1);
  });

  it("carries the sound the person chose", () => {
    const t0 = synced();
    const cams = [camId(t0, "A"), camId(t0, "B")];
    const shots = [{ cam: 0, from: 0, to: 5000 }, { cam: 1, from: 5000, to: 10_000 }];
    const keep = apply(t0, { type: "multicam", cams, shots, sound: "keep" }, ASSETS).timeline;
    expect(cutsOf(keep).every(({ c }) => c.volume === 0)).toBe(true);
    expect(keep.tracks.filter((x) => x.angles).every((x) => x.muted)).toBe(true);
    const one = apply(t0, { type: "multicam", cams, shots, sound: 1, wide: 1 }, ASSETS).timeline;
    expect(one.tracks.filter((x) => x.angles).map((x) => [x.name, x.muted])).toEqual([
      ["كاميرا 1", true],
      ["كاميرا 2 (واسعة)", false],
    ]);
  });

  it("cuts a camera with a speed curve through its curve", () => {
    let t0 = synced();
    const b = camId(t0, "B");
    t0 = apply(t0, { type: "update_clip", clipId: b, patch: { ramp: "slowFast" } }, ASSETS).timeline;
    const orig = t0.tracks.flatMap((x) => x.clips).find((c) => c.id === b)!;
    const end = clipEnd(orig);
    const r = apply(t0, { type: "multicam", cams: [camId(t0, "A"), b], shots: [{ cam: 0, from: 0, to: 4000 }, { cam: 1, from: 4000, to: Math.min(end, 10_000) }] }, ASSETS).timeline;
    const cut = cutsOf(r)[1].c;
    expect(cut.in).toBe(Math.round(sourceTime(orig, 4000)));
    expect(cut.out).toBe(Math.round(sourceTime(orig, Math.min(end, 10_000))));
    expect(Math.abs(clipLength(cut) - (Math.min(end, 10_000) - 4000))).toBeLessThanOrEqual(2);
  });

  it("refuses shots that overlap, leave their camera's clip, or name a camera that isn't there", () => {
    const t0 = synced();
    const cams = [camId(t0, "A"), camId(t0, "B")];
    const bad = (shots: { cam: number; from: number; to: number }[]) => () => apply(t0, { type: "multicam", cams, shots }, ASSETS);
    expect(bad([{ cam: 0, from: 0, to: 5000 }, { cam: 1, from: 4000, to: 9000 }])).toThrow();
    expect(bad([{ cam: 1, from: 0, to: 4000 }])).toThrow(); // B only from 500
    expect(bad([{ cam: 3, from: 0, to: 4000 }])).toThrow();
    expect(() => apply(t0, { type: "multicam", cams: [cams[0]], shots: [{ cam: 0, from: 0, to: 4000 }] }, ASSETS)).toThrow();
  });
});

describe("«بدّل الزاوية»", () => {
  const made = () => {
    const t0 = synced();
    const cams = [camId(t0, "A"), camId(t0, "B"), camId(t0, "W")];
    const t = apply(t0, { type: "multicam", cams, wide: 2, shots: [{ cam: 2, from: 0, to: 3000 }, { cam: 0, from: 3000, to: 7000 }, { cam: 1, from: 7000, to: 10_000 }] } as Command, ASSETS).timeline;
    return { t, cams };
  };

  it("shows the same moment from another camera, keeping the cut's place and length", () => {
    const { t, cams } = made();
    const cut = cutsOf(t)[1].c; // A, 3–7 s
    const opts = angleOptions(t, cut.id);
    expect(opts.map((o) => [o.clipId, o.on])).toEqual([
      [cams[0], true],
      [cams[1], false],
      [cams[2], false],
    ]);
    const r = apply(t, { type: "multicam_angle", clipId: cut.id, cam: cams[1] }, ASSETS).timeline;
    const now = cutsOf(r)[1].c;
    expect([now.assetId, now.start, now.in, now.out, now.angle]).toEqual(["B", 3000, 2500, 6500, cams[1]]);
    expect(clipLength(now)).toBe(clipLength(cut));
    // and back again
    const back = apply(r, { type: "multicam_angle", clipId: cut.id, cam: cams[0] }, ASSETS).timeline;
    expect(cutsOf(back)[1].c).toMatchObject({ assetId: "A", in: 3000, out: 7000 });
  });

  it("finds the moment through the camera even after the cut was moved", () => {
    const { t, cams } = made();
    const last = cutsOf(t)[2].c; // B, 7–10 s
    const moved = apply(t, { type: "move_clip", clipId: last.id, trackId: "new", start: 20_000 }, ASSETS).timeline;
    const r = apply(moved, { type: "multicam_angle", clipId: last.id, cam: cams[0] }, ASSETS).timeline;
    expect(cutsOf(r).find(({ c }) => c.id === last.id)!.c).toMatchObject({ assetId: "A", start: 20_000, in: 7000, out: 10_000 });
  });

  it("refuses a camera that did not film all of that moment", () => {
    const { t, cams } = made();
    const first = cutsOf(t)[0].c; // W, 0–3 s — B starts at 0.5 s
    expect(angleOptions(t, first.id).map((o) => o.clipId)).not.toContain(cams[1]);
    expect(() => apply(t, { type: "multicam_angle", clipId: first.id, cam: cams[1] }, ASSETS)).toThrow();
  });
});
