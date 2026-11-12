import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LIMITS as PRICES } from "@/lib/film/limits";
import { FEATURES } from "@config/feature-use";
import { apply, applyAll } from "@/lib/editor/commands";
import { emptyTimeline, timelineTime, type Timeline } from "@/lib/editor/model";
import type { TWord } from "@/lib/editor/transcript";
import {
  fitLength,
  LEAD_MS,
  placeRange,
  planMoments,
  readCount,
  readKeptMoments,
  readLengths,
  readMoments,
  searchForm,
  searchSpeech,
  sentenceLines,
  sentences,
  SENTENCE_MAX_MS,
  shortCommands,
  shortsUnits,
  snapRange,
  TAIL_MS,
  whereOnTimeline,
  wordsInShort,
} from "@/lib/editor/shorts";
import { lib, main, sound, video } from "./helpers";

/**
 * Sentences of `n` words each, a word every 500 ms (400 ms long), the last word of each with a full stop and a 1 s
 * pause after it. Returns the words and where each sentence starts.
 */
function talk(sentenceCount: number, n = 10, from = 0) {
  const words: TWord[] = [];
  let at = from;
  for (let k = 0; k < sentenceCount; k++) {
    for (let i = 0; i < n; i++) {
      words.push({ s: at, e: at + 400, w: i === n - 1 ? `s${k}w${i}.` : `s${k}w${i}` });
      at += 500;
    }
    at += 1000;
  }
  return words;
}

/** Is `ms` inside a word (not in a pause)? */
const insideWord = (words: TWord[], ms: number) => words.some((w) => ms > w.s && ms < w.e);

describe("sentences", () => {
  it("ends a sentence at a full stop or a long pause", () => {
    const words = talk(3);
    const s = sentences(words);
    expect(s.map((x) => [x.a, x.b])).toEqual([
      [0, 9],
      [10, 19],
      [20, 29],
    ]);
    expect(s.every((x) => x.strong)).toBe(true);
    // a pause alone (no punctuation) also ends one; a question mark in Arabic too
    const q: TWord[] = [
      { s: 0, e: 300, w: "ليش" },
      { s: 400, e: 700, w: "كذا؟" },
      { s: 800, e: 1100, w: "لأن" },
      { s: 2100, e: 2400, w: "خلاص" },
    ];
    expect(sentences(q).map((x) => [x.a, x.b])).toEqual([
      [0, 1],
      [2, 2],
      [3, 3],
    ]);
  });

  it("splits a very long sentence at its best breath, not anywhere", () => {
    // 80 words with no full stop, every pause 100 ms except a 400 ms breath after word 30
    const words: TWord[] = [];
    let at = 0;
    for (let i = 0; i < 80; i++) {
      words.push({ s: at, e: at + 300, w: `w${i}` });
      at += i === 30 ? 700 : 400;
    }
    const s = sentences(words);
    expect(s[0]).toMatchObject({ a: 0, b: 30, strong: false });
    expect(s.every((x) => x.e - x.s <= SENTENCE_MAX_MS + 400)).toBe(true);
    expect(s[s.length - 1].b).toBe(79);
  });

  it("lists the sentences numbered for Claude, with their start and length", () => {
    const words = talk(2);
    const lines = sentenceLines(words, sentences(words)).split("\n");
    expect(lines[0]).toMatch(/^\[0\] 0:00 \(5s\) s0w0 /);
    expect(lines[1]).toMatch(/^\[1\] 0:06 /);
  });
});

describe("snapping to the pauses", () => {
  it("starts and ends in the pause around the words, never inside one", () => {
    const words = talk(4);
    const r = snapRange(words, 10, 19);
    expect(r.s).toBe(words[10].s - LEAD_MS);
    expect(r.e).toBe(words[19].e + TAIL_MS);
    expect(insideWord(words, r.s)).toBe(false);
    expect(insideWord(words, r.e)).toBe(false);
    // tight neighbours: the breath stops where the next/previous word is
    const tight: TWord[] = [
      { s: 0, e: 400, w: "a" },
      { s: 450, e: 800, w: "b." },
      { s: 850, e: 1200, w: "c" },
    ];
    expect(snapRange(tight, 1, 1)).toEqual({ s: 450 - 50, e: 850 });
    // the file's first word: never before 0; its last: never past the file
    expect(snapRange(tight, 0, 2, 1300)).toEqual({ s: 0, e: 1300 });
  });
});

