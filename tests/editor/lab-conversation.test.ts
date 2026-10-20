import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { partialField } from "@/components/jawad/editor/lab-watch";
import { labResponse } from "@/lib/editor/scene/response";
import { COVER_RULES_TEXT, COVER_SKILL_TEXT } from "@/lib/editor/cover-skill-text";
import { COVER_PASS, COVER_RUBRIC } from "@/lib/editor/scene/cover-rubric";
import { readPlan } from "@/lib/editor/scene/contract";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";

describe("«مختبر الموشن» as one conversation", () => {
  it("shows the program while it is written: a string field of unfinished JSON, decoded as far as it goes", () => {
    expect(partialField('{"code":"scene({\\n  duration: 3,', "code")).toBe("scene({\n  duration: 3,");
    expect(partialField('{"notes":"x","code":"a\\"b\\\\c"', "code")).toBe('a"b\\c');
    expect(partialField('{"code":"\\u0627\\u0644', "code")).toBe("ال");
    // an escape cut in the middle stops before it (never shows a half character)
    expect(partialField('{"code":"ab\\u06', "code")).toBe("ab");
    expect(partialField('{"code":"done","notes":"n"}', "code")).toBe("done");
    expect(partialField('{"notes":"not yet', "code")).toBe("");
  });

  it("answers a watched step one JSON object a line: the pieces as written, then the result", async () => {
    const res = labResponse(async (onText) => {
      onText?.('{"code":"scene(');
      onText?.('{})"}');
      await new Promise((r) => setTimeout(r, 260));
      return { code: "scene({})", problems: [] };
    }, true);
    expect(res.headers.get("content-type")).toContain("ndjson");
    const lines = (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l) as { w?: string; r?: unknown });
    expect(lines.map((l) => l.w ?? "").join("")).toBe('{"code":"scene({})"}');
    expect(lines[lines.length - 1].r).toEqual({ code: "scene({})", problems: [] });
  });

  it("keeps the plain answer for steps nobody watches (spaces, then the JSON)", async () => {
    const res = labResponse(async () => ({ ok: 1 }));
    expect(JSON.parse(await res.text())).toEqual({ ok: 1 });
  });

  it("lets the scenario ask GPT Image 2 for at most four pictures (no writing in them is the server's rule)", () => {
    const plan = readPlan({ title: "t", shots: [{ from: 0, to: 3, what: "x" }], pictures: [{ prompt: "a brass coffee pot on dunes at dusk, empty sky for type", name: "دلة", use: "hero", aspect: "9:16" }, { prompt: "x" }, ...Array(6).fill({ prompt: "long enough prompt", name: "n", use: "u", aspect: "nope" })] }, 10);
    expect(plan.pictures?.length).toBe(4);
    expect(plan.pictures?.[0]).toEqual({ prompt: "a brass coffee pot on dunes at dusk, empty sky for type", name: "دلة", use: "hero", aspect: "9:16" });
    expect(plan.pictures?.[1].aspect).toBe("1:1");
  });

  it("designs the cover by the owner's cover skill, word for word", () => {
    // if this fails the skill changed: copy it again into config/editor/skills/thumbnail-video and regenerate the text
    expect(COVER_SKILL_TEXT).toBe(readFileSync("config/editor/skills/thumbnail-video/SKILL.md", "utf8"));
    expect(COVER_RULES_TEXT).toBe(readFileSync("config/editor/skills/thumbnail-video/references/thumbnails.md", "utf8"));
    expect(COVER_RULES_TEXT).toContain("170");
    expect(COVER_RUBRIC.map((r) => r.id)).toEqual(["read", "square", "hook", "face", "contrast", "brand", "finish"]);
    expect(COVER_PASS).toBe(8);
  });

  it("is told to every robot as it is now (a conversation, kept on the server)", () => {
    expect(JAWAD_KNOWLEDGE).toContain("IS ONE CONVERSATION NOW");
    expect(JAWAD_KNOWLEDGE).toContain("motion_lab_chats");
    expect(JAWAD_KNOWLEDGE).not.toContain("SOLID studio in five steps");
  });
});
