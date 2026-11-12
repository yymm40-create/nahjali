import { beforeEach, describe, expect, it, vi } from "vitest";

// A small in-memory stand-in for the database: only what the review's server code calls.
type Row = Record<string, unknown>;
const state = { ready: true, tables: {} as Record<string, Row[]>, seq: 0 };
function resetDb(ready = true) {
  state.ready = ready;
  state.tables = { editor_reviews: [], editor_review_versions: [], editor_review_comments: [] };
  state.seq = 0;
}
function from(name: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let op: "select" | "update" | "delete" | "insert" = "select";
  let patch: Row = {};
  let inserted: Row[] = [];
  let head = false;
  let single = false;
  let order: { k: string; asc: boolean } | null = null;
  let limit = Infinity;
  const q = {
    select: (_c?: string, o?: { head?: boolean }) => ((head = !!o?.head), q),
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
    in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), q),
    gt: (k: string, v: string) => (filters.push((r) => String(r[k]) > v), q),
    lt: (k: string, v: string) => (filters.push((r) => r[k] != null && String(r[k]) < v), q),
    is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
    order: (k: string, o?: { ascending?: boolean }) => ((order = { k, asc: o?.ascending !== false }), q),
    limit: (n: number) => ((limit = n), q),
    maybeSingle: () => ((single = true), q),
    single: () => ((single = true), q),
    update: (p: Row) => ((op = "update"), (patch = p), q),
    delete: () => ((op = "delete"), q),
    insert: (v: Row | Row[]) => {
      op = "insert";
      inserted = (Array.isArray(v) ? v : [v]).map((r) => ({
        id: name === "editor_review_comments" ? ++state.seq : `${name}-${++state.seq}`,
        created_at: new Date(Date.now() + state.seq).toISOString(),
        parent_id: null,
        resolved_at: null,
        videos_purged_at: null,
        ...r,
      }));
      return q;
    },
    then: (res: (v: unknown) => void) => {
      if (!state.ready) return res({ data: null, error: { message: "relation does not exist" }, count: null });
      const rows = state.tables[name];
      let hit = rows.filter((r) => filters.every((f) => f(r)));
      if (order) {
        const { k, asc } = order;
        hit = [...hit].sort((a, b) => (String(a[k]) < String(b[k]) ? -1 : String(a[k]) > String(b[k]) ? 1 : 0) * (asc ? 1 : -1));
      }
      hit = hit.slice(0, limit);
      if (op === "update") hit.forEach((r) => Object.assign(r, patch));
      if (op === "delete") state.tables[name] = rows.filter((r) => !hit.includes(r));
      if (op === "insert") rows.push(...inserted);
      const data = op === "insert" ? inserted : hit;
      res({ data: head ? null : single ? (data[0] ?? null) : data, error: null, count: data.length });
    },
  };
  return q;
}

