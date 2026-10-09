import { describe, expect, it } from "vitest";
import { DESIGN_ASPECTS, DESIGN_KINDS, DESIGN_SOURCES, DESIGNER_PLATFORM_RULES, DESIGNER_TOOLS, KAZEM_PERSONA, NO_TEXT_RULE } from "@config/designer";
import { DESIGN_LIBRARY, findDirection, libraryBlock } from "@config/designer-library";
import { FONTS } from "@config/jawad/student";
import { ALL_PERMS, OPEN_PERMS } from "@config/access";
import { DEFAULT_SECTIONS, FIXED_IMPLEMENTATIONS, RESERVED_SECTION_IDS, sectionPath } from "@config/jawad/sections";
import { cleanHistory, forModel, readPending, readQuestions, titleOf } from "@/lib/designer/chats";
import { ANSWER_SCHEMA } from "@/lib/designer/chat";
import { layersNote, readDesign, readLayers, readTextLayer, sizeOf } from "@/lib/designer/layers";
import { fontsBlock, systemText } from "@/lib/designer/persona";
import { artworkPrompt } from "@/lib/designer/produce";
import { scenarios } from "@/lib/designer/scenarios";
import { nearestAspect } from "@/lib/designer/split";
import { parseVerdict } from "@/lib/designer/tests";

describe("«كاظم»", () => {
  it("has his persona, and always the platform's rules, tools, fonts and the style library after it", () => {
    expect(KAZEM_PERSONA.length).toBeGreaterThan(3000);
    for (const line of ["أنت «كاظم»", "ليس فوانيس وزخارف", "محرر الطبقات", "المرحلة الثالثة: الملخص قبل التنفيذ"]) expect(KAZEM_PERSONA).toContain(line);
    const t = systemText("PERSONA", ["EX"], "REC");
    expect(t.indexOf("PERSONA")).toBeLessThan(t.indexOf(DESIGNER_PLATFORM_RULES));
    expect(t.indexOf(DESIGNER_PLATFORM_RULES)).toBeLessThan(t.indexOf(DESIGNER_TOOLS));
    expect(t.indexOf(DESIGNER_TOOLS)).toBeLessThan(t.indexOf(fontsBlock()));
    expect(t.indexOf(fontsBlock())).toBeLessThan(t.indexOf(libraryBlock()));
    expect(t.indexOf(libraryBlock())).toBeLessThan(t.indexOf("EX"));
    expect(t.endsWith("REC")).toBe(true);
    expect(DESIGNER_PLATFORM_RULES).toContain("لا تدّعِ");
    expect(DESIGNER_PLATFORM_RULES).toContain("بلا أي كتابة");
    for (const f of FONTS) expect(fontsBlock()).toContain(f.id);
  });

  it("answers in the shape the site reads: a reply, questions, the record, a design to produce, a split", () => {
    expect(ANSWER_SCHEMA.required).toEqual(["reply", "questions", "record", "produce", "split"]);
    expect(ANSWER_SCHEMA.properties.questions.items.properties.kind.enum).toEqual(["choice", "source", "directions", "fonts"]);
    expect(ANSWER_SCHEMA.properties.produce.properties.kind.enum).toEqual(DESIGN_KINDS.map((k) => k.id));
    expect(ANSWER_SCHEMA.properties.produce.properties.aspect.enum).toEqual(Object.keys(DESIGN_ASPECTS));
    for (const field of ["\"reply\"", "\"questions\"", "\"record\"", "\"produce\"", "\"split\"", "kind=\"source\"", "kind=\"fonts\"", "kind=\"directions\"", "\"layers\"", "#RRGGBB"]) expect(DESIGNER_TOOLS).toContain(field);
  });
});

