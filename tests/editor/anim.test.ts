import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { FONT_BY_ID, FONT_LIST, fontFile, isFont } from "@/lib/editor/fonts";
import { animAt, emptyTimeline, kashida, readAnim, readTimeline } from "@/lib/editor/model";
import { lib, main, video } from "./helpers";

const assets = lib(video("v", 4000));

describe("entrances and exits", () => {
  const t = applyAll(emptyTimeline(), [{ type: "add_clip", assetId: "v" }, { type: "update_clip", clipId: "$1", patch: { anim: { in: "fade", inMs: 400, out: "rise", outMs: 500 } } }], assets).timeline;
  const c = main(t).clips[0];

  it("come in from nothing and settle", () => {
    expect(animAt(c, 0).alpha).toBe(0);
    expect(animAt(c, 200).alpha).toBeGreaterThan(0.5);
    expect(animAt(c, 1000)).toMatchObject({ alpha: 1, dx: 0, dy: 0, scale: 1 });
  });

  it("go out at the end (rising out of sight)", () => {
    expect(animAt(c, 3990).dy).toBeLessThan(-0.05);
    expect(animAt(c, 3999).alpha).toBeLessThan(0.1);
  });

  it("«كين بيرنز» pushes in slowly over the whole clip", () => {
    const k = apply(t, { type: "update_clip", clipId: c.id, patch: { anim: { in: "kenburns", out: null } } }, assets).timeline;
    const kc = main(k).clips[0];
    expect(animAt(kc, 0).scale).toBeCloseTo(1);
    expect(animAt(kc, 2000).scale).toBeCloseTo(1.075, 2);
    expect(animAt(kc, 4000).scale).toBeCloseTo(1.15, 2);
  });

  it("keep word-by-word and kashida for texts, Ken Burns for pictures", () => {
    expect(readAnim({ in: "words", out: "kashida" }, false)).toBeNull();
    expect(readAnim({ in: "words", out: "kashida" }, true)).toMatchObject({ in: "words", out: "kashida", inMs: 900, outMs: 650 });
    expect(readAnim({ in: "kenburns" }, true)).toBeNull();
    expect(readAnim({ in: "pop", inMs: 99999 }, false)?.inMs).toBe(3000);
  });

  it("are removed from a sound track's clips when read", () => {
    const raw = JSON.parse(JSON.stringify(t));
    raw.tracks[1].clips.push({ ...raw.tracks[0].clips[0], id: "s1" });
    expect(readTimeline(raw).tracks[1].clips[0].anim).toBeNull();
  });
});

describe("kashida", () => {
  it("stretches between joined letters only", () => {
    expect(kashida("كبير", 1)).toBe("كـبـيـر");
    expect(kashida("دار", 2)).toBe("دار");
    expect(kashida("سلام عليكم", 1)).toBe("سـلـام عـلـيـكـم");
    expect(kashida("abc", 3)).toBe("abc");
  });
});

describe("the font catalogue", () => {
  it("has 100 fonts with files, and the page's own three", () => {
    expect(FONT_LIST).toHaveLength(100);
    expect(new Set(FONT_LIST.map((f) => f.id)).size).toBe(100);
    expect(FONT_LIST.every((f) => Object.values(f.files).every((u) => /^https:\/\/cdn\.jsdelivr\.net\//.test(u!)))).toBe(true);
    expect(isFont("readex") && isFont("cairo") && !isFont("comic-sans")).toBe(true);
  });

  it("serves the nearest weight there is", () => {
    const f = FONT_BY_ID.get("cairo")!;
    expect(fontFile(f, 900).weight).toBe(Math.max(...Object.keys(f.files).map(Number)));
    const one = FONT_LIST.find((x) => Object.keys(x.files).length === 1)!;
    expect(fontFile(one, 700).url).toBe(Object.values(one.files)[0]);
  });

  it("keeps a known font and drops an unknown one", () => {
    const t = apply(emptyTimeline(), { type: "add_text", at: 0, body: "سلام" }, assets).timeline;
    const id = t.tracks.find((x) => x.kind === "text")!.clips[0].id;
    const raw = JSON.parse(JSON.stringify(apply(t, { type: "update_clip", clipId: id, patch: { text: { font: "lalezar" } } }, assets).timeline));
    expect(readTimeline(raw).tracks.find((x) => x.kind === "text")!.clips[0].text!.font).toBe("lalezar");
    raw.tracks.find((x: { kind: string }) => x.kind === "text").clips[0].text.font = "evil";
    expect(readTimeline(raw).tracks.find((x) => x.kind === "text")!.clips[0].text!.font).toBe("readex");
  });
});
