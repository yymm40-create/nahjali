import { describe, expect, it } from "vitest";
import { applyAll, type Command } from "@/lib/editor/commands";
import { clipEnd, emptyTimeline, mainTrack, transformAt, type AssetInfo, type Ratio, type Timeline } from "@/lib/editor/model";
import { lintMotion } from "@/lib/editor/motion-build";
import { MOTION_STYLES, styleInText } from "@/lib/editor/motion-styles";
import { BRANDS, boxTransform, faceOnFrame, readFace, readTalk, talkArt, talkCommands, talkLayout, type FaceBox, type TalkPlan } from "@/lib/editor/talk-motion";

const RATIOS: Ratio[] = ["9:16", "16:9", "1:1", "4:5"];
const VIDEO: AssetInfo = { id: "a-video", kind: "video", durationMs: 40_000, width: 1080, height: 1920, hasAudio: true };

function talking(ratio: Ratio): Timeline {
  let tl = emptyTimeline(ratio);
  tl = applyAll(tl, [{ type: "add_clip", assetId: VIDEO.id }], new Map([[VIDEO.id, VIDEO]])).timeline;
  const caps: Command[] = [];
  for (let s = 0; s < 40_000; s += 2000) caps.push({ type: "add_text", at: s, body: "كلام الكابشن هنا", duration: 1900 });
  return applyAll(tl, caps, new Map([[VIDEO.id, VIDEO]])).timeline;
}

const KINDS = ["word", "emoji", "brand", "stat", "pin", "word"] as const;
function plan(i: number, layout: TalkPlan["layout"], face: FaceBox | null): TalkPlan {
  const n = 3 + (i % 8);
  const cues = Array.from({ length: n }, (_, j) => ({
    kind: KINDS[(i + j) % KINDS.length],
    at: 600 + j * Math.round(36_000 / n),
    text: ["تاكسي", "الرياض", "انستقرام", "مليون", "قهوة الصباح", "الشغل"][(i + j) % 6],
    emoji: ["🚕", "☕", "📱"][(i + j) % 3],
    brand: BRANDS[(i + j) % BRANDS.length],
    to: "الرياض",
    value: `${(i + j) % 90}%`,
  }));
  const p = readTalk(JSON.stringify({ palette: ["studio", "night", "majlis"][i % 3], layout, cues }), 40_000)!;
  return { ...p, face };
}
const FACES: FaceBox[] = [
  { x: 0.5, y: 0.32, w: 0.34, h: 0.2 },
  { x: 0.5, y: 0.62, w: 0.4, h: 0.24 },
  { x: 0.32, y: 0.4, w: 0.22, h: 0.3 },
  { x: 0.7, y: 0.45, w: 0.2, h: 0.3 },
];
const overlaps = (a: { x: number; y: number; w: number; h: number }, b: FaceBox) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;

describe("«فوق كلامي ثلاثي الأبعاد»: the person stays full, the cues float in 3D off the face", () => {
  for (let i = 0; i < 48; i++) {
    const ratio = RATIOS[i % RATIOS.length];
    const face = FACES[i % FACES.length];
    it(`video ${i + 1} (${ratio}, face at ${face.x},${face.y})`, () => {
      const tl = talking(ratio);
      const p = plan(i, "over3d", face);
      const art = talkArt(p, tl.width, tl.height);
      const ids = new Map(art.map((a) => [a.key, `img-${a.key}`]));
      const infos = new Map<string, AssetInfo>([[VIDEO.id, VIDEO], ...art.map((a): [string, AssetInfo] => [`img-${a.key}`, { id: `img-${a.key}`, kind: "image", durationMs: null, width: a.w, height: a.h }])]);
      // every word and number gets its slab, every app its 3D tile (real SVG)
      const words = p.cues.filter((c) => c.kind === "word" || c.kind === "stat").length;
      expect(art.filter((a) => a.key.startsWith("slab-")).length).toBe(words);
      for (const a of art) expect(a.svg.startsWith("<svg")).toBe(true);
      const { commands, windows } = talkCommands(p, tl, 0, ids);
      expect(windows).toEqual([]);
      const out = applyAll(tl, commands, infos).timeline;
      // the person never shrinks
      const main = mainTrack(out)!;
      for (const c of main.clips) expect(transformAt(c, c.start + 5000).scale).toBeCloseTo(1, 3);
      // the new pictures and texts flip in, and none sits on the face
      const before = new Set(tl.tracks.flatMap((t) => t.clips.map((c) => c.id)));
      const fresh = out.tracks.flatMap((t) => t.clips.filter((c) => !before.has(c.id)));
      expect(fresh.filter((c) => !c.text).every((c) => c.anim?.in === "flip")).toBe(true);
      const L = talkLayout(out.width, out.height, face, "over3d");
      const tall = out.height >= out.width;
      // a face that leaves room above/below (tall) or beside (wide): the cue area keeps off it
      void tall;
      expect(overlaps(L.area, { ...face, w: face.w - 0.01, h: face.h - 0.01 })).toBe(false);
      // the texts read: no overlaps (among them or with the captions), inside the frame (the words on a slab or a
      // tile read on it, not on the frame's background, so contrast is the slab's)
      expect(lintMotion(out, new Set(fresh.filter((c) => c.text).map((c) => c.id))).filter((x) => x.kind !== "contrast")).toEqual([]);
    });
  }
});

