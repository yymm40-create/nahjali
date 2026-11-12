import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { FX_BY_ID } from "@/lib/editor/effects";
import { LOOKS } from "@/lib/editor/grade";
import { clipEnd, clipLength, emptyTimeline, mainTrack, RATIOS, readTimeline, type AssetInfo, type Timeline } from "@/lib/editor/model";
import { autoFill, buildTemplate, READY_TEMPLATES, readTemplate, slotLengths, templateById, templateFromTimeline, templateMs, TEMPLATE_LIMITS, type Fill, type Template } from "@/lib/editor/templates";
import { TR_BY_ID } from "@/lib/editor/transitions";
import { image, lib, sound, video } from "./helpers";

const FILES = [video("v1", 60_000), video("v2", 45_000), image("p1"), video("v3", 90_000), image("p2"), video("v4", 30_000)];
const ASSETS = lib(...FILES, sound("song", 200_000));
/** every slot filled from the files in order */
const filled = (t: Template) => autoFill(t, FILES).fills;

describe("every ready template", () => {
  it("there are about twelve, each with its own id, and none borrows a look, effect or transition that doesn't exist", () => {
    expect(READY_TEMPLATES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(READY_TEMPLATES.map((t) => t.id)).size).toBe(READY_TEMPLATES.length);
    for (const t of READY_TEMPLATES) {
      expect(t.slots.length, t.id).toBeGreaterThan(0);
      if (t.look) expect(LOOKS.some((l) => l.id === t.look), t.id).toBe(true);
      if (t.transition) expect(TR_BY_ID.has(t.transition.kind), t.id).toBe(true);
      for (const s of t.slots) {
        for (const f of s.fx ?? []) expect(FX_BY_ID.has(f), `${t.id}: ${f}`).toBe(true);
        if (s.transition) expect(TR_BY_ID.has(s.transition.kind), t.id).toBe(true);
      }
      for (const x of t.texts) expect(x.slot, t.id).toBeLessThan(t.slots.length);
      // a template is its own check: read back, nothing is lost
      expect(readTemplate(JSON.parse(JSON.stringify(t)), t.id), t.id).toEqual(t);
    }
  });

  it("loads into a valid timeline that the editor reads back unchanged, and is one change on the open timeline", () => {
    for (const t of READY_TEMPLATES) {
      const b = buildTemplate(t, filled(t), ASSETS, { music: t.music ? "song" : null });
      const tl = b.timeline;
      expect([tl.width, tl.height], t.id).toEqual([RATIOS[t.ratio].width, RATIOS[t.ratio].height]);
      // what is stored reads back the same: no clip dropped, moved or overlapping
      const back = readTimeline(JSON.parse(JSON.stringify(tl)), new Set(ASSETS.keys()));
      expect(back.tracks.map((x) => x.clips.map((c) => [c.id, c.start, clipLength(c)])), t.id).toEqual(tl.tracks.map((x) => x.clips.map((c) => [c.id, c.start, clipLength(c)])));
      // the slots edge to edge on the main track from 0, in order
      const main = mainTrack(back)!;
      expect(main.clips.map((c) => c.id), t.id).toEqual(b.clips);
      expect(main.clips[0].start).toBe(0);
      main.clips.slice(1).forEach((c, i) => expect(c.start, t.id).toBe(clipEnd(main.clips[i])));
      // every text inside the video
      const end = clipEnd(main.clips[main.clips.length - 1]);
      for (const x of back.tracks.filter((k) => k.kind === "text")) for (const c of x.clips) expect(clipEnd(c), t.id).toBeLessThanOrEqual(end);
      expect(back.tracks.filter((k) => k.kind === "text").reduce((n, k) => n + k.clips.length, 0), t.id).toBe(t.texts.length);
      if (t.look) expect(main.clips.every((c) => c.grades[0]?.look === t.look), t.id).toBe(true);
      if (t.bpm) expect(back.markers.length, t.id).toBeGreaterThan(2);
      // «ابنِ المونتاج»: one command on the open timeline (the main track's magnet keeps them where they are)
      const r = apply(emptyTimeline("16:9"), { type: "use_template", name: t.name, timeline: tl }, ASSETS);
      expect(r.timeline.width, t.id).toBe(RATIOS[t.ratio].width);
      expect(mainTrack(r.timeline)!.clips.map((c) => c.start), t.id).toEqual(main.clips.map((c) => c.start));
    }
  });

  it("keeps the person's earlier work in its own timeline when the template opens in a new one", () => {
    const t = templateById("hook-points-cta")!;
    const before = apply(emptyTimeline(), { type: "add_clip", assetId: "v1" }, ASSETS).timeline;
    const b = buildTemplate(t, filled(t), ASSETS);
    const r = applyAll(before, [{ type: "seq_new", name: t.name }, { type: "use_template", name: t.name, timeline: b.timeline }], ASSETS);
    expect(r.timeline.seqs?.length).toBe(2);
    const old = r.timeline.seqs!.find((s) => s.tl)!.tl!;
    expect(mainTrack(old)!.clips.map((c) => c.assetId)).toEqual(["v1"]);
    expect(mainTrack(r.timeline)!.clips.length).toBe(t.slots.length);
  });

  it("draws nobody: the cards are made from the template itself (no picture files)", () => {
    for (const t of READY_TEMPLATES) expect(JSON.stringify(t)).not.toMatch(/\.(png|jpe?g|webp|mp4)|https?:/i);
  });
});

