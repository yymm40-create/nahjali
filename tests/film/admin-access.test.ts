import { beforeEach, describe, expect, it, vi } from "vitest";

// a tiny in-memory Supabase: tables of rows, eq/in filters, insert/update/select/single/maybeSingle
const mem = vi.hoisted(() => ({ tables: {} as Record<string, Record<string, unknown>[]>, n: 0 }));

vi.mock("@/lib/supabase/admin", () => {
  const query = (table: string) => {
    const rows = () => (mem.tables[table] ??= []);
    const filters: ((r: Record<string, unknown>) => boolean)[] = [];
    let patch: Record<string, unknown> | null = null;
    let insert: Record<string, unknown> | null = null;
    const pick = () => rows().filter((r) => filters.every((f) => f(r)));
    const run = () => {
      if (insert) {
        const row = { id: `id-${++mem.n}`, ...insert };
        rows().push(row);
        return [row];
      }
      if (patch) {
        const hit = pick();
        for (const r of hit) Object.assign(r, patch);
        return hit;
      }
      return pick();
    };
    const q = {
      select: () => q,
      order: () => q,
      limit: () => q,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
      in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), q),
      insert: (r: Record<string, unknown>) => ((insert = r), q),
      update: (r: Record<string, unknown>) => ((patch = r), q),
      single: async () => ({ data: run()[0] ?? null, error: null }),
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      then: (ok: (v: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: run(), error: null }).then(ok),
    };
    return q;
  };
  return { createAdminClient: () => ({ from: query, auth: { admin: { getUserById: async (id: string) => ({ data: { user: { email: `${id}@mail` } } }) } } }) };
});

const { answerAccess, hasAdminAccess, pendingForOwner, requestAccess, revokeAccess } = await import("@/lib/film/admin-access");
const { canOpenProject } = await import("@/lib/film/access");
const { payerOf } = await import("@/lib/film/usage");

const P = "11111111-1111-4111-8111-111111111111";
const owner = { id: "owner", email: "someone@mail.com" };
const admin = { id: "admin", email: "yymm40@gmail.com" };
const project = { id: P, user_id: "owner", series_id: null } as never;

describe("«اسمح للأدمن بالدخول على مشروعك»", () => {
  beforeEach(() => {
    mem.tables = { film_projects: [{ id: P, user_id: "owner", title: "عباية الرأس", series_id: null }], film_project_access: [] };
  });

  it("only an admin may ask, never for his own project", async () => {
    await expect(requestAccess({ id: "x", email: "x@mail.com" }, P)).rejects.toThrow("للأدمن");
    mem.tables.film_projects[0].user_id = "admin";
    await expect(requestAccess(admin, P)).rejects.toThrow("مشروعك");
  });

  it("the owner sees the request; until he allows it the admin can't open the project", async () => {
    const r = await requestAccess(admin, P);
    expect(r.status).toBe("pending");
    expect(await pendingForOwner("owner")).toEqual([expect.objectContaining({ id: r.id, title: "عباية الرأس" })]);
    expect(await canOpenProject(project, "admin")).toBe(false);
    await expect(answerAccess(admin, r.id, true)).rejects.toThrow("ما لقينا");
  });

  it("allowed: the admin works on the owner's project itself and pays himself; stopped: he is out", async () => {
    const r = await requestAccess(admin, P);
    await answerAccess(owner, r.id, true);
    expect(await hasAdminAccess(P, "admin")).toBe(true);
    expect(await canOpenProject(project, "admin")).toBe(true);
    expect((await payerOf(P, admin)).id).toBe("admin");
    expect(await pendingForOwner("owner")).toEqual([]);
    await revokeAccess(owner, r.id);
    expect(await canOpenProject(project, "admin")).toBe(false);
    // asking again waits for the owner again
    expect((await requestAccess(admin, P)).status).toBe("pending");
  });

  it("refused: no access", async () => {
    const r = await requestAccess(admin, P);
    await answerAccess(owner, r.id, false);
    expect(await canOpenProject(project, "admin")).toBe(false);
  });
});
