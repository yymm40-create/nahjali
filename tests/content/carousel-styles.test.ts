import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAROUSEL_CODE_CRAFT, CAROUSEL_GPT_CRAFT, CAROUSEL_NICHES, CAROUSEL_STYLES, carouselSample, carouselStyleBlock, carouselStyleForCode, findCarouselStyle, NO_REALISTIC_WOMEN } from "@config/content-carousel-styles";
import { CONTENT_PLATFORM_RULES, CONTENT_TOOLS } from "@config/content";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";
import { readQuestions, type Turn } from "@/lib/content/chats";
import { CAROUSEL_HELP_LINE, carouselLine, carouselOwnLine, stripMarks } from "@/lib/content/marks";
import { answerLine } from "@/lib/content/marks";
import { attachedPictures, carouselHold, CAROUSEL_LABEL, MAKER_CODE, MAKER_GPT, MAKER_LABEL, MAKER_MIX, PHOTOS_LABEL, PHOTOS_MAKE, PHOTOS_MINE, pickedCarousel, pickedMaker, pickedPhotos } from "@/lib/content/maker";
import { slidePrompt } from "@/lib/content/produce";
import { catalogBlock, chosenBlock, chosenIds } from "@/lib/content/persona";

// The table of 100 carousel styles, picked from instead of being asked about colours and margins: the owner's order.
describe("the 100 carousel styles", () => {
  it("are 100, numbered in order, each with its own id and name, in every niche", () => {
    expect(CAROUSEL_STYLES).toHaveLength(100);
    expect(CAROUSEL_STYLES.map((s) => s.n)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    expect(new Set(CAROUSEL_STYLES.map((s) => s.id)).size).toBe(100);
    expect(new Set(CAROUSEL_STYLES.map((s) => s.name)).size).toBe(100);
    expect(new Set(CAROUSEL_STYLES.map((s) => s.niche))).toEqual(new Set(CAROUSEL_NICHES));
    expect(CAROUSEL_NICHES).toHaveLength(12);
    expect(findCarouselStyle("notebook")?.name).toBe("الدفتر");
    expect(findCarouselStyle("nope")).toBeUndefined();
  });

  it("each has a complete description, for the person and for the prompts", () => {
    for (const s of CAROUSEL_STYLES) {
      expect(s.id, s.id).toMatch(/^[a-z0-9-]+$/);
      expect(s.description.length, s.id).toBeGreaterThan(30);
      expect(s.bestFor.length, s.id).toBeGreaterThan(5);
      expect(s.words, s.id).toBeGreaterThanOrEqual(4);
      expect(s.words, s.id).toBeLessThanOrEqual(24);
      for (const f of [s.look, s.type, s.cover, s.body, s.closing, s.code]) expect(f.length, s.id).toBeGreaterThan(15);
      expect(s.type, s.id).toMatch(/Arabic/);
    }
  });

  it("each has its two sample slides with the site", () => {
    for (const s of CAROUSEL_STYLES) for (const w of ["cover", "slide"] as const) expect(existsSync(`public${carouselSample(s, w)}`), `${s.id} ${w}`).toBe(true);
  });

  it("each niche has one strongest style", () => {
    for (const n of CAROUSEL_NICHES) expect(CAROUSEL_STYLES.filter((s) => s.niche === n && s.winner), n).toHaveLength(1);
  });

  it("a realistic style says what the person could add", () => {
    const real = CAROUSEL_STYLES.filter((s) => s.photoIdea);
    expect(real.length).toBeGreaterThan(20);
    for (const s of real) {
      expect(s.photoIdea!.length, s.id).toBeGreaterThan(20);
      expect(s.photoIdea, s.id).toMatch(/من الصفر/);
    }
  });

  it("never describe a woman, and every prompt forbids a realistic one", () => {
    for (const s of CAROUSEL_STYLES) expect(`${s.look} ${s.cover} ${s.body} ${s.closing}`, s.id).not.toMatch(/\bwomen?\b|\bgirl\b|\blady\b/i);
    expect(NO_REALISTIC_WOMEN).toMatch(/realistic adult woman/);
    expect(CAROUSEL_CODE_CRAFT).toMatch(/realistic adult woman/);
    expect(CONTENT_PLATFORM_RULES).toContain("امرأة بالغة واقعية");
  });

  it("their briefs fit where they go", () => {
    for (const s of CAROUSEL_STYLES) {
      const b = carouselStyleBlock(s);
      for (const f of [s.look, s.type, s.cover, s.body, s.closing]) expect(b).toContain(f);
      expect(b.length, s.id).toBeLessThan(2000);
      // the «الستايل» field of a drawing is cut at 2000 characters
      const c = carouselStyleForCode(s);
      expect(c.length, s.id).toBeLessThanOrEqual(2000);
      expect(c).toContain(s.code);
      expect(c).toContain(CAROUSEL_CODE_CRAFT);
    }
  });

  it("a slide's brief carries the look and the rule, whoever makes it", () => {
    const p = slidePrompt({ n: 1, total: 5, prompt: 'cover "العنوان"', styleId: "", carouselId: "notebook", withRef: false });
    expect(p).toContain(carouselStyleBlock(findCarouselStyle("notebook")!));
    expect(p).toContain(NO_REALISTIC_WOMEN);
    expect(p).toContain('cover "العنوان"');
    expect(slidePrompt({ n: 1, total: 5, prompt: "p", styleId: "", withRef: false })).toContain(NO_REALISTIC_WOMEN);
  });
});

describe("what محمد باقر knows", () => {
  it("the whole table, and how to write a brief for GPT Image 2", () => {
    const c = catalogBlock();
    for (const s of CAROUSEL_STYLES) expect(c).toContain(`- ${s.id} — ${s.n}) ${s.name} (${s.niche})`);
    expect(c).toContain("[صور واقعية]");
    expect(c).toContain(CAROUSEL_GPT_CRAFT);
    for (const lesson of ["huge bold text", "لا بين «»", "«٠١»", "interface labels blurred"]) expect(CAROUSEL_GPT_CRAFT).toContain(lesson);
  });

  it("the rules: no questions about colours and margins, the three makers, the realistic question", () => {
    for (const t of ["لا تسأل العميل عن الألوان ولا الخطوط ولا الهوامش", MAKER_CODE, MAKER_GPT, MAKER_MIX, "أعطه الفكرة"]) expect(CONTENT_PLATFORM_RULES).toContain(t);
    expect(CONTENT_TOOLS).toContain('kind="carousels"');
    expect(CONTENT_TOOLS).toContain('"mix"');
    expect(CONTENT_TOOLS).toContain('"carousel_id"');
  });

  it("the details of what was picked, and the question of a realistic look", () => {
    const ids = chosenIds([carouselLine({ id: "notebook", name: "الدفتر" })]);
    expect(ids.carousel).toBe("notebook");
    const b = chosenBlock(ids);
    expect(b).toContain("ستايل الكاروسيل الذي اختاره العميل: 1) الدفتر (notebook)");
    expect(b).toContain(carouselStyleBlock(findCarouselStyle("notebook")!));
    expect(b).toContain(PHOTOS_MINE);
    expect(b).toContain(PHOTOS_MAKE);
    expect(b).toContain(findCarouselStyle("notebook")!.photoIdea!);
    // a look with no realistic pictures asks nothing more
    expect(chosenBlock(chosenIds([carouselLine({ id: "white-text", name: "ب" })]))).not.toContain(PHOTOS_MINE);
    expect(chosenBlock(chosenIds([CAROUSEL_HELP_LINE]))).toContain("رشّح له ٣ ستايلات");
    expect(chosenBlock(chosenIds([carouselOwnLine("خشب")]))).toContain("يريد شكلًا غير الموجود");
  });

  it("the site's knowledge says all of it", () => {
    for (const t of ["جدول ستايلات الكاروسيل", MAKER_MIX, "a realistic adult woman", "أضيف صوري", "ما أعرف أختار، ساعدني"]) expect(JAWAD_KNOWLEDGE).toContain(t);
    expect(JAWAD_KNOWLEDGE).not.toContain("two ways only");
  });
});

describe("the marks and the questions", () => {
  it("hide the marks from the person", () => {
    expect(stripMarks(carouselLine({ id: "notebook", name: "الدفتر" }))).toBe("• ستايل الكاروسيل: «الدفتر»");
    expect(stripMarks(CAROUSEL_HELP_LINE)).toBe("• ستايل الكاروسيل: ما أعرف أختار، ساعدني");
    expect(stripMarks(carouselOwnLine("خشب محروق"))).toBe("• ستايل الكاروسيل: أبي شيئًا غير الموجود: خشب محروق");
  });
  it("keep the table's kind and only the ids the site knows", () => {
    expect(readQuestions([{ label: "اختر", kind: "carousels", options: ["notebook", "nope", "meme"], multi: true }])).toEqual([{ label: "اختر", kind: "carousels", options: ["notebook", "meme"], multi: false }]);
    expect(readQuestions([{ label: "اختر", kind: "carousels", options: [] }])).toEqual([{ label: "اختر", kind: "carousels", options: [], multi: false }]);
  });
});

describe("what stops a new carousel", () => {
  const user = (text: string, files?: Turn["files"]): Turn => ({ role: "user", text, ...(files ? { files } : {}) });
  const picture = [{ id: "p1", kind: "image" as const, name: "a.png", durationMs: null }];
  const REAL = carouselLine({ id: "notebook", name: "الدفتر" });
  const FLAT = carouselLine({ id: "white-text", name: "ب" });

  it("goes in order: the style, then the pictures, then who makes it", () => {
    expect(carouselHold([user("أنتج")])?.question.label).toBe(CAROUSEL_LABEL);
    expect(carouselHold([user(CAROUSEL_HELP_LINE)])?.question.label).toBe(CAROUSEL_LABEL);
    expect(carouselHold([user(REAL)])?.question.label).toBe(PHOTOS_LABEL);
    expect(carouselHold([user(REAL), user(PHOTOS_MAKE)])?.question.label).toBe(MAKER_LABEL);
    expect(carouselHold([user(REAL), user(PHOTOS_MAKE), user(MAKER_MIX)])).toBeNull();
    expect(carouselHold([user(FLAT)])?.question.label).toBe(MAKER_LABEL);
    expect(carouselHold([user(FLAT), user(MAKER_CODE)])).toBeNull();
  });

  it("wants the pictures themselves when they chose to add them", () => {
    expect(carouselHold([user(REAL), user(PHOTOS_MINE), user(MAKER_GPT)])?.note).toContain("أرفقها بزر 📎");
    const withPics = [user(REAL), user(PHOTOS_MINE), user("هذي", picture), user(MAKER_GPT)];
    expect(carouselHold(withPics)).toBeNull();
    expect(attachedPictures(withPics).map((f) => f.id)).toEqual(["p1"]);
  });

  it("reads a press alone or as a line of a batch, never a sentence", () => {
    expect(pickedMaker([user(MAKER_MIX)])).toBe("mix");
    expect(pickedMaker([user(answerLine(MAKER_LABEL, [MAKER_GPT]))])).toBe("gpt");
    expect(pickedMaker([user("أبي حيدرا ماكس")])).toBeNull();
    expect(pickedPhotos([user(answerLine(PHOTOS_LABEL, [PHOTOS_MINE]))])).toBe("mine");
    expect(pickedPhotos([user("بضيف صوري")])).toBeNull();
  });

  it("starts again after a carousel", () => {
    const done: Turn = { role: "assistant", text: "تم", slides: { aspect: "1:1", items: [], todo: [], failed: [], running: false, total: 1, styleId: "", templateId: "" } };
    expect(pickedCarousel([user(FLAT), user(MAKER_GPT), done])).toBeNull();
    expect(pickedMaker([user(FLAT), user(MAKER_GPT), done])).toBeNull();
    expect(carouselHold([user(FLAT), user(MAKER_GPT), done, user("كاروسيل ثاني")])?.question.label).toBe(CAROUSEL_LABEL);
  });

  it("does not stop a conversation that began with the older template gallery", () => {
    expect(pickedCarousel([user("• القالب: «دفتر قصاصات» [قالب:scrapbook]")])).toEqual({ id: "own", style: null });
    expect(carouselHold([user("• القالب: «دفتر قصاصات» [قالب:scrapbook]"), user(MAKER_GPT)])).toBeNull();
  });
});