describe("filling the slots", () => {
  const t = templateById("hook-points-cta")!; // 5 slots: 3, 4, 4, 4, 3 s

  it("fills the empty slots with the files in their order, keeping what is already there", () => {
    const r = autoFill(t, [video("a", 60_000), video("b", 60_000), image("c")], [null, { assetId: "x" }, null, null, null]);
    expect(r.fills.map((f) => f?.assetId)).toEqual(["a", "x", "b", "c", "a"]);
    expect(r.reused).toBe(true);
    expect(r.extra).toBe(0);
  });

  it("with too few files, a long video goes on from where its last slot ended", () => {
    const r = autoFill(t, [video("long", 60_000)]);
    expect(r.fills.map((f) => [f?.assetId, f?.in ?? 0])).toEqual([
      ["long", 0],
      ["long", 3000],
      ["long", 7000],
      ["long", 11_000],
      ["long", 15_000],
    ]);
    // a short one starts again from its beginning when not enough is left
    const short = autoFill(t, [video("s", 5000)]);
    expect(short.fills.map((f) => f?.in ?? 0)).toEqual([0, 0, 0, 0, 0]);
  });

  it("with too many files, the rest are counted (they stay in the library), and a sound is the music", () => {
    const files: AssetInfo[] = [...Array.from({ length: 8 }, (_, i) => video(`v${i}`, 60_000)), sound("m", 30_000)];
    const r = autoFill(t, files);
    expect(r.fills.map((f) => f?.assetId)).toEqual(["v0", "v1", "v2", "v3", "v4"]);
    expect(r.extra).toBe(3);
    expect(r.music).toBe("m");
    expect(autoFill({ ...t, music: false }, files).music).toBeNull();
  });

  it("gives each slot its suggested length, shortens it for a shorter video, and moves what follows", () => {
    const assets = lib(video("a", 60_000), video("short", 1500), image("p"));
    const fills: Fill[] = [{ assetId: "a" }, { assetId: "short" }, { assetId: "p" }, { assetId: "a", in: 20_000 }, { assetId: "a", in: 59_000 }];
    expect(slotLengths(t, fills, assets)).toEqual([3000, 1500, 4000, 4000, 1000]);
    const b = buildTemplate(t, fills, assets);
    const main = mainTrack(b.timeline)!.clips;
    expect(main.map((c) => [c.start, c.in, c.out])).toEqual([
      [0, 0, 3000],
      [3000, 0, 1500],
      [4500, 0, 4000],
      [8500, 20_000, 24_000],
      [12_500, 59_000, 60_000],
    ]);
    expect(b.notes.length).toBe(2);
    // the texts follow their slots
    const texts = b.timeline.tracks.filter((x) => x.kind === "text").flatMap((x) => x.clips).sort((x, y) => x.start - y.start);
    expect(texts.map((c) => c.start)).toEqual([0, 3000, 4500, 8500, 12_500]);
    expect(clipEnd(texts[1])).toBe(4500);
  });

  it("takes the whole file in a talking slot (up to ten minutes)", () => {
    const talk = templateById("talking-captions")!;
    expect(slotLengths(talk, [{ assetId: "v3" }], ASSETS)).toEqual([90_000]);
    expect(slotLengths(talk, [{ assetId: "x" }], lib(video("x", 3_600_000)))).toEqual([TEMPLATE_LIMITS.wholeMaxMs]);
  });

  it("won't build with an empty slot, and says which", () => {
    expect(() => buildTemplate(t, [{ assetId: "v1" }, null, { assetId: "v2" }, null, { assetId: "v1" }], ASSETS)).toThrow(/2، 4/);
    // a file that isn't in the library is as good as empty
    expect(() => buildTemplate(t, [{ assetId: "gone" }, ...filled(t).slice(1)], ASSETS)).toThrow();
  });

  it("puts the person's own words in place of the template's, and the music under it all", () => {
    const b = buildTemplate(t, filled(t), ASSETS, { words: ["كلامي أنا", "", "  "], music: "song" });
    const bodies = b.timeline.tracks.filter((x) => x.kind === "text").flatMap((x) => x.clips).sort((x, y) => x.start - y.start).map((c) => c.text!.body);
    expect(bodies[0]).toBe("كلامي أنا");
    expect(bodies[1]).toBe(t.texts[1].body);
    expect(bodies[2]).toBe(t.texts[2].body);
    const music = b.timeline.tracks.find((x) => x.kind === "audio")!.clips;
    expect(music.length).toBe(1);
    expect(clipLength(music[0])).toBe(templateMs(t));
    expect(music[0].fadeOut).toBeGreaterThan(0);
  });
});

