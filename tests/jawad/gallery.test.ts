import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTryDraft, cleanTitle, isShareSlug, newShareSlug, pickTryGenerator, publishStatus, reviewPatch, tryHref, tryLoginHref, galleryFromJob, type GalleryUse } from "@config/jawad/gallery";
import { isFeatureId } from "@config/feature-use";
import { isAdmin } from "@config/site";

// «معرض الناس» + «جرّبه» + the permanent share link: the try-it builder and its fallback, that no reference file is ever
// carried, and the routes' rules — only a work's owner publishes or shares it, only the site's owner approves.

// ── the signed-in person, an in-memory Supabase and the file store (no database or bucket here) ──
const who = vi.hoisted(() => ({ user: null as { id: string; email: string } | null }));
const mem = vi.hoisted(() => ({ tables: {} as Record<string, Record<string, unknown>[]>, n: 0, signed: [] as string[], missing: false }));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: who.user } }) } }) }));
vi.mock("@/lib/access", async (orig) => ({ ...(await orig<object>()), can: async () => true, hasAnyAccess: async () => true, unlimitedFor: async () => false }));
vi.mock("@/lib/storage", () => ({
  storage: { from: () => ({ createSignedUrl: async (path: string) => (mem.signed.push(path), { data: { signedUrl: `https://files.test/${path}?sig=1` }, error: null }) }) },
}));
vi.mock("@/lib/jawad/server/runtime", () => ({ JAWAD_BUCKET: "jawad", loadRuntime: async () => ({ generators: [] }) }));
vi.mock("@/lib/supabase/admin", () => {
  const query = (table: string) => {
    const rows = () => (mem.tables[table] ??= []);
    const filters: ((r: Record<string, unknown>) => boolean)[] = [];
    let patch: Record<string, unknown> | null = null;
    let insert: Record<string, unknown> | null = null;
    let from = 0;
    let to = Infinity;
    const pick = () => rows().filter((r) => filters.every((f) => f(r)));
    // before 0112 runs, the gallery's table is not there
    const gone = () => mem.missing && table === "jawad_gallery";
    const none = { data: null, error: { code: "PGRST205", message: "no table" } };
    const run = () => {
      if (insert) {
        const row = { id: `00000000-0000-4000-8000-${String(++mem.n).padStart(12, "0")}`, status: "none", featured: false, share_on: false, share_slug: null, created_at: new Date().toISOString(), reviewed_at: null, submitted_at: null, ...insert };
        rows().push(row);
        return [row];
      }
      if (patch) {
        const hit = pick();
        for (const r of hit) Object.assign(r, patch);
        return hit;
      }
      return pick().slice(from, to + 1);
    };
    const q = {
      select: () => q,
      order: () => q,
      limit: () => q,
      range: (a: number, b: number) => ((from = a), (to = b), q),
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
      neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), q),
      in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), q),
      insert: (r: Record<string, unknown>) => ((insert = r), q),
      update: (r: Record<string, unknown>) => ((patch = r), q),
      single: async () => (gone() ? none : { data: run()[0] ?? null, error: null }),
      maybeSingle: async () => (gone() ? none : { data: run()[0] ?? null, error: null }),
      then: (ok: (v: unknown) => unknown) => {
        if (gone()) return Promise.resolve(none).then(ok);
        const data = run();
        return Promise.resolve({ data, error: null, count: data.length }).then(ok);
      },
    };
    return q;
  };
  return { createAdminClient: () => ({ from: query, auth: { admin: { getUserById: async (id: string) => ({ data: { user: { email: `${id}@mail.test` } } }) } } }) };
});

const OWNER = { id: "11111111-1111-4111-8111-111111111111", email: "maker@mail.test" };
const OTHER = { id: "22222222-2222-4222-8222-222222222222", email: "other@mail.test" };
const ADMIN = { id: "33333333-3333-4333-8333-333333333333", email: "yymm40@gmail.com" };
const JOB = "44444444-4444-4444-8444-444444444444";
const OUT = "55555555-5555-4555-8555-555555555555";
const UPLOAD = "66666666-6666-4666-8666-666666666666";
const O = "https://www.aljawadai.app";

function seed() {
  mem.n = 0;
  mem.signed = [];
  mem.tables = {
    jawad_jobs: [
      {
        id: JOB,
        user_id: OWNER.id,
        status: "succeeded",
        generator_id: "wan-3-0",
        idempotency_key: "click-123456",
        prompt: "@img1 rides a flying carpet over the dunes, cinematic",
        inputs: { settings: { ratio: "4:3", resolution: "720p", duration: 8, audio: true }, styleId: "football-drift", refStyle: "references" },
        refs: [{ uploadId: UPLOAD, kind: "image", role: "reference", name: "img1" }],
      },
    ],
    jawad_outputs: [{ id: OUT, job_id: JOB, user_id: OWNER.id, kind: "video", idx: 0, storage_path: `${OWNER.id}/jobs/${JOB}/0.mp4`, width: 1280, height: 960 }],
    jawad_gallery: [],
  };
}

