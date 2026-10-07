import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { emptyTimeline, flatten, readTimeline, seqLength } from "@/lib/editor/model";
import { lib, main, sound, spans, video } from "./helpers";

const assets = lib(video("a", 4000), video("b", 3000), video("c", 2000), sound("m", 10000));
const three = () => applyAll(emptyTimeline("16:9"), [{ type: "add_clip", assetId: "a" }, { type: "add_clip", assetId: "b" }, { type: "add_clip", assetId: "c" }], assets).timeline;

describe("nest", () => {
  it("the clips become one clip of a new timeline, in their place", () => {
    const t0 = three();
    const [, b, c] = main(t0).clips;
    const r = apply(t0, { type: "nest", clipIds: [b.id, c.id], name: "الوسط" }, assets);
    const t = r.timeline;
    expect(main(t).clips).toHaveLength(2);
    const n = main(t).clips[1];
    expect(n.seq).toBeTruthy();
    expect([n.start, n.in, n.out]).toEqual([4000, 0, 5000]);
    expect(r.select).toEqual([n.id]);
    expect(t.seqs!.map((s) => s.name)).toEqual(["تسلسل 1", "الوسط"]);
    expect(spans(t.seqs![1].tl!)).toEqual([
      ["b", 0, 3000],
      ["c", 3000, 5000],
    ]);
    expect(seqLength(t, n.seq!)).toBe(5000);
  });
  it("plays flattened: the inner clips at their times, cut to the nest's in/out", () => {
    let t = three();
    const [, b, c] = main(t).clips;
    t = apply(t, { type: "nest", clipIds: [b.id, c.id] }, assets).timeline;
    const n = main(t).clips[1];
    // trim the nest's start by 1 s: inner b starts 1 s in
    t = apply(t, { type: "trim_clip", clipId: n.id, edge: "start", to: 5000 }, assets).timeline;
    const f = flatten(t);
    const all = f.tracks.flatMap((tr) => tr.clips.map((x) => [x.assetId, x.start, x.in, x.out]));
    expect(all).toContainEqual(["a", 0, 0, 4000]);
    expect(all).toContainEqual(["b", 4000, 1000, 3000]);
    expect(all).toContainEqual(["c", 6000, 0, 2000]);
    expect(f.tracks.some((tr) => tr.clips.some((x) => x.seq))).toBe(false);
  });
  it("a nest can't run past its content, and the nest's grade goes over its pictures", () => {
    let t = three();
    const [, b] = main(t).clips;
    t = apply(t, { type: "nest", clipIds: [b.id] }, assets).timeline;
    const n = main(t).clips[1];
    t = apply(t, { type: "trim_clip", clipId: n.id, edge: "end", to: 99999 }, assets).timeline;
    expect(main(t).clips[1].out).toBe(3000);
    t = apply(t, { type: "update_clip", clipId: n.id, patch: { grade: { saturation: 0 } } }, assets).timeline;
    const inner = flatten(t).tracks.flatMap((x) => x.clips).find((x) => x.assetId === "b")!;
    expect(inner.grades.at(-1)?.saturation).toBe(0);
  });
  it("sound inside a nest plays, at the nest's volume", () => {
    let t = applyAll(emptyTimeline("16:9"), [{ type: "add_clip", assetId: "a" }, { type: "add_clip", assetId: "m", at: 0 }], assets).timeline;
    const m = t.tracks.find((x) => x.kind === "audio")!.clips[0];
    t = apply(t, { type: "nest", clipIds: [main(t).clips[0].id, m.id] }, assets).timeline;
    t = apply(t, { type: "update_clip", clipId: main(t).clips[0].id, patch: { volume: 0.5 } }, assets).timeline;
    const f = flatten(t);
    const s = f.tracks.filter((x) => x.kind === "audio").flatMap((x) => x.clips);
    expect(s.map((x) => [x.assetId, x.volume])).toEqual([["m", 0.5]]);
  });
  it("survives a save; a nest pointing nowhere or at itself is dropped; loops don't hang", () => {
    let t = three();
    t = apply(t, { type: "nest", clipIds: [main(t).clips[2].id] }, assets).timeline;
    const back = readTimeline(JSON.parse(JSON.stringify(t)), new Set(["a", "b", "c"]));
    expect(main(back).clips.some((c) => c.seq)).toBe(true);
    const bad = JSON.parse(JSON.stringify(t));
    bad.tracks[0].clips.push({ ...bad.tracks[0].clips[0], id: "zz", seq: "nowhere", assetId: null, start: 90000 });
    expect(readTimeline(bad, new Set(["a", "b", "c"])).tracks[0].clips.some((c) => c.seq === "nowhere")).toBe(false);
    // a loop: the inner timeline holding a nest of the outer one
    const outer = t.seqs!.find((s) => !s.tl)!.id;
    const loop = JSON.parse(JSON.stringify(t));
    loop.seqs[1].tl.tracks[0].clips.push({ ...loop.seqs[1].tl.tracks[0].clips[0], id: "lp", seq: outer, assetId: null, start: 5000 });
    expect(() => flatten(readTimeline(loop, new Set(["a", "b", "c"])))).not.toThrow();
  });
});
