import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ submit: vi.fn(async () => "req1"), task: vi.fn(async () => ({ status: "succeeded", videoUrl: "https://v/x.mp4", error: null, moderated: false })) }));
vi.mock("@/lib/jawad/server/providers/realface", () => ({ realFaceSubmit: mocks.submit, realFaceTask: mocks.task }));
import { createVideoTask, getVideoTask } from "@/lib/film/seedance";
import { VIDEO_MODELS, videoEstimateUsd } from "@config/film";

describe("«Seedance وجه واقعي» in the film maker", () => {
  it("is a third model, offered for realistic scenes and much dearer", () => {
    expect(VIDEO_MODELS["seedance-real-face"].maxSeconds).toBe(30);
    for (const q of ["480p", "720p", "1080p"] as const) expect(videoEstimateUsd("seedance-real-face", q, 10)).toBeGreaterThan(1.8 * videoEstimateUsd("seedance-2.5", q, 10));
  });
  it("goes to its own provider with the references named its way, and is followed there", async () => {
    const id = await createVideoTask({ model: "seedance-real-face", prompt: "<<<image_1>>> walks to <<<image_2>>>", imageUrls: ["a", "b"], audioUrls: ["c"], durationSec: 12, resolution: "720p", ratio: "9:16", generateAudio: true });
    expect(id).toBe("rf:req1");
    expect(mocks.submit).toHaveBeenCalledWith("bytedance/seedance-2.5/reference-to-video", expect.objectContaining({ prompt: "@image1 walks to @image2", image_urls: ["a", "b"], audio_urls: ["c"], duration: 12, resolution: "720p", aspect_ratio: "9:16" }), expect.any(String));
    expect(await getVideoTask(id)).toMatchObject({ status: "succeeded", videoUrl: "https://v/x.mp4", tokens: null });
    expect(mocks.task).toHaveBeenCalledWith("req1");
  });
});

describe("«Seedance وجه واقعي» sent to JAWAD's video section", () => {
  it("stays «وجه واقعي» there and back (never turned into plain Seedance 2.5)", async () => {
    const { generatorOfFilmModel, filmModelOfGenerator } = await import("@/lib/film/studio-models");
    const { generatorById } = await import("@config/jawad/generators");
    expect(generatorOfFilmModel("seedance-real-face")).toBe("seedance-real-face");
    expect(generatorById(generatorOfFilmModel("seedance-real-face"))).toBeTruthy();
    expect(filmModelOfGenerator("seedance-real-face")).toBe("seedance-real-face");
    for (const m of ["seedance-2.0", "seedance-2.5"] as const) expect(filmModelOfGenerator(generatorOfFilmModel(m))).toBe(m);
  });
});
