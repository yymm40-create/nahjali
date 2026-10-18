import { describe, expect, it } from "vitest";
import { asksAboutBackdrop, withoutBackdropEdits } from "@/lib/editor/assistant-core";

describe("the background and the colour key are the person's own settings", () => {
  it("drops a change to bg or key that nobody asked for, and keeps everything else in the same command", () => {
    const r = withoutBackdropEdits([
      { type: "update_clip", patch: { bg: { mode: "remove" }, volume: 0.8 } },
      { type: "update_clip", patch: { key: { kind: "chroma" } } },
      { type: "update_clip", patch: { speed: 1.25 } },
      { type: "split" },
    ]);
    expect(r.dropped).toBe(2);
    expect(r.cmds).toEqual([{ type: "update_clip", patch: { volume: 0.8 } }, { type: "update_clip", patch: { speed: 1.25 } }, { type: "split" }]);
    expect(withoutBackdropEdits([{ type: "update_clip", patch: { volume: 1 } }]).dropped).toBe(0);
  });

  it("knows when the request itself is about the background, the green screen or the key", () => {
    for (const m of ["شيل الخلفية الخضراء", "اشتغل على الكروما", "غبّش الخلفية", "green screen", "عدّل الكي", "خل الخلفية شفافة"]) expect(asksAboutBackdrop(m), m).toBe(true);
    for (const m of ["قص السكتات", "رتّب المقاطع وحط انتقالات", "لوّن الفيديو سينمائي", "حط موسيقى"]) expect(asksAboutBackdrop(m), m).toBe(false);
  });
});
