import { beforeEach, describe, expect, it, vi } from "vitest";
import { GENERATORS, generatorById } from "@config/jawad/generators";
import { CAMERA_MOVES, cameraFamily, cameraPhrase, findCameraMove, removeCameraMove, setCameraMove } from "@config/jawad/camera-moves";
import { evaluate } from "@/lib/jawad/engine";
import { COMPARE_MAX, comparePlan, compareRequest, type CompareQuote } from "@/lib/jawad/compare";
import type { FilmItemView, JobView } from "@/lib/jawad/labels";
import {
  cleanFolderName,
  DEFAULT_VIEW,
  folderNameProblem,
  folderProblem,
  isFresh,
  markProblem,
  matchesView,
  matchesWorkSearch,
  MAX_FOLDERS,
  normaliseSearch,
  parseWorksView,
  sortWorks,
  worksQuery,
} from "@/lib/jawad/works-organise";

// «الاستوديو الإبداعي»: «ترتيب أعمالي» (search, sort, folders, ⭐), «🎥 حركة الكاميرا» and «قارن المولّدات».

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const F1 = "33333333-3333-4333-8333-333333333333";
const J1 = "44444444-4444-4444-8444-444444444444";

const job = (over: Partial<JobView> = {}): JobView => ({
  type: "job",
  id: J1,
  createdAt: "2026-11-10T10:00:00.000Z",
  finishedAt: null,
  status: "succeeded",
  providerStatus: null,
  progress: null,
  generatorId: "kling-4",
  generatorName: "Kling 4.0",
  sectionId: "video",
  outputKind: "video",
  mode: "text_to_video",
  prompt: "طفل يركض في المدرسة",
  instructions: "",
  settings: {},
  refStyle: "none",
  refs: [],
  modelPrompt: null,
  diction: [],
  priceCoins: 100,
  charged: true,
  chargeState: "settled",
  error: null,
  cancellable: false,
  outputs: [],
  ...over,
});
const film = (over: Partial<FilmItemView> = {}): FilmItemView => ({ type: "film", id: B, createdAt: "2026-11-09T10:00:00.000Z", kind: "image", url: null, downloadUrl: null, projectId: A, projectTitle: "آخر كيس", refKey: "S1", href: "/x", ...over });

describe("«ترتيب أعمالي»: who may set a folder or ⭐", () => {
  it("only the work's own person, only into their own folder", () => {
    expect(markProblem({ userId: A, item: { ownerId: A } })).toBeNull();
    expect(markProblem({ userId: A, item: { ownerId: A }, folderId: null })).toBeNull();
    expect(markProblem({ userId: A, item: { ownerId: A }, folderId: F1, folder: { ownerId: A } })).toBeNull();
    // someone else's work, or no such work
    expect(markProblem({ userId: A, item: { ownerId: B } })).toMatch(/ما لقينا هذا العمل/);
    expect(markProblem({ userId: A, item: null })).toMatch(/ما لقينا هذا العمل/);
    expect(markProblem({ userId: A, item: { ownerId: null } })).toMatch(/ما لقينا هذا العمل/);
    // someone else's folder, or no such folder
    expect(markProblem({ userId: A, item: { ownerId: A }, folderId: F1, folder: { ownerId: B } })).toMatch(/ما لقينا هذا المجلد/);
    expect(markProblem({ userId: A, item: { ownerId: A }, folderId: F1, folder: null })).toMatch(/ما لقينا هذا المجلد/);
  });

  it("a folder is renamed or deleted by its owner only", () => {
    expect(folderProblem(A, { ownerId: A })).toBeNull();
    expect(folderProblem(A, { ownerId: B })).toMatch(/ما لقينا/);
    expect(folderProblem(A, null)).toMatch(/ما لقينا/);
  });

  it("folder names: cleaned, 1–40 letters, one of each name, at most 50 folders", () => {
    expect(cleanFolderName("  إعلان   العيد \n")).toBe("إعلان العيد");
    expect(cleanFolderName("   ")).toBeNull();
    expect(cleanFolderName(42)).toBeNull();
    expect(cleanFolderName("ا".repeat(41))).toBeNull();
    expect(cleanFolderName("ا".repeat(40))).toBe("ا".repeat(40));
    const mine = [{ id: F1, name: "إعلان العيد" }];
    expect(folderNameProblem("اعلان العيد", mine)).toMatch(/عندك مجلد/);
    expect(folderNameProblem("ريلز", mine)).toBeNull();
    // renaming a folder to (a form of) its own name is fine
    expect(folderNameProblem("اعلان العيد", mine, F1)).toBeNull();
    expect(folderNameProblem(null, mine)).toMatch(/اسم المجلد/);
    const full = Array.from({ length: MAX_FOLDERS }, (_, i) => ({ id: `f${i}`, name: `م${i}` }));
    expect(folderNameProblem("جديد", full)).toMatch(/حد المجلدات/);
    expect(folderNameProblem("جديد", full, "f3")).toBeNull();
  });
});

