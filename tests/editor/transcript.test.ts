import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { emptyTimeline, type Timeline } from "@/lib/editor/model";
import { fillers, isFiller, keysBetween, lineAt, mergeTranscripts, needsListening, paragraphs, rangesFor, readingOrder, TAIL_MS, wordKey, type AssetSpeech, type TWord } from "@/lib/editor/transcript";
import { lib, main, video } from "./helpers";

// a file «a» with a word every 500 ms (each 400 ms long): w0 at 0, w1 at 500, …
const words = (n: number, from = 0, text = (i: number) => `w${i}`): TWord[] => Array.from({ length: n }, (_, i) => ({ s: from + i * 500, e: from + i * 500 + 400, w: text(i) }));
const assets = lib(video("a", 10_000), video("b", 6000));
const speech = (a: TWord[], b: TWord[] = []): Record<string, AssetSpeech> => ({ a: { words: a, spans: [[0, 10_000]] }, b: { words: b, spans: [[0, 6000]] } });
const two = (): Timeline => applyAll(emptyTimeline("9:16"), [{ type: "add_clip", assetId: "a" }, { type: "add_clip", assetId: "b" }], assets).timeline;
const keysOf = (ws: string[], lines: ReturnType<typeof readingOrder>) => new Set(lines.filter((l) => ws.includes(l.w)).map((l) => l.key));

describe("the reading order", () => {
  it("lists the words of every heard clip at their place on the timeline", () => {
    const lines = readingOrder(two(), speech(words(20), words(3, 0, (i) => `b${i}`)));
    expect(lines.map((l) => l.w).slice(18)).toEqual(["w18", "w19", "b0", "b1", "b2"]);
    // b's words start where its clip starts (after a's 10 s)
    expect(lines.find((l) => l.w === "b1")).toMatchObject({ from: 10_500, to: 10_900 });
  });

  it("lists a word heard twice at one moment (a video and its own sound) once", () => {
    const base = applyAll(emptyTimeline("9:16"), [{ type: "add_clip", assetId: "a" }], assets).timeline;
    const id = main(base).clips[0].id;
    const ex = apply(base, { type: "extract_audio", clipId: id }, assets).timeline;
    // the video goes quiet when its sound is taken out: still every word once
    expect(readingOrder(ex, speech(words(4))).map((l) => l.w)).toEqual(["w0", "w1", "w2", "w3"]);
    // both heard (volume back up): still once
    const loud = apply(ex, { type: "update_clip", clipId: id, patch: { volume: 1 } }, assets).timeline;
    expect(readingOrder(loud, speech(words(4))).map((l) => l.w)).toEqual(["w0", "w1", "w2", "w3"]);
  });

  it("finds the word under the playhead", () => {
    const lines = readingOrder(two(), speech(words(20)));
    expect(lines[lineAt(lines, 1250)].w).toBe("w2");
    expect(lineAt(lines, 1450)).toBe(2); // in the pause just after it, it stays lit
    expect(lineAt(lines, 60_000)).toBe(-1);
  });
});

describe("chosen words → timeline spans", () => {
  it("takes a word with a short breath after it", () => {
    const lines = readingOrder(two(), speech(words(20)));
    expect(rangesFor(lines, keysOf(["w3"], lines))).toEqual([[1500, 1900 + Math.min(100, TAIL_MS)]]);
  });

  it("merges words next to each other into one span (the pauses between them go too)", () => {
    const lines = readingOrder(two(), speech(words(20)));
    expect(rangesFor(lines, keysOf(["w3", "w4", "w5"], lines))).toEqual([[1500, 3000]]);
    // two runs apart stay two spans
    expect(rangesFor(lines, keysOf(["w1", "w6"], lines))).toEqual([
      [500, 1000],
      [3000, 3500],
    ]);
  });

  it("works across clips: the end of one and the start of the next", () => {
    const lines = readingOrder(two(), speech(words(20), words(4, 0, (i) => `b${i}`)));
    // w19 is the last word of «a» (9500–9900), b0 the first of «b» (10000–10400): one span over the cut
    expect(rangesFor(lines, keysOf(["w19", "b0"], lines))).toEqual([[9500, 10_500]]);
  });

  it("maps through an earlier cut (the words after it moved back)", () => {
    const t0 = two();
    const s = speech(words(20));
    const lines0 = readingOrder(t0, s);
    const first = rangesFor(lines0, keysOf(["w2", "w3"], lines0));
    expect(first).toEqual([[1000, 2000]]);
    const t1 = apply(t0, { type: "remove_ranges", ranges: first }, assets).timeline;
    const lines1 = readingOrder(t1, s);
    expect(lines1.map((l) => l.w).slice(0, 4)).toEqual(["w0", "w1", "w4", "w5"]);
    // w10 was at 5000; one second came out before it
    expect(lines1.find((l) => l.w === "w10")).toMatchObject({ from: 4000 });
    expect(rangesFor(lines1, keysOf(["w10"], lines1))).toEqual([[4000, 4500]]);
    // and cutting it really cuts the right second of the file
    const t2 = apply(t1, { type: "remove_ranges", ranges: rangesFor(lines1, keysOf(["w10"], lines1)) }, assets).timeline;
    expect(readingOrder(t2, s).map((l) => l.w)).not.toContain("w10");
    expect(readingOrder(t2, s).map((l) => l.w)).toContain("w11");
  });

  it("shows cut words struck through where they were until they come back", () => {
    const t0 = two();
    const s = speech(words(8));
    const lines0 = readingOrder(t0, s);
    const gone = keysOf(["w2", "w3"], lines0);
    const t1 = apply(t0, { type: "remove_ranges", ranges: rangesFor(lines0, gone) }, assets).timeline;
    const lines1 = readingOrder(t1, s, gone);
    expect(lines1.map((l) => (l.clipId ? l.w : `~${l.w}`))).toEqual(["w0", "w1", "~w2", "~w3", "w4", "w5", "w6", "w7"]);
    // struck words are never cut again and never chosen by a range
    expect(rangesFor(lines1, gone)).toEqual([]);
    expect(keysBetween(lines1, lines1[1].key, lines1[4].key)).toEqual([lines1[1].key, lines1[4].key]);
    // an undo (the old timeline back): they are plain words again
    expect(readingOrder(t0, s, gone).every((l) => l.clipId)).toBe(true);
  });
});

