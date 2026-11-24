import { describe, expect, it } from "vitest";
import { COVER_RULE, ownerPrompts } from "@/lib/content/produce";
import type { PendingProduce } from "@/lib/content/chats";

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
});
