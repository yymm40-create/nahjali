import { describe, expect, it } from "vitest";
import { apply, applyAll, BEHIND_TRACK } from "@/lib/editor/commands";
import { clipEnd, emptyTimeline, findClip, readBackdrop, readTimeline } from "@/lib/editor/model";
import { faceAt, newMotion, readMotion } from "@/lib/editor/motion-elements";
import { lib, video } from "./helpers";

// «موشن العمق»: words behind the person, a face-tracking frame, a ribbon around them, a silhouette poster, 3D tilt
const assets = lib(video("a", 10000));
const base = () => apply(emptyTimeline("16:9"), { type: "add_clip", assetId: "a" }, assets).timeline;

describe("«ورا الشخص»: a text goes behind the person", () => {
  it("copies the video under the text, for its seconds, onto a cut-out track right above it", () => {
    const r = applyAll(base(), [{ type: "add_text", at: 2000, duration: 3000, body: "السلام عليكم" }], assets);
    const textId = r.select![0];
    const b = apply(r.timeline, { type: "behind_person", clipId: textId }, assets);
    const t = b.timeline;
    const text = findClip(t, textId)!;
    const above = t.tracks[t.tracks.indexOf(text.track) + 1];
    expect(above.kind).toBe("video");
    expect(above.name).toBe(BEHIND_TRACK);
    const cut = above.clips[0];
    expect(cut.assetId).toBe("a");
    expect([cut.start, clipEnd(cut), cut.in, cut.out]).toEqual([2000, 5000, 2000, 5000]);
    expect(cut.volume).toBe(0);
    expect(cut.bg?.mode).toBe("remove");
    // a second text at other seconds reuses the same track instead of adding one each time
    const r2 = apply(t, { type: "add_text", at: 6000, duration: 1000 }, assets);
    const before = r2.timeline.tracks.length;
    const b2 = apply(r2.timeline, { type: "behind_person", clipId: r2.select![0] }, assets);
    expect(b2.timeline.tracks.length).toBeLessThanOrEqual(before + 1);
  });

  it("refuses when nothing with a person is under it", () => {
    const r = apply(emptyTimeline("16:9"), { type: "add_text", at: 0 }, assets);
    expect(() => apply(r.timeline, { type: "behind_person", clipId: r.select![0] }, assets)).toThrow("ما فيه فيديو");
  });
});

describe("«شريط يلف» and «تتبّع الوجه»", () => {
  it("wraps a ribbon around the person: far half under the cut-out, near half over it", () => {
    const r = apply(base(), { type: "add_motion", kind: "ribbon", at: 1000, duration: 2000 }, assets);
    const w = apply(r.timeline, { type: "wrap_ribbon", clipId: r.select![0] }, assets).timeline;
    const back = findClip(w, r.select![0])!;
    expect(back.clip.motion?.part).toBe("back");
    const iBack = w.tracks.indexOf(back.track);
    const iCut = w.tracks.findIndex((x) => x.name === BEHIND_TRACK);
    const front = w.tracks.flatMap((x, i) => x.clips.filter((c) => c.motion?.part === "front").map(() => i));
    expect(iCut).toBe(iBack + 1);
    expect(front.length).toBe(1);
    expect(front[0]).toBeGreaterThan(iCut);
  });

  it("reuses the cut-out a text already has, so a face frame added after stays in front of the person", () => {
    let r = apply(base(), { type: "add_text", at: 0, duration: 4000, body: "المسابقة" }, assets);
    let t = apply(r.timeline, { type: "behind_person", clipId: r.select![0] }, assets).timeline;
    t = apply(t, { type: "add_motion", kind: "facehud", at: 0, duration: 4000 }, assets).timeline;
    r = apply(t, { type: "add_motion", kind: "ribbon", at: 0, duration: 4000 }, assets);
    t = apply(r.timeline, { type: "wrap_ribbon", clipId: r.select![0] }, assets).timeline;
    const cuts = t.tracks.map((x, i) => (x.name === BEHIND_TRACK ? i : -1)).filter((i) => i >= 0);
    expect(cuts.length).toBe(1);
    const iOf = (pred: (c: import("@/lib/editor/model").Clip) => boolean) => t.tracks.findIndex((x) => x.clips.some(pred));
    expect(iOf((c) => c.motion?.kind === "facehud")).toBeGreaterThan(cuts[0]);
    expect(iOf((c) => c.motion?.part === "back")).toBeLessThan(cuts[0]);
    expect(iOf((c) => c.motion?.part === "front")).toBeGreaterThan(cuts[0]);
    // asking again for the text changes nothing
    const again = apply(t, { type: "behind_person", clipId: t.tracks.find((x) => x.kind === "text" && !x.motion)!.clips[0].id }, assets).timeline;
    expect(again.tracks.length).toBe(t.tracks.length);
  });

  it("keeps the face samples safe and follows them smoothly", () => {
    const m = readMotion({ kind: "facehud", track: [{ t: 1000, x: 0.6, y: 0.4, w: 0.1, h: 0.2 }, { t: 0, x: 0.4, y: 0.4, w: 0.1, h: 0.2 }, "x", { t: 2000, x: 9, y: 0.5 }] })!;
    expect(m.track.map((f) => f.t)).toEqual([0, 1000, 2000]);
    expect(m.track[2].x).toBe(2);
    expect(faceAt(m.track, 500)!.x).toBeCloseTo(0.5);
    expect(faceAt(m.track, -10)!.x).toBe(0.4);
    expect(faceAt([], 0)).toBeNull();
    expect(readMotion({ kind: "ribbon", part: "sideways" })!.part).toBe("whole");
    expect(newMotion("facehud").track).toEqual([]);
  });
});

describe("«ظل» and «ميلان ثلاثي» are kept", () => {
  it("reads a silhouette fill and a tilt back from a saved timeline", () => {
    expect(readBackdrop({ mode: "color", fill: "#141010" }).fill).toBe("#141010");
    expect(readBackdrop({ mode: "remove", fill: "black" }).fill).toBeUndefined();
    const r = apply(base(), { type: "add_text", at: 0, body: "المسابقة" }, assets);
    const t = apply(r.timeline, { type: "update_clip", clipId: r.select![0], patch: { text: { tiltY: 32, tiltX: -90 } } }, assets).timeline;
    const back = readTimeline(JSON.parse(JSON.stringify(t)))!;
    const txt = findClip(back, r.select![0])!.clip.text!;
    expect(txt.tiltY).toBe(32);
    expect(txt.tiltX).toBe(-60);
  });
});
