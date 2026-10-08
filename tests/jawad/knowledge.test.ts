import { describe, expect, it } from "vitest";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";
import { DEFAULT_SECTIONS } from "@config/jawad/sections";
import { GENERATORS } from "@config/jawad/generators";
import { OUTPUT_KINDS } from "@config/jawad/student";
import { siteSystem } from "@/lib/film/anthropic";

// What every Claude request knows about the site has to follow the site: a new section, generator or study output
// added without a word about it here fails.
describe("site knowledge for Claude", () => {
  it("names every built-in section and where it opens", () => {
    for (const s of DEFAULT_SECTIONS) {
      expect(JAWAD_KNOWLEDGE, s.name).toContain(`«${s.name}»`);
      expect(JAWAD_KNOWLEDGE, s.id).toContain(`/jawad-ai/${["film", "student", "editor", "islamic", "games"].includes(s.implementation) ? s.implementation : s.id}`);
    }
  });

  it("names every generator", () => {
    for (const g of GENERATORS) expect(JAWAD_KNOWLEDGE, g.id).toContain(g.name);
  });

  it("names every study output", () => {
    for (const o of OUTPUT_KINDS) expect(JAWAD_KNOWLEDGE, o.kind).toContain(o.name);
  });

  it("stays the same on every request, so it is cached", () => {
    expect(JAWAD_KNOWLEDGE).not.toMatch(/\$\{|\d{4}-\d{2}-\d{2}/);
    expect(siteSystem("a")[0].text).toBe(siteSystem("b", false)[0].text);
  });

  it("comes first, and the task after it keeps the cache mark", () => {
    const s = siteSystem("TASK");
    expect(s[0]).toEqual({ type: "text", text: JAWAD_KNOWLEDGE });
    expect(s[1]).toEqual({ type: "text", text: "TASK", cache_control: { type: "ephemeral" } });
    expect(siteSystem("TASK", false)[1]).toEqual({ type: "text", text: "TASK" });
  });
});
