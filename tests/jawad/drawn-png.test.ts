import { beforeEach, describe, expect, it, vi } from "vitest";

// A big PNG of «حيدرا ماكس» (a photo-real slide) passes Vercel's 4.5 MB body limit: the page puts it up first and sends
// its id; the server reads it once and drops it (the 413 of 5 Nov 2026).

const row = { id: "11111111-1111-4111-8111-111111111111", user_id: "u1", kind: "image", mime: "image/png", status: "ready", storage_path: "u1/refs/a.png" };
const state = { found: row as typeof row | null, removed: [] as string[][], deleted: [] as string[] };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: state.found }),
        delete: () => ({ eq: async (_k: string, id: string) => void state.deleted.push(id) }),
      };
      return q;
    },
  }),
}));
vi.mock("@/lib/storage", () => ({
  storage: {
    from: () => ({
      download: async () => ({ data: new Blob([new Uint8Array([137, 80, 78, 71])]), error: null }),
      remove: async (paths: string[]) => void state.removed.push(paths),
    }),
  },
}));

const { drawnPng } = await import("@/lib/jawad/server/uploads");

describe("the drawn PNG", () => {
  beforeEach(() => {
    state.found = row;
    state.removed = [];
    state.deleted = [];
  });

  it("reads a small one inline", async () => {
    const png = Buffer.from([1, 2, 3]).toString("base64");
    expect([...((await drawnPng("u1", { png: `data:image/png;base64,${png}` }, 100)) ?? [])]).toEqual([1, 2, 3]);
    expect(await drawnPng("u1", { png: "x".repeat(200) }, 100)).toBeNull();
  });

  it("reads a big one from the person's upload, once", async () => {
    const buf = await drawnPng("u1", { pngUpload: row.id }, 100);
    expect([...(buf ?? [])]).toEqual([137, 80, 78, 71]);
    expect(state.removed).toEqual([[row.storage_path]]);
    expect(state.deleted).toEqual([row.id]);
  });

  it("refuses an upload that is not their PNG", async () => {
    state.found = { ...row, mime: "image/jpeg" };
    expect(await drawnPng("u1", { pngUpload: row.id }, 100)).toBeNull();
    state.found = null;
    expect(await drawnPng("u1", { pngUpload: row.id }, 100)).toBeNull();
    expect(state.deleted).toEqual([]);
  });

  it("is what every page sends a drawing through", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["src/components/jawad/content/ContentChat.tsx", "src/components/jawad/designer/DesignerChat.tsx"]) expect(readFileSync(f, "utf8")).toContain("...(await pngBody(drawn.png))");
    expect(readFileSync("src/components/claude-code/draw.ts", "utf8")).toContain("pngBody(png).then");
  });
});
