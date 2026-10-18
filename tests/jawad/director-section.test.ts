import { describe, expect, it } from "vitest";
import { DEFAULT_SECTIONS, FIXED_IMPLEMENTATIONS, sectionPath, unifiedStudioNavigation } from "@config/jawad/sections";
import { directorGeneratorsOf } from "@/lib/jawad/server/director-generators";
import { contextOf } from "@/lib/director/chats";

describe("«جواد المخرج» as a section of its own", () => {
  const s = DEFAULT_SECTIONS.find((x) => x.id === "director")!;
  it("is a built-in section with its own page, shown in the navigation", () => {
    expect(s.implementation).toBe("director");
    expect(FIXED_IMPLEMENTATIONS).toContain("director");
    expect(sectionPath(s)).toBe("/jawad-ai/director");
    const nav = unifiedStudioNavigation(DEFAULT_SECTIONS.map((x) => ({ ...x, path: sectionPath(x) })));
    expect(nav.some((x) => x.id === "director")).toBe(true);
  });
  it("offers only image and video generators", () => {
    expect(directorGeneratorsOf([{ id: "no-such-generator", name: "x" }])).toEqual([]);
  });
  it("tells the page to hand over by itself once the conversation is critical", () => {
    const long = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? ("assistant" as const) : ("user" as const), text: "س".repeat(4000) }));
    expect(contextOf(long).level).toBe("critical");
  });
});
