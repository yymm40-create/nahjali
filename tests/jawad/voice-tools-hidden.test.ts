import { beforeAll, describe, expect, it, vi } from "vitest";

// «أدوات الصوت» are hidden from users until the owner turns each on in /jawad-ai/admin/generators (no row = off),
// while the owner can try them first.

vi.mock("@/lib/supabase/admin", () => {
  const empty = { data: [], error: null };
  return { createAdminClient: () => ({ from: () => ({ select: () => Promise.resolve(empty) }) }) };
});
vi.mock("@/lib/coins", async () => ({ loadPricing: async () => (await import("@config/coins")).getPricing() }));

import { loadRuntime, sectionGenerators } from "@/lib/jawad/server/runtime";
import { VOICE_TOOL_IDS } from "@config/jawad/voice-tools";

describe("«أدوات الصوت» start hidden", () => {
  beforeAll(() => {
    process.env.ELEVENLABS_API_KEY = "test";
    process.env.FAL_KEY = "test";
  });

  it("are off for users until the owner switches them on, and the owner can try them", async () => {
    const rt = await loadRuntime();
    for (const id of VOICE_TOOL_IDS) {
      const g = rt.generators.find((x) => x.id === id)!;
      expect(g.sectionId).toBe("audio");
      expect(g.keyConfigured).toBe(true);
      expect(g.enabled).toBe(false);
      expect(g.live).toBe(false);
      expect(g.reason).toMatch(/مخفي/);
      expect(sectionGenerators(rt, "audio", false).some((x) => x.id === id)).toBe(false);
      expect(sectionGenerators(rt, "audio", true).some((x) => x.id === id)).toBe(true);
    }
  });
});
