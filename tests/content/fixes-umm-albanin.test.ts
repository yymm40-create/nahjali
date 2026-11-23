import { describe, expect, it } from "vitest";
import { isEmptyReply } from "@/lib/content/chat";
import { COVER_RULE, slidePrompt } from "@/lib/content/produce";
import { soundOnlyAsk } from "@/components/jawad/content/media-prep";

// What the first real two-chat carousel (Umm al-Banin, 23 Nov 2026) showed.
describe("the fixes after the Umm al-Banin carousel", () => {
  it("an answer of dots only is an empty answer", () => {
    expect(isEmptyReply("…")).toBe(true);
    expect(isEmptyReply("...")).toBe(true);
    expect(isEmptyReply("  … \n")).toBe(true);
    expect(isEmptyReply("تمام")).toBe(false);
  });

  it("slide 1 carries the cover-and-hook rules; the others do not", () => {
    const one = slidePrompt({ n: 1, total: 8, prompt: "x", styleId: "", withRef: false });
    const two = slidePrompt({ n: 2, total: 8, prompt: "x", styleId: "", withRef: true });
    expect(one).toContain(COVER_RULE);
    expect(COVER_RULE).toContain("HUGE");
    expect(two).not.toContain(COVER_RULE);
  });

  it("a YouTube link wanted for its sound only gets no frames sheet", () => {
    expect(soundOnlyAsk("حمّل صوته وخلّه الخلفية الصوتية")).toBe(true);
    expect(soundOnlyAsk("هذي لطمية حطها تحت الشرائح")).toBe(true);
    expect(soundOnlyAsk("لخص لي هذا الفيديو")).toBe(false);
    expect(soundOnlyAsk("خذ صوته وصور من الفيديو")).toBe(false);
  });
});
