import { beforeEach, describe, expect, it, vi } from "vitest";
import { CARTOON_OFFER } from "@config/jawad/cartoon-offer";
const mocks = vi.hoisted(() => ({ rows: [] as { user_id: string; kind: string; status: string }[], filters: [] as [string, unknown][] }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      let kind = "";
      const query = {
        select: () => query, like: () => query, neq: () => query, gte: () => query,
        eq: (field: string, value: unknown) => { mocks.filters.push([field, value]); if (field === "inputs->cartoon->>freeOffer") kind = String(value); return query; },
        limit: async () => ({ data: mocks.rows.filter(row => row.kind === kind && row.status !== "failed").map(row => ({ user_id: row.user_id })), error: null }),
      };
      return query;
    },
  }),
}));
import { cartoonFree, cartoonOfferLeft } from "@/lib/jawad/server/cartoon-offer";
const take = (n: number, kind: string) => Array.from({ length: n }, (_, i) => ({ user_id: "u" + i, kind, status: "succeeded" }));
beforeEach(() => { mocks.rows = []; mocks.filters = []; });
describe("the cartoon opening offer", () => {
  it("is 20 free pictures and 2 free films, one each per account", () => {
    expect(CARTOON_OFFER).toMatchObject({ pictures: 20, videos: 2 });
  });
  it("gives the picture to the first 20 accounts only, once each", async () => {
    mocks.rows = take(19, "pic");
    expect(await cartoonFree("new", "pic")).toBe(true);
    expect(await cartoonFree("u3", "pic")).toBe(false);
    mocks.rows = take(20, "pic");
    expect(await cartoonFree("new", "pic")).toBe(false);
    expect(mocks.filters).toContainEqual(["inputs->cartoon->>freeOffer", "pic"]);
  });
  it("gives the film to the first 2 accounts only, and a failed one does not count", async () => {
    mocks.rows = [...take(1, "video"), { user_id: "x", kind: "video", status: "failed" }, ...take(20, "pic")];
    expect(await cartoonFree("x", "video")).toBe(true);
    expect(await cartoonOfferLeft()).toEqual({ pictures: 0, videos: 1 });
    mocks.rows = take(2, "video");
    expect(await cartoonFree("new", "video")).toBe(false);
  });
});
