import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { liveTracks } from "@/lib/editor/cover";
import { emptyTimeline, flatten, mainTrack, readTimeline, type Timeline } from "@/lib/editor/model";
import { packLanes } from "@/lib/editor/pack-tracks";
import { lib, sound, video } from "./helpers";

const assets = lib(video("v", 60_000), video("w", 60_000), sound("m", 90_000));

/** a main track with one clip, and `n` camera tracks: camera i has one 6 s clip starting at i × `step` s */
function shoot(n: number, step: number): Timeline {
  let t = apply({ ...emptyTimeline(), magnetic: false }, { type: "add_clip", assetId: "v" }, assets).timeline;
  for (let i = 0; i < n; i++) {
    t = apply(t, { type: "add_track", kind: "video" }, assets).timeline;
    const track = t.tracks.filter((x) => x.kind === "video").at(-1)!;
    t = applyAll(t, [{ type: "add_clip", assetId: "w", trackId: track.id, at: i * step * 1000 }, { type: "trim_clip", clipId: "$1", edge: "end", to: i * step * 1000 + 6000 }], assets).timeline;
  }
  return t;
}
const cams = (t: Timeline) => t.tracks.filter((x) => x.kind === "video").slice(1);

describe("packLanes: the fewest tracks, the same film", () => {
  it("clips that never overlap all go to one lane", () => {
    const to = packLanes([0, 1, 2, 3].map((i) => ({ id: `c${i}`, lane: i, start: i * 10, end: i * 10 + 5 })));
    expect([...to.values()]).toEqual([0, 0, 0, 0]);
  });
  it("a clip that was over another where they overlap stays over it", () => {
    // b (lane 1) overlaps a (lane 0); c (lane 2) overlaps b only; d (lane 3) overlaps nothing
    const to = packLanes([
      { id: "a", lane: 0, start: 0, end: 10 },
      { id: "b", lane: 1, start: 5, end: 15 },
      { id: "c", lane: 2, start: 12, end: 20 },
      { id: "d", lane: 3, start: 30, end: 40 },
    ]);
    expect(Object.fromEntries(to)).toEqual({ a: 0, b: 1, c: 2, d: 0 });
  });
  it("never changes who is over whom, on a random shoot", () => {
    let s = 7;
    const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const clips = Array.from({ length: 60 }, (_, i) => {
      const start = Math.round(r() * 300);
      return { id: `c${i}`, lane: i, start, end: start + 5 + Math.round(r() * 30) };
    });
    const to = packLanes(clips);
    for (const a of clips) for (const b of clips) {
      if (a === b || !(a.start < b.end && a.end > b.start)) continue;
      expect(to.get(a.id)! < to.get(b.id)!, `${a.id} under ${b.id}`).toBe(a.lane < b.lane);
    }
    expect(Math.max(...to.values()) + 1).toBeLessThan(25);
  });
});

describe("«لمّ المسارات»", () => {
  it("32 cameras that follow one another fit in one track, each clip at its own moment", () => {
    const t = shoot(32, 8);
    const r = apply(t, { type: "pack_tracks", kind: "video" }, assets);
    expect(r.label).toBe("لمّيت 32 مسار في 1");
    expect(cams(r.timeline).map((x) => x.clips.length)).toEqual([32]);
    const starts = (x: Timeline) => x.tracks.flatMap((k) => k.clips.map((c) => `${c.id}@${c.start}`)).sort();
    expect(starts(r.timeline)).toEqual(starts(t));
    // the main track is left alone
    expect(mainTrack(r.timeline)!.clips).toEqual(mainTrack(t)!.clips);
  });
  it("cameras that each start over the one before can not be packed without changing the film: they stay", () => {
    // every clip overlaps the one before it and is drawn over it: it must stay on a higher track
    const t = shoot(6, 4);
    const r = apply(t, { type: "pack_tracks", kind: "video" }, assets);
    expect(r.label).toMatch(/ما تنقص/);
    expect(cams(r.timeline).length).toBe(6);
  });
  it("leaves alone a track that is locked, hidden or off, and says so when there is nothing to do", () => {
    const t = shoot(4, 10);
    const [a] = cams(t);
    const locked = apply(t, { type: "update_track", trackId: a.id, patch: { locked: true } }, assets).timeline;
    const packed = apply(locked, { type: "pack_tracks", kind: "video" }, assets).timeline;
    expect(packed.tracks.find((x) => x.id === a.id)!.clips).toEqual(a.clips);
    expect(cams(packed).length).toBe(2);
    expect(() => apply(packed, { type: "pack_tracks", kind: "video" }, assets)).toThrow(/ما فيه مسارات تنلمّ/);
  });
});

