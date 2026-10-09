import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserError } from "@/lib/api";

// The desk of جواد end to end with the job system replaced: how Baqir's request becomes a JAWAD AI job (perm «content»),
// the price discovery, the settings kept to the registry, and the way each failure is told.
const jobs = vi.hoisted(() => ({
  calls: [] as { body: Record<string, unknown>; server: Record<string, unknown> }[],
  script: [] as unknown[],
}));
vi.mock("@/lib/jawad/server/jobs", () => ({
  createJob: vi.fn(async (_u: unknown, _o: boolean, body: Record<string, unknown>, _origin: string, server: Record<string, unknown>) => {
    jobs.calls.push({ body, server });
    const step = jobs.script.shift();
    if (step instanceof Error) throw step;
    return step ?? { kind: "created", job: { id: "job-1", price_coins: 5, charge_state: "none", inputs: { settings: body.settings }, status: "queued" } };
  }),
  runJob: vi.fn(async () => undefined),
  loadJob: vi.fn(async () => null),
  advanceJob: vi.fn(async () => undefined),
}));
vi.mock("@/lib/jawad/server/runtime", async () => {
  const { GENERATORS } = await import("@config/jawad/generators");
  return { JAWAD_BUCKET: "jawad", loadRuntime: vi.fn(async () => ({ migrated: true, generators: GENERATORS.map((g) => ({ id: g.id, sectionId: "images", live: true })) })) };
});
vi.mock("@/lib/jawad/server/uploads", () => ({ uploadFromBuffer: vi.fn(async () => ({ id: "up-1" })) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/storage", () => ({ storage: { from: () => ({}) } }));

import { deskSettings, deskVideo, DeskError, isTransientText, DESK_GENERATOR } from "@/lib/content/jawad";
import { generatorById } from "@config/jawad/generators";

const who = { id: "u1", email: "a@b.c", owner: true, origin: "https://x.test" };
const base = { key: "k-12345678", prompt: "a calm sea", aspect: "9:16" };

beforeEach(() => {
  jobs.calls.length = 0;
  jobs.script.length = 0;
});

describe("the settings جواد sets from a request", () => {
  it("keeps a picture to GPT Image 2's own options, high quality by default", () => {
    const def = generatorById(DESK_GENERATOR.image)!;
    expect(deskSettings(def, { ...base, kind: "image", aspect: "16:9" })).toEqual({ aspect: "16:9", resolution: "std", quality: "high", count: 1 });
    expect(deskSettings(def, { ...base, kind: "image", aspect: "21:9", resolution: "8k", quality: "x" })).toMatchObject({ aspect: "1:1", resolution: "std", quality: "high" });
  });
  it("clamps a video to 4–15 seconds and to the registry's sizes", () => {
    const def = generatorById(DESK_GENERATOR.video)!;
    expect(deskSettings(def, { ...base, kind: "video", seconds: 99 })).toMatchObject({ duration: 15, ratio: "9:16", resolution: "720p", audio: true });
    expect(deskSettings(def, { ...base, kind: "video", seconds: 1, resolution: "480p", withSound: false })).toMatchObject({ duration: 4, resolution: "480p", audio: false });
  });
});

describe("handing a request to جواد", () => {
  it("asks the price first, then makes the job at that price, as the «content» door", async () => {
    jobs.script.push({ kind: "price_changed", coins: 40 });
    const r = await deskVideo(who, { ...base, kind: "video", seconds: 6 });
    expect(r).toMatchObject({ jobId: "job-1", generatorId: "byteplus-seedance-2-5" });
    expect(jobs.calls.map((c) => c.body.expectedCoins)).toEqual([-1, 40]);
    expect(jobs.calls.every((c) => c.server.via === "content")).toBe(true);
    expect(jobs.calls[0].body.prompt).toBe("a calm sea");
  });
  it("tells a refusal plainly and marks only a busy one as worth another try", async () => {
    jobs.script.push(new UserError("المنصة مشغولة", 429));
    await expect(deskVideo(who, { ...base, kind: "video" })).rejects.toMatchObject({ transient: true });
    jobs.script.push({ kind: "issues", issues: [{ field: "prompt", message: "الوصف قصير" }] });
    await expect(deskVideo(who, { ...base, kind: "video" })).rejects.toMatchObject({ reason: "الوصف قصير", transient: false });
    await expect(deskVideo(who, { ...base, kind: "video", key: "x" })).rejects.toBeInstanceOf(DeskError);
    await expect(deskVideo(who, { ...base, kind: "video", prompt: "  " })).rejects.toBeInstanceOf(DeskError);
  });
  it("knows a moment's refusal from a policy one", () => {
    expect(isTransientText("429 rate_limit")).toBe(true);
    expect(isTransientText("503 server error")).toBe(true);
    expect(isTransientText("400 content_policy_violation")).toBe(false);
  });
});
