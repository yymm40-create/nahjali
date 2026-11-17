import { describe, expect, it } from "vitest";
import { chatEditPatch } from "@/lib/content/produce";
import type { SlidesBlock } from "@/lib/content/chats";

const still = { aspect: "4:5", items: [{ n: 1, fileId: "f1", name: "slide-01", text: "أ" }], todo: [], failed: [], running: false, total: 1 } as unknown as SlidesBlock;

describe("a slide edit asked in the chat", () => {
  it("is not a patch for a carousel that does not move (drawn again as before)", async () => {
    expect(await chatEditPatch("u", "c", still, [{ n: 1, text: "أ" }], "خل الكتابة تحت")).toBeNull();
  });
  it("is not a patch without the person's words", async () => {
    expect(await chatEditPatch("u", "c", { ...still, motion: { styleId: "x", route: "x", seconds: 6 } } as unknown as SlidesBlock, [{ n: 1, text: "أ" }], "  ")).toBeNull();
  });
  it("is not a patch for a slide that failed (it has no program to change)", async () => {
    const b = { ...still, motion: { styleId: "x", route: "x", seconds: 6 }, failed: [{ n: 1, text: "أ", prompt: "", reason: "" }] } as unknown as SlidesBlock;
    expect(await chatEditPatch("u", "c", b, [{ n: 1, text: "أ" }], "خل الكتابة تحت")).toBeNull();
  });
});
