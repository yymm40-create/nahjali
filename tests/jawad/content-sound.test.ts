import { describe, expect, it } from "vitest";
import { sliceNote, splitSound } from "@/lib/content/sound";

const ph = (xs: [number, number][]) => xs.map(([from, to], i) => ({ text: `جملة ${i + 1}`, from, to }));

describe("the person's sound shared by the motion carousel's slides", () => {
  it("cuts only between phrases, in order, with no gap", () => {
    const s = { seconds: 30, phrases: ph([[0, 4], [4.6, 9], [9.5, 14], [14.8, 19], [19.5, 24], [24.6, 29]]) };
    const parts = splitSound(s, 3, 5);
    expect(parts).toHaveLength(3);
    expect(parts[0].from).toBe(0);
    for (let i = 1; i < parts.length; i++) expect(parts[i].from).toBe(parts[i - 1].to);
    // every phrase is said in exactly one slide, whole
    const said = parts.flatMap((p) => p.lines.map((l) => l.text));
    expect(said).toEqual(s.phrases.map((p) => p.text));
    for (const p of parts) for (const l of p.lines) expect(l.to).toBeLessThanOrEqual(p.to - p.from + 0.01);
    expect(parts[2].to).toBeCloseTo(29.6, 1);
  });

  it("gives each slide a phrase when there are as many phrases as slides", () => {
    const parts = splitSound({ seconds: 10, phrases: ph([[0, 2], [2.5, 5], [5.5, 8]]) }, 3, 5);
    expect(parts.map((p) => p.lines.length)).toEqual([1, 1, 1]);
  });

  it("music keeps the planned length, shortened evenly when the sound is short", () => {
    expect(splitSound({ seconds: 60, phrases: [] }, 4, 5).map((p) => [p.from, p.to])).toEqual([[0, 5], [5, 10], [10, 15], [15, 20]]);
    expect(splitSound({ seconds: 12, phrases: [] }, 4, 5).map((p) => p.to - p.from)).toEqual([3, 3, 3, 3]);
  });

  it("tells the scene writer how long the slide is and when each phrase is said", () => {
    const [first] = splitSound({ seconds: 10, phrases: ph([[0.5, 3], [3.5, 6]]) }, 1, 5);
    const note = sliceNote(first, true);
    expect(note).toContain("[0.5–3.0] «جملة 1»");
    expect(note).toContain(`exactly ${(first.to - first.from).toFixed(1)} s`);
  });
});
