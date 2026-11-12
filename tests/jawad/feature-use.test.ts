import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanUses, FEATURES, FUNNELS, isFeatureId, MAX_PER_BATCH, recipeFeature, USE_SECTIONS, dayOf } from "@config/feature-use";
import { makeBatch, SAME_USE_MS } from "@/lib/feature-track";

// «استخدام المزايا»: the list of counted features, the page's batching, and the route that adds a batch to the day.
const user = vi.hoisted(() => ({ id: "11111111-1111-4111-8111-111111111111" as string | null }));
const rpc = vi.hoisted(() => vi.fn<(name: string, args: unknown) => Promise<{ data: null; error: unknown }>>(async () => ({ data: null, error: null })));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: user.id ? { id: user.id } : null } }) } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));

const post = async (body: unknown) => {
  const { POST } = await import("@/app/api/feature-use/route");
  return POST(new Request("https://x.test/api/feature-use", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
};

describe("the features counted", () => {
  it("every feature has a label and a known section, and the ids are unique", () => {
    const sections = USE_SECTIONS.map((s) => s.id);
    for (const f of FEATURES) {
      expect(f.label.trim(), f.id).not.toBe("");
      expect(sections, f.id).toContain(f.section);
      expect(f.id.startsWith(`${f.section}.`), f.id).toBe(true);
      // what the table's check accepts (0110)
      expect(f.id, f.id).toMatch(/^[a-z]+(\.[a-z0-9_-]+)+$/);
      expect(f.id.length).toBeLessThanOrEqual(80);
    }
    expect(new Set(FEATURES.map((f) => f.id)).size).toBe(FEATURES.length);
    for (const s of sections) expect(FEATURES.some((f) => f.section === s), s).toBe(true);
  });

  it("every funnel step names features of its own section", () => {
    for (const s of USE_SECTIONS) {
      expect(FUNNELS[s.id].length).toBeGreaterThanOrEqual(3);
      for (const step of FUNNELS[s.id]) {
        expect(step.any.length, step.label).toBeGreaterThan(0);
        for (const id of step.any) expect(FEATURES.find((f) => f.id === id)?.section, id).toBe(s.id);
      }
    }
  });

  it("each ready recipe of «حيدرة كت» has its own feature, a new one falls under «أسلوب جاهز آخر»", async () => {
    const { RECIPES } = await import("@/components/jawad/editor/recipes");
    for (const r of RECIPES) expect(recipeFeature(r.id), r.id).toBe(`editor.recipe.${r.id}`);
    expect(recipeFeature("something-new")).toBe("editor.recipe");
  });

  it("counts on the Saudi day", () => {
    expect(dayOf(Date.UTC(2026, 10, 12, 20, 59))).toBe("2026-11-12");
    expect(dayOf(Date.UTC(2026, 10, 12, 21, 0))).toBe("2026-11-13");
  });
});

describe("the page's batch", () => {
  it("merges repeats into one count per feature, a repeat within a moment being the same use", () => {
    const b = makeBatch();
    expect(b.add("studio.generate", 0)).toBe(true);
    expect(b.add("studio.generate", SAME_USE_MS - 1)).toBe(false);
    // a slider dragged: every call moves the moment on, so it stays one use
    expect(b.add("studio.generate", 2 * SAME_USE_MS - 2)).toBe(false);
    expect(b.add("studio.generate", 10_000)).toBe(true);
    expect(b.add("studio.download", 10_001)).toBe(true);
    expect(JSON.parse(b.take()!)).toEqual({ uses: { "studio.generate": 2, "studio.download": 1 } });
    expect(b.take()).toBeNull();
    // after a send, the moment is still remembered
    expect(b.add("studio.download", 10_002)).toBe(false);
  });
});

describe("POST /api/feature-use", () => {
  beforeEach(() => {
    user.id = "11111111-1111-4111-8111-111111111111";
    rpc.mockClear();
    rpc.mockImplementation(async () => ({ data: null, error: null }));
  });

  it("keeps only the features of the list, with whole counts up to the cap", () => {
    expect(cleanUses({ uses: { "studio.generate": 2.7, "studio.nope": 3, "editor.export.video": 999, "editor.open": 0, "editor.edit": "4" } })).toEqual({
      "studio.generate": 2,
      "editor.export.video": MAX_PER_BATCH,
    });
    expect(cleanUses({ uses: { "studio.nope": 1, toString: 1 } })).toBeNull();
    expect(cleanUses({ uses: [] })).toBeNull();
    expect(cleanUses(null)).toBeNull();
    expect(isFeatureId("constructor")).toBe(false);
  });

  it("rejects a batch with no known feature, and never touches the database for it", async () => {
    const r = await post({ uses: { "studio.unknown": 1, "admin.anything": 5 } });
    expect(r.status).toBe(400);
    expect((await post("not json")).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("adds the known features to the signed-in person's day", async () => {
    const r = await post({ uses: { "studio.generate": 3, "studio.unknown": 1 } });
    expect(r.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]).toEqual(["jawad_feature_use_add", { p_user: user.id, p_day: dayOf(), p_uses: { "studio.generate": 3 } }]);
  });

  it("does not count a visitor who is not signed in", async () => {
    user.id = null;
    expect((await post({ uses: { "studio.open": 1 } })).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("swallows a missing table (0110 not run yet)", async () => {
    rpc.mockImplementation(async () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function public.jawad_feature_use_add" } }));
    const r = await post({ uses: { "editor.open": 1 } });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });
});
