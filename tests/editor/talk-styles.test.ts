import { describe, expect, it } from "vitest";
import { applyAll } from "@/lib/editor/commands";
import { emptyTimeline, mainTrack, transformAt, type AssetInfo, type Ratio } from "@/lib/editor/model";
import { BOUNCY, lintMotion } from "@/lib/editor/motion-build";
import { frameGeo, frameModes, planFrames, readTalk, talkArt, talkCommands } from "@/lib/editor/talk-motion";
import { TALK_STYLES, contrastOf, inkOn, panelSvg, pickTalkStyle, talkStyleInText } from "@/lib/editor/talk-styles";
import { FONT_LIST } from "@/lib/editor/fonts";

const VIDEO: AssetInfo = { id: "v", kind: "video", durationMs: 30_000, width: 1080, height: 1920, hasAudio: true };

describe("the talking reel's styles", () => {
  it("fourteen looks, each with real fonts, readable ink and no bouncing entrance", () => {
    expect(TALK_STYLES.length).toBe(14);
    const ids = new Set(FONT_LIST.map((f) => f.id));
    for (const s of TALK_STYLES) {
      expect(ids.has(s.title), `${s.id} title font ${s.title}`).toBe(true);
      expect(ids.has(s.body), `${s.id} body font ${s.body}`).toBe(true);
      for (const bg of s.panels) expect(contrastOf(inkOn(bg, s.ink), bg), `${s.id} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      for (const e of [...s.enter, s.panelIn]) expect(BOUNCY.has(e), `${s.id} ${e}`).toBe(false);
      for (let i = 1; i < s.enter.length; i++) expect(s.enter[i]).not.toBe(s.enter[i - 1]);
    }
  });
  it("is found in the person's words, or picked steadily from the reel", () => {
    expect(talkStyleInText("سوّه ستايل دفتر")?.id).toBe("notebook");
    expect(talkStyleInText("أبيه كوميك")?.id).toBe("comic");
    expect(talkStyleInText("نيون")?.id).toBe("neon");
    expect(talkStyleInText("كلام عادي")).toBeNull();
    expect(pickTalkStyle("chalk", "x").id).toBe("chalk");
    expect(pickTalkStyle(undefined, "تاكسي|الرياض").id).toBe(pickTalkStyle("nonsense", "تاكسي|الرياض").id);
  });
  it("draws every style's panel as SVG, with a window when the person shows through", () => {
    for (const s of TALK_STYLES) {
      const plain = panelSvg(s, 540, 960, s.panels[0], 1);
      expect(plain).toMatch(/^<svg[\s\S]*<\/svg>$/);
      const holed = panelSvg(s, 540, 960, s.panels[0], 2, { x: 100, y: 100, w: 200, h: 200, round: true });
      expect(holed).toContain('mask="url(#hole)"');
      expect(holed).toContain("<ellipse");
    }
  });
});

describe("the frames of a reel", () => {
  it("«mix» never repeats a frame twice in a row; «split» alternates halves", () => {
    const m = frameModes("mix", 12);
    for (let i = 1; i < m.length; i++) expect(m[i]).not.toBe(m[i - 1]);
    expect(new Set(m).size).toBeGreaterThanOrEqual(4);
    expect(frameModes("split", 4)).toEqual(["split-top", "split-bottom", "split-top", "split-bottom"]);
    expect(frameModes("corner", 2)).toEqual(["corner", "corner"]);
  });
  it("puts the person's face in its half, in the corner, or punches in on it", () => {
    const face = { x: 0.5, y: 0.38, w: 0.3, h: 0.22 };
    const full = { x: 0.5, y: 0.5, scale: 1, rotate: 0, opacity: 1 };
    const top = frameGeo("split-top", 1080, 1920, face).person(full);
    expect(top.y + (face.y - 0.5)).toBeLessThan(0.5);
    const bottom = frameGeo("split-bottom", 1080, 1920, face).person(full);
    expect(bottom.y).toBeGreaterThan(top.y);
    const corner = frameGeo("corner", 1080, 1920, face);
    expect(corner.person(full).scale).toBeLessThan(0.5);
    expect(corner.panel?.hole?.round).toBe(true);
    const punch = frameGeo("punch", 1080, 1920, face).person(full);
    expect(punch.scale).toBeGreaterThan(1);
    expect(frameGeo("split-top", 1080, 1920).panel?.h).toBe(480);
  });
  for (const [layout, ratio] of [["mix", "9:16"], ["split", "9:16"], ["corner", "9:16"], ["mix", "16:9"], ["mix", "1:1"], ["split", "4:5"]] as const) {
    it(`lays out a ${layout} reel on ${ratio}: panels drawn, person framed, texts clean`, () => {
      const infos = new Map<string, AssetInfo>([[VIDEO.id, VIDEO]]);
      let tl = emptyTimeline(ratio as Ratio);
      tl = applyAll(tl, [{ type: "add_clip", assetId: VIDEO.id }, { type: "split", at: 12_000 }], infos).timeline;
      for (let s = 0; s < 30_000; s += 2000) tl = applyAll(tl, [{ type: "add_text", at: s, body: "كلام الكابشن", duration: 1900 }], infos).timeline;
      const plan = readTalk(JSON.stringify({ layout, style: "comic", cues: [
        { kind: "word", at: 1000, text: "تاكسي" }, { kind: "stat", at: 6000, value: "70%", text: "من الناس" }, { kind: "emoji", at: 11_000, emoji: "☕", text: "قهوة" },
        { kind: "brand", at: 16_000, brand: "instagram", text: "انستقرام" }, { kind: "word", at: 21_000, text: "الرياض" }, { kind: "pin", at: 26_000, to: "جدة" },
      ] }), 30_000)!;
      plan.face = { x: 0.5, y: 0.4, w: 0.3, h: 0.22 };
      const art = talkArt(plan, tl.width, tl.height, 30_000);
      const F = planFrames(plan, tl.width, tl.height, 30_000);
      expect(F.windows.length).toBe(6);
      expect(art.filter((a) => a.key.startsWith("panel-")).length).toBe(F.geos.filter((g) => g.panel).length);
      for (const a of art) {
        infos.set(`img-${a.key}`, { id: `img-${a.key}`, kind: "image", durationMs: null, width: a.w, height: a.h });
      }
      const ids = new Map(art.map((a) => [a.key, `img-${a.key}`]));
      const built = talkCommands(plan, tl, 0, ids);
      const out = applyAll(tl, built.commands, infos).timeline;
      const before = new Set(tl.tracks.flatMap((t) => t.clips.map((c) => c.id)));
      const fresh = new Set(out.tracks.flatMap((t) => t.clips.filter((c) => !before.has(c.id)).map((c) => c.id)));
      expect(lintMotion(out, fresh)).toEqual([]);
      // the person moves for every window and comes back between them
      const main = mainTrack(out)!;
      const w0 = built.windows[0];
      const clip = main.clips.find((c) => c.start <= w0.start && w0.start < c.start + (c.out - c.in) / c.speed)!;
      const during = transformAt(clip, w0.start + 200);
      expect(during.scale !== 1 || Math.abs(during.y - 0.5) > 0.02).toBe(true);
      // the texts use the style's fonts and the entrances vary
      const texts = out.tracks.flatMap((t) => t.clips.filter((c) => c.text && fresh.has(c.id)));
      expect(texts.some((c) => c.text!.font === "lalezar")).toBe(true);
      expect(new Set(texts.map((c) => c.anim?.in)).size).toBeGreaterThanOrEqual(2);
    });
  }
});