const call = async (method: "GET" | "POST", path: string, body?: unknown) => {
  const url = `${O}${path}`;
  const req = new Request(url, { method, ...(body ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}) });
  const p = path.split("?")[0];
  if (p === "/api/jawad/gallery") {
    const m = await import("@/app/api/jawad/gallery/route");
    return method === "GET" ? m.GET(req) : m.POST(req);
  }
  if (p === "/api/jawad/admin/gallery") return (await import("@/app/api/jawad/admin/gallery/route")).POST(req);
  const media = p.match(/^\/api\/jawad\/gallery\/([^/]+)\/media$/);
  if (media) return (await import("@/app/api/jawad/gallery/[id]/media/route")).GET(req, { params: Promise.resolve({ id: media[1] }) });
  const one = p.match(/^\/api\/jawad\/gallery\/([^/]+)$/);
  if (one) return (await import("@/app/api/jawad/gallery/[id]/route")).GET(req, { params: Promise.resolve({ id: one[1] }) });
  throw new Error(path);
};

const use = (over: Partial<GalleryUse> = {}): GalleryUse => ({
  id: "x",
  kind: "video",
  title: "",
  prompt: "@img1 on a carpet",
  generatorId: "wan-3-0",
  settings: { ratio: "4:3", resolution: "720p", duration: 8 },
  styleId: "football-drift",
  refStyle: "references",
  refNames: [{ name: "img1", kind: "image" }],
  ...over,
});

describe("«جرّبه»: the studio form from a gallery work", () => {
  it("opens the work's own generator with its shape, settings, style and prompt", () => {
    const t = buildTryDraft(use(), [{ id: "wan-3-0" }, { id: "kling-4" }])!;
    expect(t).toMatchObject({ generatorId: "wan-3-0", fellBack: false, prompt: "@img1 on a carpet", styleId: "football-drift", refStyle: "references" });
    expect(t.settings).toMatchObject({ ratio: "4:3", resolution: "720p", duration: 8 });
    expect(t.wantNames).toEqual([{ name: "img1", kind: "image" }]);
  });

  it("falls back to an available generator of the same kind (never an editor), at the nearest shape", () => {
    // Wan hidden for this account: Gemini Omni 1.2 has only 16:9 and 9:16 → 4:3 becomes 16:9
    const t = buildTryDraft(use(), [{ id: "openai-gpt-image-2" }, { id: "kling-4-edit" }, { id: "gemini-omni-1-2" }])!;
    expect(t.generatorId).toBe("gemini-omni-1-2");
    expect(t.fellBack).toBe(true);
    expect(t.settings.ratio).toBe("16:9");
    expect(pickTryGenerator("wan-3-0", "video", [{ id: "kling-4-edit" }, { id: "kling-4" }], "references").id).toBe("kling-4");
    // the same id of another kind is not the work's generator
    expect(pickTryGenerator("openai-gpt-image-2", "video", [{ id: "openai-gpt-image-2" }]).id).toBeNull();
    // no generator of that kind at all: nothing to open
    expect(buildTryDraft(use(), [{ id: "openai-gpt-image-2" }])).toBeNull();
    // a picture work on another picture model keeps its shape when that model has it
    const img = buildTryDraft(use({ kind: "image", generatorId: "openai-gpt-image-2", settings: { aspect: "9:16", quality: "high" }, refStyle: "none", refNames: [] }), [{ id: "google-nano-banana-2" }])!;
    expect(img).toMatchObject({ generatorId: "google-nano-banana-2", fellBack: true, refStyle: "none" });
    expect(img.settings.aspect).toBe("9:16");
    expect(img.settings.quality).toBeUndefined();
  });

  it("never carries a reference: the form starts with none, only the prompt's names wait for the visitor's own", () => {
    const t = buildTryDraft(use({ refNames: [{ name: "img1", kind: "image" }, { name: "IMG1", kind: "image" }, { name: "aud1", kind: "audio" }] }), [{ id: "wan-3-0" }])!;
    expect(t.refs).toEqual([]);
    expect(t.wantNames).toEqual([{ name: "img1", kind: "image" }, { name: "aud1", kind: "audio" }]);
    // an unknown style is dropped; a prompt longer than the generator takes is cut there
    const long = buildTryDraft(use({ styleId: "no-such-style", prompt: "x".repeat(9000) }), [{ id: "wan-3-0" }])!;
    expect(long.styleId).toBe("");
    expect(long.prompt.length).toBe(4000);
  });

  it("copies from the job only the names of its references — no upload id, link or voice", () => {
    const u = galleryFromJob({
      generator_id: "openai-gpt-4o-mini-tts",
      prompt: "hello",
      inputs: { settings: { voice: "v:my-own-voice", format: "mp3", secret: "x" } },
      refs: [{ uploadId: UPLOAD, kind: "image", name: "@face", url: "https://files.test/face.png" }, { uploadId: UPLOAD, kind: "pdf", name: "doc" }],
    });
    expect(u.settings).toEqual({ format: "mp3" });
    expect(u.refNames).toEqual([{ name: "face", kind: "image" }]);
    expect(JSON.stringify(u)).not.toContain(UPLOAD);
    expect(JSON.stringify(u)).not.toContain("files.test");
  });

  it("signed out: sign in first, then land in the filled studio", () => {
    expect(tryHref("abc")).toBe("/jawad-ai/images?gallery=abc");
    expect(tryLoginHref("abc")).toBe(`/jawad-ai/login?next=${encodeURIComponent("/jawad-ai/images?gallery=abc")}`);
  });

  it("titles, share names, statuses and the owner's buttons", () => {
    expect(cleanTitle("  قطّ \n رائد‮ فضاء ")).toBe("قطّ رائد فضاء");
    expect(cleanTitle("ب".repeat(200))).toHaveLength(80);
    expect(isShareSlug(newShareSlug())).toBe(true);
    expect(newShareSlug()).not.toBe(newShareSlug());
    expect(publishStatus(null, "a")).toBe("pending");
    expect(publishStatus({ status: "approved", title: "a" }, "a")).toBe("approved");
    expect(publishStatus({ status: "approved", title: "a" }, "b")).toBe("pending");
    expect(publishStatus({ status: "rejected", title: "a" }, "a")).toBe("pending");
    expect(publishStatus({ status: "hidden", title: "a" }, "a")).toBeNull();
    // a work only shared by link never enters the gallery without its person sending it
    expect(reviewPatch("approve", "none", "t", "o")).toBeNull();
    expect(reviewPatch("feature", "none", "t", "o")).toBeNull();
    expect(reviewPatch("approve", "pending", "t", "o")).toMatchObject({ status: "approved" });
    expect(reviewPatch("hide", "approved", "t", "o")).toMatchObject({ status: "hidden", share_on: false, featured: false });
    expect(reviewPatch("unhide", "hidden", "t", "o")).toMatchObject({ status: "none" });
  });

  it("the new uses are counted features of the studio", () => {
    for (const id of ["studio.gallery_publish", "studio.gallery_open", "studio.gallery_try", "studio.share_permanent"]) expect(isFeatureId(id), id).toBe(true);
  });
});

