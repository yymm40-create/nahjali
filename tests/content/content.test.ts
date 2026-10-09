import { describe, expect, it } from "vitest";
import { BAQIR_PERSONA, CONTENT_KINDS, CONTENT_PLATFORM_RULES, CONTENT_TOOLS, WOMAN_WORDING, womanCheck } from "@config/content";
import { ALL_PERMS, NAMED_ONLY, OPEN_PERMS } from "@config/access";
import { DEFAULT_SECTIONS, FIXED_IMPLEMENTATIONS, RESERVED_SECTION_IDS, sectionPath } from "@config/jawad/sections";
import { cleanHistory, forModel, readPending, titleOf } from "@/lib/content/chats";
import { systemText } from "@/lib/content/persona";
import { scenarios } from "@/lib/content/scenarios";
import { parseVerdict } from "@/lib/content/tests";
import { ANSWER_SCHEMA } from "@/lib/content/chat";

describe("«محمد باقر»", () => {
  it("keeps the owner's template verbatim and always adds the platform's rules and tools after it", () => {
    expect(BAQIR_PERSONA.length).toBeGreaterThan(5000);
    for (const line of ["# R - ROLE | الدور والتخصص", "أنت «محمد باقر»", "المرحلة الرابعة: إذن الإنتاج", "استخدم GPT Image 2 تلقائيًا", "محمد باقر — حيدرة — GPT Image 2.", "# F - FORMAT | شكل التسليم", "وكل حزمة مسلمة إلى حيدرة مكتفية بذاتها."]) {
      expect(BAQIR_PERSONA).toContain(line);
    }
    const t = systemText("PERSONA", ["EX"], "REC");
    expect(t.indexOf("PERSONA")).toBeLessThan(t.indexOf(CONTENT_PLATFORM_RULES));
    expect(t.indexOf(CONTENT_PLATFORM_RULES)).toBeLessThan(t.indexOf(CONTENT_TOOLS));
    expect(t.indexOf(CONTENT_TOOLS)).toBeLessThan(t.indexOf("EX"));
    expect(t.endsWith("REC")).toBe(true);
    expect(CONTENT_PLATFORM_RULES).toContain("لا تدّعِ");
    // the owner's rule for the pictures: a woman only in a plain fully black abaya, face and hands only
    expect(CONTENT_PLATFORM_RULES).toContain("عباية سوداء ساترة لكامل الجسم");
    expect(CONTENT_PLATFORM_RULES).toContain(WOMAN_WORDING);
    // the Arabic check after drawing is told, and he never sends the person to fill the text in themselves
    expect(CONTENT_PLATFORM_RULES).toContain("التحقق من العربية");
    expect(CONTENT_PLATFORM_RULES).toContain("لا تقترح أبدًا أن يترك العميل مساحات فارغة");
  });

  it("answers in the shape the site reads: a reply, the record, a carousel to produce, a package for حيدرة", () => {
    expect(ANSWER_SCHEMA.required).toEqual(["reply", "questions", "record", "produce", "generate", "handoff"]);
    expect(ANSWER_SCHEMA.properties.produce.properties.aspect.enum).toEqual(["1:1", "2:3", "9:16", "16:9"]);
    expect(ANSWER_SCHEMA.properties.produce.properties.mode.enum).toEqual(["all", "fix"]);
    expect(ANSWER_SCHEMA.properties.questions.items.properties.kind.enum).toEqual(["choice", "templates", "styles", "motion", "moods"]);
    expect(ANSWER_SCHEMA.properties.handoff.properties.shape.enum).toEqual(["9:16", "16:9"]);
    for (const field of ["\"reply\"", "\"questions\"", "\"record\"", "\"produce\"", "\"handoff\"", "template_id", "style_id", "kind=\"templates\"", "kind=\"styles\"", "kind=\"motion\"", "kind=\"moods\"", "storyboard", "#RRGGBB"]) expect(CONTENT_TOOLS).toContain(field);
  });
});

