import { describe, expect, it } from "vitest";
import { applyAll, type Command } from "@/lib/editor/commands";
import { clipEnd, emptyTimeline, mainTrack, transformAt, type AssetInfo, type Ratio, type Timeline } from "@/lib/editor/model";
import { lintMotion } from "@/lib/editor/motion-build";
import { BRANDS, cueTimes, readTalk, talkArt, talkCommands, talkLayout, windowsOf, type TalkPlan } from "@/lib/editor/talk-motion";

// a talking video of 40 s, cut into pieces like after «قص السكتات», with captions every 2 s — then 100 plans on it
const RATIOS: Ratio[] = ["9:16", "16:9", "1:1", "4:5"];
const VIDEO: AssetInfo = { id: "a-video", kind: "video", durationMs: 40_000, width: 1080, height: 1920, hasAudio: true };
const ART = ["brand-instagram", "brand-tiktok", "brand-youtube", "brand-x", "brand-snapchat", "brand-whatsapp", "brand-facebook", "brand-telegram", "brand-linkedin", "brand-threads", "route", "pin"];
const infos = new Map<string, AssetInfo>([[VIDEO.id, VIDEO], ...ART.map((k): [string, AssetInfo] => [`img-${k}`, { id: `img-${k}`, kind: "image", durationMs: null, width: 400, height: 400 }])]);
const artIds = new Map(ART.map((k) => [k, `img-${k}`]));

function talkingTimeline(ratio: Ratio, cuts: number): Timeline {
  let tl = emptyTimeline(ratio);
  tl = applyAll(tl, [{ type: "add_clip", assetId: VIDEO.id }], infos).timeline;
  // the silence cuts: the video in pieces
  const at = Array.from({ length: cuts }, (_, i) => Math.round(((i + 1) * 40_000) / (cuts + 1)));
  for (const t of at) tl = applyAll(tl, [{ type: "split", at: t }], infos).timeline;
  const caps: Command[] = [];
  for (let s = 0; s < 40_000; s += 2000) caps.push({ type: "add_text", at: s, body: "كلام الكابشن هنا", duration: 1900 });
  return applyAll(tl, caps, infos).timeline;
}

const KINDS = ["word", "emoji", "brand", "route", "pin", "stat"] as const;
function plan(i: number): TalkPlan {
  const n = 3 + (i % 9);
  const cues = Array.from({ length: n }, (_, j) => {
    const kind = KINDS[(i + j) % KINDS.length];
    const at = 600 + j * Math.round(36_000 / n) + ((i * 37 + j * 91) % 700);
    return { kind, at, text: ["تاكسي", "الرياض", "انستقرام", "مليون", "قهوة", "الشغل"][(i + j) % 6], emoji: ["🚕", "☕", "📱", "✈️"][(i + j) % 4], brand: BRANDS[(i + j) % BRANDS.length], from: j % 2 ? "الكويت" : undefined, to: "الرياض", value: `${(i + j) % 90}%` };
  });
  return readTalk(JSON.stringify({ palette: ["studio", "night", "majlis", "paper", "riso"][i % 5], layout: i % 7 === 0 ? "over" : "shrink", cues }), 40_000)!;
}

