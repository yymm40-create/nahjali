import { describe, expect, it, vi } from "vitest";

// the database lists one published course; the sitemap adds its page to the public ones
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ eq: async () => ({ data: [{ id: "c0ffee00-0000-4000-8000-000000000001" }], error: null }) }) }) }),
}));
const { default: sitemap } = await import("@/app/sitemap");
const { CREATIVE_METHODS } = await import("@config/jawad/creative");

describe("sitemap.xml (SEO audit)", () => {
  it("lists the public pages, every creative method and the published courses, all on the main address", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    for (const p of ["/jawad-ai", "/jawad-ai/images", "/jawad-ai/content", "/jawad-ai/designer", "/jawad-ai/editor", "/jawad-ai/student", "/jawad-ai/connect", "/jawad-ai/gallery", "/terms"])
      expect(urls).toContain(`https://www.aljawadai.app${p}`);
    for (const m of CREATIVE_METHODS) expect(urls).toContain(`https://www.aljawadai.app/jawad-ai/creative/${m.slug}`);
    expect(urls).toContain("https://www.aljawadai.app/jawad-ai/course/c0ffee00-0000-4000-8000-000000000001");
    expect(new Set(urls).size).toBe(urls.length);
    // pages that send a visitor to sign in stay out
    expect(urls.some((u) => /\/jawad-ai\/(film|learn|account|login|admin)/.test(u))).toBe(false);
  });
});