describe("fitting to the length range", () => {
  const words = talk(20); // each sentence ≈ 4.9 s of speech + 1 s pause
  const sents = sentences(words);

  it("keeps a moment inside the range and on sentence edges", () => {
    const f = fitLength(words, sents, 2, 5, 15_000, 30_000)!;
    expect(f.e - f.s).toBeGreaterThanOrEqual(15_000);
    expect(f.e - f.s).toBeLessThanOrEqual(30_000);
    expect(sents.some((x) => x.a === f.a)).toBe(true);
    expect(sents.some((x) => x.b === f.b)).toBe(true);
    expect(insideWord(words, f.s) || insideWord(words, f.e)).toBe(false);
  });

  it("drops sentences from the end when too long (the opening is the hook)", () => {
    const f = fitLength(words, sents, 3, 15, 10_000, 20_000)!;
    expect(f.a).toBe(sents[3].a);
    expect(f.e - f.s).toBeLessThanOrEqual(20_000);
  });

  it("takes the next sentences when too short, or the ones before at the file's end", () => {
    const f = fitLength(words, sents, 4, 4, 15_000, 60_000)!;
    expect(f.a).toBe(sents[4].a);
    expect(f.e - f.s).toBeGreaterThanOrEqual(15_000);
    const end = fitLength(words, sents, 19, 19, 15_000, 60_000)!;
    expect(end.b).toBe(sents[19].b);
    expect(end.a).toBeLessThan(sents[19].a);
  });

  it("cuts one sentence longer than the most between two words", () => {
    const long: TWord[] = Array.from({ length: 60 }, (_, i) => ({ s: i * 500, e: i * 500 + 400, w: i === 59 ? "end." : `w${i}` }));
    const s = sentences(long);
    const f = fitLength(long, s, 0, s.length - 1, 5000, 10_000)!;
    expect(f.e - f.s).toBeLessThanOrEqual(10_000);
    expect(f.e - f.s).toBeGreaterThanOrEqual(5000);
    expect(insideWord(long, f.e)).toBe(false);
  });

  it("gives up when the file can't make it long enough", () => {
    expect(fitLength(talk(1), sentences(talk(1)), 0, 0, 30_000, 60_000)).toBeNull();
    expect(fitLength([], [], 0, 0, 1000, 2000)).toBeNull();
  });

  it("reads the range the person asked, kept sensible", () => {
    expect(readLengths(15, 90)).toEqual({ min: 15, max: 90 });
    expect(readLengths(90, 15)).toEqual({ min: 15, max: 90 });
    expect(readLengths(1, 999)).toEqual({ min: 5, max: 180 });
    expect(readLengths(30, 31)).toEqual({ min: 30, max: 35 });
    expect(readLengths("x", null)).toEqual({ min: 15, max: 90 });
    expect(readCount(1)).toBe(3);
    expect(readCount(50)).toBe(10);
    expect(readCount(undefined)).toBe(6);
    expect(shortsUnits(0)).toBe(1);
    expect(shortsUnits(10 * 60_000)).toBe(1);
    expect(shortsUnits(10 * 60_000 + 1)).toBe(2);
  });
});