describe("the gallery's routes", () => {
  beforeEach(() => {
    seed();
    who.user = null;
  });

  it("only the work's owner publishes it, and nothing is public before the site's owner approves", async () => {
    expect((await call("POST", "/api/jawad/gallery", { action: "publish", outputId: OUT, title: "بساط" })).status).toBe(401);
    who.user = OTHER;
    expect((await call("POST", "/api/jawad/gallery", { action: "publish", outputId: OUT, title: "سرقة" })).status).toBe(404);
    expect(mem.tables.jawad_gallery).toHaveLength(0);

    who.user = OWNER;
    const r = await call("POST", "/api/jawad/gallery", { action: "publish", outputId: OUT, title: "  بساط  " });
    expect(r.status).toBe(200);
    expect((await r.json()).item).toMatchObject({ status: "pending", title: "بساط", shareUrl: null });
    const row = mem.tables.jawad_gallery[0];
    expect(row).toMatchObject({ user_id: OWNER.id, output_id: OUT, kind: "video", generator_id: "wan-3-0", style_id: "football-drift", ref_style: "references", ref_names: [{ name: "img1", kind: "image" }] });
    // the reference file of the job is never copied
    expect(JSON.stringify(row)).not.toContain(UPLOAD);

    // waiting: not listed, not opened, its file not served to a visitor
    who.user = null;
    expect((await (await call("GET", "/api/jawad/gallery")).json()).items).toEqual([]);
    expect((await call("GET", `/api/jawad/gallery/${row.id}`)).status).toBe(404);
    expect((await call("GET", `/api/jawad/gallery/${row.id}/media`)).status).toBe(404);
    expect(mem.signed).toEqual([]);
  });

  it("only the site's owner approves; then everyone sees it and its one file", async () => {
    who.user = OWNER;
    await call("POST", "/api/jawad/gallery", { action: "publish", outputId: OUT, title: "بساط" });
    const id = mem.tables.jawad_gallery[0].id as string;

    for (const u of [null, OWNER, OTHER]) {
      who.user = u;
      const r = await call("POST", "/api/jawad/admin/gallery", { id, action: "approve" });
      expect(r.status, u?.email ?? "signed out").toBe(u ? 404 : 401);
    }
    expect(mem.tables.jawad_gallery[0].status).toBe("pending");

    expect(isAdmin(ADMIN.email)).toBe(true);
    who.user = ADMIN;
    expect((await call("POST", "/api/jawad/admin/gallery", { id, action: "approve" })).status).toBe(200);
    expect((await call("POST", "/api/jawad/admin/gallery", { id, action: "feature" })).status).toBe(200);

    who.user = null;
    const list = (await (await call("GET", "/api/jawad/gallery?kind=video")).json()) as { ready: boolean; items: Record<string, unknown>[] };
    expect(list.ready).toBe(true);
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ id, featured: true, prompt: "@img1 rides a flying carpet over the dunes, cinematic", mediaUrl: `/api/jawad/gallery/${id}/media` });
    expect(JSON.stringify(list.items[0])).not.toContain(UPLOAD);
    expect(JSON.stringify(list.items[0])).not.toContain("storage_path");
    expect((await (await call("GET", "/api/jawad/gallery?kind=image")).json()).items).toEqual([]);

    const media = await call("GET", `/api/jawad/gallery/${id}/media`);
    expect(media.status).toBe(302);
    expect(media.headers.get("location")).toBe(`https://files.test/${OWNER.id}/jobs/${JOB}/0.mp4?sig=1`);

    // hidden by the owner: gone everywhere
    who.user = ADMIN;
    await call("POST", "/api/jawad/admin/gallery", { id, action: "hide" });
    who.user = null;
    expect((await (await call("GET", "/api/jawad/gallery")).json()).items).toEqual([]);
    expect((await call("GET", `/api/jawad/gallery/${id}/media`)).status).toBe(404);
    // and its person can't send it again
    who.user = OWNER;
    expect((await call("POST", "/api/jawad/gallery", { action: "publish", outputId: OUT })).status).toBe(403);
  });

  it("only the work's owner makes or stops its permanent link; it serves that work alone", async () => {
    who.user = OTHER;
    expect((await call("POST", "/api/jawad/gallery", { action: "share", outputId: OUT, on: true })).status).toBe(404);
    who.user = OWNER;
    const r = await call("POST", "/api/jawad/gallery", { action: "share", outputId: OUT, on: true, title: "بساطي" });
    const item = (await r.json()).item as { shareUrl: string; status: string };
    expect(item.status).toBe("none");
    expect(item.shareUrl).toMatch(/^\/jawad-ai\/w\/[A-Za-z0-9]{12}$/);
    const id = mem.tables.jawad_gallery[0].id as string;

    // shared, not in the gallery: the link's work opens, the gallery stays empty, and the owner can't approve it in
    who.user = null;
    expect((await call("GET", `/api/jawad/gallery/${id}/media`)).status).toBe(302);
    expect((await call("GET", `/api/jawad/gallery/${id}`)).status).toBe(200);
    expect((await (await call("GET", "/api/jawad/gallery")).json()).items).toEqual([]);
    who.user = ADMIN;
    expect((await call("POST", "/api/jawad/admin/gallery", { id, action: "approve" })).status).toBe(400);

    // someone else can't turn it off; its owner can, and the same address comes back when turned on again
    who.user = OTHER;
    expect((await call("POST", "/api/jawad/gallery", { action: "share", outputId: OUT, on: false })).status).toBe(404);
    who.user = OWNER;
    expect((await (await call("POST", "/api/jawad/gallery", { action: "share", outputId: OUT, on: false })).json()).item.shareUrl).toBeNull();
    who.user = null;
    expect((await call("GET", `/api/jawad/gallery/${id}/media`)).status).toBe(404);
    who.user = OWNER;
    expect((await (await call("POST", "/api/jawad/gallery", { action: "share", outputId: OUT, on: true })).json()).item.shareUrl).toBe(item.shareUrl);
  });

  it("before 0112 runs: the lists say not ready and the buttons say so, nothing fails", async () => {
    mem.missing = true;
    try {
      const r = await call("GET", "/api/jawad/gallery");
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ ready: false, items: [], more: false });
      expect((await call("GET", "/api/jawad/gallery/00000000-0000-4000-8000-000000000001")).status).toBe(404);
      who.user = OWNER;
      const p = await call("POST", "/api/jawad/gallery", { action: "publish", outputId: OUT });
      expect(p.status).toBe(503);
      expect(await p.json()).toMatchObject({ notReady: true });
      const { myGallery } = await import("@/lib/jawad/server/gallery");
      expect(await myGallery(OWNER.id, [OUT])).toEqual({ ready: false, items: {} });
    } finally {
      mem.missing = false;
    }
  });
});
