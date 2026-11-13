import { describe, expect, it, vi } from "vitest";
import { GENERATORS } from "@config/jawad/generators";
import { MODEL_ABOUT } from "@config/jawad/model-pages";

// the live runtime: every generator live, one with a picture sample and one with a video sample
vi.mock("@/lib/jawad/server/runtime", () => ({
  loadRuntime: async () => ({
    prices: {},
    generators: GENERATORS.map((g, i) => ({
      id: g.id,
      name: g.name,
      sort: i,
      live: true,
      sampleUrl: g.id === "openai-gpt-image-2" ? "/files/jawad-public/samples/gpt/a.png" : g.id === "wan-3-0" ? "/files/jawad-public/samples/wan/b.mp4" : null,
    })),
  }),
}));
vi.mock("@/lib/coins", () => ({ loadPricing: async () => null }));

const { livePages, livePage } = await import("@/lib/jawad/server/model-pages");

describe("the generators' public pages (/jawad-ai/models)", () => {
  it("every generator has its Arabic introduction (a new one needs a line in config/jawad/model-pages.ts)", () => {
    const missing = GENERATORS.filter((g) => ["image", "video", "audio"].includes(g.output) && !MODEL_ABOUT[g.id]).map((g) => g.id);
    expect(missing).toEqual([]);
  });

  it("builds a page for every live generator: modes, settings, and a price at the default settings where one exists", async () => {
    const pages = await livePages();
    expect(pages.length).toBe(GENERATORS.filter((g) => ["image", "video", "audio"].includes(g.output)).length);
    for (const p of pages) {
      expect(p.modes.length).toBeGreaterThan(0);
      if (p.price != null) {
        expect(p.price).toBeGreaterThan(0);
        expect(p.priceFor.length).toBeGreaterThan(3);
      }
    }
    const gpt = await livePage("openai-gpt-image-2");
    expect(gpt?.price).toBeGreaterThan(0);
    expect(gpt?.priceFor).toMatch(/^صورة وحدة/);
    // a picture sample is shown small; a video sample is not drawn as a picture
    expect(gpt?.sample).toBe("/files/thumb/jawad-public/samples/gpt/a.png?w=480");
    expect((await livePage("wan-3-0"))?.sample).toBeNull();
    // the text-to-video ones are priced from their defaults too
    expect((await livePage("byteplus-seedance-2-5"))?.price).toBeGreaterThan(0);
    expect(await livePage("nope")).toBeNull();
  });
});