describe("what Claude sends back", () => {
  const ok = { from: 2, to: 4, title: " عنوان  قوي ", score: 77.6, reasons: [{ kind: "hook", text: "يبدأ بسؤال" }, { kind: "pace", text: "سريع" }], tip: "حط نص هوك" };

  it("keeps a well-formed moment, tidied", () => {
    expect(readMoments({ clips: [ok] }, 10)).toEqual([{ from: 2, to: 4, title: "عنوان قوي", score: 78, reasons: ok.reasons, tip: "حط نص هوك" }]);
  });

  it("swaps a backwards range and clamps the score to 0–99", () => {
    const [m] = readMoments({ clips: [{ ...ok, from: 5, to: 1, score: 140 }] }, 10);
    expect(m).toMatchObject({ from: 1, to: 5, score: 99 });
    expect(readMoments({ clips: [{ ...ok, score: -3 }] }, 10)[0].score).toBe(0);
  });

  it("drops what can't be read (never guessed)", () => {
    const bad = [
      { ...ok, to: 10 }, // past the last sentence
      { ...ok, from: 1.5 },
      { ...ok, score: "عالي" },
      { ...ok, score: null },
      { ...ok, title: "  " },
      { ...ok, reasons: [{ kind: "virality", text: "x" }] },
      null,
      "clip",
    ];
    expect(readMoments({ clips: bad }, 10)).toEqual([]);
    expect(readMoments(null, 10)).toEqual([]);
    expect(readMoments({ clips: "x" }, 10)).toEqual([]);
  });

  it("keeps at most three reasons of the known kinds", () => {
    const many = [
      { kind: "hook", text: "a" },
      { kind: "nope", text: "b" },
      { kind: "complete", text: "" },
      { kind: "value", text: "c" },
      { kind: "pace", text: "d" },
      { kind: "complete", text: "e" },
    ];
    expect(readMoments({ clips: [{ ...ok, reasons: many }] }, 10)[0].reasons.map((r) => r.text)).toEqual(["a", "c", "d"]);
  });

  it("plans the clips: fitted, overlaps dropped, the best first, no more than asked", () => {
    const words = talk(30);
    const sents = sentences(words);
    const raw = readMoments(
      {
        clips: [
          { ...ok, from: 0, to: 3, score: 60, title: "أ" },
          { ...ok, from: 1, to: 4, score: 90, title: "ب" }, // overlaps «أ» and is better
          { ...ok, from: 10, to: 13, score: 70, title: "ج" },
          { ...ok, from: 20, to: 23, score: 50, title: "د" },
        ],
      },
      sents.length,
    );
    const plan = planMoments(raw, words, sents, { assetId: "a", minMs: 15_000, maxMs: 30_000, count: 2 });
    expect(plan.map((m) => m.title)).toEqual(["ب", "ج"]);
    for (const m of plan) {
      expect(m.e - m.s).toBeGreaterThanOrEqual(15_000);
      expect(m.e - m.s).toBeLessThanOrEqual(30_000);
      expect(insideWord(words, m.s) || insideWord(words, m.e)).toBe(false);
      expect(m.text.length).toBeGreaterThan(0);
    }
    // kept moments read back from the file's record
    expect(readKeptMoments(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
    expect(readKeptMoments([{ assetId: "a", s: 5, e: 1 }, "x"])).toEqual([]);
  });
});

describe("«ابحث في مقاطعك»", () => {
  const w = (s: number, text: string): TWord => ({ s, e: s + 400, w: text });

  it("treats the letter forms as one and drops diacritics", () => {
    expect(searchForm("أَحْمَد")).toBe("احمد");
    expect(searchForm("إسلام")).toBe(searchForm("اسلام"));
    expect(searchForm("آمنة")).toBe("امنه");
    expect(searchForm("مدرسة")).toBe(searchForm("مدرسه"));
    expect(searchForm("على")).toBe(searchForm("علي"));
    expect(searchForm("مسؤول")).toBe("مسوول");
    expect(searchForm("شيء،")).toBe("شيء");
    expect(searchForm("Hello!")).toBe("hello");
  });

  const speech = {
    a: { words: [w(0, "السلام"), w(500, "عليكم."), w(2000, "اليوم"), w(2500, "نتكلم"), w(3000, "عن"), w(3500, "الصلاة.")] },
    b: { words: [w(0, "الصلاه"), w(500, "عمود"), w(1000, "الدين."), w(3000, "وأهمية"), w(3500, "الصلاة"), w(4000, "كبيرة.")] },
    c: { words: [] },
  };

  it("finds every place across the files, partial words and letter forms included", () => {
    const hits = searchSpeech(speech, "صلاة");
    expect(hits.map((h) => [h.assetId, h.at])).toEqual([
      ["a", 3500],
      ["b", 0],
      ["b", 3500],
    ]);
    // the file order asked comes first
    expect(searchSpeech(speech, "صلاة", { order: ["b"] })[0].assetId).toBe("b");
  });

  it("matches words that follow one another, and gives the whole sentence to place", () => {
    const [h] = searchSpeech(speech, "عمود دين");
    expect(h).toMatchObject({ assetId: "b", a: 1, b: 2, match: "عمود الدين." });
    expect(h.before).toBe("الصلاه");
    // the sentence «الصلاه عمود الدين.»: from the pause before its first word to the breath after its last
    expect(h.s).toBe(0);
    expect(h.e).toBe(1400 + TAIL_MS);
    expect(searchSpeech(speech, "الدين عمود")).toEqual([]);
  });

  it("needs at least two letters and keeps to the limit", () => {
    expect(searchSpeech(speech, "ا")).toEqual([]);
    expect(searchSpeech(speech, "  ")).toEqual([]);
    expect(searchSpeech(speech, "ال", { limit: 2 })).toHaveLength(2);
  });
});

describe("on the timeline", () => {
  const assets = lib(video("a", 600_000), sound("p", 600_000), video("b", 5000));

  it("«سوّه مقطع»: a new 9:16 timeline holding just the moment, captions and all, the original untouched", () => {
    const base = applyAll(emptyTimeline("16:9"), [{ type: "add_clip", assetId: "a" }], assets).timeline;
    const cap = [{ start: 0, end: 1500, body: "مرحبا", words: [{ s: 0, e: 400, w: "مرحبا" }] }];
    const r = applyAll(base, shortCommands({ assetId: "a", s: 61_000, e: 92_500, title: "أقوى لحظة" }, { ratio: "9:16", captions: cap, style: "pop2" }), assets);
    const t = r.timeline;
    expect(t.height).toBeGreaterThan(t.width);
    expect(main(t).clips).toHaveLength(1);
    expect(main(t).clips[0]).toMatchObject({ assetId: "a", start: 0, in: 61_000, out: 92_500, speed: 1 });
    expect(t.tracks.find((x) => x.kind === "text")?.clips[0].text?.body).toBe("مرحبا");
    expect(t.seqs?.find((s) => !s.tl)?.name).toBe("أقوى لحظة");
    // the old timeline is kept as it was (wide, the whole file)
    const parked = t.seqs!.find((s) => s.tl)!.tl as Timeline;
    expect(parked.width).toBeGreaterThan(parked.height);
    expect(main(parked).clips[0]).toMatchObject({ in: 0, out: 600_000 });
  });

  it("a sound file's moment goes on a sound track", () => {
    const t = applyAll(emptyTimeline("9:16"), shortCommands({ assetId: "p", s: 1000, e: 20_000, title: "بودكاست" }), assets).timeline;
    const audio = t.tracks.find((x) => x.kind === "audio" && x.clips.length)!;
    expect(audio.clips[0]).toMatchObject({ assetId: "p", in: 1000, out: 20_000, start: 0 });
  });

  it("«ضيفه» puts the part at the playhead", () => {
    const base = applyAll(emptyTimeline("9:16"), [{ type: "add_clip", assetId: "b" }, { type: "add_clip", assetId: "b" }], assets).timeline;
    const t = apply(base, placeRange("a", 3000, 7000, 5000), assets).timeline;
    const clips = main(t).clips;
    expect(clips.map((c) => [c.assetId, c.start, c.in, c.out])).toEqual([
      ["b", 0, 0, 5000],
      ["a", 5000, 3000, 7000],
      ["b", 9000, 0, 5000],
    ]);
  });

  it("finds where the open timeline plays a file's moment, speed and trims followed", () => {
    let t = applyAll(emptyTimeline("9:16"), [{ type: "add_clip", assetId: "b" }, { type: "add_clip", assetId: "a" }], assets).timeline;
    const id = main(t).clips[1].id;
    t = apply(t, { type: "trim_clip", clipId: id, edge: "start", to: 7000 }, assets).timeline; // its first 2 s gone
    t = apply(t, { type: "update_clip", clipId: id, patch: { speed: 2 } }, assets).timeline;
    const c = main(t).clips.find((x) => x.id === id)!;
    expect(c.in).toBe(2000);
    expect(whereOnTimeline(t, "a", 12_000)).toBe(Math.round(timelineTime(c, 12_000)));
    expect(whereOnTimeline(t, "a", 12_000)).toBe(c.start + 5000);
    expect(whereOnTimeline(t, "a", 1000)).toBeNull(); // trimmed away
    expect(whereOnTimeline(t, "zzz", 0)).toBeNull();
  });

  it("times the file's words inside the short", () => {
    const words: TWord[] = [
      { s: 900, e: 1300, w: "قبل" },
      { s: 2000, e: 2400, w: "أول" },
      { s: 2500, e: 3200, w: "آخر" },
    ];
    expect(wordsInShort(words, 1500, 3000)).toEqual([
      { s: 500, e: 900, w: "أول" },
      { s: 1000, e: 1500, w: "آخر" },
    ]);
  });
});

describe("the price and the wiring", () => {
  it("shows the price first, asks again when it went up, gives the coins back, and keeps per-call facts out of the system", () => {
    expect(PRICES.editor_price_shorts.default).toBeGreaterThan(0);
    const server = readFileSync("src/lib/editor/shorts-find.ts", "utf8");
    expect(server).toContain("if (b.quote) return");
    expect(server).toContain('code: "price_changed"');
    expect(server).toContain('charged(who, "editor_price_shorts"');
    expect(server).toContain("turnNote: `");
    expect(server).not.toMatch(/system: `[^`]*\$\{/);
    expect(server).not.toMatch(/const SYSTEM = `[^`]*\$\{/);
    const route = readFileSync("src/app/api/jawad/editor/projects/[id]/route.ts", "utf8");
    expect(route).toContain('case "shorts"');
    expect(route).toMatch(/AI_ACTIONS = new Set\(\[[^\]]*"shorts"/);
    const panel = readFileSync("src/components/jawad/editor/ShortsPanel.tsx", "utf8");
    expect(panel).toContain("تقدير");
    expect(panel).toContain("expectedCoins: quote.coins");
    for (const id of ["editor.shorts_find", "editor.shorts_make", "editor.speech_search", "editor.speech_search_add"]) {
      expect(FEATURES.some((f) => f.id === id && f.section === "editor"), id).toBe(true);
      expect(panel).toContain(`track("${id}")`);
    }
  });
});