describe("«المربع الصغير»: the box follows the face", () => {
  it("puts the face at the box's centre while small", () => {
    for (const ratio of RATIOS) {
      const tl = talking(ratio);
      for (const face of FACES) {
        const p = plan(3, "shrink", face);
        const { commands, windows } = talkCommands(p, tl, 0);
        const out = applyAll(tl, commands, new Map([[VIDEO.id, VIDEO]])).timeline;
        const L = talkLayout(out.width, out.height, face, "shrink");
        const main = mainTrack(out)!;
        for (const w of windows) {
          const mid = Math.round((w.start + w.end) / 2);
          const piece = main.clips.find((c) => c.start <= mid && clipEnd(c) > mid)!;
          const t = transformAt(piece, mid);
          const want = boxTransform({ x: 0.5, y: 0.5, scale: 1, rotate: 0, opacity: 1 }, L.box, face);
          expect(t.x).toBeCloseTo(want.x, 3);
          expect(t.y).toBeCloseTo(want.y, 3);
          // where the face lands: the box's centre (unless kept inside the frame)
          const fx = t.x + (face.x - 0.5) * L.box.scale;
          if (want.x > 0.08 && want.x < 0.92) expect(fx).toBeCloseTo(L.box.x, 3);
        }
      }
    }
  });

  it("a wide video in a tall frame is moved so the face is in view, and no edge shows", () => {
    // a 16:9 video (cover) in 9:16: only its middle third shows; the face is on the right
    const r = faceOnFrame({ x: 0.5, y: 0.5, scale: 1 }, "cover", 1920, 1080, 1080, 1920, { x: 0.78, y: 0.4, w: 0.12, h: 0.2 });
    expect(r.moved).toBe(true);
    expect(r.face.x).toBeGreaterThan(0.3);
    expect(r.face.x).toBeLessThan(0.7);
    // the picture still covers the frame: its edges are outside
    const dw = (1920 * (1920 / 1080)) / 1080;
    expect(r.x - dw / 2).toBeLessThanOrEqual(0.0001);
    expect(r.x + dw / 2).toBeGreaterThanOrEqual(0.9999);
    // a face already in the middle: nothing moves
    expect(faceOnFrame({ x: 0.5, y: 0.5, scale: 1 }, "cover", 1080, 1920, 1080, 1920, { x: 0.5, y: 0.35, w: 0.3, h: 0.18 }).moved).toBe(false);
  });
});

describe("the names and the inputs", () => {
  it("knows both talking-video skills by name", () => {
    expect(styleInText("ركّب موشن على كلامي بمهارة «المربع الصغير»")?.talk).toBe("shrink");
    expect(styleInText("ابي فوق كلامي ثلاثي الأبعاد")?.talk).toBe("over3d");
    expect(styleInText("ابيه ثري دي على كلامي")?.talk).toBe("over3d");
    expect(MOTION_STYLES.filter((s) => s.talk).map((s) => s.ar)).toEqual(["المربع الصغير", "فوق كلامي ثلاثي الأبعاد"]);
  });
  it("reads the 3D layout and checks the face from the page", () => {
    expect(readTalk({ layout: "over3d", cues: [{ kind: "word", at: 100, text: "كلمة" }] }, 5000)!.layout).toBe("over3d");
    expect(readFace({ x: 0.5, y: 0.4, w: 0.3, h: 0.2 })).toEqual({ x: 0.5, y: 0.4, w: 0.3, h: 0.2 });
    expect(readFace({ x: 2, y: 0.4, w: 0.3, h: 0.2 })).toBeNull();
    expect(readFace("face")).toBeNull();
  });
});