describe("the style library", () => {
  it("covers every kind with three directions, real fonts, hex colours and text-free artwork", () => {
    expect(DESIGN_LIBRARY.map((k) => k.kind)).toEqual(DESIGN_KINDS.map((k) => k.id));
    for (const k of DESIGN_LIBRARY) {
      expect(k.directions).toHaveLength(3);
      expect(k.aspects[0] in DESIGN_ASPECTS).toBe(true);
      for (const d of k.directions) {
        expect(d.colors).toHaveLength(4);
        for (const c of d.colors) expect(c).toMatch(/^#[0-9A-F]{6}$/i);
        expect(FONTS.some((f) => f.id === d.fonts.title)).toBe(true);
        expect(FONTS.some((f) => f.id === d.fonts.body)).toBe(true);
        expect(d.artwork).not.toMatch(/\btext\b.*\bsays\b|"[^"]*[؀-ۿ]+[^"]*"/);
      }
    }
    expect(findDirection("wedding-noir-gold")?.name).toBe("ليل وذهب");
    expect(libraryBlock()).toContain("## husseini_mourning");
    // the owner's rule: not lanterns and ornament on everything
    expect(DESIGN_LIBRARY.find((k) => k.kind === "wedding")!.avoid).toContain("فوانيس");
    expect(DESIGN_SOURCES.map((s) => s.id)).toEqual(["copy", "ours", "scratch", "mix"]);
  });
});

describe("the layers", () => {
  it("reads a layer from the model, fills what is missing and keeps it inside the design", () => {
    const l = readTextLayer({ role: "title", text: "مجلس عزاء\\nالإمام الحسين", font: "amiri", size: 9, color: "#d4af37", x: 50, y: 30, w: 80, align: "center", effect: "outline", effect_color: "#000000", weight: 700 })!;
    expect(l.text).toBe("مجلس عزاء\nالإمام الحسين");
    expect(l.color).toBe("#D4AF37");
    expect(l.effectColor).toBe("#000000");
    expect(l.font).toBe("amiri");
    expect(readTextLayer({ text: "x", font: "nope", size: 999, x: -5, color: "red" }, "tajawal")).toMatchObject({ font: "tajawal", size: 30, x: 0, color: "#FFFFFF", role: "body" });
    expect(readTextLayer({ text: "" })).toBeNull();
    const layers = readLayers([{ text: "a" }, { kind: "image", fileId: "f1", w: 40 }, null, { text: "b" }]);
    expect(layers.map((x) => x.kind)).toEqual(["image", "text", "text"]);
    expect(readLayers(Array.from({ length: 30 }, (_, i) => ({ text: `t${i}` }))).length).toBe(14);
  });
  it("keeps a design's size by its aspect and tells كاظم what is on it", () => {
    expect(sizeOf("16:9")).toEqual({ width: 2048, height: 1152 });
    const d = readDesign({ id: "d1", aspect: "2:3", artwork: "a1", layers: [{ role: "names", text: "سعود", font: "amiri", size: 5, color: "#ffffff", x: 50, y: 40, w: 80 }], state: "ready" })!;
    expect(d.width).toBe(1280);
    expect(layersNote(d)).toContain("[names] «سعود»");
    expect(readDesign(null)).toBeNull();
  });
  it("puts the no-text rule and the references into every artwork prompt", () => {
    const p = artworkPrompt({ prompt: "a dark velvet poster", refs: 2, fix: "FIX" });
    expect(p).toContain(NO_TEXT_RULE);
    expect(p).toContain("ref1…");
    expect(p.endsWith("FIX")).toBe(true);
    expect(artworkPrompt({ prompt: "x", refs: 0 })).not.toContain("ref1");
  });
  it("picks the nearest aspect of a picture to split", () => {
    expect(nearestAspect(1920, 1080)).toBe("16:9");
    expect(nearestAspect(1000, 1000)).toBe("1:1");
    expect(nearestAspect(1080, 1920)).toBe("9:16");
  });
});

describe("conversations", () => {
  it("keeps the attachments, the questions and the design, drops junk, and starts with the person", () => {
    const h = cleanHistory([
      { role: "assistant", text: "a" },
      { role: "user", text: "x", files: [{ id: "f1", kind: "image", name: "tpl.png", durationMs: null }, { bad: true }] },
      { role: "assistant", text: "b", questions: [{ label: "المصدر", kind: "source", options: [] }, { label: "الخط", kind: "fonts" }, { label: "x", kind: "choice", options: [] }], design: { id: "d", aspect: "1:1", layers: [], state: "drawing" } },
      { role: "bad", text: "z" },
      { role: "assistant", text: "", error: true },
    ]);
    expect(h.map((t) => t.role)).toEqual(["assistant", "user", "assistant"]);
    expect(h[1].files).toEqual([{ id: "f1", kind: "image", name: "tpl.png", durationMs: null }]);
    expect(h[2].questions?.map((q) => q.kind)).toEqual(["source", "fonts"]);
    expect(h[2].design?.width).toBe(1536);
    expect(forModel(h)[0].role).toBe("user");
    expect(titleOf("  بطاقة   زواج ")).toBe("بطاقة زواج");
    expect(readQuestions([{ label: "l", kind: "directions", options: ["a — b — #000000"] }])![0].options).toEqual(["a — b — #000000"]);
    expect(readPending({ id: "p", at: 2, kind: "wedding", aspect: "2:3", artwork: "art", refs: ["r1"], layers: [{ text: "t" }] })).toMatchObject({ kind: "wedding", aspect: "2:3", artwork: "art", refs: ["r1"], keep: null });
    expect(readPending({ artwork: "" })).toBeNull();
    expect(readPending({ artwork: "", keep: "file" })?.keep).toBe("file");
  });
});

describe("the section", () => {
  it("is registered, owner-only by default, with its own page, and inside the all-opening code", () => {
    const s = DEFAULT_SECTIONS.find((x) => x.id === "designer")!;
    expect(s.enabled).toBe(false);
    expect(RESERVED_SECTION_IDS).toContain("designer");
    expect(FIXED_IMPLEMENTATIONS).toContain("designer");
    expect(sectionPath(s)).toBe("/jawad-ai/designer");
    expect(ALL_PERMS).toContain("designer");
    expect(OPEN_PERMS).toContain("designer");
  });
});

describe("the tests", () => {
  it("makes up to 1000 different scenarios, the same each time, with every kind and the traps", () => {
    const a = scenarios(1000);
    expect(a.length).toBe(1000);
    expect(new Set(a.map((s) => s.message)).size).toBe(1000);
    expect(scenarios(50)).toEqual(a.slice(0, 50));
    expect(new Set(a.map((s) => s.kind))).toEqual(new Set([...DESIGN_KINDS.map((k) => k.id), "trap"]));
    expect(a.filter((s) => s.kind === "trap").length).toBeGreaterThanOrEqual(7);
  });
  it("reads the judge's verdict, and treats junk as a failure", () => {
    expect(parseVerdict("SCORE: 9\nPASS: yes\nWENT_WELL: asked once\nWENT_WRONG: none\nFIX: none")).toEqual({ score: 9, pass: true, good: "asked once", bad: "", fix: "" });
    expect(parseVerdict("garbage")).toEqual({ score: 0, pass: false, good: "", bad: "", fix: "" });
  });
});
