import { describe, expect, it } from "vitest";
import { HUSSEINI_MOURNING_FEED } from "@config/husseini-mourning";
import { systemText as designerSystem } from "@/lib/designer/persona";
import { systemText as contentSystem } from "@/lib/content/persona";
import { DESIGNER_PLATFORM_RULES, KAZEM_PERSONA } from "@config/designer";

describe("تغذية العزاء الحسيني", () => {
  it("covers the occasions, the Instagram formats, the elements, the writing, the colours and the red lines", () => {
    for (const s of ["محرم", "الأربعين", "الفاطمية", "٤:٥", "كاروسيل", "القربة", "ذو الجناح", "زيارة عاشوراء", "لا تُرسم وجوه", "لا جراح", "للاستيحاء والتعلّم، لا للنسخ", "تعريض مزدوج"]) expect(HUSSEINI_MOURNING_FEED).toContain(s);
  });
  it("reaches كاظم and محمد باقر in every conversation", () => {
    expect(designerSystem("persona")).toContain(HUSSEINI_MOURNING_FEED);
    expect(contentSystem("persona")).toContain(HUSSEINI_MOURNING_FEED);
  });
});

describe("كاظم يكتب ويعدّل الكتابة", () => {
  it("has no rule that he never edits or that a word changes only at زهراء", () => {
    for (const t of [DESIGNER_PLATFORM_RULES, KAZEM_PERSONA]) {
      expect(t).not.toContain("ولا تعدّل أبدًا");
      expect(t).not.toContain("وأنت تصنع فقط");
    }
    expect(DESIGNER_PLATFORM_RULES).toContain("أنت تكتب وتعدّل الكتابة بنفسك");
  });
});

describe("محمد باقر: Claude Code يرسم الكاروسيل", () => {
  it("keeps the maker with the carousel being made and in the tools he is told about", async () => {
    const { readPending } = await import("@/lib/content/chats");
    const p = readPending({ id: "x", aspect: "1:1", slides: [{ n: 1, text: "سلام", prompt: "a slide" }], at: 1, styleId: "", templateId: "", mode: "all", maker: "code", made: [], failed: [], carry: [] });
    expect(p?.maker).toBe("code");
    expect(readPending({ id: "x", aspect: "1:1", slides: [{ n: 1, text: "", prompt: "a" }], at: 1, mode: "all", made: [], failed: [], carry: [] })?.maker).toBeUndefined();
    const { CONTENT_TOOLS, CONTENT_PLATFORM_RULES } = await import("@config/content");
    // the owner's order now: the person picks who designs the slides — «حيدرا ماكس» in code (GPT Image 2 paints only a slide's picture) or GPT Image 2 for the whole slide
    expect(CONTENT_TOOLS).toContain('"picture"');
    expect(CONTENT_TOOLS).toContain('"maker"');
    expect(CONTENT_PLATFORM_RULES).toContain("العميل هو من يختار من يصمم شرائحه");
    expect(CONTENT_PLATFORM_RULES).toContain("آخر خطوة قبل تصنيع أي كاروسيل جديد");
  });
  it("the page draws a slide in code and sends it back to the produce step", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("src/app/api/content/produce/route.ts", "utf8")).toContain("produceFromCode(user.id, chatId, b)");
    const page = readFileSync("src/components/jawad/content/ContentChat.tsx", "utf8");
    expect(page).toContain('from: "content"');
    expect(page).toContain("n: r.code.n, png: drawn.png");
  });
});

describe("Claude Code يحط صور الأشخاص في التصميم", () => {
  it("كاظم marks the photos to place, and they reach the scene as photo1… unchanged", async () => {
    const { readFileSync } = await import("node:fs");
    const { readPending } = await import("@/lib/designer/chats");
    const p = readPending({ id: "d", at: 1, kind: "husseini_mourning", aspect: "1:1", textMode: "baked", artwork: "a poster", refs: ["a", "b"], layers: [], keep: null, maker: "code", place: ["a"] });
    expect(p?.place).toEqual(["a"]);
    expect(DESIGNER_PLATFORM_RULES).toContain('"place"');
    expect(readFileSync("src/lib/designer/chat.ts", "utf8")).toContain('"place", "layers"]');
    expect(readFileSync("src/lib/designer/produce.ts", "utf8")).toContain("refs: urls.slice(0, 4), photos, picture: Boolean(artUrl) };");
    const draw = readFileSync("src/components/claude-code/draw.ts", "utf8");
    expect(draw).toContain("id: `photo${i + 1}`, bitmap: p.bm");
    expect(draw).toContain("await host.load(code, { w: W, h: H, assets,");
    const picture = readFileSync("src/lib/claude-code/picture.ts", "utf8");
    expect(picture).toContain("Keep every face EXACTLY as photographed");
    expect(picture.match(/\.\.\.photosParts\(b\.photos\)/g)?.length).toBe(2);
    expect(readFileSync("src/components/claude-code/ClaudeCodeCard.tsx", "utf8")).toContain("حط الصور المرفقة داخل التصميم كما هي");
  });
});

describe("زهراء: Claude Code يركّب التصميم بالبرنامج", () => {
  it("a layout program is checked like the others, and its kit computes in percent of the canvas", async () => {
    const { checkProgram, LAYOUT_KIT_API, computeDoc } = await import("@/lib/claude-code/compute");
    expect(checkProgram("layout", "function layout(D, K) { return []; }").ok).toBe(true);
    expect(checkProgram("layout", "function edit(T, K) { return []; }").problems.join()).toContain("function layout(D, K)");
    expect(checkProgram("layout", "function layout(D, K) { return fetch('x'); }").ok).toBe(false);
    expect(LAYOUT_KIT_API).toContain("K.grid(");
    expect(computeDoc()).toContain('m.kind === "layout"');
  });
  it("زهراء chooses it from her chat, and the page applies it to a copy before the design changes", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("src/lib/photo/chat.ts", "utf8")).toContain('mode: { type: "string", enum: ["grade", "layout"] }');
    expect(readFileSync("src/app/api/photo/code/route.ts", "utf8")).toContain('b.action === "layout_review"');
    const page = readFileSync("src/components/jawad/photo/PhotoEditor.tsx", "utf8");
    expect(page).toContain("const res = applyOps(d0, ops, ctx);");
    expect(page).toContain('r.code.mode === "layout" ? runCodeLayout(r.code.prompt)');
  });
  it("ten photos in one drawing, twenty on two rounds", async () => {
    const { readFileSync } = await import("node:fs");
    const draw = readFileSync("src/components/claude-code/draw.ts", "utf8");
    expect(draw).toContain("export const PHOTOS_PER_ROUND = 10;");
    expect(draw).toContain("SECOND ROUND: photo1 is the design as it stands");
    expect(readFileSync("src/lib/claude-code/picture.ts", "utf8")).toContain(".slice(0, 10);\n  if (!list.length) return [];");
  });
});
