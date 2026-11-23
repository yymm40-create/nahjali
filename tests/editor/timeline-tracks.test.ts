import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { emptyTimeline, readTimeline, type Timeline } from "@/lib/editor/model";
import { groupSnap, trackShift } from "@/lib/editor/snap";
import { lib, sound, video } from "./helpers";

const assets = lib(video("v", 6000), video("w", 6000), sound("m", 9000));

/** main + two picture tracks + two sound tracks, one clip on each of the upper picture tracks */
function project(): Timeline {
  const t = applyAll({ ...emptyTimeline(), magnetic: false }, [{ type: "add_clip", assetId: "v" }, { type: "add_track", kind: "video" }, { type: "add_track", kind: "video" }, { type: "add_track", kind: "video" }, { type: "add_track", kind: "audio" }, { type: "add_track", kind: "audio" }], assets).timeline;
  const [, v1, v2] = t.tracks.filter((x) => x.kind === "video");
  return applyAll(
    t,
    [
      { type: "add_clip", assetId: "v", trackId: v1.id, at: 1000 },
      { type: "add_clip", assetId: "w", trackId: v2.id, at: 3000 },
    ],
    assets,
  ).timeline;
}
const pics = (t: Timeline) => t.tracks.filter((x) => x.kind === "video");

describe("⌥ on a track's switch: every track", () => {
  const t = project();
  const ids = t.tracks.map((x) => x.id);
  it("hides every track that has an eye, and shows them again", () => {
    const hidden = apply(t, { type: "update_tracks", trackIds: ids, patch: { hidden: true } }, assets).timeline;
    expect(hidden.tracks.filter((x) => x.kind !== "audio").every((x) => x.hidden)).toBe(true);
    expect(hidden.tracks.filter((x) => x.kind === "audio").some((x) => x.hidden)).toBe(false);
    const shown = apply(hidden, { type: "update_tracks", trackIds: ids, patch: { hidden: false } }, assets).timeline;
    expect(shown.tracks.some((x) => x.hidden)).toBe(false);
  });
  it("mutes and locks them all in one step", () => {
    const r = apply(t, { type: "update_tracks", trackIds: ids, patch: { muted: true } }, assets);
    expect(r.timeline.tracks.every((x) => x.muted)).toBe(true);
    expect(r.label).toMatch(/كتمت/);
    expect(apply(t, { type: "update_tracks", trackIds: ids, patch: { locked: true } }, assets).timeline.tracks.every((x) => x.locked)).toBe(true);
  });
});

describe("«مجلدات المسارات»", () => {
  const t = project();
  const [, v1, v2, v3] = pics(t);
  const made = apply(t, { type: "folder_tracks", trackIds: [v1.id, v2.id], name: "الكاميرات" }, assets).timeline;
  const folder = made.folders![0];

  it("puts tracks in a new folder", () => {
    expect(folder).toMatchObject({ name: "الكاميرات", closed: false });
    expect(made.tracks.filter((x) => x.folder === folder.id).map((x) => x.id)).toEqual([v1.id, v2.id]);
  });
  it("folds, opens and renames it; nothing else changes", () => {
    const closed = apply(made, { type: "update_folder", folderId: folder.id, patch: { closed: true } }, assets).timeline;
    expect(closed.folders![0].closed).toBe(true);
    expect(closed.tracks.map((x) => x.clips.length)).toEqual(made.tracks.map((x) => x.clips.length));
    expect(apply(closed, { type: "update_folder", folderId: folder.id, patch: { name: "جديد" } }, assets).timeline.folders![0]).toMatchObject({ name: "جديد", closed: true });
  });
  it("adds a track to it, takes one out, and the folder goes with its last track", () => {
    const three = apply(made, { type: "folder_tracks", trackIds: [v3.id], folderId: folder.id }, assets).timeline;
    expect(three.tracks.filter((x) => x.folder).length).toBe(3);
    const two = apply(three, { type: "folder_tracks", trackIds: [v1.id], folderId: null }, assets).timeline;
    expect(two.tracks.filter((x) => x.folder).map((x) => x.id)).toEqual([v2.id, v3.id]);
    expect(apply(two, { type: "folder_tracks", trackIds: [v2.id, v3.id], folderId: null }, assets).timeline.folders).toBeUndefined();
  });
  it("«فك المجلد» keeps the tracks and their clips", () => {
    const gone = apply(made, { type: "remove_folder", folderId: folder.id }, assets).timeline;
    expect(gone.folders).toBeUndefined();
    expect(gone.tracks.some((x) => x.folder)).toBe(false);
    expect(gone.tracks.length).toBe(made.tracks.length);
  });
  it("survives saving and opening; a folder nobody is in is dropped", () => {
    const again = readTimeline(JSON.parse(JSON.stringify(made)));
    expect(again.folders).toEqual(made.folders);
    expect(again.tracks.map((x) => x.folder)).toEqual(made.tracks.map((x) => x.folder));
    const stray = readTimeline({ ...JSON.parse(JSON.stringify(t)), folders: [{ id: "fzz", name: "فاضي", closed: true }] });
    expect(stray.folders).toBeUndefined();
    // a track pointing at a folder that is not there is simply on its own
    const lost = JSON.parse(JSON.stringify(made));
    lost.folders = [];
    expect(readTimeline(lost).tracks.some((x) => x.folder)).toBe(false);
  });
  it("is not what the picture is made of: the tracks keep their order", () => {
    expect(made.tracks.map((x) => x.id)).toEqual(t.tracks.map((x) => x.id));
  });
});

