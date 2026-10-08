import { describe, expect, it } from "vitest";
import { applyAll } from "@/lib/editor/commands";
import { animAt, emptyTimeline, type Ratio } from "@/lib/editor/model";
import { MAJED_SKILL } from "@/lib/editor/majed";
import { MOTION_SKILL } from "@/lib/editor/motion";
import { BOUNCY, brandPalette, contrast, IN, layoutMotion, lintMotion, lintPlaced, motionCommands, PALETTES, readStoryboard, STAGGER_MS, storyboardNumbers, westernDigits } from "@/lib/editor/motion-build";

// 100 pieces in «أسلوب ماجد الزعابي»: written as حيدرة writes them (a JSON string, Eastern digits, brand colours
// that don't always read, kinetic hooks), then held to Majed's rules on top of the layout check.
const WORDS = "خلاص قصّ السكتات وخل الكابشن يطلع بوقته والرقم يخبط على الكلمة والحركة لها سبب دايم بدون ارتداد ولا توهج".split(" ");
const pick = (seed: number, n: number) => Array.from({ length: n }, (_, i) => WORDS[(seed * 5 + i * 3) % WORDS.length]).join(" ");
const RATIOS: Ratio[] = ["9:16", "16:9", "1:1", "4:5"];
const KINDS = ["kinetic", "stat", "points", "steps", "compare", "statement", "quote", "title", "outro"] as const;
// brand colours, some of them unreadable as given (dark on dark, light on light, a pale accent)
const BRANDS = [
  { bg: "#0b0b0b", text: "#222222", accent: "#ff3b30" },
  { bg: "#ffffff", text: "#f0f0f0", accent: "#ffe000" },
  { bg: "#123524", text: "#e8f5e9", accent: "#2e7d32" },
  { bg: "#f6e7c1", accent: "#c79a3b" },
  { bg: "#3a0ca3", text: "#ffffff", accent: "#4361ee" },
  { bg: "#c1121f", text: "#fdf0d5", accent: "#003049" },
];
const VALUES = ["٧٠٪", "963007", "١٠٠ دينار", "٣×", "+٤٠٠", "1,250,000"];

function raw(i: number) {
  const beats = Array.from({ length: 3 + (i % 6) }, (_, k) => {
    const kind = KINDS[(i + k) % KINDS.length];
    return {
      kind,
      words: pick(i + k, 2 + ((i + k) % 5)).split(" "),
      hot: (i + k) % 3,
      title: pick(i + k, 1 + (i % 6)),
      text: pick(i * 3 + k, 3 + ((i + k) % 11)),
      items: Array.from({ length: 2 + ((i + k) % 4) }, (_, j) => pick(i + j + k, 2 + ((i + j) % 5))),
      value: VALUES[(i + k) % VALUES.length],
      label: pick(i + 2 * k, 2 + (i % 3)),
      by: "ماجد",
      left: { title: pick(k, 1 + (i % 2)), text: pick(i + k + 1, 3 + (i % 7)) },
      right: { title: pick(k + 1, 1 + (i % 2)), text: pick(i + k + 2, 3 + (i % 7)) },
      handle: "@majed_alzaabi_",
    };
  });
  return JSON.stringify({ palette: PALETTES[i % 5].id, ...(i % 2 ? { colors: BRANDS[i % BRANDS.length] } : {}), head: ["cairo", "changa", "almarai"][i % 3], body: "tajawal", at: (i % 3) * 1000, beats });
}

describe("«أسلوب ماجد الزعابي»: 100 pieces follow his rules", () => {
  for (let i = 0; i < 100; i++) {
    const ratio = RATIOS[i % RATIOS.length];
    it(`piece ${i + 1} (${ratio}${i % 2 ? ", brand colours" : `, ${PALETTES[i % 5].id}`})`, () => {
      const sb = readStoryboard(raw(i))!;
      expect(sb).not.toBeNull();
      const tl = emptyTimeline(ratio);
      const { placed, palette } = layoutMotion(sb, tl.width, tl.height);
      // the layout check + Majed's: no bounce, fast entrances, faster exits, ≥ 0.6 s readable, the hook moving at once, 0–9
      expect(lintPlaced(placed, tl.width, tl.height, palette.bg, { startMs: sb.at })).toEqual([]);
      for (const p of placed) {
        expect(BOUNCY.has(p.anim.in)).toBe(false);
        expect(p.anim.inMs).toBeLessThanOrEqual(300);
        expect(p.anim.outMs).toBeLessThan(p.anim.inMs);
        expect(p.body).not.toMatch(/[٠-٩]/);
      }
      // the brand's colours are kept as the background and made readable
      if (sb.colors) {
        expect(palette.bg).toBe(sb.colors.bg!.toLowerCase());
        // 7 where the background allows it (a mid-tone brand colour reaches only so far with white or black)
        const best = Math.max(contrast("#ffffff", palette.bg), contrast("#111111", palette.bg));
        expect(contrast(palette.text, palette.bg)).toBeGreaterThanOrEqual(Math.min(7, best) - 0.01);
        expect(contrast(palette.accent, palette.bg)).toBeGreaterThanOrEqual(4.5);
      }
      // texts of a beat that enter together follow each other 30–80 ms apart (lists and kinetic words land one by one)
      const firsts = new Map<number, number[]>();
      for (const p of placed) firsts.set(p.beat, [...(firsts.get(p.beat) ?? []), p.start]);
      for (const starts of firsts.values()) {
        const gaps = starts.slice(1).map((s, j) => s - starts[j]).filter((g) => g > 0 && g < 200);
        for (const g of gaps) {
          expect(g).toBeGreaterThanOrEqual(30);
          expect(g).toBeLessThanOrEqual(80);
        }
      }
      // the commands run, and the timeline passes the same check (the hand-placed lint knows the anims too)
      const { commands } = motionCommands(sb, tl.width, tl.height);
      const out = applyAll(tl, commands, new Map()).timeline;
      expect(lintMotion(out)).toEqual([]);
    });
  }
});

