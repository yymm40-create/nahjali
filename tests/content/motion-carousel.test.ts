import { describe, expect, it } from "vitest";
import { isMotionCarouselAsk, MOTION_CAROUSEL_GUIDE } from "@config/content-motion-carousel";

describe("motion carousel guide", () => {
  it("holds Instagram's rules, when to use it, how a slide is built, and the honest delivery line", () => {
    for (const w of ["حتى ٢٠ شريحة", "1080×1350", "أول فريم", "الشريحة الثانية", "بلا صوت", "لا يُستعمل حين", "٣ إلى ٦ ثوانٍ", "مؤثر ناعم", "الشرائح المتصلة", "امسك واسحب", "صورًا ثابتة"]) expect(MOTION_CAROUSEL_GUIDE).toContain(w);
  });
  it("goes with carousel and motion talk only", () => {
    for (const t of ["أبي كاروسيل عن القهوة", "سوّ لي شرائح", "كاروسيل متحرك", "motion carousel"]) expect(isMotionCarouselAsk(t)).toBe(true);
    for (const t of ["اكتب لي سكربت ريل", "كابشن لبوست"]) expect(isMotionCarouselAsk(t)).toBe(false);
  });
});