describe("«ترتيب أعمالي»: the server side of a mark", () => {
  const state = vi.hoisted(() => ({ folders: [] as { id: string; user_id: string; name: string; created_at: string }[], jobOwner: null as string | null, upserts: [] as unknown[] }));
  vi.mock("@/lib/supabase/admin", () => {
    const result = (table: string, op: string) => {
      if (table === "jawad_work_folders") return { data: state.folders, error: null };
      if (table === "jawad_jobs") return { data: state.jobOwner ? { user_id: state.jobOwner } : null, error: null };
      if (table === "jawad_work_marks" && op === "upsert") return { data: { folder_id: F1, favourite: true }, error: null };
      return { data: null, error: null };
    };
    const builder = (table: string) => {
      let op = "select";
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "in", "or", "is", "limit", "delete", "update", "insert"]) b[m] = () => b;
      b.upsert = (row: unknown) => ((op = "upsert"), state.upserts.push(row), b);
      b.single = async () => result(table, op);
      b.maybeSingle = async () => result(table, op);
      b.then = (ok: (v: unknown) => unknown) => Promise.resolve(result(table, op)).then(ok);
      return b;
    };
    return { createAdminClient: () => ({ from: builder }) };
  });
  beforeEach(() => {
    state.folders = [{ id: F1, user_id: A, name: "ريلز", created_at: "2026-11-01T00:00:00Z" }];
    state.jobOwner = A;
    state.upserts = [];
  });

  it("refuses another person's work, a page-only job and an unknown folder; saves the person's own", async () => {
    const { setMark } = await import("@/lib/jawad/server/works-organise");
    await expect(setMark(A, { type: "job", id: "temp-123", favourite: true })).rejects.toMatchObject({ status: 404 });
    await expect(setMark(A, { type: "job", id: J1, folderId: B })).rejects.toThrow(/ما لقينا هذا المجلد/);
    state.jobOwner = B;
    await expect(setMark(A, { type: "job", id: J1, favourite: true })).rejects.toThrow(/ما لقينا هذا العمل/);
    expect(state.upserts).toEqual([]);
    state.jobOwner = A;
    await expect(setMark(A, { type: "job", id: J1, folderId: F1, favourite: true })).resolves.toEqual({ folderId: F1, favourite: true });
    expect(state.upserts).toHaveLength(1);
    expect(state.upserts[0]).toMatchObject({ user_id: A, item_type: "job", item_id: J1, folder_id: F1, favourite: true });
  });

  it("only the field asked for is sent (the other stays as it was)", async () => {
    const { setMark } = await import("@/lib/jawad/server/works-organise");
    await setMark(A, { type: "job", id: J1, favourite: true });
    expect(state.upserts[0]).not.toHaveProperty("folder_id");
    await expect(setMark(A, { type: "job", id: J1 })).rejects.toMatchObject({ status: 400 });
  });
});

