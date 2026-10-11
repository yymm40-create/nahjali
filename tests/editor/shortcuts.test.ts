import { describe, expect, it } from "vitest";
import { ACTIONS, clashes, comboOf, KEYMAPS, keyTable, PROGRAM_ORDER, readProgram } from "@/lib/editor/shortcuts";
import { DEFAULT_BACKDROP, readBackdrop } from "@/lib/editor/model";
import { despillPixels } from "@/components/jawad/editor/render";

const ev = (key: string, code: string, mods: Partial<Record<"ctrlKey" | "metaKey" | "shiftKey" | "altKey", boolean>> = {}) => ({ key, code, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods });

describe("«⌨️ الاختصارات»", () => {
  it("reads a key press the way the maps write it, whatever the keyboard's language", () => {
    expect(comboOf(ev("k", "KeyK", { ctrlKey: true }))).toBe("Mod+K");
    expect(comboOf(ev("ن", "KeyK", { metaKey: true }))).toBe("Mod+K");
    expect(comboOf(ev("+", "Equal", { ctrlKey: true, shiftKey: true }))).toBe("Mod+Shift+=");
    expect(comboOf(ev(" ", "Space"))).toBe("Space");
    expect(comboOf(ev("ArrowLeft", "ArrowLeft", { shiftKey: true }))).toBe("Shift+Left");
    expect(comboOf(ev("Shift", "ShiftLeft", { shiftKey: true }))).toBeNull();
  });
  it("every key in every program names a known job", () => {
    const ids = new Set(ACTIONS.map((a) => a.id));
    for (const p of PROGRAM_ORDER) for (const a of Object.keys(KEYMAPS[p])) expect(ids.has(a as never)).toBe(true);
  });
  it("the chosen program wins a clash; its keys all work", () => {
    expect(keyTable("premiere").get("Mod+D")?.action).toBe("transition");
    expect(keyTable("jawad").get("Mod+D")?.action).toBe("duplicate");
    expect(keyTable("resolve").get("Delete")?.action).toBe("ripple");
    expect(keyTable("premiere").get("Delete")?.action).toBe("delete");
    for (const p of PROGRAM_ORDER) {
      const t = keyTable(p);
      for (const [a, combos] of Object.entries(KEYMAPS[p])) for (const c of combos!) expect(t.get(c)?.action).toBe(a);
    }
  });
  it("keys of other programs still work when they clash with nothing", () => {
    const t = keyTable("capcut");
    expect(t.get("Mod+K")?.action).toBe("split");
    expect(t.get("Shift+M")?.action).toBe("nextMarker");
  });
  it("lists the clashing keys", () => {
    const c = clashes("premiere").map((x) => x.combo);
    expect(c).toContain("Mod+D");
    expect(c).toContain("Delete");
    expect(c).not.toContain("Space");
  });
  it("reads a stored choice", () => {
    expect(readProgram("fcp")).toBe("fcp");
    expect(readProgram("avid")).toBeNull();
  });
});

describe("«Despill» in background removal", () => {
  it("older projects get none", () => {
    expect(readBackdrop({ mode: "remove" })).toEqual({ ...DEFAULT_BACKDROP, mode: "remove" });
    expect(DEFAULT_BACKDROP.despill).toBe(0);
  });
  it("keeps its bounds and colour", () => {
    const b = readBackdrop({ despill: 4, spillColor: "#00B140" });
    expect(b.despill).toBe(1);
    expect(b.spillColor).toBe("#00b140");
    expect(readBackdrop({ spillColor: "green" }).spillColor).toBe("");
  });
  it("takes a green cast off an edge pixel and keeps a neutral one", () => {
    const px = new Uint8ClampedArray([120, 180, 110, 128, 128, 128, 128, 128]);
    despillPixels(px, [0, 177, 64], 1);
    expect(px[1] - px[0]).toBeLessThan(60);
    expect(px[1]).toBeLessThan(180);
    expect([px[4], px[5], px[6]]).toEqual([128, 128, 128]);
  });
});