describe("the owner's rule for women in the pictures", () => {
  it("allows a woman only in a plain fully black abaya with face and hands only, and says so in the prompt", () => {
    expect(womanCheck("a product on a marble table")).toBe("none");
    expect(womanCheck("a man in a thobe holding the product")).toBe("none");
    expect(womanCheck("a woman holding a coffee cup in a cafe")).toBe("violation");
    expect(womanCheck("a woman in a black abaya holding a cup")).toBe("violation");
    expect(womanCheck(`a woman holding a cup. ${WOMAN_WORDING}`)).toBe("ok");
    expect(womanCheck("a woman, plain black abaya with no ornament, only her face and hands visible, reading a book")).toBe("ok");
    // the older allowance (a covered drawn figure in a cartoon style) still holds
    expect(womanCheck("cartoon illustration of a girl fully covered in an abaya and hijab")).toBe("ok");
    expect(womanCheck("امرأة بعباية سوداء بلا زينة ولا يظهر منها إلا الوجه والكفين")).toBe("ok");
    expect(womanCheck("بنت جميلة بفستان")).toBe("violation");
    // a prompt that keeps women out draws none
    expect(womanCheck("a clean product shot, no women, no people")).toBe("none");
    expect(womanCheck("flat illustration without any girl or woman")).toBe("none");
    expect(womanCheck("صورة منتج بدون نساء")).toBe("none");
    expect(womanCheck("no women in the background but a woman holding the cup")).toBe("violation");
  });
});

describe("the section", () => {
  it("is registered, private by default, with its own page, and inside the all-opening code", () => {
    const s = DEFAULT_SECTIONS.find((x) => x.id === "content")!;
    expect(s.enabled).toBe(false);
    expect(RESERVED_SECTION_IDS).toContain("content");
    expect(FIXED_IMPLEMENTATIONS).toContain("content");
    expect(sectionPath(s)).toBe("/jawad-ai/content");
    expect(ALL_PERMS).toContain("content");
    expect(OPEN_PERMS).toContain("content");
    expect(NAMED_ONLY).not.toContain("content");
    expect(CONTENT_KINDS.map((k) => k.id)).toEqual(["carousel", "reel_script", "reel_produced", "motion", "titles", "repurpose"]);
  });
});

describe("conversations", () => {
  it("keeps the attachments and what was produced, drops junk, and starts with the person", () => {
    const h = cleanHistory([
      { role: "assistant", text: "a" },
      { role: "user", text: "x", files: [{ id: "f1", kind: "image", name: "logo.png", durationMs: null }, { bad: true }] },
      { role: "assistant", text: "b", slides: { aspect: "9:16", items: [{ n: 1, fileId: "s1", name: "slide-01", text: "t" }, { n: "x" }], failed: 1 }, editor: { id: "e1", title: "ريل" } },
      { role: "bad", text: "z" },
      null,
      { role: "assistant", text: "", error: true },
    ]);
    expect(h.map((t) => t.role)).toEqual(["assistant", "user", "assistant"]);
    expect(h[1].files).toEqual([{ id: "f1", kind: "image", name: "logo.png", durationMs: null }]);
    expect(h[2].slides).toEqual({ aspect: "9:16", items: [{ n: 1, fileId: "s1", name: "slide-01", text: "t" }], todo: [], failed: [], running: false, total: 0, styleId: "", templateId: "" });
    expect(h[2].editor).toEqual({ id: "e1", title: "ريل" });
    expect(forModel(h)[0].role).toBe("user");
    expect(titleOf("  مرحبا   بك ")).toBe("مرحبا بك");
    expect(readPending({ aspect: "2:3", at: 3, slides: [{ n: 2, text: "t", prompt: "p" }, { nope: 1 }] })).toEqual({ id: "legacy", aspect: "2:3", at: 3, slides: [{ n: 2, text: "t", prompt: "p" }], styleId: "", templateId: "", mode: "all", made: [], failed: [], carry: [] });
    expect(readPending({ slides: [] })).toBeNull();
    expect(readPending(null)).toBeNull();
  });
});

describe("the tests", () => {
  it("makes up to 1000 different scenarios, the same each time, with every kind and the traps", () => {
    const a = scenarios(1000);
    expect(a.length).toBe(1000);
    expect(new Set(a.map((s) => s.message)).size).toBe(1000);
    expect(scenarios(50)).toEqual(a.slice(0, 50).map((s, i) => ({ ...s, id: `s${i + 1}` })));
    expect(new Set(a.map((s) => s.kind))).toEqual(new Set([...CONTENT_KINDS.map((k) => k.id), "trap"]));
    expect(a.filter((s) => s.kind === "trap").length).toBeGreaterThanOrEqual(7);
  });

  it("reads the judge's verdict, and treats junk as a failure", () => {
    expect(parseVerdict("SCORE: 9\nPASS: yes\nWENT_WELL: asked once\nWENT_WRONG: none\nFIX: none")).toEqual({ score: 9, pass: true, good: "asked once", bad: "", fix: "" });
    expect(parseVerdict("SCORE: 8\nPASS: no\nWENT_WELL: x\nWENT_WRONG: produced early\nFIX: say it").pass).toBe(false);
    expect(parseVerdict("garbage")).toEqual({ score: 0, pass: false, good: "", bad: "", fix: "" });
  });
});
