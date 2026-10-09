import { describe, expect, it } from "vitest";
import { CONTINUITY_METHOD, EDIT_MODELS, EDIT_SECONDS, checkEditPrompt, editModel, editModelsBrief, editTrainingModels, spans, timingBlock, writeEditPrompt } from "@config/jawad/smart-edit-training";

// The thousand worked edits «جواد» learns «التعديل الذكي» with continuity from: each one's cut is whole seconds
// inside the video and never shorter than the generator's shortest clip, its three spans add up to the cut, the
// timing block carries the exact seconds, the prompt passes the checker, and most mark less than 4 s (the case the
// fill is for).
const models = editTrainingModels();

describe("the bank", () => {
  it("is a thousand, mostly under four seconds, with the method they follow", () => {
    expect(models).toHaveLength(EDIT_MODELS);
    expect(new Set(models.map((m) => m.prompt)).size).toBeGreaterThan(EDIT_MODELS * 0.9);
    const short = models.filter((m) => m.model.marked.to - m.model.marked.from < EDIT_SECONDS.min).length;
    expect(short).toBeGreaterThan(EDIT_MODELS * 0.6);
    expect(CONTINUITY_METHOD).toContain("THE FILL");
    expect(CONTINUITY_METHOD).toContain("continuity only");
    expect(CONTINUITY_METHOD).toContain(`${EDIT_SECONDS.min}-second cut`);
  });
  it("gives the writer the closest worked edits", () => {
    const m = editModel(10, { from: 6.2, to: 7.7 })!;
    const brief = editModelsBrief(m, 2);
    expect(brief).toContain("WORKED EDITS");
    expect((brief.match(/prompt: /g) ?? []).length).toBe(2);
  });
  it("works the owner's own example: 1.5 s marked at 6.2–7.7 becomes a 4-second cut inside the video", () => {
    const m = editModel(10, { from: 6.2, to: 7.7 })!;
    expect(m.cut).toEqual({ start: 5, end: 9, seconds: 4 });
    const s = spans(m);
    expect(s).toMatchObject({ before: 1.2, marked: 1.5, after: 1.3, fill: true });
    expect(timingBlock(m)).toContain("0.0–1.2 s");
    expect(timingBlock(m)).toContain("1.2–2.7 s");
    expect(timingBlock(m)).toContain("2.7–4.0 s");
  });
});

describe.each(models.map((m) => [m.id, m] as const))("%s", (_id, t) => {
  const m = t.model;
  it("cuts whole seconds, at least the shortest clip, inside the video, around what was marked", () => {
    expect(Number.isInteger(m.cut.seconds)).toBe(true);
    expect(m.cut.seconds).toBeGreaterThanOrEqual(EDIT_SECONDS.min);
    expect(m.cut.seconds).toBeLessThanOrEqual(EDIT_SECONDS.max);
    expect(m.cut.start).toBeGreaterThanOrEqual(0);
    expect(m.cut.end).toBeLessThanOrEqual(m.videoSec + 1e-9);
    expect(m.cut.start).toBeLessThanOrEqual(m.marked.from + 1e-9);
    expect(m.cut.end).toBeGreaterThanOrEqual(Math.min(m.marked.to, m.cut.start + m.cut.seconds) - 1e-9);
    const s = spans(m);
    expect(s.before + s.marked + s.after).toBeCloseTo(m.cut.seconds, 5);
  });
  it("writes the prompt the way the method says, and the checker passes it", () => {
    expect(checkEditPrompt(t.prompt, m)).toEqual([]);
    expect(t.prompt).toBe(writeEditPrompt(m, t.scene));
    expect(t.prompt).toContain(`${m.cut.seconds}-second clip`);
    if (m.continuity.length) expect(t.prompt.startsWith("@")).toBe(true);
    if (spans(m).fill) expect(t.timing).toContain("TIMING");
    for (const w of m.lockWords) expect(t.prompt).toContain(w);
  });
});
