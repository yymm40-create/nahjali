import { describe, expect, it } from "vitest";
import { withoutSpokenArabic } from "@/lib/film/director";

describe("«الحوار من الصوت فقط»", () => {
  it("takes the quoted Arabic lines out of the prompt and keeps everything else", () => {
    const p = 'Audio: Abdullah says "السَّلامُ عَلَيكُم" softly. Sign reads "OPEN". Then «كَيفَ حالُك».';
    expect(withoutSpokenArabic(p)).toBe('Audio: Abdullah says (the line spoken in the attached dialogue audio) softly. Sign reads "OPEN". Then (the line spoken in the attached dialogue audio).');
  });
});
