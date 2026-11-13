import { describe, expect, it } from "vitest";
import { CONTENT_PATHS, CONTENT_PATH_IDS, findPath, isContentPath, PATH_EDIT_RULES, PATH_TALK_RULES } from "@config/content-paths";
import { decisionsOf, pathLine, stripMarks } from "@/lib/content/marks";
import { chosenBlock, chosenIds, pathBlock } from "@/lib/content/persona";
import { carouselHold, pathOf, pickedKind } from "@/lib/content/maker";
import { CAROUSEL_STYLES } from "@config/content-carousel-styles";
import type { Turn } from "@/lib/content/chats";

const user = (text: string): Turn => ({ role: "user", text });

describe("the four paths", () => {
  it("are carousel, motion carousel, motion graphics and graphics on a reel, each with its own first questions and steps", () => {
    expect(CONTENT_PATH_IDS).toEqual(["carousel", "motion-carousel", "motion-graphics", "reel-graphics"]);
    expect(CONTENT_PATHS.map((p) => p.name)).toEqual(["كاروسيل", "موشن كاروسيل", "موشن جرافكس", "جرافكس على ريل"]);
    for (const p of CONTENT_PATHS) {
      expect(isContentPath(p.id)).toBe(true);
      expect(p.first.length).toBeGreaterThan(1);
      expect(p.first.length).toBeLessThanOrEqual(3);
      for (const q of p.first) expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(p.steps.length).toBeGreaterThan(3);
      expect(p.flow).toContain(p.name);
    }
    expect(findPath("nope")).toBeNull();
  });
});

describe("the path mark", () => {
  it("is hidden from the person, read by the server, and the last one wins when they switch", () => {
    const first = user(pathLine("carousel", "أبي كاروسيل"));
    expect(stripMarks(first.text)).toBe("أبي كاروسيل");
    expect(pathOf([first])).toBe("carousel");
    expect(pathOf([first, user(pathLine("motion-carousel", "لا، خلنا موشن"))])).toBe("motion-carousel");
    expect(chosenIds([first.text, pathLine("reel-graphics", "ريل")]).path).toBe("reel-graphics");
    expect(pathOf([user("بدون مسار")])).toBeNull();
  });

  it("fixes still or motion for the carousel paths, so «ثابت أو متحرك؟» is never asked there", () => {
    expect(pickedKind([user(pathLine("carousel", "كاروسيل"))])).toBe("still");
    expect(pickedKind([user(pathLine("motion-carousel", "موشن"))])).toBe("motion");
    expect(pickedKind([user("كاروسيل")])).toBeNull();
    const asked = (path: string) => carouselHold([user(`${pathLine(path, "فكرتي")}\n• ستايل الكاروسيل: «س» [كاروسيل:${CAROUSEL_STYLES.find((s) => !s.photoIdea)!.id}]\n• الألوان: «ألوان الستايل نفسها» [ألوان:style]\n• الخط: خط [خط:auto]`)]);
    expect(asked("carousel")?.question.label).toBe("من يصمم الشرائح؟");
    expect(asked("motion-carousel")?.question.kind).toBe("motioncarousels");
  });
});

describe("what محمد باقر is told", () => {
  it("is short by default, longer on request, always knows how to read edits, and follows the path's steps", () => {
    const ids = chosenIds([pathLine("motion-graphics", "موشن")]);
    const short = pathBlock(ids, false);
    expect(short).toContain(PATH_TALK_RULES);
    expect(short).toContain(PATH_EDIT_RULES);
    expect(short).toContain("مسار «موشن جرافكس»");
    expect(short).not.toContain("وضع المحادثة المطوّلة");
    expect(pathBlock(ids, true)).toContain("وضع المحادثة المطوّلة");
    expect(chosenBlock(ids)).toBe("");
    // a conversation with no path still gets the short talk and the edit rules
    const none = pathBlock(chosenIds([]), false);
    expect(none).toContain(PATH_TALK_RULES);
    expect(none).toContain(PATH_EDIT_RULES);
  });

  it("offers the skills for a talking video only on the reel path", () => {
    expect(pathBlock(chosenIds([pathLine("reel-graphics", "ريل")]), false)).toContain("مهارات الموشن على المتكلم");
    expect(pathBlock(chosenIds([pathLine("carousel", "ك")]), false)).not.toContain("مهارات الموشن على المتكلم");
  });
});

describe("the decisions over the chat", () => {
  it("are read from the marks, the last of each kind, with the names the person saw", () => {
    const d = decisionsOf([pathLine("carousel", "أبي كاروسيل"), `• ستايل الكاروسيل: «النوتبوك» [كاروسيل:${CAROUSEL_STYLES[0].id}]\n• الخط: «لاليزار» [خط:lalezar]`, "• الخط: اختر لي الأنسب [خط:auto]"]);
    expect(d.map((x) => [x.key, x.name])).toEqual([["path", "كاروسيل"], ["carousel", "النوتبوك"], ["font", "تلقائي"]]);
    expect(d.find((x) => x.key === "font")?.change).toBe("أبي أغيّر الخط");
    expect(decisionsOf(["مرحبا"])).toEqual([]);
  });
});
