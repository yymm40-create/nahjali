// «نسخة GPT Image» in «صانع المحتوى» (the owner, 28 November 2026): GPT Image 2 or GPT Image 2.6 (Sunburst) — the
// person's pick paints the carousel's pictures, the media step follows the last pick, and 2.6 is open there even while
// it is hidden from the studio's list.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gptOf } from "@/lib/content/produce";
import { GPT_IMAGE_26_ID, generatorById } from "@config/jawad/generators";

const read = (p: string) => readFileSync(p, "utf8");

describe("GPT Image 2.6 in the content maker", () => {
  it("a carousel picked with 2.6 is painted by GPT Image 2.6 in the model pressed; otherwise جواد's default, GPT Image 2", () => {
    expect(gptOf({ gpt26: "sunburst" })).toEqual({ generatorId: GPT_IMAGE_26_ID, variant: "sunburst" });
    expect(gptOf({ gpt26: "flare" })).toEqual({ generatorId: GPT_IMAGE_26_ID, variant: "flare" });
    expect(gptOf({})).toEqual({});
    const g = generatorById(GPT_IMAGE_26_ID)!;
    const values = (key: string) => {
      const o = g.options.find((x) => x.key === key);
      return o && "values" in o ? o.values.map((v) => v.value) : [];
    };
    expect(values("variant")).toEqual(expect.arrayContaining(["sunburst", "flare"]));
    // the slides' quality exists on 2.6 too
    expect(values("quality")).toContain("medium");
  });

  it("is wired: every picture of the carousel, the media step, and the job's gate", () => {
    const produce = read("src/lib/content/produce.ts");
    expect(produce.match(/\.\.\.gptOf\(p\)/g)?.length).toBe(2);
    expect(read("src/lib/content/media.ts")).toContain("variant: c.gpt26");
    // «لامحدود»: the version question says which version the person's pass makes free
    expect(read("src/lib/content/chat.ts")).toContain("versionPassNote(userId, hold.question)");
    expect(read("src/lib/content/chat.ts")).toContain("versionPassNote(userId, step.question)");
    expect(read("src/lib/jawad/server/jobs.ts")).toContain('server.via === "content" && def.id === GPT_IMAGE_26_ID && rg.keyConfigured');
  });
});
