import { describe, expect, it } from "vitest";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";
import { DEFAULT_SECTIONS } from "@config/jawad/sections";
import { GENERATORS } from "@config/jawad/generators";
import { OUTPUT_KINDS } from "@config/jawad/student";
import { siteSystem } from "@/lib/film/anthropic";
import { PLATFORM_BRIEF } from "@config/jawad/brief";
import { SECTION_IMPLEMENTATIONS } from "@config/jawad/sections";

// What every Claude request knows about the site has to follow the site: a new section, generator or study output
// added without a word about it here fails.
describe("site knowledge for Claude", () => {
  it("names every built-in section and where it opens", () => {
    for (const s of DEFAULT_SECTIONS) {
      expect(JAWAD_KNOWLEDGE, s.name).toContain(`«${s.name}»`);
      expect(JAWAD_KNOWLEDGE, s.id).toContain(`/jawad-ai/${["film", "student", "editor", "islamic", "games", "content", "designer", "booklet"].includes(s.implementation) ? s.implementation : s.id}`);
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
    expect(siteSystem("a", true, true)[0].text).toBe(siteSystem("b", false, true)[0].text);
    expect(siteSystem("a")[0].text).toBe(siteSystem("b", false)[0].text);
  });

  it("the owner's conversations read it all, first, with its own cache mark; a customer's robot reads the short brief", () => {
    const s = siteSystem("TASK", true, true);
    expect(s[0]).toEqual({ type: "text", text: JAWAD_KNOWLEDGE, cache_control: { type: "ephemeral" } });
    expect(s.at(-1)).toEqual({ type: "text", text: "TASK", cache_control: { type: "ephemeral" } });
    // a customer: like a plain Claude conversation with the robot's own training (the owner, 2 November 2026)
    const c = siteSystem("TASK");
    expect(c[0]).toEqual({ type: "text", text: PLATFORM_BRIEF });
    expect(c[1]).toEqual({ type: "text", text: "TASK", cache_control: { type: "ephemeral" } });
    expect(JSON.stringify(c)).not.toContain(JAWAD_KNOWLEDGE.slice(0, 200));
    expect(PLATFORM_BRIEF.length).toBeLessThan(6000);
    for (const s2 of Object.values(SECTION_IMPLEMENTATIONS)) expect(PLATFORM_BRIEF).toContain(s2.label);
    expect(siteSystem("TASK", false)[1]).toEqual({ type: "text", text: "TASK" });
  });
});
