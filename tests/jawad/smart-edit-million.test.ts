import { describe, expect, it } from "vitest";
import { FAULTS, breakPrompt, checkEditPrompt, expectedKinds, randomEdit, repairEditPrompt, spans, writeEditPrompt, EDIT_SECONDS, type Fault } from "@config/jawad/smart-edit-training";

// A million edits with continuity, in twenty batches of fifty thousand, each followed by a correction round:
// every edit is a random video and a random marked part (mostly under 4 s); its prompt is written by the method and
// must pass the checker; half the prompts are then broken on purpose in one of nine ways a careless writer breaks
// them, the checker must catch exactly that, and the correction must bring every broken prompt back to passing.
// After every batch the counts are checked (what was caught, what was corrected) before the next starts.
const TOTAL = 1_000_000;
const BATCH = 50_000;

describe(`${TOTAL.toLocaleString("en")} smart edits, corrected after every ${BATCH.toLocaleString("en")}`, () => {
  const totals = { edits: 0, short: 0, clean: 0, broken: 0, caught: 0, corrected: 0, byFault: {} as Record<string, number> };

  for (let b = 0; b < TOTAL / BATCH; b++) {
    it(`batch ${b + 1}: ${BATCH.toLocaleString("en")} edits written, checked, broken, caught and corrected`, () => {
      let edits = 0;
      let short = 0;
      let clean = 0;
      let broken = 0;
      let caught = 0;
      let corrected = 0;
      const failures: string[] = [];
      for (let i = 0; i < BATCH; i++) {
        const seed = b * BATCH + i + 1;
        const e = randomEdit(seed);
        if (!e) continue;
        edits++;
        const { model, scene } = e;
        // the cut: whole seconds, at least the shortest clip, inside the video, and the spans add up
        const s = spans(model);
        if (!Number.isInteger(model.cut.seconds) || model.cut.seconds < EDIT_SECONDS.min || model.cut.seconds > EDIT_SECONDS.max || model.cut.start < 0 || model.cut.end > model.videoSec + 1e-9 || Math.abs(s.before + s.marked + s.after - model.cut.seconds) > 1e-6) {
          failures.push(`seed ${seed}: bad cut ${JSON.stringify(model.cut)}`);
          continue;
        }
        if (model.marked.to - model.marked.from < EDIT_SECONDS.min) short++;
        const prompt = writeEditPrompt(model, scene);
        const probs = checkEditPrompt(prompt, model);
        if (probs.length) {
          failures.push(`seed ${seed}: clean prompt refused: ${probs.map((p) => p.kind).join(",")}`);
          continue;
        }
        clean++;
        if (seed % 2 === 0) continue;
        // broken on purpose, in one way
        const fault: Fault = FAULTS[seed % FAULTS.length];
        const want = expectedKinds(fault, model);
        if (!want.length) continue;
        const bad = breakPrompt(prompt, fault, model);
        broken++;
        totals.byFault[fault] = (totals.byFault[fault] ?? 0) + 1;
        const found = checkEditPrompt(bad, model).map((p) => p.kind);
        if (!want.every((k) => found.includes(k))) {
          failures.push(`seed ${seed}: ${fault} not caught (found ${found.join(",") || "nothing"})`);
          continue;
        }
        caught++;
        // the correction
        const fixed = repairEditPrompt(bad, model, scene);
        const left = checkEditPrompt(fixed, model);
        if (left.length) {
          failures.push(`seed ${seed}: ${fault} not corrected (${left.map((p) => p.kind).join(",")})`);
          continue;
        }
        corrected++;
      }
      expect(failures.slice(0, 10)).toEqual([]);
      expect(edits).toBeGreaterThan(BATCH * 0.95);
      expect(clean).toBe(edits);
      expect(caught).toBe(broken);
      expect(corrected).toBe(broken);
      expect(short).toBeGreaterThan(edits * 0.5);
      totals.edits += edits;
      totals.short += short;
      totals.clean += clean;
      totals.broken += broken;
      totals.caught += caught;
      totals.corrected += corrected;
    }, 600_000);
  }

  it("adds up to a million edits, every broken one caught and corrected", () => {
    expect(totals.edits).toBeGreaterThan(TOTAL * 0.95);
    expect(totals.clean).toBe(totals.edits);
    expect(totals.caught).toBe(totals.broken);
    expect(totals.corrected).toBe(totals.broken);
    for (const f of FAULTS) expect(totals.byFault[f], f).toBeGreaterThan(1000);
    console.info("smart edit million", totals);
  });
});
