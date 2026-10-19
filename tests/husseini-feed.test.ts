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
    expect(CONTENT_TOOLS).toContain('"maker"');
    expect(CONTENT_PLATFORM_RULES).toContain("حيدرة ماكس");
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
    expect(readFileSync("src/lib/designer/produce.ts", "utf8")).toContain("refs: urls.slice(0, 4), photos }");
    const draw = readFileSync("src/components/claude-code/draw.ts", "utf8");
    expect(draw).toContain("id: `photo${i + 1}`, bitmap: p.bm");
    expect(draw).toContain("await host.load(code, { w: W, h: H, assets,");
    const picture = readFileSync("src/lib/claude-code/picture.ts", "utf8");
    expect(picture).toContain("Keep every face EXACTLY as photographed");
    expect(picture.match(/\.\.\.photosParts\(b\.photos\)/g)?.length).toBe(2);
    expect(readFileSync("src/components/claude-code/ClaudeCodeCard.tsx", "utf8")).toContain("حط الصور المرفقة داخل التصميم كما هي");
  });
});
