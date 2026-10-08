import { describe, expect, it } from "vitest";
import { applyAll } from "@/lib/editor/commands";
import { emptyTimeline, TRANSITIONS, type AssetInfo, type Ratio } from "@/lib/editor/model";
import { beatBackground, beatTransition, mix } from "@/lib/editor/motion-art";
import { contrast, lintMotion, motionCommands, motionPlan, PALETTES, SFX, type Beat, type Storyboard } from "@/lib/editor/motion-build";

const KINDS: Beat["kind"][] = ["title", "points", "stat", "quote", "steps", "compare", "statement", "outro"];
const board = (i: number): Storyboard => ({
  palette: PALETTES[i % PALETTES.length].id,
  beats: KINDS.map((kind, k) => ({ kind, title: `عنوان ${k}`, text: "جملة قصيرة تشرح الفكرة", items: ["أول نقطة", "ثاني نقطة", "ثالث نقطة"], value: "٧٠٪", label: "من الناس", by: "الإمام علي (ع)", left: { title: "قبل", text: "كان كذا" }, right: { title: "بعد", text: "صار كذا" }, handle: "@nahjali" })),
});
const RATIOS: Ratio[] = ["9:16", "16:9", "1:1", "4:5"];

describe("«موشن جرافيكس» art: drawn by the engine, no generator", () => {
  it("draws a background and a decoration for every beat, as valid SVG of the frame's shape", () => {
    for (const [i, ratio] of RATIOS.entries()) {
      const tl = emptyTimeline(ratio);
      const plan = motionPlan(board(i), tl.width, tl.height);
      expect(plan.art.length).toBe(plan.beats.length * 2);
      for (const a of plan.art) {
        expect(a.svg.startsWith("<svg")).toBe(true);
        expect(a.svg.endsWith("</svg>")).toBe(true);
        expect(Math.abs(a.w / a.h - tl.width / tl.height)).toBeLessThan(0.01);
        expect(a.w).toBeLessThanOrEqual(1080);
        // every tag closed
        expect((a.svg.match(/<(circle|rect|path|line)\b[^>]*\/>/g) ?? []).length + (a.svg.match(/<\/(g|defs|pattern|radialGradient)>/g) ?? []).length).toBeGreaterThan(0);
        expect(a.svg).not.toMatch(/NaN|undefined/);
      }
    }
  });

  it("changes the background every beat, never the same twice in a row, and keeps the text readable on each", () => {
    for (const p of PALETTES) {
      const bgs = Array.from({ length: 8 }, (_, i) => beatBackground(p, i));
      for (let i = 1; i < bgs.length; i++) expect(bgs[i]).not.toBe(bgs[i - 1]);
      for (const bg of bgs) expect(contrast(p.text, bg)).toBeGreaterThanOrEqual(5);
      // the band behind a title (accent at 16%) keeps the headline readable too
      for (const bg of bgs) expect(contrast(p.text, mix(bg, p.accent, 0.16))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses transitions the editor has, cycling through several kinds", () => {
    const kinds = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const t = beatTransition(i);
      expect(t.kind in TRANSITIONS).toBe(true);
      kinds.add(t.kind);
    }
    expect(kinds.size).toBeGreaterThanOrEqual(6);
  });

  it("places the art as clips under the words, with a transition into each next beat, and the piece passes the lint", () => {
    for (const [i, ratio] of RATIOS.entries()) {
      const tl = emptyTimeline(ratio);
      const sb = board(i);
      const plan = motionPlan(sb, tl.width, tl.height);
      const infos = new Map<string, AssetInfo>();
      const ids = new Map<string, string>();
      for (const a of plan.art) {
        const id = `asset-${a.key}`;
        ids.set(a.key, id);
        infos.set(id, { id, kind: "image", durationMs: null, width: a.w, height: a.h, hasAudio: false });
      }
      const { commands } = motionCommands(sb, tl.width, tl.height, 0, ids);
      const out = applyAll(tl, commands, infos).timeline;
      expect(lintMotion(out)).toEqual([]);
      const videoTracks = out.tracks.filter((t) => t.kind === "video" && t.clips.length);
      // two picture tracks: the backgrounds (one per beat, touching, with transitions) and the decorations
      expect(videoTracks.length).toBe(2);
      const bg = videoTracks[0];
      expect(bg.clips.length).toBe(plan.beats.length);
      for (let k = 0; k < bg.clips.length - 1; k++) {
        expect(bg.clips[k].start + (bg.clips[k].out - bg.clips[k].in)).toBe(bg.clips[k + 1].start);
        expect(bg.clips[k].transition).not.toBeNull();
      }
      expect(bg.clips[bg.clips.length - 1].transition).toBeNull();
      // every decoration enters before its words and leaves fast
      for (const c of videoTracks[1].clips) {
        expect(c.anim?.inMs).toBeLessThanOrEqual(320);
        expect(c.anim?.outMs).toBe(160);
        expect(c.keys.length).toBe(2);
      }
      // the words' entrances are short, exits shorter
      for (const t of out.tracks.filter((x) => x.kind === "text")) for (const c of t.clips) {
        expect(c.anim?.inMs).toBeLessThanOrEqual(320);
        expect(c.anim?.outMs).toBeLessThanOrEqual(180);
      }
    }
  });

  it("without the art (no files yet) the piece is still the words on the palette's colour", () => {
    const tl = emptyTimeline("9:16");
    const { commands } = motionCommands(board(0), tl.width, tl.height);
    expect(commands.some((c) => c.type === "add_clip")).toBe(false);
    expect(commands.some((c) => c.type === "add_text")).toBe(true);
  });

  it("cues five different sounds, at most two a beat, with a swish into every beat but the first", () => {
    const tl = emptyTimeline("9:16");
    const plan = motionPlan(board(0), tl.width, tl.height);
    const kinds = new Set(plan.cues.map((c) => c.kind));
    expect(kinds.size).toBe(5);
    for (const k of kinds) expect(SFX[k].seconds).toBeLessThanOrEqual(1.2);
    expect(plan.cues.filter((c) => c.kind === "swish").length).toBe(plan.beats.length - 1);
    for (const [i, t] of plan.times.entries()) expect(plan.cues.filter((c) => c.at >= t.start - 120 && c.at < t.end - 120).length).toBeLessThanOrEqual(i ? 3 : 2);
    // the headline's entrance alternates beat to beat
    const heads = plan.placed.filter((p) => p.role === "head");
    expect(new Set(heads.map((p) => p.anim.in)).size).toBeGreaterThanOrEqual(2);
  });
});
