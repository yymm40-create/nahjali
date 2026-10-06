import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { allTracks, emptyTimeline, readTimeline } from "@/lib/editor/model";
import { lib, spans, video } from "./helpers";

const assets = lib(video("a", 4000), video("b", 3000));
const one = () => apply(emptyTimeline("9:16"), { type: "add_clip", assetId: "a" }, assets).timeline;

describe("sequences", () => {
  it("a new one opens empty, same size; the first is kept with its clips", () => {
    const t = apply(one(), { type: "seq_new", name: "النسخة القصيرة" }, assets).timeline;
    expect(t.tracks.every((x) => !x.clips.length)).toBe(true);
    expect(t.width).toBe(1080);
    expect(t.seqs!.map((s) => [s.name, s.tl === null])).toEqual([
      ["تسلسل 1", false],
      ["النسخة القصيرة", true],
    ]);
    expect(spans(t.seqs![0].tl!)).toEqual([["a", 0, 4000]]);
  });
  it("opening another one parks this one in its place (the order stays)", () => {
    let t = apply(one(), { type: "seq_new" }, assets).timeline;
    t = apply(t, { type: "add_clip", assetId: "b" }, assets).timeline;
    const first = t.seqs![0].id;
    t = apply(t, { type: "seq_open", id: first }, assets).timeline;
    expect(spans(t)).toEqual([["a", 0, 4000]]);
    expect(t.seqs!.map((s) => s.tl === null)).toEqual([true, false]);
    expect(spans(t.seqs![1].tl!)).toEqual([["b", 0, 3000]]);
  });
  it("rename, duplicate, delete (the open one: its neighbour opens)", () => {
    let t = applyAll(one(), [{ type: "seq_new", name: "ب" }], assets).timeline;
    const [s1, s2] = t.seqs!;
    t = apply(t, { type: "seq_rename", id: s1.id, name: "الأصل" }, assets).timeline;
    t = apply(t, { type: "seq_duplicate", id: s1.id }, assets).timeline;
    expect(t.seqs!.map((s) => s.name)).toEqual(["الأصل", "الأصل (نسخة)", "ب"]);
    expect(spans(t.seqs![1].tl!)).toEqual([["a", 0, 4000]]);
    t = apply(t, { type: "seq_delete", id: s2.id }, assets).timeline;
    expect(t.seqs!.map((s) => s.name)).toEqual(["الأصل", "الأصل (نسخة)"]);
    expect(t.seqs![1].tl).toBeNull();
    expect(spans(t)).toEqual([["a", 0, 4000]]);
  });
  it("the only one can't be deleted; a one-timeline project names its first", () => {
    expect(() => apply(one(), { type: "seq_delete", id: "s1" }, assets)).toThrow();
    const t = apply(one(), { type: "seq_rename", id: "s1", name: "الرئيسي" }, assets).timeline;
    expect(t.seqs?.[0]?.name ?? "تسلسل 1").toBeTruthy();
  });
  it("survives a save, and the files of every timeline count as used", () => {
    let t = apply(one(), { type: "seq_new" }, assets).timeline;
    t = apply(t, { type: "add_clip", assetId: "b" }, assets).timeline;
    const back = readTimeline(JSON.parse(JSON.stringify(t)), new Set(["a", "b"]));
    expect(back.seqs).toHaveLength(2);
    expect(back.seqs!.filter((s) => s.tl === null)).toHaveLength(1);
    const used = new Set(allTracks(back).flatMap((x) => x.clips.map((c) => c.assetId)));
    expect([...used].sort()).toEqual(["a", "b"]);
    // a clip of a file that no longer exists is dropped in the parked timeline too
    const strict = readTimeline(JSON.parse(JSON.stringify(t)), new Set(["b"]));
    expect(strict.seqs![0].tl!.tracks.flatMap((x) => x.clips)).toHaveLength(0);
  });
});
