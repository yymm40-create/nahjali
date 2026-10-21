import { beforeEach, describe, expect, it, vi } from "vitest";
import { cartoonInput, CARTOON_IMAGE, CARTOON_VIDEO } from "@config/jawad/cartoon";
const mocks = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[], outputs: [] as Record<string, unknown>[],
  create: vi.fn(), upload: vi.fn(), free: vi.fn(), buffer: vi.fn(), sheet: vi.fn(),
}));
vi.mock("@/lib/access", () => ({ unlimitedFor: mocks.free }));
vi.mock("@/lib/jawad/server/jobs", () => ({ createJob: mocks.create }));
vi.mock("@/lib/jawad/server/uploads", () => ({ uploadFromOutput: mocks.upload, uploadFromBuffer: mocks.buffer }));
vi.mock("@/lib/jawad/server/cartoon-pictures", () => ({ placeSheetBytes: mocks.sheet }));
vi.mock("@/lib/jawad/server/runtime", () => ({ loadRuntime: async () => ({ generators: [{ id: "openai-gpt-image-2", sectionId: "images" }, { id: "byteplus-seedance-2-0", sectionId: "video" }] }) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { getUserById: async () => ({ data: { user: { id: "u1", email: "person@example.com" } } }) } },
    from: (table: string) => {
      const filters: [string, unknown][] = [];
      const query = {
        select: () => query, eq: (field: string, value: unknown) => { filters.push([field, value]); return query; },
        order: () => query, limit: () => query,
        maybeSingle: async () => ({ data: (table === "jawad_outputs" ? mocks.outputs : mocks.rows).find(row => filters.every(([field, value]) => row[field] === value)) ?? null }),
        single: async () => query.maybeSingle(),
      };
      return query;
    },
  }),
}));
import { continueCartoon, filmSource } from "@/lib/jawad/server/cartoon";
const input = cartoonInput({ style: "stylistic-drift", age: "child", movement: "walk", story: "garden", count: 2, video: true, consent: true });
function row(id: string, position: number, status = "succeeded", plan = input) {
  return { id, user_id: "u1", status, idempotency_key: "cartoon_test_" + position, generator_id: CARTOON_IMAGE, inputs: { origin: "https://example.com", cartoon: { key: "cartoon_test", input: plan, position, videoCoins: 4000, expiresAt: Date.now() + 60000 } } };
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.rows = [row("root", 0)]; mocks.outputs = [{ id: "canonical", user_id: "u1", job_id: "root", kind: "image" }];
  mocks.upload.mockResolvedValue({ id: "upload1" }); mocks.free.mockResolvedValue(false);
  mocks.sheet.mockResolvedValue(null); mocks.buffer.mockResolvedValue({ id: "place1" });
  mocks.create.mockResolvedValue({ kind: "created", job: { id: "next" }, balance: 5000 });
});
describe("cartoon continuation", () => {
  it("uses the original canonical image and the server-owned two-riyal price", async () => {
    await continueCartoon("root");
    expect(mocks.upload).toHaveBeenCalledWith("u1", "canonical");
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }), false,
      expect.objectContaining({ idempotencyKey: "cartoon_test_1", generatorId: CARTOON_IMAGE, expectedCoins: 200, settings: { aspect: "9:16", quality: "medium", resolution: "std", count: 1 } }),
      "https://example.com", expect.objectContaining({ cartoon: expect.objectContaining({ position: 1 }) }));
  });
  it("does not repeat a step that already exists, even if it failed", async () => {
    mocks.rows.push(row("next", 1, "failed"));
    await continueCartoon("root");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("never advances failed or incomplete work", async () => {
    for (const status of ["failed", "running", "cancelled"]) { mocks.rows = [row("root", 0, status)]; await continueCartoon("root"); }
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("makes the film from the root character, with the previously confirmed video price", async () => {
    mocks.rows.push(row("second", 1));
    await continueCartoon("second");
    expect(mocks.upload).toHaveBeenCalledWith("u1", "canonical");
    expect(mocks.create.mock.calls[0][2]).toMatchObject({ generatorId: CARTOON_VIDEO, expectedCoins: 4000, settings: { duration: 15, resolution: "480p" } });
  });
  it("stops at the final stage", async () => {
    mocks.rows.push(row("film", 2)); await continueCartoon("film");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("refuses expired consent and changed prices", async () => {
    const root = mocks.rows[0] as ReturnType<typeof row>;
    root.inputs.cartoon.expiresAt = Date.now() - 1;
    await expect(continueCartoon("root")).rejects.toThrow("صلاحية");
    expect(mocks.create).not.toHaveBeenCalled();
    root.inputs.cartoon.expiresAt = Date.now() + 60000;
    mocks.create.mockResolvedValue({ kind: "price_changed" });
    await expect(continueCartoon("root")).rejects.toThrow("تغيّر السعر");
  });
  it("films each 15-second part in turn at the same price, with the place's sheet when it is drawn", async () => {
    const story = cartoonInput({ style: "stylistic-drift", age: "child", movement: "walk", story: "custom", place: "house", scenes: ["plays with blocks", "builds a tower"], count: 1, video: true, consent: true });
    mocks.rows = [row("root", 0, "succeeded", story)];
    mocks.sheet.mockResolvedValue(new Uint8Array([1, 2, 3]));
    await continueCartoon("root");
    expect(mocks.sheet).toHaveBeenCalledWith("house", "stylistic-drift");
    expect(mocks.create.mock.calls[0][2]).toMatchObject({ idempotencyKey: "cartoon_test_1", generatorId: CARTOON_VIDEO, expectedCoins: 4000, refs: [{ uploadId: "upload1", name: "character" }, { uploadId: "place1", name: "place" }] });
    expect(mocks.create.mock.calls[0][2].prompt).toContain("part 1 of 2");
    mocks.rows.push(row("part1", 1, "succeeded", story));
    mocks.sheet.mockResolvedValue(null);
    await continueCartoon("part1");
    expect(mocks.create.mock.calls[1][2]).toMatchObject({ idempotencyKey: "cartoon_test_2", generatorId: CARTOON_VIDEO, expectedCoins: 4000, refs: [{ uploadId: "upload1", name: "character" }] });
    expect(mocks.create.mock.calls[1][2].prompt).toContain("part 2 of 2");
    expect(mocks.create.mock.calls[1][2].prompt).not.toContain("@place");
    mocks.rows.push(row("part2", 2, "succeeded", story));
    await continueCartoon("part2");
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });
  it("makes a film AFTER the picture, from the chosen picture of any run, shown with that run", async () => {
    mocks.outputs.push({ id: "pic2", user_id: "u1", job_id: "root", kind: "image" });
    await expect(filmSource("u1", "pic2", { place: "garden", scenes: [] })).rejects.toThrow("١٥");
    const { input: film, parent, outputId } = await filmSource("u1", "pic2", { place: "playground", scenes: ["kicks a ball", "scores a goal"] });
    expect(parent).toBe("cartoon_test");
    expect(outputId).toBe("pic2");
    expect(film).toMatchObject({ count: 0, video: true, place: "playground", style: "stylistic-drift" });
    expect(film.scenes).toHaveLength(2);
    // part 2 follows part 1, made from the same chosen picture
    mocks.rows = [{ id: "film0", user_id: "u1", status: "succeeded", idempotency_key: "cartoon_film_x_0", generator_id: CARTOON_VIDEO, inputs: { origin: "https://example.com", cartoon: { key: "cartoon_film_x", parent, source: outputId, input: film, position: 0, videoCoins: 4000, expiresAt: Date.now() + 60000 } } }];
    await continueCartoon("film0");
    expect(mocks.upload).toHaveBeenCalledWith("u1", "pic2");
    expect(mocks.create.mock.calls[0][2]).toMatchObject({ idempotencyKey: "cartoon_film_x_1", generatorId: CARTOON_VIDEO, expectedCoins: 4000 });
    expect(mocks.create.mock.calls[0][2].prompt).toContain("part 2 of 2");
    expect(mocks.create.mock.calls[0][4].cartoon).toMatchObject({ parent: "cartoon_test", source: "pic2", position: 1 });
  });
});
