import { describe, expect, it } from "vitest";
import { isMotionCarouselAsk, MOTION_CAROUSEL_GUIDE } from "@config/content-motion-carousel";

describe("motion carousel guide", () => {
  it("holds Instagram's rules, when to use it, how a slide is built, and the honest delivery line", () => {
    for (const w of ["حتى ٢٠ شريحة", "1080×1350", "أول فريم", "الشريحة الثانية", "بلا صوت", "لا يُستعمل حين", "٣ إلى ٦ ثوانٍ", "مؤثر ناعم", "الشرائح المتصلة", "امسك واسحب", "من الأرخص للأغلى", "MP4"]) expect(MOTION_CAROUSEL_GUIDE).toContain(w);
  });
  it("goes with carousel and motion talk only", () => {
    for (const t of ["أبي كاروسيل عن القهوة", "سوّ لي شرائح", "كاروسيل متحرك", "motion carousel"]) expect(isMotionCarouselAsk(t)).toBe(true);
    for (const t of ["اكتب لي سكربت ريل", "كابشن لبوست"]) expect(isMotionCarouselAsk(t)).toBe(false);
  });
});

import { MOTION_CAROUSEL_STYLES, MOTION_ROUTES, motionStyleForCode, findMotionCarouselStyle } from "@config/content-motion-carousel";
import { cleanHistory, readPending, readQuestions } from "@/lib/content/chats";
import { chosenBlock, chosenIds } from "@/lib/content/persona";
import { motionCarouselLine, MOTION_CAROUSEL_HELP_LINE, motionCarouselOwnLine, stripMarks } from "@/lib/content/marks";
import { pickedMotionStyle, routeNote, slidePictureHalalas } from "@/lib/content/maker";
import { motionSize } from "@/lib/claude-code/picture-rubric";
import { readMotionSlide } from "@/lib/claude-code/picture";

describe("the twenty-one motion styles and the ways of making them", () => {
  it("has twenty-one styles, numbered, each with its cheapest way and a length a slide can loop in", () => {
    expect(MOTION_CAROUSEL_STYLES).toHaveLength(21);
    expect(MOTION_CAROUSEL_STYLES.map((s) => s.n)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
    expect(new Set(MOTION_CAROUSEL_STYLES.map((s) => s.id)).size).toBe(21);
    for (const s of MOTION_CAROUSEL_STYLES) {
      expect(["code", "picture", "elements"]).toContain(s.route);
      expect(s.seconds).toBeGreaterThanOrEqual(3);
      expect(s.seconds).toBeLessThanOrEqual(8);
      expect(s.craft.length).toBeGreaterThan(80);
      expect(MOTION_CAROUSEL_GUIDE).toContain(`${s.id} — ${s.n}) ${s.name}`);
    }
    // most are made in code alone: the cheapest way
    expect(MOTION_CAROUSEL_STYLES.filter((s) => s.route === "code").length).toBeGreaterThanOrEqual(17);
  });
  it("offers the ways cheapest first, with the price of a picture per slide on the paid ones", () => {
    expect(MOTION_ROUTES.map((r) => r.id)).toEqual(["code", "picture", "elements"]);
    expect(MOTION_ROUTES[0].label).toContain("الأرخص");
    expect(MOTION_ROUTES[2].label).toContain("الأغلى");
    expect(slidePictureHalalas()).toBeGreaterThan(0);
    const note = routeNote(6);
    expect(note.indexOf(MOTION_ROUTES[0].label)).toBeLessThan(note.indexOf(MOTION_ROUTES[1].label));
    expect(note).toContain("لـ 6 شرائح");
    expect(note).toContain("¤");
  });
  it("hands حيدرا ماكس the style's craft, or the person's own words when built from zero", () => {
    expect(motionStyleForCode(findMotionCarouselStyle("counter"), "")).toContain("count up");
    expect(motionStyleForCode(null, "الكلام ينكتب بالطباشير")).toContain("الكلام ينكتب بالطباشير");
  });
});

describe("a motion carousel in the conversation", () => {
  it("a pick carries a mark the person never sees; help and own are read too", () => {
    const line = motionCarouselLine({ id: "flipbook", name: "امسك واسحب" });
    expect(stripMarks(line)).toBe("• ستايل الحركة: «امسك واسحب»");
    const user = (text: string) => ({ role: "user" as const, text });
    expect(pickedMotionStyle([user(line)])?.style?.id).toBe("flipbook");
    expect(pickedMotionStyle([user(MOTION_CAROUSEL_HELP_LINE)])?.id).toBe("help");
    expect(pickedMotionStyle([user(motionCarouselOwnLine("دخول بالطباشير"))])).toMatchObject({ id: "own", own: "دخول بالطباشير" });
    expect(chosenIds([line]).move).toBe("flipbook");
    expect(chosenBlock(chosenIds([line]))).toContain("امسك واسحب");
    expect(chosenBlock(chosenIds([MOTION_CAROUSEL_HELP_LINE]))).toContain('kind="motioncarousels"');
  });
  it("keeps the motion plan, the slides' videos and the table's recommendations; drops junk", () => {
    const p = readPending({ id: "x", aspect: "2:3", slides: [{ n: 1, text: "t", prompt: "p" }], at: 1, styleId: "", templateId: "", mode: "all", maker: "code", motion: { styleId: "counter", route: "picture", seconds: 99 }, made: [{ n: 1, fileId: "f", name: "s", text: "t", video: "v1" }], failed: [], carry: [] });
    expect(p?.motion).toEqual({ styleId: "counter", route: "picture", seconds: 8 });
    expect(p?.made[0].video).toBe("v1");
    expect(readPending({ id: "x", aspect: "2:3", slides: [{ n: 1, text: "t", prompt: "p" }], at: 1, styleId: "", templateId: "", mode: "all", motion: { styleId: "nope" }, made: [], failed: [], carry: [] })?.motion).toBeUndefined();
    const [t] = cleanHistory([{ role: "assistant", text: "x", slides: { aspect: "2:3", items: [], todo: [], failed: [], running: false, total: 0, styleId: "", templateId: "", motion: { styleId: "own", own: "بهدوء", route: "elements", seconds: 5 } } }]);
    expect(t.slides?.motion).toEqual({ styleId: "own", own: "بهدوء", route: "elements", seconds: 5 });
    expect(readQuestions([{ label: "اختر", kind: "motioncarousels", options: ["counter", "nope"], multi: false }])).toEqual([{ label: "اختر", kind: "motioncarousels", options: ["counter"], multi: false }]);
  });
  it("a motion slide is Instagram's size and its brief is read safely", () => {
    expect(motionSize("2:3")).toEqual([1080, 1350]);
    expect(motionSize("1:1")).toEqual([1080, 1080]);
    expect(readMotionSlide({ seconds: 40, style: "s", first: true, total: 3 })).toEqual({ seconds: 8, style: "s", first: true, total: 3 });
    expect(readMotionSlide(null)).toBeNull();
  });
});