describe("the rules themselves", () => {
  it("found by looking at the frames: a long number keeps its label, and the hot word is the biggest", () => {
    const sb = readStoryboard({ beats: [{ kind: "stat", value: "963007", label: "مشاهدة من ريل واحد", text: "بدون برنامج مونتاج" }, { kind: "kinetic", words: ["نقول", "وداعاً", "لتعديل"], hot: 1 }] })!;
    for (const [W, H] of [[1080, 1920], [1920, 1080]]) {
      const { placed } = layoutMotion(sb, W, H);
      expect(placed.filter((p) => p.beat === 0).map((p) => p.role)).toEqual(["value", "sub", "cap"]);
      const kin = placed.filter((p) => p.beat === 1);
      const hot = kin.find((p) => p.body === "وداعاً")!;
      expect(hot.box).not.toBeNull();
      for (const p of kin) expect(hot.size).toBeGreaterThanOrEqual(p.size);
    }
  });
  it("«settle» never bounces and never grows from zero", () => {
    const c = { anim: { in: "settle" as const, out: "fade" as const, inMs: 280, outMs: 170 }, start: 0, in: 0, out: 3000, speed: 1 };
    for (let t = 0; t <= 280; t += 10) {
      const l = animAt(c, t);
      expect(l.scale).toBeGreaterThanOrEqual(0.94);
      expect(l.scale).toBeLessThanOrEqual(1);
    }
    expect(IN.settle.in).toBe("settle");
    expect(STAGGER_MS).toBeGreaterThanOrEqual(30);
    expect(STAGGER_MS).toBeLessThanOrEqual(80);
  });
  it("the hand-placed lint catches a bounce, a slow entrance, a slow exit and a flash of text", () => {
    const tl = emptyTimeline("9:16");
    const out = applyAll(tl, [
      { type: "add_text", at: 0, body: "رقم", duration: 3000 },
      { type: "update_clip", clipId: "$1", patch: { text: { size: 0.08, color: "#ffffff" }, transform: { x: 0.5, y: 0.3 }, anim: { in: "pop", out: "fade", inMs: 700, outMs: 900 } } },
      { type: "add_text", at: 0, body: "ومضة", duration: 500 },
      { type: "update_clip", clipId: "$3", patch: { text: { size: 0.06, color: "#ffffff" }, transform: { x: 0.5, y: 0.6 }, anim: { in: "fade", out: "fade", inMs: 200, outMs: 100 } } },
    ], new Map()).timeline;
    const kinds = lintMotion(out).map((x) => x.kind);
    for (const k of ["bounce", "slow_entrance", "slow_exit", "short_hold"]) expect(kinds).toContain(k);
  });
  it("Western digits, unless asked", () => {
    expect(westernDigits("٧٠٪ من ١٠٠")).toBe("70٪ من 100");
    expect(readStoryboard({ beats: [{ kind: "stat", value: "٧٠٪" }] })!.beats[0].value).toBe("70٪");
    expect(readStoryboard({ digits: "arabic", beats: [{ kind: "stat", value: "٧٠٪" }] })!.beats[0].value).toBe("٧٠٪");
  });
  it("brand colours: kept, and fixed only where they would not read", () => {
    const p = brandPalette({ bg: "#000000", text: "#111111", accent: "#222222" })!;
    expect(p.bg).toBe("#000000");
    expect(contrast(p.text, p.bg)).toBeGreaterThanOrEqual(7);
    expect(contrast(p.accent, p.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.pillText, p.pill)).toBeGreaterThanOrEqual(4.5);
    expect(brandPalette({ bg: "#ffffff", accent: "#c8102e" })!.accent).toBe("#c8102e");
    expect(brandPalette({ bg: "red" })).toBeNull();
  });
  it("the facts list: every number on screen, and the ones the person never said", () => {
    const sb = readStoryboard({ beats: [{ kind: "stat", value: "٧٠٪", label: "من المشاهدين" }, { kind: "statement", text: "زادت 963,007 مشاهدة في 3 أيام" }] })!;
    const f = storyboardNumbers(sb, "ريلي جاب 963007 مشاهدة وسبعين بالمية كملوه");
    expect(f.all).toEqual(["70", "963007", "3"]);
    expect(f.unsourced).toEqual(["70", "3"]);
  });
  it("حيدرة learns it: the skill carries Majed's rules and the engine's means", () => {
    for (const w of ["MAJED ALZAABI", "settle", "kinetic", "colors", "Western digits", "FACTS LIST", "15 sound events", "fully diacritized", "never typed from memory", "opacity 0 for 4–8 s"]) expect(MAJED_SKILL).toContain(w);
    for (const w of ["\"kind\":\"kinetic\"", "\"colors\"", "settle"]) expect(MOTION_SKILL).toContain(w);
  });
});