describe("the person's own templates", () => {
  function project(): Timeline {
    let tl = emptyTimeline("4:5");
    for (const id of ["v1", "p1", "v2"]) tl = apply(tl, { type: "add_clip", assetId: id }, ASSETS).timeline;
    const [a, , c] = mainTrack(tl)!.clips;
    tl = apply(tl, { type: "trim_clip", clipId: a.id, edge: "end", to: 2500 }, ASSETS).timeline;
    tl = apply(tl, { type: "update_clip", clipId: a.id, patch: { transition: { kind: "zoom", ms: 500 }, fx: [{ id: "vhs", amount: 0.5 }] } }, ASSETS).timeline;
    const third = mainTrack(tl)!.clips.find((x) => x.assetId === "v2")!;
    void c;
    tl = apply(tl, { type: "trim_clip", clipId: third.id, edge: "end", to: third.start + 4000 }, ASSETS).timeline;
    tl = apply(tl, { type: "add_text", at: 3000, body: "عنواني", duration: 1500 }, ASSETS).timeline;
    tl = apply(tl, { type: "set_markers", markers: [0, 500, 1000, 1500, 2000], mode: "replace" }, ASSETS).timeline;
    return tl;
  }

  it("«احفظ كقالب»: the main track's clips become slots with their lengths and looks, the texts are tied to their slot", () => {
    const tpl = templateFromTimeline(project(), ASSETS, "قالب التجربة");
    expect(tpl.name).toBe("قالب التجربة");
    expect(tpl.ratio).toBe("4:5");
    expect(tpl.slots.map((s) => [s.ms, s.kind])).toEqual([
      [2500, "video"],
      [3000, "image"],
      [4000, "video"],
    ]);
    expect(tpl.slots[0].transition).toEqual({ kind: "zoom", ms: 500 });
    expect(tpl.slots[0].fx).toEqual(["vhs"]);
    expect(tpl.texts.map((x) => [x.body, x.slot, x.at, x.ms])).toEqual([["عنواني", 1, 500, 1500]]);
    expect(tpl.bpm).toBe(120);
    // it fills and builds like a ready one
    const b = buildTemplate(tpl, autoFill(tpl, FILES).fills, ASSETS);
    expect(mainTrack(b.timeline)!.clips.map((c) => clipLength(c))).toEqual([2500, 3000, 4000]);
    expect(mainTrack(b.timeline)!.clips[0].transition).toEqual({ kind: "zoom", ms: 500 });
  });

  it("refuses a project with nothing on the main track", () => {
    expect(() => templateFromTimeline(emptyTimeline(), ASSETS, "x")).toThrow();
  });

  it("reads a stored template safely: what doesn't exist is dropped, numbers kept in bounds", () => {
    const t = readTemplate({
      name: "x".repeat(100),
      ratio: "3:2",
      slots: [{ ms: 5, fx: ["nope", "vhs"], transition: { kind: "nope", ms: 1 }, label: "" }, { ms: 10_000_000, anim: "words" }, "junk"],
      texts: [{ slot: 9, body: "مرحبا", style: { color: "red", size: 3, weight: 800, font: "nope" }, y: 7 }, { body: "" }],
      look: "nope",
      bpm: 999,
      captions: "karaoke",
    })!;
    expect(t.name.length).toBe(TEMPLATE_LIMITS.name);
    expect(t.ratio).toBe("9:16");
    expect(t.slots.map((s) => s.ms)).toEqual([TEMPLATE_LIMITS.minSlotMs, TEMPLATE_LIMITS.maxSlotMs]);
    expect(t.slots[0].fx).toEqual(["vhs"]);
    expect(t.slots[0].transition).toBeUndefined();
    expect(t.slots[1].anim).toBeUndefined(); // a text entrance isn't a picture's
    expect(t.texts).toEqual([expect.objectContaining({ slot: 1, body: "مرحبا", y: 0.95, style: { size: 0.4 } })]);
    expect(t.look).toBeNull();
    expect(t.bpm).toBe(240);
    expect(t.captions).toBe("karaoke");
    expect(readTemplate({ slots: [] })).toBeNull();
    expect(readTemplate("nope")).toBeNull();
  });
});
