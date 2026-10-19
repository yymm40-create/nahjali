import { describe, expect, it } from "vitest";
import { HUSSEINI_MOURNING_FEED } from "@config/husseini-mourning";
import { systemText as designerSystem } from "@/lib/designer/persona";
import { systemText as contentSystem } from "@/lib/content/persona";
import { DESIGNER_PLATFORM_RULES, KAZEM_PERSONA } from "@config/designer";

describe("تغذية العزاء الحسيني", () => {
  it("covers the occasions, the Instagram formats, the elements, the writing, the colours and the red lines", () => {
    for (const s of ["محرم", "الأربعين", "الفاطمية", "٤:٥", "كاروسيل", "القربة", "ذو الجناح", "زيارة عاشوراء", "لا تُرسم وجوه", "لا دماء"]) expect(HUSSEINI_MOURNING_FEED).toContain(s);
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
