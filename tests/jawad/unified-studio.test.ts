import { describe, expect, it } from "vitest";
import { DEFAULT_SECTIONS, sectionPath, unifiedStudioNavigation } from "@config/jawad/sections";

describe("unified creative studio", () => {
  it("shows image, video and audio as one navigation item", () => {
    const sections = unifiedStudioNavigation(DEFAULT_SECTIONS.map((section) => ({ ...section, path: sectionPath(section) })));
    expect(sections.filter((section) => ["images", "video", "audio"].includes(section.id))).toEqual([
      expect.objectContaining({ id: "images", name: "الاستوديو الإبداعي", path: "/jawad-ai/images" }),
    ]);
    // «جواد المخرج» is a section of its own now, not part of the studio
    expect(sections.some((section) => section.id === "director")).toBe(true);
  });

  it("keeps the old routes available for direct links", () => {
    expect(sectionPath(DEFAULT_SECTIONS.find((section) => section.id === "video")!)).toBe("/jawad-ai/video");
    expect(sectionPath(DEFAULT_SECTIONS.find((section) => section.id === "audio")!)).toBe("/jawad-ai/audio");
  });
});
