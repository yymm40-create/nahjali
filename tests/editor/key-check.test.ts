import { describe, expect, it } from "vitest";
import { cleanChange } from "@/lib/editor/key-check";
import { NEW_KEY, readKey } from "@/lib/editor/model";
import { detectKey, keyParams, sampleAt } from "@/lib/editor/key-math";

describe("«🤖 حيدرا ماكس يضبط الكي»", () => {
  it("keeps only the settings he may change, inside their bounds", () => {
    expect(cleanChange({ color: "#3F9A52", tolerance: 2, clean: -1, spill: 0.7, show: true, kind: "luma", choke: "x" })).toEqual({ color: "#3f9a52", tolerance: 0.85, clean: 0, spill: 0.7 });
    expect(cleanChange({ color: "green" })).toEqual({});
  });
});

describe("«الكي» settings", () => {
  it("an older key gets the clean-up defaults", () => {
    const k = readKey({ kind: "chroma", color: "#00ff00", tolerance: 0.3, soft: 0.15, spill: 0.6, choke: 0 })!;
    expect(k.clean).toBe(NEW_KEY.clean);
    expect(k.fill).toBe(NEW_KEY.fill);
  });
  it("despills a green screen by limiting green, a yellow wall along its chroma", () => {
    expect(keyParams({ ...NEW_KEY, color: "#3f9a52" }).lead).toBe(1);
    expect(keyParams({ ...NEW_KEY, color: "#2541bf" }).lead).toBe(2);
    expect(keyParams({ ...NEW_KEY, color: "#d8c84a" }).lead).toBe(-1);
  });
  it("finds nothing in a picture with no screen", () => {
    const w = 40,
      h = 40;
    const px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const v = (i * 37) % 255;
      px.set([v, v, v, 255], i * 4);
    }
    expect(detectKey(px, w, h)).toBeNull();
  });
  it("🎯 averages a small square around the click", () => {
    const px = new Uint8ClampedArray(9 * 9 * 4).fill(255);
    for (let i = 0; i < 81; i++) px.set([0, 200, 0, 255], i * 4);
    px.set([255, 0, 0, 255], (4 * 9 + 4) * 4);
    expect(sampleAt(px, 9, 9, 4, 4, 0)).toBe("#ff0000");
    expect(sampleAt(px, 9, 9, 4, 4, 3)).not.toBe("#ff0000");
  });
});