describe("«بدون مسار رئيسي»", () => {
  const t = shoot(2, 10);
  const free = apply({ ...t, magnetic: true }, { type: "set_main_track", on: false }, assets).timeline;
  it("no track packs its clips or is named the main one", () => {
    expect([free.noMain, free.magnetic, free.magnetAll]).toEqual([true, false, false]);
    expect(free.tracks[0].name).not.toBe("الرئيسي");
    expect(() => apply(free, { type: "set_magnetic", on: true }, assets)).toThrow(/الرئيسي/);
  });
  it("the first picture track can be deleted like any other, as long as one is left", () => {
    const empty = apply(free, { type: "delete", clipIds: [free.tracks[0].clips[0].id], ripple: false }, assets).timeline;
    const gone = apply(empty, { type: "remove_track", trackId: empty.tracks[0].id }, assets).timeline;
    expect(gone.tracks.filter((x) => x.kind === "video").length).toBe(2);
    expect(() => apply(t, { type: "remove_track", trackId: t.tracks[0].id }, assets)).toThrow(/الرئيسي/);
  });
  it("is saved, and the main track comes back", () => {
    expect(readTimeline(JSON.parse(JSON.stringify(free))).noMain).toBe(true);
    // (a saved project can not have both)
    expect(readTimeline({ ...JSON.parse(JSON.stringify(free)), magnetic: true }).magnetic).toBe(false);
    expect(apply(free, { type: "set_main_track", on: true }, assets).timeline.noMain).toBeUndefined();
  });
});

describe("«H», «S» and the colour on a clip", () => {
  const t = shoot(3, 0);
  const [c1, c2, c3] = cams(t).map((x) => x.clips[0]);
  it("«H»: the clip is not there for the player and the export, and comes back", () => {
    const off = apply(t, { type: "mark_clips", clipIds: [c2.id, c3.id], patch: { off: true } }, assets).timeline;
    const live = liveTracks(off.tracks).flatMap((x) => x.clips.map((c) => c.id));
    expect(live).toContain(c1.id);
    expect(live).not.toContain(c2.id);
    expect(flatten(off).tracks.flatMap((x) => x.clips.map((c) => c.id))).not.toContain(c3.id);
    const on = apply(off, { type: "mark_clips", clipIds: [c2.id, c3.id], patch: { off: false } }, assets).timeline;
    expect(on.tracks).toEqual(t.tracks);
  });
  it("«S» is for picture clips, and the colour is one of the known ones", () => {
    const s = apply(t, { type: "mark_clips", clipIds: [c1.id], patch: { solo: true } }, assets).timeline;
    expect(s.tracks.flatMap((x) => x.clips).filter((c) => c.solo).map((c) => c.id)).toEqual([c1.id]);
    const col = apply(t, { type: "mark_clips", clipIds: [c1.id, c2.id], patch: { label: "#22c55e" } }, assets).timeline;
    expect(col.tracks.flatMap((x) => x.clips).filter((c) => c.label === "#22c55e").length).toBe(2);
    expect(() => apply(t, { type: "mark_clips", clipIds: [c1.id], patch: { label: "red" } }, assets)).toThrow(/لون/);
    const again = readTimeline(JSON.parse(JSON.stringify(applyAll(s, [{ type: "mark_clips", clipIds: [c2.id], patch: { off: true, label: "#ef4444" } }], assets).timeline)));
    const marks = again.tracks.flatMap((x) => x.clips).map((c) => [!!c.solo, !!c.off, c.label ?? null]);
    expect(marks).toContainEqual([true, false, null]);
    expect(marks).toContainEqual([false, true, "#ef4444"]);
  });
});
