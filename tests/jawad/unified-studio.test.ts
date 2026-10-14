import { describe, expect, it } from "vitest";
import { DEFAULT_SECTIONS, sectionPath, unifiedStudioNavigation } from "@config/jawad/sections";

describe("unified creative studio", () => {
  it("shows image, video and audio as one navigation item", () => {
    const sections = unifiedStudioNavigation([
      ...DEFAULT_SECTIONS.map((section) => ({ ...section, path: sectionPath(section) })),
      { id: "director", name: "جواد المخرج", icon: "film", implementation: "film" as const, sort: 25, enabled: true, path: "/jawad-ai/director" },
    ]);
    expect(sections.filter((section) => ["images", "video", "audio"].includes(section.id))).toEqual([
      expect.objectContaining({ id: "images", name: "الاستوديو الإبداعي", path: "/jawad-ai/images" }),
    ]);
    expect(sections.some((section) => section.id === "director")).toBe(false);
  });

  it("keeps the old routes available for direct links", () => {
    expect(sectionPath(DEFAULT_SECTIONS.find((section) => section.id === "video")!)).toBe("/jawad-ai/video");
    expect(sectionPath(DEFAULT_SECTIONS.find((section) => section.id === "audio")!)).toBe("/jawad-ai/audio");
  });
});
