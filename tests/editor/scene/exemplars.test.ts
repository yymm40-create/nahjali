import { describe, expect, it } from "vitest";
import { EXEMPLARS } from "@/lib/editor/scene/exemplars";
import { CUE_SFX } from "@/lib/editor/scene/skill";
import { runScene } from "./harness";

// The reference scenes حيدرة learns from must themselves be flawless: they load, draw at every moment of their
// length in portrait and landscape, draw the same frame for the same time, and cue only real sounds.
describe("the reference scenes", () => {
  for (const ex of EXEMPLARS) {
    for (const [w, h] of [[1080, 1920], [1920, 1080]]) {
      it(`${ex.id} draws its whole length at ${w}×${h}`, () => {
        const run = runScene(ex.code, w, h);
        expect(run.duration).toBeGreaterThan(3);
        for (let t = 0; t <= run.duration; t += run.duration / 48) expect(() => run.frame(t), `t=${t.toFixed(2)}`).not.toThrow();
      });
    }
    it(`${ex.id} is deterministic and cues real sounds`, () => {
      const run = runScene(ex.code);
      // (the first frame also builds the grain tiles once: warm up before comparing)
      run.frame(0.5);
      const a = run.frame(2.2).join("\n"), b = run.frame(2.2).join("\n");
      expect(a.length).toBeGreaterThan(100);
      expect(b).toBe(a);
      expect(run.frame(4.1).join("\n")).not.toBe(a);
      expect(run.cues.length).toBeGreaterThanOrEqual(3);
      for (const c of run.cues) {
        expect(CUE_SFX, c.sfx).toContain(c.sfx);
        expect(c.t).toBeGreaterThanOrEqual(0);
        expect(c.t).toBeLessThanOrEqual(run.duration);
      }
    });
    it(`${ex.id} follows the machine's rules`, () => {
      expect(ex.code).not.toMatch(/Math\.random|Date\.|performance\.|setTimeout|requestAnimationFrame|fetch\(|import\(/);
      expect(ex.code).toContain("scene({");
    });
  }
});
