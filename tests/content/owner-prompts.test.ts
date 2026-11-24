import { describe, expect, it } from "vitest";
import { COVER_RULE, ownerPrompts, promptSource } from "@/lib/content/produce";
import type { Chat, PendingProduce } from "@/lib/content/chats";

describe("the owner's copy of the slide prompts", () => {
  it("gives every slide its full prompt, with and without slide 1 as reference", () => {
    const p = { id: "x", aspect: "2:3", at: 0, styleId: "", templateId: "", mode: "all", slides: [{ n: 1, text: "غلاف", prompt: "COVER BRIEF" }, { n: 2, text: "رواية", prompt: "SLIDE BRIEF" }] } as PendingProduce;
    const o = ownerPrompts(p);
    expect(o.aspect).toBe("2:3");
    expect(o.slides.map((s) => s.n)).toEqual([1, 2]);
    expect(o.slides[0].withRef).toBe(o.slides[0].alone);
    expect(o.slides[0].alone).toContain(COVER_RULE);
    expect(o.slides[0].alone).toContain("COVER BRIEF");
    expect(o.slides[1].withRef).toContain("The reference picture is slide 1");
    expect(o.slides[1].alone).not.toContain("The reference picture");
    expect(o.slides[1].alone).toContain("SLIDE BRIEF");
  });
  it("after a failed draw, the failed slides are the source", () => {
    const slides = { aspect: "2:3", items: [], todo: [], failed: [{ n: 2, reason: "r", text: "t", prompt: "BRIEF 2" }], running: false, total: 7, styleId: "", templateId: "", carouselId: "duotone-product" };
    const chat = { id: "c", title: "", pending: null, messages: [{ role: "assistant", text: "x", slides }] } as unknown as Chat;
    const src = promptSource(chat);
    expect(src?.carouselId).toBe("duotone-product");
    expect(src?.slides).toEqual([{ n: 2, text: "t", prompt: "BRIEF 2" }]);
    expect(promptSource({ ...chat, messages: [] } as unknown as Chat)).toBeNull();
  });
});
