import { describe, expect, it } from "vitest";
import { BAKED_TEXT_RULE, DESIGN_ASPECTS, DESIGN_KINDS, DESIGNER_PLATFORM_RULES, DESIGNER_TOOLS, KAZEM_PERSONA, NO_TEXT_RULE } from "@config/designer";
import { existsSync } from "node:fs";
import { HUSSEINI_MOURNING_FEED } from "@config/husseini-mourning";
import { CONTENT_FONTS } from "@config/content-fonts";
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
  it("has a short base persona, and always the platform's rules, tools, the talk, the fonts and the feed after it", () => {
    for (const line of ["أنت «كاظم»", "زهراء فوتو ماستر", "kind=\"fonts\""]) expect(KAZEM_PERSONA).toContain(line);
    const t = systemText("PERSONA", ["EX"], "REC");
    expect(t.indexOf("PERSONA")).toBeLessThan(t.indexOf(DESIGNER_PLATFORM_RULES));
    expect(t.indexOf(DESIGNER_PLATFORM_RULES)).toBeLessThan(t.indexOf(DESIGNER_TOOLS));
    expect(t.indexOf(DESIGNER_TOOLS)).toBeLessThan(t.indexOf(fontsBlock()));
    expect(t.indexOf(fontsBlock())).toBeLessThan(t.indexOf(HUSSEINI_MOURNING_FEED));
    expect(t.indexOf(HUSSEINI_MOURNING_FEED)).toBeLessThan(t.indexOf("EX"));
    expect(t.endsWith("REC")).toBe(true);
    expect(DESIGNER_PLATFORM_RULES).toContain("لا تدّعِ");
    // the owner's order (21 October 2026): «حيدرا ماكس» designs every design in code; GPT Image 2 only paints the
    // picture it needs, with no writing — there is no third way
    expect(DESIGNER_PLATFORM_RULES).toContain("طريقة المنصة الوحيدة لصناعة التصميم");
    expect(DESIGNER_PLATFORM_RULES).toContain("بدون أي كتابة فيها");
    expect(DESIGNER_PLATFORM_RULES).toContain("لا يوجد طريق ثالث");
    expect(DESIGNER_PLATFORM_RULES).not.toContain("جواد يرسم التصميم كاملًا بالصورة والكتابة");
    // «قائمة الخطوط»: the same 50 fonts as «صانع المحتوى»
    for (const f of CONTENT_FONTS) expect(fontsBlock()).toContain(f.id);
    // the template now tells the same way the platform does: no complete design painted with its writing
    for (const gone of ["text_mode", "baked", "النص داخل الصورة المرسومة هو الأساس", "ترسل التصميم الكامل إلى «جواد» ليرسمه"]) expect(KAZEM_PERSONA).not.toContain(gone);
    expect(KAZEM_PERSONA).toContain("«حيدرا ماكس» يصمم التصميم كاملًا بالكود");
    expect(KAZEM_PERSONA).toContain("kind=\"palettes\"");
  });

  it("answers in the shape the site reads: a reply, questions, the record, a design to produce, a split", () => {
    expect(ANSWER_SCHEMA.required).toEqual(["reply", "questions", "record", "produce", "split"]);
    expect(ANSWER_SCHEMA.properties.questions.items.properties.kind.enum).toEqual(["choice", "fonts", "palettes"]);
    expect(Object.keys(ANSWER_SCHEMA.properties.produce.properties)).not.toContain("kind");
    expect(ANSWER_SCHEMA.properties.produce.properties.aspect.enum).toEqual(Object.keys(DESIGN_ASPECTS));
    expect(ANSWER_SCHEMA.properties.produce.required).toEqual(["on", "aspect", "picture", "picture_keep", "change", "artwork", "font", "refs", "place", "layers"]);
    expect(Object.keys(ANSWER_SCHEMA.properties.produce.properties)).not.toContain("maker");
    for (const field of ["\"reply\"", "\"questions\"", "\"record\"", "\"produce\"", "\"split\"", "kind=\"fonts\"", "kind=\"palettes\"", "\"layers\"", "#RRGGBB"]) expect(DESIGNER_TOOLS).toContain(field);
  });
});

describe("the kinds of design", () => {
  it("are removed while the owner rebuilds them (10 November 2026): one internal kind, no library, no sources", () => {
    expect(DESIGN_KINDS.map((k) => k.id)).toEqual(["other"]);
    expect(existsSync("config/designer-library.ts")).toBe(false);
    for (const gone of ["wedding", "مكتبة الأنماط", "kind=\"source\"", "kind=\"directions\"", "من قوالبنا"]) {
      expect(KAZEM_PERSONA).not.toContain(gone);
      expect(DESIGNER_TOOLS).not.toContain(gone);
      expect(DESIGNER_PLATFORM_RULES).not.toContain(gone);
    }
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
  it("builds either a complete design with exact typography or an explicit text-free alternative", () => {
    const p = artworkPrompt({ prompt: "a dark velvet poster", refs: 2, fix: "FIX" });
    expect(p).toContain(NO_TEXT_RULE);
    expect(p).toContain("ref1…");
    expect(p.endsWith("FIX")).toBe(true);
    expect(artworkPrompt({ prompt: "x", refs: 0 })).not.toContain("ref1");
    const baked = artworkPrompt({ prompt: "a complete poster", refs: 0, textMode: "baked", layers: [readTextLayer({ role: "title", text: "مجلس عزاء", x: 50, y: 20, w: 80 })!] });
    expect(baked).toContain(BAKED_TEXT_RULE);
    expect(baked).toContain('exact text: "مجلس عزاء"');
    expect(baked).not.toContain(NO_TEXT_RULE);
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
    expect(h[2].questions?.map((q) => q.kind)).toEqual(["fonts"]);
    expect(h[2].design?.width).toBe(1536);
    expect(forModel(h)[0].role).toBe("user");
    expect(titleOf("  بطاقة   زواج ")).toBe("بطاقة زواج");
    // an old question of a removed kind reads as a plain choice
    expect(readQuestions([{ label: "l", kind: "directions", options: ["a — b — #000000"] }])![0]).toMatchObject({ kind: "choice", options: ["a — b — #000000"] });
    expect(readPending({ id: "p", at: 2, kind: "wedding", aspect: "2:3", artwork: "art", refs: ["r1"], layers: [{ text: "t" }] })).toMatchObject({ kind: "other", aspect: "2:3", textMode: "layers", artwork: "art", refs: ["r1"], keep: null });
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
  it("makes up to 1000 different scenarios, the same each time, with design asks and the traps", () => {
    const a = scenarios(1000);
    expect(a.length).toBe(1000);
    expect(new Set(a.map((s) => s.message)).size).toBe(1000);
    expect(scenarios(50)).toEqual(a.slice(0, 50));
    expect(new Set(a.map((s) => s.kind))).toEqual(new Set(["design", "trap"]));
    expect(a.filter((s) => s.kind === "trap").length).toBeGreaterThanOrEqual(7);
  });
  it("reads the judge's verdict, and treats junk as a failure", () => {
    expect(parseVerdict("SCORE: 9\nPASS: yes\nWENT_WELL: asked once\nWENT_WRONG: none\nFIX: none")).toEqual({ score: 9, pass: true, good: "asked once", bad: "", fix: "" });
    expect(parseVerdict("garbage")).toEqual({ score: 0, pass: false, good: "", bad: "", fix: "" });
  });
});
