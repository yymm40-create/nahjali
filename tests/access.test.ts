import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  access: {} as Record<string, string[]>,
  grants: {} as Record<string, string>,
  secret: { code: "", code_id: "c1", enabled: false },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const q = {
        _eq: "" as string,
        select: () => q,
        eq: (_c: string, v: unknown) => {
          q._eq = String(v);
          return q;
        },
        maybeSingle: async () => {
          if (table === "site_access") return { data: db.access[q._eq] ? { perms: db.access[q._eq] } : null };
          if (table === "site_code_grants") return { data: db.grants[q._eq] ? { code_id: db.grants[q._eq] } : null };
          if (table === "site_secret") return { data: db.secret };
          return { data: null };
        },
      };
      return q;
    },
  }),
}));

const { accessOf, can, forgetAccess, permForGenerator, unlimitedFor } = await import("@/lib/access");

describe("«السماح»: one list for the whole site", () => {
  beforeEach(() => {
    db.access = {};
    db.grants = {};
    db.secret = { code: "", code_id: "c1", enabled: false };
    forgetAccess();
  });

  it("the owners have everything; signed out has nothing", async () => {
    expect(await can("yymm40@gmail.com", "film")).toBe(true);
    expect(await can("narjiszahra912@gmail.com", "editor_ai")).toBe(true);
    expect((await accessOf(null)).size).toBe(0);
  });

  it("an email gets only what's ticked for it, free and without limits", async () => {
    db.access["a@b.c"] = ["image", "student"];
    expect(await can("A@b.c", "image")).toBe(true);
    expect(await can("a@b.c", "video")).toBe(false);
    expect(await unlimitedFor("a@b.c")).toBe(true);
    expect(await unlimitedFor("x@y.z")).toBe(false);
  });

  it("«الكود السري» opens everything while that same code is on", async () => {
    db.grants["k@b.c"] = "c1";
    expect(await can("k@b.c", "film")).toBe(false); // off
    db.secret = { code: "1234", code_id: "c1", enabled: true };
    forgetAccess();
    expect(await can("k@b.c", "film")).toBe(true);
    db.secret = { code: "9999", code_id: "c2", enabled: true }; // changed: the old one closes
    forgetAccess();
    expect(await can("k@b.c", "film")).toBe(false);
  });

  it("each generator belongs to its branch", () => {
    expect(permForGenerator({ id: "gpt-image-2", output: "image" })).toBe("image");
    expect(permForGenerator({ id: "seedance", output: "video" })).toBe("video");
    expect(permForGenerator({ id: "elevenlabs-music-v2-5", output: "audio" })).toBe("music");
    expect(permForGenerator({ id: "elevenlabs-sfx-v2", output: "audio" })).toBe("music");
    expect(permForGenerator({ id: "elevenlabs-eleven-v4", output: "audio" })).toBe("voice");
  });
});