describe("«ترتيب أعمالي»: search and sort", () => {
  it("finds every word in the prompt or the generator, whatever the Arabic letter forms", () => {
    expect(normaliseSearch("المدرسة  أُمّي إلى")).toBe("المدرسه امي الي");
    expect(matchesWorkSearch(job(), "")).toBe(true);
    expect(matchesWorkSearch(job(), "مدرسه")).toBe(true);
    expect(matchesWorkSearch(job(), "طفل المدرسة")).toBe(true);
    expect(matchesWorkSearch(job(), "kling")).toBe(true);
    expect(matchesWorkSearch(job(), "KLING طفل")).toBe(true);
    expect(matchesWorkSearch(job(), "seedance")).toBe(false);
    expect(matchesWorkSearch(job(), "طفل سيارة")).toBe(false);
    // a hidden prompt (someone else's cartoon recipe) never matches
    expect(matchesWorkSearch(job({ prompt: "" }), "طفل")).toBe(false);
    // a film work: its project's name
    expect(matchesWorkSearch(film(), "كيس")).toBe(true);
    expect(matchesWorkSearch(film(), "الفيلم")).toBe(true);
    expect(matchesWorkSearch(film(), "طفل")).toBe(false);
  });

  it("folders and ⭐ only narrow the list once they are on; a job being made always shows", () => {
    const inFolder = job({ folderId: F1, favourite: true });
    const loose = job({ id: B, folderId: null, favourite: false });
    const v = { ...DEFAULT_VIEW, folder: F1 };
    expect(matchesView(inFolder, v, true)).toBe(true);
    expect(matchesView(loose, v, true)).toBe(false);
    expect(matchesView(loose, { ...DEFAULT_VIEW, fav: true }, true)).toBe(false);
    expect(matchesView(loose, v, false)).toBe(true);
    expect(isFresh(job({ id: "temp-1" }))).toBe(true);
    expect(isFresh(job({ status: "running" }))).toBe(true);
    expect(isFresh(job())).toBe(false);
    expect(isFresh(film())).toBe(false);
  });

  it("sorts newest or oldest first, and the view goes to the server and back unchanged", () => {
    const list = [{ createdAt: "2026-11-02" }, { createdAt: "2026-11-03" }, { createdAt: "2026-11-01" }];
    expect(sortWorks(list, "new").map((x) => x.createdAt)).toEqual(["2026-11-03", "2026-11-02", "2026-11-01"]);
    expect(sortWorks(list, "old").map((x) => x.createdAt)).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
    expect(worksQuery(DEFAULT_VIEW)).toBe("");
    const v = { q: "طفل المدرسة", sort: "old" as const, folder: F1, fav: true };
    expect(parseWorksView(new URLSearchParams(worksQuery(v).slice(1)))).toEqual(v);
    expect(parseWorksView(new URLSearchParams("folder=../x&sort=zzz&fav=yes"))).toEqual(DEFAULT_VIEW);
  });
});

describe("«🎥 حركة الكاميرا»", () => {
  const VIDEO = GENERATORS.filter((g) => g.output === "video");

  it("about sixteen moves, each with an Arabic name and hint, distinct ids and terms", () => {
    expect(CAMERA_MOVES.length).toBeGreaterThanOrEqual(16);
    expect(new Set(CAMERA_MOVES.map((m) => m.id)).size).toBe(CAMERA_MOVES.length);
    expect(new Set(CAMERA_MOVES.map((m) => m.term)).size).toBe(CAMERA_MOVES.length);
    for (const m of CAMERA_MOVES) {
      expect(m.ar, m.id).toMatch(/[؀-ۿ]/);
      expect(m.hint, m.id).toMatch(/[؀-ۿ]/);
      expect(m.zh, m.id).toMatch(/[一-鿿]/);
    }
    for (const id of ["push_in", "pull_out", "orbit", "crane_up", "crane_down", "dolly_left", "dolly_right", "tracking", "handheld", "crash_zoom", "dolly_zoom", "fpv", "bullet_time", "top_down", "tilt_up", "whip_pan", "static"]) {
      expect(CAMERA_MOVES.some((m) => m.id === id), id).toBe(true);
    }
  });

  it("every video generator gets the phrase in its own form, in English (Seedance with the Chinese term)", () => {
    expect(VIDEO.map((g) => cameraFamily(g.id)).filter((f) => f === "other")).toEqual([]);
    const m = CAMERA_MOVES.find((x) => x.id === "push_in")!;
    expect(cameraPhrase(m, "byteplus-seedance-2-5")).toBe("Camera: slow push-in (推镜头) — the camera glides steadily forward toward the subject.");
    expect(cameraPhrase(m, "seedance-real-face")).toContain("(推镜头)");
    expect(cameraPhrase(m, "kling-4")).toBe("Camera movement: The camera glides steadily forward toward the subject.");
    expect(cameraPhrase(m, "wan-3-0")).toBe("Slow push-in shot, the camera glides steadily forward toward the subject.");
    expect(cameraPhrase(m, "gemini-omni-1-2")).toBe("Camera motion: slow push-in, the camera glides steadily forward toward the subject.");
    for (const g of VIDEO) {
      for (const move of CAMERA_MOVES) {
        const p = cameraPhrase(move, g.id);
        expect(p, `${g.id} ${move.id}`).not.toMatch(/[؀-ۿ]/);
        if (cameraFamily(g.id) !== "seedance") expect(p, `${g.id} ${move.id}`).not.toMatch(/[一-鿿]/);
        expect(findCameraMove(`مشهد\n${p}`)?.move.id, `${g.id} ${move.id}`).toBe(move.id);
      }
    }
  });

  it("one move at a time, added at the end, removable, rewritten for another generator", () => {
    const [a, b] = [CAMERA_MOVES[0], CAMERA_MOVES[2]];
    const one = setCameraMove("طفل يركض", a, "kling-4");
    expect(one).toBe(`طفل يركض\n${cameraPhrase(a, "kling-4")}`);
    const two = setCameraMove(one, b, "kling-4");
    expect(two).toBe(`طفل يركض\n${cameraPhrase(b, "kling-4")}`);
    expect(findCameraMove(two)?.move.id).toBe(b.id);
    expect(removeCameraMove(two)).toBe("طفل يركض");
    expect(setCameraMove("", a, "wan-3-0")).toBe(cameraPhrase(a, "wan-3-0"));
    const moved = setCameraMove(two, b, "byteplus-seedance-2-0");
    expect(moved).toBe(`طفل يركض\n${cameraPhrase(b, "byteplus-seedance-2-0")}`);
    expect(removeCameraMove("بلا حركة")).toBe("بلا حركة");
  });
});

