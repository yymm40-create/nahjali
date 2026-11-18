import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/content/sound", async (orig) => ({
  ...(await orig<typeof import("@/lib/content/sound")>()),
  chatSound: vi.fn(async () => ({ uploadId: "u", name: "v", kind: "video", seconds: 60, phrases: [
    { text: "اثنين:", from: 29.29, to: 29.8 },
    { text: "العلاقات التي تتكون بين القراء", from: 30.2, to: 34.7 },
    { text: "وهذا ما نجده في نوادي القراءة", from: 35.3, to: 38.1 },
    { text: "الجملة التالية", from: 43, to: 45 },
  ] })),
}));

describe("a slide's new time, its new words", () => {
  it("are the phrases said inside the new time, in order", async () => {
    const { wordsBetween } = await import("@/lib/content/produce");
    expect(await wordsBetween("u", [], 29.29, 42.36)).toBe("اثنين: العلاقات التي تتكون بين القراء وهذا ما نجده في نوادي القراءة");
    expect(await wordsBetween("u", [], 35, 46)).toBe("وهذا ما نجده في نوادي القراءة الجملة التالية");
  });
});
