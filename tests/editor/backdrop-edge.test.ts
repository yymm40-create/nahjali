import { describe, expect, it } from "vitest";
import { DEFAULT_BACKDROP, readBackdrop } from "@/lib/editor/model";

describe("«شيل الخلفية»: the edge settings", () => {
  it("an older project gets the default edge (soft, normal, steady)", () => {
    const b = readBackdrop({ mode: "remove", color: "#16a34a", blur: 40 });
    expect(b).toEqual({ ...DEFAULT_BACKDROP, mode: "remove" });
    expect(b.feather).toBe(0.3);
    expect(b.steady).toBe(0.5);
  });
  it("keeps every setting inside its bounds", () => {
    const b = readBackdrop({ mode: "remove", feather: 3, shrink: -9, steady: -1, show: true, blur: 500, color: "red" });
    expect(b.feather).toBe(1);
    expect(b.shrink).toBe(-1);
    expect(b.steady).toBe(0);
    expect(b.show).toBe(true);
    expect(b.blur).toBe(100);
    expect(b.color).toBe(DEFAULT_BACKDROP.color);
  });
  it("a change keeps what it doesn't touch", () => {
    const before = readBackdrop({ mode: "blur", feather: 0.6, shrink: -0.4, steady: 0.8, blur: 20 });
    const after = readBackdrop({ shrink: 0.2 }, before);
    expect(after).toEqual({ ...before, shrink: 0.2 });
  });
});