describe("«قارن المولّدات»", () => {
  const q = (id: string, coins: number | null, output: CompareQuote["output"] = "video"): CompareQuote => ({ id, name: id, output, coins, reason: coins == null ? "ما يقبل هالمرجع." : null });

  it("the total before confirming is the sum of each generator's own price", () => {
    const table = (id: string) => Object.fromEntries(generatorById(id)!.priceKeys.map((k) => [k.key, k.defaultCenti ?? 1000]));
    const ids = ["kling-3-pro", "wan-3-0", "byteplus-seedance-2-5"];
    const quotes = ids.map((id) => {
      const def = generatorById(id)!;
      const req = compareRequest(def, { settings: { ratio: "9:16", duration: 8 }, refStyle: "none", refs: [] });
      const ev = evaluate(def, { settings: req.settings, prompt: "a boy runs to school", instructions: "", refStyle: req.refStyle, refs: [] }, table(id));
      expect(ev.price.ok, id).toBe(true);
      return q(id, ev.price.ok ? ev.price.coins : null);
    });
    const plan = comparePlan("video", quotes);
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.total).toBe(quotes.reduce((t, x) => t + x.coins!, 0));
    expect(comparePlan("image", [q("a", 120, "image"), q("b", 35, "image")])).toEqual({ ok: true, items: [q("a", 120, "image"), q("b", 35, "image")], total: 155 });
  });

  it("refuses mixed kinds, fewer than two, more than four, repeats and an unpriced generator", () => {
    expect(comparePlan("video", [q("kling-4", 100), q("openai-gpt-image-2", 20, "image")])).toMatchObject({ ok: false, error: expect.stringMatching(/فيديو بس/) });
    expect(comparePlan("video", [q("kling-4", 100)])).toMatchObject({ ok: false });
    expect(comparePlan("video", Array.from({ length: COMPARE_MAX + 1 }, (_, i) => q(`g${i}`, 10)))).toMatchObject({ ok: false });
    expect(comparePlan("video", [q("kling-4", 100), q("kling-4", 100)])).toMatchObject({ ok: false });
    expect(comparePlan("video", [q("kling-4", 100), q("wan-3-0", null)])).toMatchObject({ ok: false, error: expect.stringMatching(/wan-3-0/) });
  });

  it("each generator gets the person's settings as far as it has them, and frames only where it takes them", () => {
    const kling = generatorById("kling-3-pro")!;
    const r = compareRequest(kling, { settings: { ratio: "9:16", duration: 40, nonsense: true }, refStyle: "references", refs: [{ kind: "image", role: "reference" as const }] });
    expect(r.settings.ratio).toBe("9:16");
    expect(r.settings.duration).toBe(15);
    expect(r.settings).not.toHaveProperty("nonsense");
    // Kling 3.0 has no «مراجع»: its first way with references (frames) is taken, the picture becomes the first frame
    expect(r.refStyle).toBe("frames");
    expect(r.refs[0].role).toBe("first_frame");
    const wan = generatorById("wan-3-0")!;
    const w = compareRequest(wan, { settings: {}, refStyle: "frames", refs: [{ kind: "image", role: "first_frame" as const }, { kind: "image", role: "last_frame" as const }] });
    expect(w.refStyle).toBe("frames");
    expect(w.refs.map((x) => x.role)).toEqual(["first_frame", "last_frame"]);
  });
});