const removed: string[] = [];
const deletedUploads: string[] = [];
let nextUpload = { duration_ms: 15_000 as number | null, status: "ready", kind: "video" };

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from }) }));
vi.mock("@/lib/jawad/server/runtime", () => ({ JAWAD_BUCKET: "jawad" }));
vi.mock("@/lib/storage", () => ({
  storage: {
    from: () => ({
      createSignedUrls: async (paths: string[]) => ({ data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${p}`, error: null })), error: null }),
      createSignedUrl: async (p: string) => ({ data: { signedUrl: `https://signed/${p}?dl` }, error: null }),
      remove: async (paths: string[]) => (removed.push(...paths), { data: [], error: null }),
      download: async () => ({ data: new Blob([new Uint8Array(10)]), error: null }),
    }),
  },
}));
vi.mock("@/lib/jawad/server/uploads", () => {
  let n = 0;
  const row = (userId: string) => ({ id: `up-${++n}`, user_id: userId, storage_path: `${userId}/refs/v${n}.mp4`, width: 1080, height: 1920, error: null, ...nextUpload });
  return {
    signUpload: async (userId: string, b: { kind: string; mime: unknown }) => {
      if (b.mime !== "video/mp4") throw new Error("bad type");
      return { id: `up-${++n}`, path: `${userId}/refs/x.mp4`, signedUrl: "https://upload", token: "t" };
    },
    confirmUpload: async (userId: string) => row(userId),
    uploadFromBuffer: async (userId: string) => row(userId),
    deleteUpload: async (_u: string, id: string) => void deletedUploads.push(id),
  };
});

import { applyAll } from "@/lib/editor/commands";
import { emptyTimeline } from "@/lib/editor/model";
import { REVIEW_LIMITS, REVIEW_NOT_READY } from "@/lib/editor/review";
import { addressHash, markSeen, ownerReply, ownerReview, publicPost, publicReview, resolveComment, reviewNoteFor, shareVersion, signReviewUpload, updateReview } from "@/lib/editor/review-server";
import { lib, video } from "./helpers";

const assets = lib(video("a", 5000), video("b", 10_000));
const timeline = applyAll(emptyTimeline("9:16"), [{ type: "add_clip", assetId: "a" }, { type: "add_clip", assetId: "b" }], assets).timeline;
const project = { id: "p1", user_id: "owner", title: "إعلان", version: 7, timeline, export_path: null as string | null, purged_at: null };
const human = { name: "سارة", typedMs: 5000, website: "" };

async function shared() {
  await shareVersion(project, "owner", { uploadId: "x", expiry: "none" });
  const r = state.tables.editor_reviews[0];
  const v = state.tables.editor_review_versions[0];
  return { slug: String(r.slug), versionId: String(v.id) };
}

beforeEach(() => {
  resetDb();
  removed.length = 0;
  deletedUploads.length = 0;
  nextUpload = { duration_ms: 15_000, status: "ready", kind: "video" };
});

describe("review link on the server: before the database file", () => {
  it("reads as not ready and refuses to share, without crashing", async () => {
    resetDb(false);
    expect(await ownerReview(project, "owner")).toMatchObject({ ready: false, review: null });
    await expect(shareVersion(project, "owner", { uploadId: "x" })).rejects.toMatchObject({ message: REVIEW_NOT_READY, status: 503 });
    await expect(signReviewUpload(project, "owner", { mime: "video/mp4", bytes: 1000 })).rejects.toMatchObject({ status: 503 });
    expect(await publicReview("A".repeat(24))).toBeNull();
    expect(await reviewNoteFor("p1", timeline)).toBe("");
  });
});

describe("review link on the server: permissions", () => {
  it("only the owner reads, shares and manages", async () => {
    await shared();
    for (const run of [
      () => ownerReview(project, "member"),
      () => shareVersion(project, "member", { uploadId: "x" }),
      () => signReviewUpload(project, "member", { mime: "video/mp4", bytes: 10 }),
      () => updateReview(project, "member", { active: false }),
      () => ownerReply(project, "member", { parentId: 1, body: "x" }),
      () => resolveComment(project, "member", { id: 1 }),
      () => markSeen(project, "member"),
    ])
      await expect(run()).rejects.toMatchObject({ status: 403 });
  });

  it("the public may comment only while the link is on", async () => {
    const { slug, versionId } = await shared();
    expect(await publicPost(slug, { ...human, versionId, body: "تمام", at: 1000 }, "1.1.1.1")).toEqual({ ok: true, kept: true });
    await updateReview(project, "owner", { active: false });
    await expect(publicPost(slug, { ...human, versionId, body: "ثاني" }, "1.1.1.1")).rejects.toMatchObject({ status: 403 });
    expect(await publicReview(slug)).toMatchObject({ state: "off", versions: [], comments: [] });
    await updateReview(project, "owner", { active: true, expiry: "1" });
    expect(await publicPost(slug, { ...human, versionId, body: "ثالث" }, "1.1.1.1", Date.now() + 2 * 86_400_000).catch((e) => e.status)).toBe(403);
    expect(await publicPost("B".repeat(24), { ...human, versionId, body: "x" }, "1.1.1.1").catch((e) => e.status)).toBe(404);
    expect(await publicPost(slug, { ...human, versionId: "other", body: "x" }, "1.1.1.1").catch((e) => e.status)).toBe(403);
  });

  it("the public sees no address and no project internals", async () => {
    const { slug, versionId } = await shared();
    await publicPost(slug, { ...human, versionId, body: "الصوت عالي", at: 2000, shape: { t: "box", x1: 0.1, y1: 0.1, x2: 0.4, y2: 0.4 } }, "9.9.9.9");
    const stored = state.tables.editor_review_comments[0];
    expect(stored.ip_hash).toBe(addressHash("9.9.9.9"));
    expect(JSON.stringify(stored)).not.toContain("9.9.9.9");
    const page = JSON.stringify(await publicReview(slug));
    expect(page).not.toContain("ip_hash");
    expect(page).not.toContain(addressHash("9.9.9.9"));
    expect(page).not.toContain("anchors");
    expect(page).toContain("https://signed/");
  });
});

describe("review link on the server: input and limits", () => {
  it("cleans what is kept and refuses links", async () => {
    const { slug, versionId } = await shared();
    await publicPost(slug, { ...human, name: "<i>سارة</i>", versionId, body: "<b>كبّر</b> الخط", at: 999_999 }, "1.1.1.1");
    expect(state.tables.editor_review_comments[0]).toMatchObject({ author: "سارة", body: "كبّر الخط", at_ms: 15_000, by_owner: false });
    await expect(publicPost(slug, { ...human, versionId, body: "زوروا https://x.co" }, "1.1.1.1")).rejects.toMatchObject({ status: 400 });
    await expect(publicPost(slug, { ...human, name: "", versionId, body: "x" }, "1.1.1.1")).rejects.toMatchObject({ status: 400 });
  });

  it("a bot gets a quiet ok and nothing is kept; a double press is kept once", async () => {
    const { slug, versionId } = await shared();
    expect(await publicPost(slug, { ...human, website: "spam", versionId, body: "x" }, "1.1.1.1")).toEqual({ ok: true, kept: false });
    expect(await publicPost(slug, { ...human, typedMs: 10, versionId, body: "x" }, "1.1.1.1")).toEqual({ ok: true, kept: false });
    expect(state.tables.editor_review_comments).toHaveLength(0);
    await publicPost(slug, { ...human, versionId, body: "نفس الكلام" }, "1.1.1.1");
    expect(await publicPost(slug, { ...human, versionId, body: "نفس الكلام" }, "1.1.1.1")).toEqual({ ok: true, kept: false });
    expect(state.tables.editor_review_comments).toHaveLength(1);
  });

  it("limits one address per link per hour", async () => {
    const { slug, versionId } = await shared();
    for (let i = 0; i < REVIEW_LIMITS.perAddressHour; i++) await publicPost(slug, { ...human, versionId, body: `تعليق ${i}` }, "2.2.2.2");
    await expect(publicPost(slug, { ...human, versionId, body: "زيادة" }, "2.2.2.2")).rejects.toMatchObject({ status: 429 });
    // another address is not affected
    expect(await publicPost(slug, { ...human, versionId, body: "من غيري" }, "3.3.3.3")).toEqual({ ok: true, kept: true });
  });

  it("approves a version once per name", async () => {
    const { slug, versionId } = await shared();
    expect(await publicPost(slug, { ...human, action: "approve", versionId }, "1.1.1.1")).toEqual({ ok: true, kept: true });
    expect(await publicPost(slug, { ...human, action: "approve", versionId }, "1.1.1.1")).toEqual({ ok: true, kept: false });
    expect(state.tables.editor_review_comments[0]).toMatchObject({ kind: "approve", at_ms: null });
  });
});

describe("review link on the server: versions and the owner's side", () => {
  it("re-sharing the project adds «نسخة ٢» on the same link, comments kept per version", async () => {
    const { slug, versionId } = await shared();
    await publicPost(slug, { ...human, versionId, body: "على الأولى", at: 6000 }, "1.1.1.1");
    const second = await shareVersion(project, "owner", { uploadId: "y" });
    expect(second.n).toBe(2);
    expect(state.tables.editor_reviews).toHaveLength(1);
    const v2 = String(state.tables.editor_review_versions[1].id);
    await publicPost(slug, { ...human, versionId: v2, body: "على الثانية", at: 1000 }, "1.1.1.1");
    const o = await ownerReview(project, "owner");
    expect(o.versions.map((v) => v.n)).toEqual([1, 2]);
    expect(o.comments.map((c) => [c.versionId, c.body])).toEqual([
      [versionId, "على الأولى"],
      [v2, "على الثانية"],
    ]);
    expect(o.versions[0]).toMatchObject({ fit: true });
    expect(o.versions[0].anchors.length).toBe(2);
  });

  it("a video that isn't the project's length carries no clips (its comments stay on its own time)", async () => {
    nextUpload = { duration_ms: 4000, status: "ready", kind: "video" };
    const r = await shareVersion(project, "owner", { uploadId: "x" });
    expect(r.fit).toBe(false);
    expect((await ownerReview(project, "owner")).versions[0]).toMatchObject({ fit: false, anchors: [] });
  });

  it("refuses a file that failed its check", async () => {
    nextUpload = { duration_ms: null, status: "rejected", kind: "video" };
    await expect(shareVersion(project, "owner", { uploadId: "x" })).rejects.toMatchObject({ status: 400 });
    expect(state.tables.editor_reviews).toHaveLength(0);
  });

  it("keeps the newest five versions' videos", async () => {
    for (let i = 0; i < 7; i++) await shareVersion(project, "owner", { uploadId: "x" });
    const vs = state.tables.editor_review_versions;
    expect(vs.filter((v) => v.storage_path).map((v) => v.n)).toEqual([3, 4, 5, 6, 7]);
    expect(deletedUploads).toHaveLength(2);
  });

  it("replies, resolves, counts new comments and feeds حيدرا ماكس the open ones", async () => {
    const { slug, versionId } = await shared();
    await publicPost(slug, { ...human, versionId, body: "الشعار صغير", at: 7000 }, "1.1.1.1");
    await publicPost(slug, { ...human, versionId, body: "اللون باهت", at: 2000 }, "1.1.1.1");
    let o = await ownerReview(project, "owner");
    expect(o.fresh).toBe(2);
    const [first, second] = o.comments;
    await ownerReply(project, "owner", { parentId: first.id, body: "أبشر" });
    await resolveComment(project, "owner", { id: second.id });
    await markSeen(project, "owner", Date.now() + 60_000);
    o = await ownerReview(project, "owner");
    expect(o.fresh).toBe(0);
    expect(o.comments.find((c) => c.byOwner)).toMatchObject({ author: "صاحب الفيديو", parentId: first.id });
    expect(o.comments.find((c) => c.id === second.id)?.resolved).toBe(true);
    const note = await reviewNoteFor("p1", timeline);
    expect(note).toContain("الشعار صغير");
    expect(note).not.toContain("اللون باهت");
    expect(note).toContain("أبشر");
  });
});