describe("«شيل الحشو»", () => {
  const w = (s: number, e: number, word: string): TWord => ({ s, e, w: word });

  it("always takes hesitation sounds, in Arabic and English", () => {
    for (const x of ["اممم", "امم", "إممم", "ممم", "آآ", "اااا", "آآه", "um", "Umm", "uh", "uhh", "erm", "hmm", "اممم،"]) expect(isFiller(w(0, 300, x), null, null), x).toBe(true);
  });

  it("never takes real words that look close", () => {
    for (const x of ["أم", "أمه", "ام", "مم", "أمم", "مما", "اه", "أهم", "يعنيه", "human", "under", "مما"]) expect(isFiller(w(1000, 1300, x), w(0, 990, "قال"), w(1310, 1600, "شي")), x).toBe(false);
  });

  it("takes «يعني» only when it stands alone", () => {
    // in the flow of a sentence: kept
    expect(isFiller(w(1000, 1300, "يعني"), w(0, 950, "هذا"), w(1350, 1700, "مهم"))).toBe(false);
    // a pause on both sides: filler
    expect(isFiller(w(1000, 1300, "يعني"), w(0, 600, "هذا"), w(1800, 2100, "مهم"))).toBe(true);
    // a comma after the word before and after itself
    expect(isFiller(w(1000, 1300, "يعني،"), w(0, 950, "طيب،"), w(1350, 1700, "مهم"))).toBe(true);
    // said twice: the first one
    expect(isFiller(w(1000, 1300, "يعني"), w(0, 950, "هذا"), w(1350, 1700, "يعني"))).toBe(true);
    // a pause on one side only: kept
    expect(isFiller(w(1000, 1300, "يعني"), w(0, 600, "هذا"), w(1350, 1700, "مهم"))).toBe(false);
  });

  it("finds them in the reading order", () => {
    const ws = [w(0, 400, "قال"), w(500, 900, "اممم"), w(1000, 1400, "إنه"), w(2000, 2300, "يعني"), w(2800, 3200, "جاي"), w(3300, 3600, "يعني"), w(3650, 4000, "بكرة")];
    const lines = readingOrder(two(), speech(ws));
    expect(fillers(lines).map((k) => lines.find((l) => l.key === k)!.w)).toEqual(["اممم", "يعني"]);
  });
});

describe("kept transcripts", () => {
  it("merges several parts of a file into one list, the longer transcript winning", () => {
    const m = mergeTranscripts({ "0-3000-ar": [{ s: 0, e: 400, w: "واحد" }, { s: 500, e: 900, w: "اثنين" }, { s: 1000, e: 1400, w: "ثلاثة" }], "800-5000-ar": [{ s: 820, e: 1300, w: "ثلاث" }, { s: 4000, e: 4400, w: "أربعة" }], bad: [{ s: NaN, e: 1, w: "x" }] as TWord[] });
    expect(m.words.map((x) => x.w)).toEqual(["واحد", "اثنين", "ثلاثة", "أربعة"]);
    expect(m.spans).toEqual([[0, 5000]]);
  });

  it("knows which clips still need listening to", () => {
    expect(needsListening([[0, 5000]], { in: 1000, out: 4000 })).toBe(false);
    expect(needsListening([[0, 2000]], { in: 1000, out: 4000 })).toBe(true);
    expect(needsListening(undefined, { in: 0, out: 100 })).toBe(true);
  });

  it("starts a new paragraph after a long pause", () => {
    const ws = [...words(3), ...words(2, 5000)];
    expect(paragraphs(readingOrder(two(), speech(ws))).map((p) => p.length)).toEqual([3, 2]);
  });

  it("names a word by its file and start", () => {
    expect(wordKey("a", 1500.4)).toBe("a:1500");
  });
});
