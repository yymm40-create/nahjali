import { describe, expect, it } from "vitest";
import { applyAll } from "@/lib/editor/commands";
import { emptyTimeline, type Ratio } from "@/lib/editor/model";
import { contrast, layoutMotion, lintMotion, lintPlaced, motionCommands, PALETTES, readStoryboard, type Beat, type Storyboard } from "@/lib/editor/motion-build";

// 100 storyboards, from short to very long words, every beat kind, every palette, every frame shape
const WORDS = "الصدقة تطفئ غضب الرب وتدفع البلاء وتزيد الرزق والبركة في المال والعمر والذرية بإذن الله تعالى في كل وقت وحين".split(" ");
const pick = (seed: number, n: number) => Array.from({ length: n }, (_, i) => WORDS[(seed * 7 + i * 3) % WORDS.length]).join(" ");
const RATIOS: Ratio[] = ["9:16", "16:9", "1:1", "4:5"];
const KINDS: Beat["kind"][] = ["title", "points", "stat", "quote", "steps", "compare", "statement", "outro"];

function board(i: number): Storyboard {
  const long = 1 + (i % 5) * 2; // 1…9 words for titles
  const beats: Beat[] = [];
  for (let k = 0; k < 4 + (i % 5); k++) {
    const kind = KINDS[(i + k) % KINDS.length];
    const n = 2 + ((i + k) % 4);
    beats.push({
      kind,
      title: pick(i + k, long),
      text: pick(i * 3 + k, 3 + ((i + k) % 12)),
      items: Array.from({ length: n }, (_, j) => pick(i + j + k, 2 + ((i + j) % 6))),
      value: ["٧٠٪", "1,250,000", "٣×", "+٤٠٠", "١٠ ملايين"][(i + k) % 5],
      label: pick(i + 2 * k, 2 + (i % 4)),
      by: "الإمام علي (ع)",
      left: { title: pick(k, 1 + (i % 3)), text: pick(i + k + 1, 3 + (i % 8)) },
      right: { title: pick(k + 1, 1 + (i % 3)), text: pick(i + k + 2, 3 + (i % 8)) },
      handle: "@nahjali",
    });
  }
  return { palette: PALETTES[i % PALETTES.length].id, head: ["cairo", "tajawal", "almarai", "changa"][i % 4], body: "tajawal", beats };
}

describe("«موشن جرافيكس» engine: 100 pieces come out clean", () => {
  for (let i = 0; i < 100; i++) {
    const ratio = RATIOS[i % RATIOS.length];
    it(`piece ${i + 1} (${ratio}, ${PALETTES[i % PALETTES.length].id})`, () => {
      const tl = emptyTimeline(ratio);
      const sb = board(i);
      const { placed, palette } = layoutMotion(sb, tl.width, tl.height);
      // every beat placed, nothing overlapping, inside the safe area, readable
      expect(new Set(placed.map((p) => p.beat)).size).toBeGreaterThanOrEqual(sb.beats.length);
      expect(lintPlaced(placed, tl.width, tl.height, palette.bg)).toEqual([]);
      // the commands run on a real timeline, and the timeline's texts pass the same check
      const { commands } = motionCommands(sb, tl.width, tl.height);
      const out = applyAll(tl, commands, new Map()).timeline;
      expect(lintMotion(out)).toEqual([]);
      expect(out.background).toBe(palette.bg);
    });
  }
});

describe("palettes and the check itself", () => {
  it("every palette reads well: text ≥ 7, accents ≥ 4.5 on the background", () => {
    for (const p of PALETTES) {
      expect(contrast(p.text, p.bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(p.accent, p.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.second, p.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.pillText, p.pill)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("catches two texts on top of each other, and a dark text on a dark background", () => {
    const tl = emptyTimeline("9:16");
    const out = applyAll(tl, [
      { type: "set_background", color: "#101010" },
      { type: "add_text", at: 0, body: "عنوان كبير جدا", duration: 3000 },
      { type: "update_clip", clipId: "$2", patch: { text: { size: 0.06, color: "#ffffff" }, transform: { x: 0.5, y: 0.5 } } },
      { type: "add_text", at: 500, body: "نص ثاني فوقه", duration: 3000 },
      { type: "update_clip", clipId: "$4", patch: { text: { size: 0.05, color: "#222222" }, transform: { x: 0.5, y: 0.52 } } },
    ], new Map()).timeline;
    const kinds = lintMotion(out).map((x) => x.kind);
    expect(kinds).toContain("overlap");
    expect(kinds).toContain("contrast");
  });
  it("reads حيدرة's storyboard and drops what is malformed", () => {
    expect(readStoryboard("not json")).toBeNull();
    expect(readStoryboard({ beats: [{ kind: "nope" }] })).toBeNull();
    const sb = readStoryboard(JSON.stringify({ palette: "majlis", beats: [{ kind: "title", title: "فضل الصدقة", text: "دقيقة تغيّر يومك" }, { kind: "stat", value: "٧٠٪", label: "من الناس" }] }));
    expect(sb?.beats.length).toBe(2);
    expect(sb?.palette).toBe("majlis");
  });
});