describe("a selection dragged across tracks (move_clips)", () => {
  const t = project();
  const [, v1, v2, v3] = pics(t);
  const a = v1.clips[0];
  const b = v2.clips[0];

  it("moves every clip to its own track and moment in one step", () => {
    const r = apply(t, { type: "move_clips", moves: [{ clipId: a.id, trackId: v2.id, start: 1500 }, { clipId: b.id, trackId: v3.id, start: 3500 }] }, assets);
    const now = pics(r.timeline);
    expect(now[1].clips).toEqual([]);
    expect(now[2].clips.map((c) => [c.id, c.start])).toEqual([[a.id, 1500]]);
    expect(now[3].clips.map((c) => [c.id, c.start])).toEqual([[b.id, 3500]]);
    expect(r.select).toEqual([a.id, b.id]);
  });
  it("a clip may land where another of the selection was (it has left)", () => {
    // a goes exactly where b is, b goes up: one after the other this would push; together nothing is pushed
    const r = apply(t, { type: "move_clips", moves: [{ clipId: a.id, trackId: v2.id, start: 3000 }, { clipId: b.id, trackId: v3.id, start: 3000 }] }, assets).timeline;
    expect(pics(r)[2].clips.map((c) => [c.id, c.start])).toEqual([[a.id, 3000]]);
    expect(pics(r)[3].clips.map((c) => [c.id, c.start])).toEqual([[b.id, 3000]]);
  });
  it("refuses a track of another kind or a locked one, and changes nothing", () => {
    const snd = t.tracks.find((x) => x.kind === "audio")!;
    expect(() => apply(t, { type: "move_clips", moves: [{ clipId: a.id, trackId: snd.id, start: 0 }] }, assets)).toThrow(/للصوت/);
    const locked = apply(t, { type: "update_track", trackId: v3.id, patch: { locked: true } }, assets).timeline;
    expect(() => apply(locked, { type: "move_clips", moves: [{ clipId: a.id, trackId: v3.id, start: 0 }] }, assets)).toThrow(/مقفول/);
  });
});

describe("trackShift: how many tracks a selection crosses", () => {
  it("is the held clip's move when everyone has room", () => {
    expect(trackShift(5, 1, 3, [2])).toBe(2);
    expect(trackShift(5, 3, 1, [2])).toBe(-2);
  });
  it("stops when the highest (or lowest) clip reaches the last track", () => {
    expect(trackShift(5, 1, 4, [3])).toBe(1);
    expect(trackShift(5, 3, 0, [1])).toBe(-1);
    expect(trackShift(3, 0, 2, [2])).toBe(0);
  });
});

describe("groupSnap: the magnet for a whole selection", () => {
  // two moving clips: 1000–2000 (held) and 3000–5000; a clip that stays ends at 9000
  const edges = [1000, 2000, 3000, 5000];
  it("sticks by the far clip's end though the near one is held", () => {
    expect(groupSnap([0, 9000], edges, 3950, 100)).toEqual({ dt: 4000, at: 9000 });
  });
  it("sticks by the held clip's start too", () => {
    expect(groupSnap([0, 9000], edges, 7960, 100)).toEqual({ dt: 8000, at: 9000 });
  });
  it("takes the nearest of several", () => {
    // the far end is 30 from 9000, the held start is 10 from 4990 (dt 3970 → start 4970… no: 4990 − 1000 = 3990)
    expect(groupSnap([4990, 9000], edges, 3980, 100)).toEqual({ dt: 3990, at: 4990 });
  });
  it("does nothing when no edge is near, and never sticks an edge to where it started", () => {
    expect(groupSnap([0, 9000], edges, 500, 100)).toBeNull();
    expect(groupSnap([1000, 5000], edges, 20, 100)).toBeNull();
  });
});
