import { describe, expect, it } from "vitest";
import { gradeFn, gradePixels } from "@/lib/editor/grade-cpu";
import { applyLook, LOOKS, NEUTRAL_GRADE, readGrade, type Grade } from "@/lib/editor/grade";

const g = (p: Record<string, unknown>): Grade => readGrade({ ...NEUTRAL_GRADE, ...p })!;

describe("the grade on the CPU (same steps as the GPU)", () => {
  it("leaves a picture as it is when the grade is neutral", () => {
    const f = gradeFn(NEUTRAL_GRADE);
    for (const c of [[0, 0, 0], [0.18, 0.4, 0.7], [1, 1, 1], [0.5, 0.5, 0.5]] as const) {
      const out = f(c[0], c[1], c[2]);
      out.forEach((v, i) => expect(v).toBeCloseTo(c[i], 4));
    }
  });
  it("warms with temp, greens with tint, brightens with exposure", () => {
    const grey = [0.5, 0.5, 0.5] as const;
    const warm = gradeFn(g({ temp: 0.5 }))(...grey);
    expect(warm[0]).toBeGreaterThan(warm[2]);
    const green = gradeFn(g({ tint: 0.5 }))(...grey);
    expect(green[1]).toBeGreaterThan(green[0]);
    const up = gradeFn(g({ exposure: 1 }))(...grey);
    expect(up[0]).toBeGreaterThan(0.6);
  });
  it("takes the saturation away to grey, and a look changes the picture", () => {
    const grey = gradeFn(g({ saturation: 0 }))(0.8, 0.3, 0.2);
    expect(Math.abs(grey[0] - grey[2])).toBeLessThan(0.01);
    const look = applyLook(NEUTRAL_GRADE, LOOKS.find((l) => l.id === "teal-orange")!);
    const px = new Uint8Array([60, 60, 60, 255, 220, 160, 120, 255]);
    const out = gradePixels(px, look);
    expect(out[2]).toBeGreaterThan(out[0]); // teal in the shadows
    expect(out[3]).toBe(255);
  });
});
