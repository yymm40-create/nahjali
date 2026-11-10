import { describe, expect, it, vi } from "vitest";

// a tool runs the site's own route as the linked person: the route's sign-in check finds them without any cookie
const person = { id: "22222222-2222-2222-2222-222222222222", email: "p@example.com", app_metadata: {} };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }));
vi.mock("@/lib/access", async (orig) => ({ ...(await orig<object>()), can: vi.fn(async () => true), unlimitedFor: vi.fn(async () => false) }));
vi.mock("@/lib/editor/server", async (orig) => ({ ...(await orig<object>()), listEditorProjects: vi.fn(async (uid: string) => [{ id: "p1", title: `of ${uid}`, kind: "reel" }]) }));

describe("acting as the linked person", () => {
  it("a route sees the person inside actAs, and nobody outside it", async () => {
    const { actAs } = await import("@/lib/mcp/acting");
    const { callRoute } = await import("@/lib/mcp/call-route");
    const route = await import("@/app/api/jawad/editor/projects/route");
    const r = await actAs(person as never, () => callRoute<{ projects: { title: string }[] }>(route.GET as never, { origin: "https://x.test", path: "/api/jawad/editor/projects" }));
    expect(r.projects[0].title).toBe(`of ${person.id}`);
    await expect(callRoute(route.GET as never, { origin: "https://x.test", path: "/api/jawad/editor/projects" })).rejects.toMatchObject({ status: 401 });
  });
});
