import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FILM_STYLES } from "@config/film-styles";
import { withStyle } from "@config/jawad/style-prompt";
import { assistantSystem, checkAnswer } from "@config/jawad/assistant";
import { GENERATORS } from "@config/jawad/generators";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

describe("«الستايل» and one «جواد» for the studios", () => {
  it("offers the 24 styles, each with its picture", () => {
    expect(FILM_STYLES).toHaveLength(24);
    for (const s of FILM_STYLES) expect(() => readFileSync(new URL(`../../public/film/styles/${s.id}.jpg`, import.meta.url))).not.toThrow();
  });
  it("puts the style's text in what the generator reads, keeping the prompt", () => {
    const out = withStyle("قطة على سطح", FILM_STYLES[0].text);
    expect(out.startsWith("قطة على سطح")).toBe(true);
    expect(out).toContain(FILM_STYLES[0].text);
    expect(read("src/lib/jawad/server/jobs.ts")).toContain("withStyle(asWritten, style.text)");
  });
  it("جواد knows the styles (not for sound) and may pick one", () => {
    const img = GENERATORS.filter((g) => g.output === "image").slice(0, 1);
    expect(assistantSystem("image", img)).toContain("shinkai");
    expect(assistantSystem("audio", GENERATORS.filter((g) => g.output === "audio").slice(0, 1))).not.toContain("shinkai");
    const draft = { generatorId: img[0].id, prompt: "", instructions: "", settings: {}, refStyle: "none" as const, refs: [], styleId: "" };
    expect(checkAnswer({ reply: "تم", styleId: "ghibli" } as never, { defs: img, draft, attachments: 0 }).set.styleId).toBe("ghibli");
    expect(checkAnswer({ reply: "تم", styleId: "nope" } as never, { defs: img, draft, attachments: 0 }).set.styleId).toBeUndefined();
  });
  it("one conversation for every studio, with past conversations", () => {
    expect(read("src/components/jawad/studio/Studio.tsx")).toContain("storage={user.id}");
    const chat = read("src/components/jawad/studio/AssistantChat.tsx");
    expect(chat).toContain("محادثاتي");
    expect(chat).toContain("KEEP_CHATS");
  });
});
