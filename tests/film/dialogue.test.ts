import { describe, expect, it } from "vitest";
import { withoutSpokenArabic } from "@/lib/film/director";
import { dialogueSource, startingMode } from "@/lib/film/dialogue-source";

describe("«الحوار من الصوت فقط»", () => {
  it("takes the quoted Arabic lines out of the prompt and keeps everything else", () => {
    const p = 'Audio: Abdullah says "السَّلامُ عَلَيكُم" softly. Sign reads "OPEN". Then «كَيفَ حالُك».';
    expect(withoutSpokenArabic(p)).toBe('Audio: Abdullah says (the line spoken in the attached dialogue audio) softly. Sign reads "OPEN". Then (the line spoken in the attached dialogue audio).');
  });
});

describe("«مصدر الحوار» from the screenwriter's handoff", () => {
  it("reads each of the four answers", () => {
    expect(dialogueSource("# قرارات الإخراج\n- مصدر الحوار: تتولّد الفويسات هنا (بأصوات الجواد) وتنحط أصوات مرجعية مع كل فيديو")).toBe("make");
    expect(dialogueSource("مصدر الحوار: أرفعها من جهازي وتنحط أصوات مرجعية مع كل فيديو")).toBe("upload");
    expect(dialogueSource("مصدر الحوار: بدون أصوات مرجعية — الفيديو يولّد الكلام بنفسه")).toBe("self");
    expect(dialogueSource("**مصدر الحوار:** الفيديو بدون حوار، وأضيف الحوار بعدين في المونتاج")).toBe("later");
    expect(dialogueSource("# قرارات الإخراج\n- كل توليد ٣٠ ثانية")).toBeNull();
    expect(dialogueSource(null)).toBeNull();
  });
  it("starts each shot on that choice", () => {
    expect(startingMode("make", true)).toBe("make");
    expect(startingMode("make", false)).toBe("none");
    expect(startingMode(null, true)).toBe("make");
    expect(startingMode("upload", true)).toBe("upload");
    expect(startingMode("self", true)).toBe("none");
    expect(startingMode("later", true)).toBe("none");
  });
});