describe("«موشن على كلامه»: 100 talking videos", () => {
  for (let i = 0; i < 100; i++) {
    const ratio = RATIOS[i % RATIOS.length];
    it(`video ${i + 1} (${ratio}, ${1 + (i % 6)} silence cuts)`, () => {
      const tl = talkingTimeline(ratio, i % 6);
      const p = plan(i);
      expect(p).not.toBeNull();
      const { commands, sounds, windows } = talkCommands(p, tl, 0, artIds);
      const out = applyAll(tl, commands, infos).timeline;
      const L = talkLayout(out.width, out.height);
      const main = mainTrack(out)!;
      // the person: small in the box in the middle of every window, full again 0.5 s after it
      for (const w of windows) {
        const mid = Math.round((w.start + w.end) / 2);
        const piece = main.clips.find((c) => c.start <= mid && clipEnd(c) > mid);
        if (piece) {
          const t = transformAt(piece, mid);
          expect(t.scale).toBeCloseTo(L.box.scale, 2);
          expect(t.y).toBeCloseTo(L.box.y, 2);
        }
        const after = w.end + 500;
        const next = main.clips.find((c) => c.start <= after && clipEnd(c) > after);
        if (next && !windows.some((x) => x.start - 320 <= after && after <= x.end + 320)) expect(transformAt(next, after).scale).toBeCloseTo(1, 2);
      }
      if (p.layout === "over") expect(windows).toEqual([]);
      // the cue texts: no overlaps, inside the frame's safe area, readable, no bounce
      const before = new Set(tl.tracks.flatMap((t) => t.clips.map((c) => c.id)));
      const fresh = new Set(out.tracks.flatMap((t) => t.clips.filter((c) => c.text && !before.has(c.id)).map((c) => c.id)));
      expect(lintMotion(out, fresh)).toEqual([]);
      // the captions said during a window sit above the box, never on the face
      const box = { top: L.box.y - L.box.scale / 2, bottom: L.box.y + L.box.scale / 2 };
      for (const tr of out.tracks) for (const c of tr.clips) if (before.has(c.id) && c.text && windows.some((w) => c.start < w.end && clipEnd(c) > w.start)) expect(c.transform.y < box.top || c.transform.y > box.bottom).toBe(true);
      // sounds: at most 15 in any minute
      for (const a of sounds) expect(sounds.filter((b) => b.at >= a.at && b.at < a.at + 60_000).length).toBeLessThanOrEqual(15);
    });
  }
});

describe("the cues themselves", () => {
  it("reads حيدرة's cues and drops what can't be shown", () => {
    expect(readTalk("nope", 10_000)).toBeNull();
    const p = readTalk({ cues: [{ kind: "brand", at: 1000, brand: "Instagram" }, { kind: "brand", at: 3000, brand: "myspace" }, { kind: "route", at: 3500, to: "الرياض" }, { kind: "word", at: 3900, text: "قريب جدا" }, { kind: "stat", at: 9000 }, { kind: "word", at: 20_000, text: "بعيد" }] }, 10_000)!;
    expect(p.cues.map((c) => c.kind)).toEqual(["brand", "route"]);
    expect(p.cues[0].brand).toBe("instagram");
    expect(p.layout).toBe("shrink");
  });
  it("each cue stays 1.6–3.5 s, and close cues share one shrink", () => {
    const t = cueTimes([{ kind: "word", at: 0, text: "أ" }, { kind: "word", at: 1000, text: "ب" }, { kind: "word", at: 9000, text: "ج" }], 20_000);
    expect(t[0].end - t[0].start).toBeGreaterThanOrEqual(1600);
    expect(t[2].end - t[2].start).toBeLessThanOrEqual(3500);
    expect(windowsOf(t).length).toBe(2);
  });
  it("draws each app's icon and the route once, as real SVG", () => {
    const p = readTalk({ cues: [{ kind: "brand", at: 0, brand: "tiktok" }, { kind: "brand", at: 3000, brand: "tiktok" }, { kind: "route", at: 6000, from: "الكويت", to: "الرياض" }] }, 20_000)!;
    const art = talkArt(p);
    expect(art.map((a) => a.key).sort()).toEqual(["brand-tiktok", "panel-0", "route"]);
    for (const a of art) expect(a.svg).toMatch(/^<svg[\s\S]*<\/svg>$/);
  });
  it("without its picture, a brand cue still shows its name", () => {
    const tl = talkingTimeline("9:16", 0);
    const p = readTalk({ cues: [{ kind: "brand", at: 2000, brand: "youtube", text: "يوتيوب" }] }, 40_000)!;
    const out = applyAll(tl, talkCommands(p, tl, 0, new Map()).commands, infos).timeline;
    expect(out.tracks.flatMap((t) => t.clips).filter((c) => c.text?.body === "يوتيوب").length).toBeGreaterThan(0);
  });
});
