import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { emptyTimeline, findClip, readTimeline } from "@/lib/editor/model";
import { countedNumber, MOTION_KINDS, MOTION_THEMES, newMotion, presence, readMotion } from "@/lib/editor/motion-elements";
import { lib, video } from "./helpers";

const assets = lib(video("a", 10000));
const withVideo = () => apply(emptyTimeline("9:16"), { type: "add_clip", assetId: "a" }, assets).timeline;

describe("«مسار الموشن»: elements, not a rendered video", () => {
  it("has the four first elements and the themes", () => {
    expect(Object.keys(MOTION_KINDS)).toEqual(["title", "list", "phrase", "big"]);
    expect(Object.values(MOTION_THEMES).map((t) => t.label)).toEqual(expect.arrayContaining(["ليل كحلي", "بحر فيروزي", "ذهبي فاخر"]));
    const list = newMotion("list");
    expect(list.items.length).toBe(3);
    expect(list.items.map((i) => i.at)).toEqual([...list.items.map((i) => i.at)].sort((a, b) => a - b));
  });

  it("reads an element safely: unknown kinds refused, numbers clamped, lines sorted by their moment", () => {
    expect(readMotion({ kind: "rocket" })).toBeNull();
    const m = readMotion({ kind: "list", x: 4, size: 9, theme: "nope", colors: { accent: "red" }, items: [{ text: "ب", at: 900 }, { text: "أ", at: 100 }], enter: "explode", font: "../x" })!;
    expect(m).toMatchObject({ x: 1, size: 2, theme: "navy", enter: "rise", font: "readex" });
    expect(m.items.map((i) => i.text)).toEqual(["أ", "ب"]);
    expect(m.colors?.accent).toBe(MOTION_THEMES.navy.accent);
  });

  it("puts an element at the playhead on its own motion track, and keeps texts and captions off it", () => {
    const r = apply(withVideo(), { type: "add_motion", kind: "list", at: 1500 }, assets);
    const f = findClip(r.timeline, r.select![0])!;
    expect(f.track.motion).toBe(true);
    expect(f.track.kind).toBe("text");
    expect(f.clip.start).toBe(1500);
    expect(f.clip.motion?.kind).toBe("list");
    expect(f.clip.text?.body).toContain("العنوان");
    // a plain text goes on a text track of its own, never the motion one
    const t2 = apply(r.timeline, { type: "add_text", at: 1500 }, assets);
    const txt = findClip(t2.timeline, t2.select![0])!;
    expect(txt.track.motion).toBeFalsy();
    expect(() => apply(t2.timeline, { type: "move_clip", clipId: txt.clip.id, trackId: f.track.id, start: 6000 }, assets)).toThrow("مسار الموشن");
    // a second element at the same moment opens a second motion track rather than covering the first
    const r3 = apply(r.timeline, { type: "add_motion", kind: "title", at: 1500 }, assets);
    expect(r3.timeline.tracks.filter((x) => x.motion)).toHaveLength(2);
  });

  it("edits every detail with one undoable change, the timeline label following the words", () => {
    const r = apply(withVideo(), { type: "add_motion", kind: "list", at: 0 }, assets);
    const id = r.select![0];
    const t = applyAll(r.timeline, [
      { type: "update_clip", clipId: id, patch: { motion: { title: "ثلاث نصايح", items: [{ text: "نم بدري", at: 300 }, { text: "اشرب ماء", at: 1200 }] } } },
      { type: "update_clip", clipId: id, patch: { motion: { theme: "gold", y: 0.3, size: 1.4 } } },
    ], assets).timeline;
    const c = findClip(t, id)!.clip;
    expect(c.motion).toMatchObject({ title: "ثلاث نصايح", theme: "gold", y: 0.3, size: 1.4 });
    expect(c.motion!.items.map((i) => i.text)).toEqual(["نم بدري", "اشرب ماء"]);
    expect(c.text!.body).toContain("ثلاث نصايح");
    // own colours over the theme, then back
    const own = apply(t, { type: "update_clip", clipId: id, patch: { motion: { colors: { ...MOTION_THEMES.gold, accent: "#ff0000" } } } }, assets).timeline;
    expect(findClip(own, id)!.clip.motion!.colors!.accent).toBe("#ff0000");
    expect(findClip(apply(own, { type: "update_clip", clipId: id, patch: { motion: { colors: null } } }, assets).timeline, id)!.clip.motion!.colors).toBeNull();
    // a plain clip refuses a motion patch
    const plain = withVideo();
    expect(() => apply(plain, { type: "update_clip", clipId: plain.tracks[0].clips[0].id, patch: { motion: { title: "x" } } }, assets)).toThrow("موشن");
  });

  it("survives saving and opening again (the element and the motion track), split and duplicate", () => {
    const r = apply(withVideo(), { type: "add_motion", kind: "big", at: 0, motion: { sub: "1,250", unit: "K" } }, assets);
    const back = readTimeline(JSON.parse(JSON.stringify(r.timeline)));
    const f = findClip(back, r.select![0])!;
    expect(f.track.motion).toBe(true);
    expect(f.clip.motion).toMatchObject({ kind: "big", sub: "1,250", unit: "K" });
    const cut = apply(back, { type: "split", at: 2000 }, assets).timeline;
    expect(cut.tracks.find((x) => x.motion)!.clips.every((c) => c.motion?.kind === "big")).toBe(true);
    const dup = apply(back, { type: "duplicate", clipId: f.clip.id }, assets).timeline;
    expect(dup.tracks.find((x) => x.motion)!.clips).toHaveLength(2);
  });

  it("comes in smoothly and leaves, and a big number counts up to its value", () => {
    expect(presence(0, 4000)).toBe(0);
    expect(presence(140, 4000)).toBeGreaterThan(0.5);
    expect(presence(2000, 4000)).toBe(1);
    expect(presence(3990, 4000)).toBeLessThan(0.1);
    expect(countedNumber("250", 0)).toBe("0");
    expect(countedNumber("250", 5000)).toBe("250");
    expect(countedNumber("1,250", 5000)).toBe("1,250");
    expect(countedNumber("٤٥", 5000)).toBe("45");
    expect(countedNumber("مليون", 100)).toBe("مليون");
  });
});
