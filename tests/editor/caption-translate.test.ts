import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { apply } from "@/lib/editor/commands";
import { emptyTimeline, LIMITS } from "@/lib/editor/model";
import { captionLines, captionTracks, readLines, spreadWords, translatedLines, translatedStyle, translateUnits, TRANSLATE_LANGS, type CaptionLine } from "@/lib/editor/caption-translate";
import { toSRT } from "@/components/jawad/editor/captions";
import { LIMITS as PRICES } from "@/lib/film/limits";
import { lib } from "./helpers";

const lines: CaptionLine[] = [
  { start: 0, end: 1200, body: "السلام عليكم", words: [{ s: 0, e: 500, w: "السلام" }, { s: 520, e: 1100, w: "عليكم" }] },
  { start: 1200, end: 3000, body: "اليوم نتكلم عن المونتاج", words: [{ s: 100, e: 400, w: "اليوم" }, { s: 420, e: 800, w: "نتكلم" }, { s: 820, e: 1000, w: "عن" }, { s: 1020, e: 1700, w: "المونتاج" }] },
  { start: 3500, end: 5000, body: "تابعونا" },
];

describe("«ترجم الكابشن»", () => {
  it("offers English and Arabic first, and a short list after them", () => {
    expect(TRANSLATE_LANGS.slice(0, 2).map((l) => l.id)).toEqual(["en", "ar"]);
    expect(TRANSLATE_LANGS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(TRANSLATE_LANGS.map((l) => l.id)).size).toBe(TRANSLATE_LANGS.length);
  });

  it("keeps the number of lines and every line's start and end", () => {
    const out = translatedLines(lines, ["Peace be upon you", "Today we talk about editing", "Follow us"]);
    expect(out.length).toBe(lines.length);
    out.forEach((l, i) => {
      expect(l.start).toBe(lines[i].start);
      expect(l.end).toBe(lines[i].end);
    });
    expect(out.map((l) => l.body)).toEqual(["Peace be upon you", "Today we talk about editing", "Follow us"]);
    // a line left empty by the translator keeps its own text (nothing disappears from the video)
    expect(translatedLines(lines, ["Hello", "", "Follow"])[1].body).toBe(lines[1].body);
  });

  it("spreads a word-lit line's new words over its spoken time, in order, inside the line", () => {
    const out = translatedLines(lines, ["Peace be upon you", "Today we talk about editing", "Follow us"]);
    const w = out[1].words!;
    expect(w.map((x) => x.w)).toEqual(["Today", "we", "talk", "about", "editing"]);
    expect(w[0].s).toBe(100);
    expect(w[w.length - 1].e).toBe(1700);
    for (let i = 1; i < w.length; i++) expect(w[i].s).toBeGreaterThanOrEqual(w[i - 1].s);
    for (const x of w) expect(x.e).toBeGreaterThan(x.s);
    // a line without word timing gets none
    expect(out[2].words).toBeUndefined();
    expect(spreadWords("a b", undefined, 1000)).toEqual([]);
    expect(translatedStyle(out)).toBe("karaoke");
  });

  it("goes on the timeline as a new caption track on the same times, and downloads as its own SRT", () => {
    const assets = lib();
    let t = apply(emptyTimeline("9:16"), { type: "add_captions", items: lines, style: "karaoke", name: "كابشن" }, assets).timeline;
    const src = captionTracks(t)[0];
    const got = captionLines(t, src.id);
    expect(got.map((l) => [l.start, l.end, l.body])).toEqual(lines.map((l) => [l.start, l.end, l.body]));
    const tr = translatedLines(got, ["Peace be upon you", "Today we talk about editing", "Follow us"]);
    t = apply(t, { type: "add_captions", items: tr, style: translatedStyle(tr), name: "كابشن · English" }, assets).timeline;
    const tracks = captionTracks(t);
    expect(tracks.length).toBe(2);
    const en = tracks.find((x) => x.name.includes("English"))!;
    expect(en.clips.map((c) => [c.start, c.start + (c.out - c.in)])).toEqual(lines.map((l) => [l.start, l.end]));
    const srt = toSRT(t, en.id);
    expect(srt).toContain("Today we talk about editing");
    expect(srt).not.toContain("السلام");
    expect(srt).toContain("00:00:01,200 --> 00:00:03,000");
  });

  it("reads the page's lines safely and prices per started 50 lines", () => {
    expect(readLines([{ start: 0, end: 10, body: " hi " }])).toEqual([{ start: 0, end: 10, body: "hi" }]);
    expect(readLines([{ start: 10, end: 5, body: "x" }])).toBeNull();
    expect(readLines([])).toBeNull();
    expect(readLines("x")).toBeNull();
    expect([1, 50, 51, 120].map(translateUnits)).toEqual([1, 1, 2, 3]);
    expect(PRICES.editor_price_translate.default).toBeGreaterThan(0);
    expect(LIMITS.words).toBeGreaterThan(0);
  });

  it("shows the price before translating, asks again when it went up, and gives the coins back on a failure", () => {
    const panel = readFileSync("src/components/jawad/editor/CaptionsPanel.tsx", "utf8");
    expect(panel).toContain("translateQuote(projectId, lines, toLang)");
    expect(panel).toContain("<Riyal halalas={ask}");
    expect(panel).toContain("أكّد وترجم");
    expect(panel).toContain('track("editor.caption_translate")');
    const server = readFileSync("src/lib/editor/translate.ts", "utf8");
    expect(server).toContain("if (b.quote) return { coins, lines: lines.length };");
    expect(server).toContain('code: "price_changed"');
    // charged() holds the coins and releases them when the call throws
    expect(server).toContain('charged(who, "editor_price_translate"');
    // the language is a per-message fact: in turnNote, never in the system
    expect(server).toContain("turnNote: `Target language:");
    expect(server).not.toMatch(/system: `[^`]*\$\{/);
    expect(readFileSync("src/app/api/jawad/editor/projects/[id]/route.ts", "utf8")).toContain('case "translate_captions"');
  });
});
