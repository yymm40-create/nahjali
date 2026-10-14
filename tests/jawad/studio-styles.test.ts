import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FILM_STYLES } from "@config/film-styles";
import { withStyle } from "@config/jawad/style-prompt";
import { assistantSystem, checkAnswer } from "@config/jawad/assistant";
import { GENERATORS } from "@config/jawad/generators";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

describe("«الستايل» and one «جواد» for the studios", () => {
  it("offers the 24 styles, each with its picture", () => {
    expect(FILM_STYLES).toHaveLength(24);
    for (const s of FILM_STYLES) expect(() => readFileSync(new URL(`../../public/film/styles/${s.id}.jpg`, import.meta.url))).not.toThrow();
    expect(FILM_STYLES.map((style) => style.name)).toEqual([
      "بيكسار الكلاسيكية", "بيكسار الكاريكاتيرية", "إلومينيشن", "النيو-ديزني", "بيكسار الطبيعية", "دريم ووركس الملحمي",
      "شينكاي", "سايبربانك / ساينن", "دريم ووركس اللوحي", "الهجين 2D/3D", "المرسوم فوق CG", "العصر الذهبي 2D",
      "جيبلي", "بيكسار التجريدي", "الكوميكس المطبوع", "شونين حديث", "الهجين الأنمي-غربي", "دريم ووركس الساخر",
      "ريترو سِل", "3DCG أنمي", "تجريبي / مؤلف", "الانحراف الأسلوبي", "موي / تشيبي", "نهضة التسعينات",
    ]);
  });
  it("puts the style's text in what the generator reads, keeping motion video-only", () => {
    const out = withStyle("قطة على سطح", FILM_STYLES[0].text);
    expect(out.startsWith("قطة على سطح")).toBe(true);
    expect(out).toContain(FILM_STYLES[0].text);
    const moving = FILM_STYLES.find((style) => style.videoText)!;
    expect(withStyle("قطة على سطح", moving.text)).not.toContain(moving.videoText);
    expect(withStyle("قطة على سطح", moving.text, moving.videoText)).toContain(`VIDEO MOTION: ${moving.videoText}`);
    expect(read("src/lib/jawad/server/jobs.ts")).toContain('def.output === "video" ? style.videoText : undefined');
  });
  it("contains no negative prompt or blanket ban on text and logos", () => {
    const library = FILM_STYLES.map((style) => `${style.text} ${style.videoText ?? ""}`).join("\n").toLowerCase();
    expect(library).not.toContain("negative prompt");
    expect(library).not.toContain("watermark");
    expect(library).not.toContain("logo");
    expect(library).not.toMatch(/pixar|dreamworks|disney|ghibli|shinkai|ufotable|spider-verse|kpop/);
    expect(read("src/lib/film/sheets.ts")).toContain("findStyle(styleId)!.text");
    expect(read("src/components/jawad/studio/StylePicker.tsx")).toContain("FILM_STYLES");
  });
  it("جواد knows the styles (not for sound) and may pick one", () => {
    const img = GENERATORS.filter((g) => g.output === "image").slice(0, 1);
    expect(assistantSystem("image", img)).toContain("shinkai");
    expect(assistantSystem("audio", GENERATORS.filter((g) => g.output === "audio").slice(0, 1))).not.toContain("shinkai");
    const draft = { generatorId: img[0].id, prompt: "", instructions: "", settings: {}, refStyle: "none" as const, refs: [], styleId: "" };
    expect(checkAnswer({ reply: "تم", styleId: "ghibli" } as never, { defs: img, draft, attachments: 0 }).set.styleId).toBe("ghibli");
    expect(checkAnswer({ reply: "تم", styleId: "nope" } as never, { defs: img, draft, attachments: 0 }).set.styleId).toBeUndefined();
  });
  it("one conversation for every studio, with past conversations", () => {
    expect(read("src/components/jawad/studio/Studio.tsx")).toContain("storage={user.id}");
    const chat = read("src/components/jawad/studio/AssistantChat.tsx");
    expect(chat).toContain("محادثاتي");
    expect(chat).toContain("KEEP_CHATS");
  });
});

describe("«برومبت ثاني وثالث»", () => {
  it("جواد fills up to two more prompts with the references each one uses, by known names only", async () => {
    const { checkAnswer } = await import("@config/jawad/assistant");
    const { GENERATORS } = await import("@config/jawad/generators");
    const img = GENERATORS.filter((g) => g.output === "image").slice(0, 1);
    const draft = { generatorId: img[0].id, prompt: "", instructions: "", settings: {}, refStyle: "references" as const, refs: [{ uploadId: "u1", name: "ali", kind: "image" as const, role: "reference" as const }, { uploadId: "u2", name: "cat", kind: "image" as const, role: "reference" as const }], styleId: "" };
    const r = checkAnswer({ reply: "تم", extraPrompts: [{ prompt: "ثاني", refs: ["@cat", "dog"] }, { prompt: "ثالث", refs: [] }, { prompt: "رابع", refs: [] }], mainRefs: ["ali"] } as never, { defs: img, draft, attachments: 0 });
    expect(r.set.extra).toEqual([{ prompt: "ثاني", refs: ["cat"] }, { prompt: "ثالث", refs: null }]);
    expect(r.set.mainRefs).toEqual(["ali"]);
    expect(checkAnswer({ reply: "x", extraPrompts: [{ prompt: "", refs: [] }] } as never, { defs: img, draft, attachments: 0 }).set.extra).toEqual([]);
  });
  it("the studio sends one generation per prompt with its own references and price", () => {
    const s = readFileSync(new URL("../../src/components/jawad/studio/Studio.tsx", import.meta.url), "utf8");
    expect(s).toContain("async function submitAll()");
    expect(s).toContain("await submit(x.ev.price.coins, { prompt: x.prompt, refs: x.refs })");
  });
});
